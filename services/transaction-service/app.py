import logging
import os
import json
import time
import threading
from typing import Optional, Callable
import stomp
from flask import Flask, request, jsonify
from db import get_db_connection
from queue import Queue

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('transactions.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ActiveMQ configuration
BROKER_HOST = os.getenv("ACTIVEMQ_BROKER", "shared-activemq")
BROKER_PORT = int(os.getenv("ACTIVEMQ_BROKER_PORT", "61616"))
USERNAME = os.getenv("ACTIVEMQ_USERNAME", "admin")
PASSWORD = os.getenv("ACTIVEMQ_PASSWORD", "admin")
CONNECTION_TIMEOUT = 5  # Seconds
MAX_RECONNECT_ATTEMPTS = 3

# Message queue for async sending
message_queue = Queue()

# ActiveMQ Connection Manager
class ActiveMQConnection:
    def __init__(self, host: str, port: int, username: str, password: str, timeout: int):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.timeout = timeout
        self.conn = None
        self.lock = threading.Lock()
        self.is_enabled = True

    def connect(self):
        if not self.is_enabled:
            logger.warning("ActiveMQ connection disabled")
            raise Exception("ActiveMQ connection disabled")
        with self.lock:
            if not self.conn or not self.conn.is_connected():
                try:
                    self.conn = stomp.Connection(
                        [(self.host, self.port)],
                        timeout=self.timeout,
                        heartbeats=(10000, 10000),
                        vhost=None
                    )
                    self.conn.set_listener('', ConnectionListener())
                    self.conn.connect(
                        self.username,
                        self.password,
                        wait=True,
                        headers={'client-id': 'transaction-service'}
                    )
                    logger.info(f"Connected to ActiveMQ at {self.host}:{self.port}")
                except Exception as e:
                    logger.error(f"Failed to connect to ActiveMQ at {self.host}:{self.port}: {str(e)}")
                    raise

    def disconnect(self):
        with self.lock:
            if self.conn and self.conn.is_connected():
                try:
                    self.conn.disconnect()
                    logger.info("Disconnected from ActiveMQ")
                except Exception as e:
                    logger.error(f"Failed to disconnect from ActiveMQ: {str(e)}")
                finally:
                    self.conn = None

    def send_message(self, destination: str, message: str):
        try:
            self.connect()
            self.conn.send(
                body=message,
                destination=destination,
                headers={'persistent': 'true'}
            )
            logger.info(f"Sent to {destination}: {message}")
        except Exception as e:
            logger.error(f"Failed to send message to {destination}: {str(e)}")
            self.disconnect()
            raise
        finally:
            self.disconnect()

    def subscribe(self, destination: str, listener: 'MessageListener'):
        try:
            self.connect()
            self.conn.set_listener("msg_listener", listener)
            self.conn.subscribe(
                destination=destination,
                id='transaction-service-sub-1',
                ack='client-individual',
                headers={'activemq.prefetchSize': '1'}
            )
            logger.info(f"Subscribed to {destination}")
        except Exception as e:
            logger.error(f"Failed to subscribe to {destination}: {str(e)}")
            self.disconnect()
            raise

    def disable(self):
        self.is_enabled = False
        self.disconnect()
        logger.warning("ActiveMQ connection disabled due to repeated failures")

# Connection Listener
class ConnectionListener(stomp.ConnectionListener):
    def on_connected(self, frame):
        logger.info(f"ActiveMQ connected: {frame.headers}")

    def on_disconnected(self):
        logger.warning("Disconnected from ActiveMQ")

    def on_error(self, frame):
        logger.error(f"ActiveMQ error: {frame.body}")

    def on_heartbeat_timeout(self):
        logger.error("ActiveMQ heartbeat timeout")

# Message Listener
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
        try:
            self.ack(frame)
        except Exception as e:
            logger.error(f"Failed to ack message: {str(e)}")

    def on_disconnected(self):
        logger.warning("Disconnected from ActiveMQ")

    def on_connected(self, frame):
        logger.info(f"Message listener connected: {frame.headers}")

# Global ActiveMQ connection
mq_conn = ActiveMQConnection(BROKER_HOST, BROKER_PORT, USERNAME, PASSWORD, CONNECTION_TIMEOUT)

# Background message sender
def message_sender():
    while True:
        destination, message = message_queue.get()
        attempts = 0
        while attempts < MAX_RECONNECT_ATTEMPTS:
            try:
                mq_conn.send_message(destination, message)
                break
            except Exception as e:
                attempts += 1
                logger.error(f"Background send attempt {attempts} failed for {destination}: {str(e)}")
                if attempts == MAX_RECONNECT_ATTEMPTS:
                    logger.error(f"Max attempts reached for {destination}. Disabling ActiveMQ.")
                    mq_conn.disable()
                    break
                time.sleep(2)
        message_queue.task_done()

# Start message sender thread
threading.Thread(target=message_sender, daemon=True).start()

# Send book purchase event (async)
def send_book_purchase_event(user_id: str, book_id: int, transaction_type: str):
    if not mq_conn.is_enabled:
        logger.warning("Skipping book purchase event: ActiveMQ disabled")
        return
    message = json.dumps({
        "event": "book_purchase",
        "userId": user_id,
        "bookId": book_id,
        "transactionType": transaction_type,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    })
    message_queue.put(("/topic/book-purchases", message))
    logger.info(f"Queued book purchase event: {message}")

# Subscribe to book purchases
def subscribe_to_topic(topic: str, callback: Optional[Callable[[str], None]] = None):
    def run_subscription():
        attempts = 0
        while attempts < MAX_RECONNECT_ATTEMPTS:
            try:
                listener = MessageListener(callback)
                mq_conn.subscribe(topic, listener)
                while mq_conn.conn and mq_conn.conn.is_connected():
                    time.sleep(1)
                logger.warning("Subscription loop exited, reconnecting...")
            except Exception as e:
                attempts += 1
                logger.error(f"Subscription error for {topic}, attempt {attempts}: {str(e)}")
                if attempts == MAX_RECONNECT_ATTEMPTS:
                    logger.error(f"Max subscription attempts reached for {topic}. Disabling ActiveMQ.")
                    mq_conn.disable()
                    break
                time.sleep(5)

    threading.Thread(target=run_subscription, daemon=True).start()

# Handle book purchase messages
def handle_book_purchase_message(message: str):
    try:
        data = json.loads(message)
        if data.get("event") == "book_purchase":
            logger.info(f"Processed book purchase: userId={data['userId']}, bookId={data['bookId']}")
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON message: {message}")

# Start subscription
subscribe_to_topic("/topic/book-purchases", handle_book_purchase_message)

# Create a new transaction
@app.route('/transactions', methods=['POST'])
def create_transaction():
    logger.info('Received POST request to create a transaction')
    try:
        data = request.get_json()
        logger.debug(f'Request data: {data}')
        user_id = data.get('userId')
        book_id = data.get('bookId')
        transaction_type = data.get('transactionType')

        if not all([user_id, book_id, transaction_type]):
            logger.warning('Missing required fields in request')
            return jsonify({'error': 'userId, bookId, and transactionType are required'}), 400

        if transaction_type not in ['BORROW', 'PURCHASE']:
            logger.warning(f'Invalid transactionType: {transaction_type}')
            return jsonify({'error': 'transactionType must be BORROW or PURCHASE'}), 400

        db = get_db_connection()
        query = """
            INSERT INTO transactions (user_id, book_id, transaction_type)
            VALUES (%s, %s, %s)
        """
        transaction_id = db.insert(query, (user_id, book_id, transaction_type))
        logger.info(f'Transaction created with ID: {transaction_id}')
        db.close()

        send_book_purchase_event(str(user_id), book_id, transaction_type)

        logger.debug("Preparing response")
        response = jsonify({
            'id': transaction_id,
            'userId': user_id,
            'bookId': book_id,
            'transactionType': transaction_type,
            'message': 'Transaction created'
        })
        logger.debug("Response prepared")
        return response, 201

    except Exception as e:
        logger.error(f'Server error while creating transaction: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get all transactions
@app.route('/transactions', methods=['GET'])
def get_all_transactions():
    logger.info('Received GET request to fetch all transactions')
    try:
        db = get_db_connection()
        transactions = db.select('SELECT * FROM transactions')
        logger.info(f'Fetched {len(transactions)} transactions')
        db.close()

        for transaction in transactions:
            transaction['userId'] = transaction.pop('user_id')
            transaction['bookId'] = transaction.pop('book_id')
            transaction['transactionType'] = transaction.pop('transaction_type')
            transaction['transactionDate'] = transaction['transaction_date'].isoformat()

        return jsonify(transactions), 200

    except Exception as e:
        logger.error(f'Server error while fetching transactions: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get a transaction by ID
@app.route('/transactions/<int:id>', methods=['GET'])
def get_transaction(id):
    logger.info(f'Received GET request to fetch transaction with ID: {id}')
    try:
        db = get_db_connection()
        transaction = db.select_one('SELECT * FROM transactions WHERE id = %s', (id,))
        db.close()

        if not transaction:
            logger.warning(f'Transaction with ID {id} not found')
            return jsonify({'error': 'Transaction not found'}), 404

        transaction['userId'] = transaction.pop('user_id')
        transaction['bookId'] = transaction.pop('book_id')
        transaction['transactionType'] = transaction.pop('transaction_type')
        transaction['transactionDate'] = transaction['transaction_date'].isoformat()

        logger.info(f'Transaction with ID {id} fetched successfully')
        return jsonify(transaction), 200

    except Exception as e:
        logger.error(f'Server error while fetching transaction {id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Get transactions by user ID
@app.route('/transactions/user/<int:user_id>', methods=['GET'])
def get_transactions_by_user(user_id):
    logger.info(f'Received GET request to fetch transactions for user ID: {user_id}')
    try:
        db = get_db_connection()
        transactions = db.select('SELECT * FROM transactions WHERE user_id = %s', (user_id,))
        db.close()

        if not transactions:
            logger.info(f'No transactions found for user ID: {user_id}')
            return jsonify([]), 200

        for transaction in transactions:
            transaction['userId'] = transaction.pop('user_id')
            transaction['bookId'] = transaction.pop('book_id')
            transaction['transactionType'] = transaction.pop('transaction_type')
            transaction['transactionDate'] = transaction['transaction_date'].isoformat()

        logger.info(f'Fetched {len(transactions)} transactions for user ID: {user_id}')
        return jsonify(transactions), 200

    except Exception as e:
        logger.error(f'Server error while fetching transactions for user {user_id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Update a transaction
@app.route('/transactions/<int:id>', methods=['PUT'])
def update_transaction(id):
    logger.info(f'Received PUT request to update transaction with ID: {id}')
    try:
        data = request.get_json()
        logger.debug(f'Request data: {data}')
        user_id = data.get('userId')
        book_id = data.get('bookId')
        transaction_type = data.get('transactionType')

        if not all([user_id, book_id, transaction_type]):
            logger.warning('Missing required fields in request')
            return jsonify({'error': 'userId, bookId, and transactionType are required'}), 400

        if transaction_type not in ['BORROW', 'PURCHASE']:
            logger.warning(f'Invalid transactionType: {transaction_type}')
            return jsonify({'error': 'transactionType must be BORROW or PURCHASE'}), 400

        db = get_db_connection()
        query = """
            UPDATE transactions
            SET user_id = %s, book_id = %s, transaction_type = %s
            WHERE id = %s
        """
        row_count = db.update(query, (user_id, book_id, transaction_type, id))

        if row_count == 0:
            db.close()
            logger.warning(f'Transaction with ID {id} not found for update')
            return jsonify({'error': 'Transaction not found'}), 404

        db.close()
        logger.info(f'Transaction with ID {id} updated successfully')
        return jsonify({'message': 'Transaction updated'}), 200

    except Exception as e:
        logger.error(f'Server error while updating transaction {id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# Delete a transaction
@app.route('/transactions/<int:id>', methods=['DELETE'])
def delete_transaction(id):
    logger.info(f'Received DELETE request to delete transaction with ID: {id}')
    try:
        db = get_db_connection()
        row_count = db.delete('DELETE FROM transactions WHERE id = %s', (id,))

        if row_count == 0:
            db.close()
            logger.warning(f'Transaction with ID {id} not found for deletion')
            return jsonify({'error': 'Transaction not found'}), 404

        db.close()
        logger.info(f'Transaction with ID {id} deleted successfully')
        return jsonify({'message': 'Transaction deleted'}), 200

    except Exception as e:
        logger.error(f'Server error while deleting transaction {id}: {str(e)}')
        return jsonify({'error': f'Server error: {str(e)}'}), 500

if __name__ == '__main__':
    logger.info('Starting transactions-service on port 6000')
    app.run(host='0.0.0.0', port=6000)