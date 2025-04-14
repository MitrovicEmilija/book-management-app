const stompit = require('stompit');
const express = require('express');
const app = express();
app.use(express.json());

// Load environment variables
const BROKER_URL = process.env.ACTIVEMQ_BROKER_URL || 'tcp://shared-activemq:61616';
const USERNAME = process.env.ACTIVEMQ_USERNAME || 'admin';
const PASSWORD = process.env.ACTIVEMQ_PASSWORD || 'admin';
const PORT = process.env.PORT || 3001; // Changed from 50051 to avoid gRPC conflict

// Parse brokerUrl
const url = new URL(BROKER_URL.replace('tcp://', 'http://'));
const BROKER_HOST = url.hostname;
const BROKER_PORT = parseInt(url.port) || 61616;

// Configure reconnect options
const reconnectOptions = {
    maxReconnects: 10,
    reconnectDelay: 5000,
    connectOptions: {
        host: BROKER_HOST,
        port: BROKER_PORT,
        connectHeaders: {
            'host': '/',
            'login': USERNAME,
            'passcode': PASSWORD,
            'heart-beat': '5000,5000'
        }
    }
};

// Function to send a message
function sendMessage(destination, message) {
    stompit.connect(reconnectOptions.connectOptions, (error, client) => {
        if (error) {
            console.error(`Failed to connect to ActiveMQ: ${error.message}`);
            return;
        }
        const frame = client.send({ destination });
        frame.write(JSON.stringify(message));
        frame.end();
        client.disconnect();
        console.log(`Sent to ${destination}: ${JSON.stringify(message)}`);
    });
}

// Function to subscribe to a topic/queue
function subscribeToTopic(topic, callback) {
    const channel = new stompit.Channel(reconnectOptions);
    channel.subscribe({ destination: topic, ack: 'client' }, (error, message) => {
        if (error) {
            console.error(`Subscribe failed for ${topic}: ${error.message}`);
            return;
        }
        message.readString('utf-8', (error, body) => {
            if (error) {
                console.error(`Read message failed: ${error.message}`);
                return;
            }
            console.log(`Received from ${topic}: ${body}`);
            try {
                callback(JSON.parse(body));
                message.ack();
            } catch (e) {
                console.error(`Error processing message: ${e.message}`);
            }
        });
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('Server is up');
});

// Send message endpoint (for testing)
app.post('/send-purchase', (req, res) => {
    const { userId, bookId, transactionType } = req.body;
    const message = {
        event: 'book_purchase',
        userId,
        bookId,
        transactionType,
        timestamp: new Date().toISOString()
    };
    sendMessage('/topic/book-purchases', message);
    res.send('Book purchase message sent');
});

// Handle book purchase messages
subscribeToTopic('/topic/book-purchases', (message) => {
    if (message.event === 'book_purchase') {
        console.log(`Book purchased: userId=${message.userId}, bookId=${message.bookId}`);
        // Add logic to update book availability
    }
});

app.listen(PORT, () => {
    console.log(`Book service running on port ${PORT}`);
});