const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const cors = require('cors');
const axiosRetry = require('axios-retry');
require('dotenv').config();

// Configure retries for axios
axiosRetry(axios, {
  retries: 3, // Retry 3 times
  retryDelay: (retryCount) => retryCount * 1000, // 1s, 2s, 3s delay between retries
  retryCondition: (error) => {
    // Retry on network errors or 5xx status codes
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response && error.response.status >= 500);
  },
});

const app = express();
app.use(express.json());
app.use(cors());

const PROTO_PATH = './book.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const bookProto = grpc.loadPackageDefinition(packageDefinition).book;
const bookClient = new bookProto.BookService(
  process.env.BOOK_SERVICE_URL || 'book-service-ita:50051',
  grpc.credentials.createInsecure(),
  {
    'grpc.service_config': JSON.stringify({
      methodConfig: [
        {
          name: [{ service: 'book.BookService' }], // Apply to all methods in BookService
          retryPolicy: {
            maxAttempts: 4, // Retry up to 4 times (including initial attempt)
            initialBackoff: '1s', // 1 second initial backoff
            maxBackoff: '5s', // 5 seconds max backoff
            backoffMultiplier: 2, // Double the backoff each retry
            retryableStatusCodes: ['UNAVAILABLE', 'DEADLINE_EXCEEDED'], // Retry on these gRPC statuses
          },
        },
      ],
    }),
  }
);

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service-ita:8080';
const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service-ita:6000';
const JWT_SECRET_ENCODED = process.env.JWT_SECRET || 'GD01pc7/7BmRWmWtY71dIUjR1G+we3N5d9EKYWmzuFI6o6eRCsetl/9KruFclnFwmb7B9I62hhDfjUAl3IUDUw==';
const JWT_SECRET = Buffer.from(JWT_SECRET_ENCODED, 'base64');

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  logger.info('Received Authorization header', { authHeader });

  if (!authHeader) {
    logger.warn('Missing authorization header');
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    logger.warn('Malformed authorization header', { authHeader });
    return res.status(401).json({ error: 'Malformed authorization header' });
  }

  const token = tokenParts[1];
  logger.info('Extracted token', { token });

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS512'] });
    logger.info('Token validated in gateway', { decoded });
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('JWT validation failed in gateway', { error: error.message, token });
    return res.status(403).json({ error: 'Invalid token' });
  }
};

app.get('/api/web/books', async (req, res) => {
  logger.info('Fetching all books');
  bookClient.GetAllBooks({}, (error, response) => {
    if (error) {
      logger.error('Error fetching books', { error: error.message });
      return res.status(500).json({ error: 'Server error' });
    }
    res.json(response.books);
  });
});

app.get('/api/web/books/:id', async (req, res) => {
  const bookId = parseInt(req.params.id);
  logger.info('Fetching book', { bookId });
  bookClient.GetBook({ id: bookId }, (error, response) => {
    if (error) {
      logger.error('Error fetching book', { bookId, error: error.message });
      return res.status(error.code === grpc.status.NOT_FOUND ? 404 : 500).json({ error: error.message });
    }
    res.json(response);
  });
});

app.get('/api/web/users/:userId/books', authenticateJWT, async (req, res) => {
  const userId = req.params.userId;
  logger.info('Fetching books for user', { userId });
  bookClient.GetBooksByUser({ userId }, (error, response) => {
    if (error) {
      logger.error('Error fetching user books', { userId, error: error.message });
      return res.status(error.code === grpc.status.NOT_FOUND ? 404 : 500).json({ error: error.message });
    }
    res.json(response.books);
  });
});

app.post('/api/web/books', authenticateJWT, async (req, res) => {
  const { title, author, isbn, userId } = req.body;
  logger.info('Creating book', { title, userId });
  if (!title || !author || !userId) {
    logger.warn('Invalid create book request', { request: req.body });
    return res.status(400).json({ error: 'Title, author, and userId are required' });
  }
  bookClient.CreateBook({ title, author, isbn, userId }, (error, response) => {
    if (error) {
      logger.error('Error creating book', { error: error.message });
      return res.status(error.code === grpc.status.INVALID_ARGUMENT ? 400 : 500).json({ error: error.message });
    }
    res.status(201).json(response);
  });
});

app.put('/api/web/books/:id', authenticateJWT, async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, author, isbn, userId } = req.body;
  logger.info('Updating book', { id });
  if (!title || !author || !userId) {
    logger.warn('Invalid update book request', { request: req.body });
    return res.status(400).json({ error: 'Title, author, and userId are required' });
  }
  bookClient.UpdateBook({ id, title, author, isbn, userId, created_at: new Date().toISOString() }, (error, response) => {
    if (error) {
      logger.error('Error updating book', { id, error: error.message });
      return res.status(error.code === grpc.status.NOT_FOUND ? 404 : 500).json({ error: error.message });
    }
    res.json({ message: response.message });
  });
});

app.delete('/api/web/books/:id', authenticateJWT, async (req, res) => {
  const bookId = parseInt(req.params.id);
  logger.info('Deleting book', { bookId });
  bookClient.DeleteBook({ id: bookId }, (error, response) => {
    if (error) {
      logger.error('Error deleting book', { bookId, error: error.message });
      return res.status(error.code === grpc.status.NOT_FOUND ? 404 : 500).json({ error: error.message });
    }
    res.json({ message: response.message });
  });
});

