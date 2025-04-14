import os
import json
import stomp
import time
import threading
import logging
from typing import Callable, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler("transaction-service.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Load environment variables
BROKER_HOST = os.getenv("ACTIVEMQ_BROKER", "shared-activemq")
BROKER_PORT = int(os.getenv("ACTIVEMQ_BROKER_PORT", "61616"))
USERNAME = os.getenv("ACTIVEMQ_USERNAME", "admin")
PASSWORD = os.getenv("ACTIVEMQ_PASSWORD", "admin")

# Message broker configuration
class MessageListener(stomp.ConnectionListener):
    def __init__(self, callback: Optional[Callable[[str], None]] = None):
        self.callback = callback

    def on_error(self, frame):
        logger.error(f"ActiveMQ error: {frame.body}")

    def on_message(self, frame):
        body = frame.body
        logger.info(f"Received message: {body}")
        if self.callback:
            try:
                self.callback(body)
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}")
        frame.ack()

    def on_disconnected(self):
        logger.warning("Disconnected from ActiveMQ")

    def on_connected(self, frame):
        logger.info("Connected to ActiveMQ")

# Connection manager with reconnect logic
class ActiveMQConnection:
    def __init__(self, host: str, port: int, username: str, password: str):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.conn = None
        self.lock = threading.Lock()

    def connect(self):
        with self.lock:
            if not self.conn or not self.conn.is_connected():
                try:
                    self.conn = stomp.Connection([(self.host, self.port)])
                    self.conn.connect(self.username, self.password, wait=True)
                    logger.info(f"Connected to ActiveMQ at {self.host}:{self.port}")
                except Exception as e:
                    logger.error(f"Failed to connect to ActiveMQ: {str(e)}")
                    raise

    def disconnect(self):
        with self.lock:
            if self.conn and self.conn.is_connected():
                self.conn.disconnect()
                logger.info("Disconnected from ActiveMQ")

    def send_message(self, destination: str, message: str):
        self.connect()
        try:
            self.conn.send(body=message, destination=destination)
            logger.info(f"Sent to {destination}: {message}")
        except Exception as e:
            logger.error(f"Failed to send message to {destination}: {str(e)}")
            self.disconnect()
            raise

    def subscribe(self, destination: str, listener: MessageListener):
        self.connect()
        try:
            self.conn.set_listener("", listener)
            self.conn.subscribe(destination=destination, id=1, ack="client")
            logger.info(f"Subscribed to {destination}")
        except Exception as e:
            logger.error(f"Failed to subscribe to {destination}: {str(e)}")
            self.disconnect()
            raise

# Global connection instance
mq_conn = ActiveMQConnection(BROKER_HOST, BROKER_PORT, USERNAME, PASSWORD)

# Function to send a book purchase event
def send_book_purchase_event(user_id: str, book_id: int, transaction_type: str):
    message = json.dumps({
        "event": "book_purchase",
        "userId": user_id,
        "bookId": book_id,
        "transactionType": transaction_type,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    })
    try:
        mq_conn.send_message("/topic/book-purchases", message)
    except Exception as e:
        logger.error(f"Failed to send book purchase event: {str(e)}")

# Function to subscribe to a topic/queue
def subscribe_to_topic(topic: str, callback: Optional[Callable[[str], None]] = None):
    def run_subscription():
        while True:
            try:
                listener = MessageListener(callback)
                mq_conn.subscribe(topic, listener)
                # Keep connection alive
                while mq_conn.conn and mq_conn.conn.is_connected():
                    time.sleep(1)
            except Exception as e:
                logger.error(f"Subscription error for {topic}: {str(e)}")
                time.sleep(5)  # Wait before reconnecting

    threading.Thread(target=run_subscription, daemon=True).start()

# Example callback for processing book purchase messages
def handle_book_purchase_message(message: str):
    try:
        data = json.loads(message)
        if data.get("event") == "book_purchase":
            logger.info(f"Processed book purchase: userId={data['userId']}, bookId={data['bookId']}")
            # Add logic to update transaction state if needed
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON message: {message}")

# Subscribe to book purchases
subscribe_to_topic("/topic/book-purchases", handle_book_purchase_message)

if __name__ == "__main__":
    logger.info("Transaction service ActiveMQ setup complete")