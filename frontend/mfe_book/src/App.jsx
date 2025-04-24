import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BookApp = () => {
  const [books, setBooks] = useState([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');

  const API_URL = 'http://localhost:3000/api/web';
  const token = localStorage.getItem('token');

  const fetchBooks = async () => {
    try {
      const response = await axios.get(`${API_URL}/books`);
      setBooks(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch books');
    }
  };

  const handleCreateBook = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_URL}/books`,
        { title, author, isbn, userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchBooks();
      setTitle('');
      setAuthor('');
      setIsbn('');
      setUserId('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create book');
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  return (
    <div className="p-4 max-w-4xl mx-auto bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Book Service</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="mb-6">
        <h3 className="text-xl mb-2">Create Book</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="ISBN"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="p-2 border rounded"
          />
          <button
            onClick={handleCreateBook}
            className="col-span-1 sm:col-span-2 bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Create Book
          </button>
        </div>
      </div>
      <h3 className="text-xl mb-2">Books</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {books.map((book) => (
          <div key={book.id} className="p-4 border rounded">
            <h4 className="font-bold">{book.title}</h4>
            <p>Author: {book.author}</p>
            <p>ISBN: {book.isbn}</p>
            <p>User ID: {book.userId}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookApp;