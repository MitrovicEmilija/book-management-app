const stompit = require('stompit');
const express = require('express');
const app = express();

// Load environment variables
const brokerUrl = process.env.ACTIVEMQ_BROKER_URL || 'tcp://shared-activemq:61616'; 
const username = process.env.ACTIVEMQ_USERNAME || 'admin';
const password = process.env.ACTIVEMQ_PASSWORD || 'admin';
const port = process.env.PORT || 50051;

// Parse brokerUrl to extract host and port
const url = new URL(brokerUrl.replace('tcp://', 'http://')); 
const brokerHost = url.hostname;
const brokerPort = parseInt(url.port) || 61616;

// Configure connection to ActiveMQ
const connectOptions = {
    host: brokerHost, 
    port: brokerPort, 
    connectHeaders: {
        'host': '/',
        'login': username,
        'passcode': password,
        'heart-beat': '5000,5000'
    }
};

// Function to send a message
function sendMessage(queueName, message) {
    stompit.connect(connectOptions, (error, client) => {
        if (error) {
            console.error('Connection failed:', error);
            return;
        }
        const frame = client.send({ destination: `/queue/${queueName}` });
        frame.write(message);
        frame.end();
        client.disconnect();
        console.log(`Message sent to ${queueName}: ${message}`);
    });
}

// Function to subscribe to a queue
function subscribeToQueue(queueName) {
    stompit.connect(connectOptions, (error, client) => {
        if (error) {
            console.error('Connection failed:', error);
            return;
        }
        client.subscribe({ destination: `/queue/${queueName}` }, (error, message) => {
            if (error) {
                console.error('Subscribe failed:', error);
                return;
            }
            message.readString('utf-8', (error, body) => {
                if (error) {
                    console.error('Read message failed:', error);
                    return;
                }
                console.log(`Received from ${queueName}: ${body}`);
                message.ack(); // Acknowledge the message
            });
        });
        // Note: Client is not disconnected here to keep subscription active
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('Server is up');
});

// Express route
app.get('/send', (req, res) => {
    sendMessage('book-queue', 'New book added!');
    res.send('Message sent to queue');
});

// Start subscription
subscribeToQueue('book-queue');

app.listen(port, () => {
    console.log(`Book service running on port ${port}`);
});