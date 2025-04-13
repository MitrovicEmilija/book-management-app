import os
import stomp
import time

# Load environment variables
broker_url = os.getenv('ACTIVEMQ_BROKER_URL', 'tcp://shared-activemq:61616')  # Fallback to shared-activemq
broker_host = os.getenv('ACTIVEMQ_BROKER', 'shared-activemq')  # Container name
broker_port = int(os.getenv('ACTIVEMQ_BROKER_PORT', '61616'))  # Default port
username = os.getenv('ACTIVEMQ_USERNAME', 'admin')
password = os.getenv('ACTIVEMQ_PASSWORD', 'admin')
port = int(os.getenv('PORT', '6000'))

# Connection configuration
class MessageListener(stomp.ConnectionListener):
    def on_error(self, frame):
        print('Error:', frame.body)

    def on_message(self, frame):
        print('Received message:', frame.body)

    def on_disconnected(self):
        print('Disconnected from ActiveMQ')

# Function to send a message
def send_message(queue_name, message):
    conn = stomp.Connection([(broker_host, broker_port)])
    conn.connect(username, password, wait=True)
    conn.send(body=message, destination=f'/queue/{queue_name}')
    conn.disconnect()
    print(f"Sent to {queue_name}: {message}")

# Function to subscribe to a queue
def subscribe_to_queue(queue_name):
    conn = stomp.Connection([(broker_host, broker_port)])
    conn.set_listener('', MessageListener())
    conn.connect(username, password, wait=True)
    conn.subscribe(destination=f'/queue/{queue_name}', id=1, ack='auto')
    print(f"Subscribed to {queue_name}")
    # Keep the connection alive
    while True:
        time.sleep(1)

if __name__ == "__main__":
    # Example usage
    send_message('transaction-queue', 'New transaction processed!')

    # Start listening in a separate thread
    import threading
    listener_thread = threading.Thread(target=subscribe_to_queue, args=('transaction-queue',))
    listener_thread.start()

    # Main application logic
    print(f"Transaction service running on port {port}")