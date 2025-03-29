const db = require('../config/db');
const logger = require('../logger');

const bookService = {
    GetAllBooks: async (call, callback) => {
        try {
            const [rows] = await db.query('SELECT * FROM books');
            const books = rows.map(row => ({
                ...row,
                userId: Number(row.user_id), 
                user_id: undefined 
            }));
            logger.info(`Retrieved ${books.length} books`);
            callback(null, { books }); 
        } catch (error) {
            logger.error('GetAllBooks error', { error: error.message });
            callback({ code: 500, message: 'Server error' });
        }
    },

    GetBook: async (call, callback) => {
        const bookId = call.request.id;
        logger.info('GetBook request received', { bookId });
        try {
            const [rows] = await db.query('SELECT * FROM books WHERE id = ?', [bookId]);
            if (rows.length === 0) {
                logger.warn('Book not found', { bookId });
                return callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'Book not found'
                });
            }
            const book = {
                ...rows[0],
                userId: Number(rows[0].user_id),
                user_id: undefined
            };
            logger.info('Book retrieved successfully', { bookId });
            callback(null, book);
        } catch (error) {
            logger.error('GetBook error', { bookId, error: error.message });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Server error'
            });
        }
    },

    GetBooksByUser: async (call, callback) => {
        const userId = call.request.userId;
        logger.info('GetBooksByUser request received', { userId });
        try {
            const [rows] = await db.query('SELECT * FROM books WHERE user_id = ?', [userId]);
            const books = rows.map(row => ({
                ...row,
                userId: Number(row.user_id),
                user_id: undefined
            }));
            logger.info(`Retrieved ${rows.length} books for user`, { userId });
            callback(null, { books });
        } catch (error) {
            logger.error('GetBooksByUser error', { userId, error: error.message });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Server error'
            });
        }
    },

    CreateBook: async (call, callback) => {
        const { title, author, isbn, userId } = call.request;
        logger.info('CreateBook request received', { title, userId });
        if (!title || !author || !userId) {
            logger.warn('Invalid CreateBook request', { request: call.request });
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Title, author, and user_id are required'
            });
        }
        try {
            const [result] = await db.query(
                'INSERT INTO books (title, author, isbn, user_id) VALUES (?, ?, ?, ?)',
                [title, author, isbn, userId]
            );
            logger.info('Book created successfully', { id: result.insertId, title, userId });
            callback(null, { id: result.insertId, title, author, isbn, userId });
        } catch (error) {
            logger.error('CreateBook error', { error: error.message });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Server error'
            });
        }
    },

    UpdateBook: async (call, callback) => {
        const { id, title, author, isbn, userId } = call.request;
        logger.info('UpdateBook request received', { id, title });
        try {
            const [result] = await db.query(
                'UPDATE books SET title = ?, author = ?, isbn = ?, user_id = ? WHERE id = ?',
                [title, author, isbn, userId, id]
            );
            if (result.affectedRows === 0) {
                logger.warn('Book not found for update', { id });
                return callback({ code: 404, message: 'Book not found' });
            }
            logger.info('Book updated successfully', { id });
            callback(null, { message: 'Book updated' });
        } catch (error) {
            logger.error('UpdateBook error', { id, error: error.message });
            callback({ code: 500, message: 'Server error' });
        }
    },

    DeleteBook: async (call, callback) => {
        const bookId = call.request.id;
        logger.info('DeleteBook request received', { bookId });
        try {
            const [result] = await db.query('DELETE FROM books WHERE id = ?', [bookId]);
            if (result.affectedRows === 0) {
                logger.warn('Book not found for deletion', { bookId });
                return callback({ code: 404, message: 'Book not found' });
            }
            logger.info('Book deleted successfully', { bookId });
            callback(null, { message: 'Book deleted' });
        } catch (error) {
            logger.error('DeleteBook error', { bookId, error: error.message });
            callback({ code: 500, message: 'Server error' });
        }
    }
};

module.exports = bookService;