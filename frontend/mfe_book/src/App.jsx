import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import './App.css';

function BookList() {
  const [books, setBooks] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchBooksAndTransactions = async () => {
      try {
        // Fetch all books
        const booksResponse = await axios.get('http://localhost:3000/api/web/books');
        const booksData = booksResponse.data;

        // Fetch all transactions
        const transactionsResponse = await axios.get('http://localhost:3000/api/web/transactions', {
          params: { page: 1, limit: 1000 }, // Adjust limit as needed
        });
        const transactionsData = transactionsResponse.data;

        // Map transactions to books to determine status
        const booksWithStatus = booksData.map(book => {
          const latestTransaction = transactionsData
            .filter(tx => tx.bookId === book.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          const status = latestTransaction && latestTransaction.transactionType !== 'RETURN'
            ? latestTransaction.transactionType
            : 'AVAILABLE';
          return { ...book, status };
        });

        setBooks(booksWithStatus);
        setTransactions(transactionsData);
      } catch (error) {
        alert('Failed to fetch books or transactions: ' + (error.response?.data?.error || error.message));
      }
    };
    fetchBooksAndTransactions();
  }, []);

  return (
    <div>
      <ul className="books-grid">
        {books.map(book => (
          <li key={book.id} className="book-card">
            <img
              src="http://localhost:3003/book.jpg"
              alt={`${book.title} cover`}
              className="book-image"
            />
            <div className="book-details">
              <h3>{book.title}</h3>
              <p>by {book.author}</p>
              <p>Status: {book.status}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreateBook() {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [userId, setUserId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('CreateBook: Current path:', location.pathname);
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserId(decoded.sub);
        setIsAdmin(Array.isArray(decoded.roles) && decoded.roles.includes('ROLE_ADMIN'));
      } catch (error) {
        console.error('Failed to decode JWT:', error);
      }
    }
    setIsLoading(false);
  }, [location.pathname]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Unauthorized: Only admins can create books');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3000/api/web/books', { title, author, isbn, userId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Book created');
      setTitle('');
      setAuthor('');
      setIsbn('');
    } catch (error) {
      alert('Failed to create book: ' + (error.response?.data?.error || error.message));
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-4">
        <h2 className="text-xl mb-4">Unauthorized</h2>
        <p className="text-red-500">Only admins can create books.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="create-card">
        <h2>Create Book</h2>
        <form onSubmit={handleCreate} className="create-form">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="text"
            placeholder="Author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <input
            type="text"
            placeholder="ISBN"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
          />
          <button type="submit">Create</button>
        </form>
      </div>
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