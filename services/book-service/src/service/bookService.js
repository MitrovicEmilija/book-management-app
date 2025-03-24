const db = require('../config/db');

const bookService = {
    GetAllBooks: async (call, callback) => {
        try {
            const [rows] = await db.query('SELECT * FROM books');
            callback(null, { books: rows });
        } catch (error) {
            console.error(error);
            callback({ code: 500, message: 'Server error' });
        }
    },

    GetBook: async (call, callback) => {
        try {
            const [rows] = await db.query('SELECT * FROM books WHERE id = ?', [call.request.id]);
            if (rows.length === 0) {
                return callback({
                    code: grpc.status.NOT_FOUND, 
                    message: 'Book not found'
                });
            }
            // Map user_id to userId
            const book = {
                ...rows[0],
                userId: Number(rows[0].user_id), 
                user_id: undefined // Remove the original user_id field
            };
            callback(null, book);
        } catch (error) {
            console.error(error);
            callback({
                code: grpc.status.INTERNAL,
                message: 'Server error'
            });
        }
    },

    GetBooksByUser: async (call, callback) => {
        try {
            const [rows] = await db.query('SELECT * FROM books WHERE user_id = ?', [call.request.userId]);
            // Map user_id to userId
            const books = rows.map(row => ({
                ...row,
                userId: Number(row.user_id), 
                user_id: undefined 
            }));
            callback(null, { books });
        } catch (error) {
            console.error(error);
            callback({
                code: grpc.status.INTERNAL, 
                message: 'Server error'
            });
        }
    },

    CreateBook: async (call, callback) => {
        const { title, author, isbn, userId } = call.request;
        if (!title || !author || !userId) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT, // 3
                message: 'Title, author, and user_id are required'
            });
        }
        try {
            const [result] = await db.query(
                'INSERT INTO books (title, author, isbn, user_id) VALUES (?, ?, ?, ?)',
                [title, author, isbn, userId]
            );
            callback(null, { id: result.insertId, title, author, isbn, userId });
        } catch (error) {
            console.error('CreateBook Error:', error);
            callback({
                code: grpc.status.INTERNAL, // 13
                message: 'Server error'
            });
        }
    },

    UpdateBook: async (call, callback) => {
        const { id, title, author, isbn, userId } = call.request;
        try {
            const [result] = await db.query(
                'UPDATE books SET title = ?, author = ?, isbn = ?, user_id = ? WHERE id = ?',
                [title, author, isbn, userId, id]
            );
            if (result.affectedRows === 0) {
                return callback({ code: 404, message: 'Book not found' });
            }
            callback(null, { message: 'Book updated' });
        } catch (error) {
            console.error(error);
            callback({ code: 500, message: 'Server error' });
        }
    },

    DeleteBook: async (call, callback) => {
        try {
            const [result] = await db.query('DELETE FROM books WHERE id = ?', [call.request.id]);
            if (result.affectedRows === 0) {
                return callback({ code: 404, message: 'Book not found' });
            }
            callback(null, { message: 'Book deleted' });
        } catch (error) {
            console.error(error);
            callback({ code: 500, message: 'Server error' });
        }
    }
};

module.exports = bookService;