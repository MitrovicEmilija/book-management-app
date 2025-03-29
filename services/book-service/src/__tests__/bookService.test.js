const grpc = require('@grpc/grpc-js'); 
const bookService = require('../service/bookService');

// Mock the database
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

// Mock the logger
jest.mock('../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const db = require('../config/db');
const logger = require('../logger');

describe('BookService', () => {
  let mockCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCallback = jest.fn(); // Mock the gRPC callback
  });

  // Test GetAllBooks
  describe('GetAllBooks', () => {
    it('should return all books with userId mapped', async () => {
      const mockRows = [
        { id: 1, title: 'Book 1', author: 'Author 1', isbn: '123', user_id: 100 },
        { id: 2, title: 'Book 2', author: 'Author 2', isbn: '456', user_id: 200 },
      ];
      db.query.mockResolvedValue([mockRows]);

      await bookService.GetAllBooks({}, mockCallback);

      expect(db.query).toHaveBeenCalledWith('SELECT * FROM books');
      expect(logger.info).toHaveBeenCalledWith('Retrieved 2 books');
      expect(mockCallback).toHaveBeenCalledWith(null, {
        books: [
          { id: 1, title: 'Book 1', author: 'Author 1', isbn: '123', userId: 100 },
          { id: 2, title: 'Book 2', author: 'Author 2', isbn: '456', userId: 200 },
        ],
      });
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      await bookService.GetAllBooks({}, mockCallback);

      expect(logger.error).toHaveBeenCalledWith('GetAllBooks error', { error: 'DB error' });
      expect(mockCallback).toHaveBeenCalledWith({ code: 500, message: 'Server error' });
    });
  });

  // Test GetBook
  describe('GetBook', () => {
    it('should return a book with userId mapped', async () => {
      const mockRows = [{ id: 1, title: 'Book 1', author: 'Author 1', isbn: '123', user_id: 100 }];
      db.query.mockResolvedValue([mockRows]);

      await bookService.GetBook({ request: { id: 1 } }, mockCallback);

      expect(db.query).toHaveBeenCalledWith('SELECT * FROM books WHERE id = ?', [1]);
      expect(logger.info).toHaveBeenCalledWith('GetBook request received', { bookId: 1 });
      expect(logger.info).toHaveBeenCalledWith('Book retrieved successfully', { bookId: 1 });
      expect(mockCallback).toHaveBeenCalledWith(null, {
        id: 1,
        title: 'Book 1',
        author: 'Author 1',
        isbn: '123',
        userId: 100,
      });
    });

    it('should return NOT_FOUND if book doesn’t exist', async () => {
      db.query.mockResolvedValue([[]]);

      await bookService.GetBook({ request: { id: 1 } }, mockCallback);

      expect(logger.warn).toHaveBeenCalledWith('Book not found', { bookId: 1 });
      expect(mockCallback).toHaveBeenCalledWith({
        code: grpc.status.NOT_FOUND,
        message: 'Book not found',
      });
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      await bookService.GetBook({ request: { id: 1 } }, mockCallback);

      expect(logger.error).toHaveBeenCalledWith('GetBook error', { bookId: 1, error: 'DB error' });
      expect(mockCallback).toHaveBeenCalledWith({
        code: grpc.status.INTERNAL,
        message: 'Server error',
      });
    });
  });

  // Test GetBooksByUser
  describe('GetBooksByUser', () => {
    it('should return books for a user with userId mapped', async () => {
      const mockRows = [
        { id: 1, title: 'Book 1', author: 'Author 1', isbn: '123', user_id: 100 },
      ];
      db.query.mockResolvedValue([mockRows]);

      await bookService.GetBooksByUser({ request: { userId: 100 } }, mockCallback);

      expect(db.query).toHaveBeenCalledWith('SELECT * FROM books WHERE user_id = ?', [100]);
      expect(logger.info).toHaveBeenCalledWith('Retrieved 1 books for user', { userId: 100 });
      expect(mockCallback).toHaveBeenCalledWith(null, {
        books: [{ id: 1, title: 'Book 1', author: 'Author 1', isbn: '123', userId: 100 }],
      });
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      await bookService.GetBooksByUser({ request: { userId: 100 } }, mockCallback);

      expect(logger.error).toHaveBeenCalledWith('GetBooksByUser error', {
        userId: 100,
        error: 'DB error',
      });
      expect(mockCallback).toHaveBeenCalledWith({
        code: grpc.status.INTERNAL,
        message: 'Server error',
      });
    });
  });

  // Test CreateBook
  describe('CreateBook', () => {
    it('should create a book successfully', async () => {
      db.query.mockResolvedValue([{ insertId: 1 }]);
      const request = { title: 'New Book', author: 'Author', isbn: '123', userId: 100 };

      await bookService.CreateBook({ request }, mockCallback);

      expect(db.query).toHaveBeenCalledWith(
        'INSERT INTO books (title, author, isbn, user_id) VALUES (?, ?, ?, ?)',
        ['New Book', 'Author', '123', 100]
      );
      expect(logger.info).toHaveBeenCalledWith('Book created successfully', {
        id: 1,
        title: 'New Book',
        userId: 100,
      });
      expect(mockCallback).toHaveBeenCalledWith(null, { id: 1, ...request });
    });

    it('should return INVALID_ARGUMENT if required fields are missing', async () => {
      await bookService.CreateBook({ request: { title: 'New Book' } }, mockCallback);

      expect(logger.warn).toHaveBeenCalledWith('Invalid CreateBook request', {
        request: { title: 'New Book' },
      });
      expect(mockCallback).toHaveBeenCalledWith({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Title, author, and user_id are required',
      });
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));
      const request = { title: 'New Book', author: 'Author', isbn: '123', userId: 100 };

      await bookService.CreateBook({ request }, mockCallback);

      expect(logger.error).toHaveBeenCalledWith('CreateBook error', { error: 'DB error' });
      expect(mockCallback).toHaveBeenCalledWith({
        code: grpc.status.INTERNAL,
        message: 'Server error',
      });
    });
  });

  // Test UpdateBook
  describe('UpdateBook', () => {
    it('should update a book successfully', async () => {
      db.query.mockResolvedValue([{ affectedRows: 1 }]);
      const request = { id: 1, title: 'Updated Book', author: 'Author', isbn: '123', userId: 100 };

      await bookService.UpdateBook({ request }, mockCallback);

      expect(db.query).toHaveBeenCalledWith(
        'UPDATE books SET title = ?, author = ?, isbn = ?, user_id = ? WHERE id = ?',
        ['Updated Book', 'Author', '123', 100, 1]
      );
      expect(logger.info).toHaveBeenCalledWith('Book updated successfully', { id: 1 });
      expect(mockCallback).toHaveBeenCalledWith(null, { message: 'Book updated' });
    });

    it('should return 404 if book not found', async () => {
      db.query.mockResolvedValue([{ affectedRows: 0 }]);
      const request = { id: 1, title: 'Updated Book', author: 'Author', isbn: '123', userId: 100 };

      await bookService.UpdateBook({ request }, mockCallback);

      expect(logger.warn).toHaveBeenCalledWith('Book not found for update', { id: 1 });
      expect(mockCallback).toHaveBeenCalledWith({ code: 404, message: 'Book not found' });
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));
      const request = { id: 1, title: 'Updated Book', author: 'Author', isbn: '123', userId: 100 };

      await bookService.UpdateBook({ request }, mockCallback);

      expect(logger.error).toHaveBeenCalledWith('UpdateBook error', { id: 1, error: 'DB error' });
      expect(mockCallback).toHaveBeenCalledWith({ code: 500, message: 'Server error' });
    });
  });

  // Test DeleteBook
  describe('DeleteBook', () => {
    it('should delete a book successfully', async () => {
      db.query.mockResolvedValue([{ affectedRows: 1 }]);

      await bookService.DeleteBook({ request: { id: 1 } }, mockCallback);

      expect(db.query).toHaveBeenCalledWith('DELETE FROM books WHERE id = ?', [1]);
      expect(logger.info).toHaveBeenCalledWith('Book deleted successfully', { bookId: 1 });
      expect(mockCallback).toHaveBeenCalledWith(null, { message: 'Book deleted' });
    });

    it('should return 404 if book not found', async () => {
      db.query.mockResolvedValue([{ affectedRows: 0 }]);

      await bookService.DeleteBook({ request: { id: 1 } }, mockCallback);

      expect(logger.warn).toHaveBeenCalledWith('Book not found for deletion', { bookId: 1 });
      expect(mockCallback).toHaveBeenCalledWith({ code: 404, message: 'Book not found' });
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      await bookService.DeleteBook({ request: { id: 1 } }, mockCallback);

      expect(logger.error).toHaveBeenCalledWith('DeleteBook error', { bookId: 1, error: 'DB error' });
      expect(mockCallback).toHaveBeenCalledWith({ code: 500, message: 'Server error' });
    });
  });
});