app.post('/api/web/users/login', async (req, res) => {
  const { username, password } = req.body;
  logger.info('User login attempt', { username });
  try {
    const response = await axios.post(`${USER_SERVICE_URL}/users/login`, { username, password });
    let token = response.data;
    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      token = token.replace(/^Bearer\s+/i, '');
    }
    logger.info('Login response', { token });
    res.json({ token });
  } catch (error) {
    logger.error('Login failed', { username, error: error.message });
    res.status(error.response?.status || 500).json({ error: error.response?.data || 'Server error' });
  }
});

app.post('/api/web/users/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  logger.info('User registration attempt', { username });
  try {
    const response = await axios.post(`${USER_SERVICE_URL}/users/register`, { username, email, password }, {
      params: { role }
    });
    res.json({ message: response.data });
  } catch (error) {
    logger.error('Registration failed', { username, error: error.message });
    res.status(error.response?.status || 500).json({ error: error.response?.data || 'Server error' });
  }
});

app.get('/api/web/transactions', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  logger.info('Fetching transactions', { page, limit });
  try {
    const response = await axios.get(`${TRANSACTION_SERVICE_URL}/transactions`, {
      params: { page, limit }
    });
    res.json(response.data);
  } catch (error) {
    logger.error('Error fetching transactions', { error: error.message, status: error.response?.status, responseData: error.response?.data });
    res.status(error.response?.status || 500).json({ error: error.response?.data || 'Server error' });
  }
});

app.post('/api/web/transactions', async (req, res) => {
  const { userId, bookId, transactionType } = req.body;
  logger.info('Creating transaction', { userId, bookId, transactionType });
  try {
    const response = await axios.post(`${TRANSACTION_SERVICE_URL}/transactions`, {
      userId,
      bookId,
      transactionType
    });
    res.status(201).json(response.data);
  } catch (error) {
    logger.error('Error creating transaction', { error: error.message, status: error.response?.status, responseData: error.response?.data });
    res.status(error.response?.status || 500).json({ error: error.response?.data || 'Server error' });
  }
});

app.get('/api/web/dashboard/:userId', authenticateJWT, async (req, res) => {
  const requestedUserId = req.params.userId;
  const tokenUserId = req.user.sub;

  logger.info('Fetching dashboard data', { requestedUserId, tokenUserId });

  if (requestedUserId !== tokenUserId) {
    logger.warn('Forbidden: user tried to access another user’s dashboard', {
      requestedUserId,
      tokenUserId,
    });
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    logger.info('Fetching user data', { userId: requestedUserId });
    const userResponse = await axios.get(`${USER_SERVICE_URL}/users/${requestedUserId}`, {
      headers: { Authorization: req.headers.authorization }
    });
    const user = userResponse.data;

    logger.info('Fetching books data', { userId: requestedUserId });
    const booksResponse = await new Promise((resolve, reject) => {
      bookClient.GetBooksByUser({ userId: requestedUserId }, (error, response) => {
        if (error) {
          logger.error('gRPC error fetching books', { error: error.message });
          reject(new Error(`Book service error: ${error.message}`));
        } else {
          resolve(response);
        }
      });
    });

    logger.info('Fetching transactions data', { userId: requestedUserId });
    const transactionsResponse = await axios.get(`${TRANSACTION_SERVICE_URL}/transactions/user/${requestedUserId}`, {
      headers: { Authorization: req.headers.authorization }
    });

    const dashboardData = {
      user: user || null,
      books: booksResponse.books || [],
      transactions: transactionsResponse.data || []
    };

    logger.info('Dashboard data fetched successfully', { userId: requestedUserId });
    res.json(dashboardData);
  } catch (error) {
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.error || error.message || 'Server error';

    logger.error('Error fetching dashboard data', {
      userId: requestedUserId,
      statusCode,
      errorMessage,
    });

    res.status(statusCode).json({ error: errorMessage });
  }
});

// health pattern
app.get('/health', async (req, res) => {
  logger.info('Health check requested');
  const healthStatus = {
    status: 'healthy',
    services: {},
  };

  // Check book-service (gRPC)
  try {
    await new Promise((resolve, reject) => {
      bookClient.GetAllBooks({}, (error, response) => {
        if (error) {
          logger.error('book-service health check failed', { error: error.message });
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
    healthStatus.services['book-service'] = 'healthy';
  } catch (error) {
    healthStatus.status = 'unhealthy';
    healthStatus.services['book-service'] = 'unhealthy';
  }

  // Check user-service (HTTP)
  try {
    await axios.get(`${USER_SERVICE_URL}/users`, { timeout: 2000 }); // Assuming user-service has a health endpoint
    healthStatus.services['user-service'] = 'healthy';
  } catch (error) {
    logger.error('user-service health check failed', { error: error.message });
    healthStatus.status = 'unhealthy';
    healthStatus.services['user-service'] = 'unhealthy';
  }

  // Check transaction-service (HTTP)
  try {
    await axios.get(`${TRANSACTION_SERVICE_URL}/transactions`, { timeout: 2000 }); // Assuming transaction-service has a health endpoint
    healthStatus.services['transaction-service'] = 'healthy';
  } catch (error) {
    logger.error('transaction-service health check failed', { error: error.message });
    healthStatus.status = 'unhealthy';
    healthStatus.services['transaction-service'] = 'unhealthy';
  }

  logger.info('Health check response', { healthStatus });
  res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Web API Gateway running on port ${PORT}`);
});