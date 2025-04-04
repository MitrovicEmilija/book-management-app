const stompit = require('stompit');
const express = require('express');
const app = express();

// Load environment variables
const brokerUrl = process.env.ACTIVEMQ_BROKER_URL;
const username = process.env.ACTIVEMQ_USERNAME;
const password = process.env.ACTIVEMQ_PASSWORD;
const port = process.env.PORT || 50051;

// Configure connection to ActiveMQ
const connectOptions = {
    host: 'book-service-activemq-ita', // Matches container name in Docker Compose
    port: 61616,
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
    });
}

// Example Express route
app.get('/send', (req, res) => {
    sendMessage('book-queue', 'New book added!');
    res.send('Message sent to queue');
});

// Start subscription
subscribeToQueue('book-queue');

app.listen(port, () => {
    console.log(`Book service running on port ${port}`);
});