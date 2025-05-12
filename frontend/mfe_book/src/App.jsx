import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import axios from 'axios';

function BookList() {
  const [books, setBooks] = useState([]);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/web/books');
        setBooks(response.data);
      } catch (error) {
        alert('Failed to fetch books: ' + error.response?.data?.error);
      }
    };
    fetchBooks();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Books</h2>
      <ul>
        {books.map(book => (
          <li key={book.id} className="mb-2">{book.title} by {book.author}</li>
        ))}
      </ul>
    </div>
  );
}

function CreateBook() {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [userId, setUserId] = useState('1');

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3000/api/web/books', { title, author, isbn, userId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Book created');
    } catch (error) {
      alert('Failed to create book: ' + error.response?.data?.error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Create Book</h2>
      <form onSubmit={handleCreate} className="space-y-4">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 w-full"
        />
        <input
          type="text"
          placeholder="Author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="border p-2 w-full"
        />
        <input
          type="text"
          placeholder="ISBN"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          className="border p-2 w-full"
        />
        <button type="submit" className="bg-blue-500 text-white p-2">Create</button>
      </form>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<BookList />} />
      <Route path="/create" element={<CreateBook />} />
    </Routes>
  );
}

export default App;