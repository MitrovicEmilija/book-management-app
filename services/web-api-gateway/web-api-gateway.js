const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
require('dotenv').config();

const app = express();
app.use(express.json());

// gRPC Client for book-service
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
  grpc.credentials.createInsecure()
);

// Service URLs
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service-ita:8080';
const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service-ita:6000';
const JWT_SECRET_ENCODED = process.env.JWT_SECRET || 'GD01pc7/7BmRWmWtY71dIUjR1G+we3N5d9EKYWmzuFI6o6eRCsetl/9KruFclnFwmb7B9I62hhDfjUAl3IUDUw==';
const JWT_SECRET = Buffer.from(JWT_SECRET_ENCODED, 'base64');

// Middleware for JWT validation
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.warn('Missing authorization header');
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS512'] });
    req.user = decoded;
    logger.info('Token validated in gateway', { user: decoded.sub });
    next();
  } catch (error) {
    logger.error('JWT validation failed in gateway', { error: error.message });
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Get all books
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

// Get book by ID
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

// Get books by user (protected)
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

// Create book (protected)
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

// Update book (protected)
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

// Delete book (protected)
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

// User login
app.post('/api/web/users/login', async (req, res) => {
  const { username, password } = req.body;
  logger.info('User login attempt', { username });
  try {
    const response = await axios.post(`${USER_SERVICE_URL}/users/login`, { username, password });
    res.json({ token: response.data });
  } catch (error) {
    logger.error('Login failed', { username, error: error.message });
    res.status(error.response?.status || 500).json({ error: error.response?.data || 'Server error' });
  }
});

// User registration
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

// Get transactions (unprotected)
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

// Create transaction (unprotected)
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Web API Gateway running on port ${PORT}`);
});