import React, { useState } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3000/api/web/users/login', { username, password });
      const token = response.data.token;
      console.log('Stored token:', token);
      localStorage.setItem('token', token);
      navigate('/users/dashboard');
    } catch (error) {
      alert('Login failed: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Login</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 w-full"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 w-full"
        />
        <button type="submit" className="bg-blue-500 text-white p-2">Login</button>
      </form>
      <p className="mt-4">
        Don't have an account? <Link to="/users/register" className="text-blue-500">Register here</Link>
      </p>
    </div>
  );
}

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/web/users/register', { username, email, password, role: 'user' });
      navigate('/users/login');
    } catch (error) {
      alert('Registration failed: ' + error.response?.data?.error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Register</h2>
      <form onSubmit={handleRegister} className="space-y-4">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 w-full"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 w-full"
        />
        <button type="submit" className="bg-blue-500 text-white p-2">Register</button>
      </form>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '' });
  const [transactionForm, setTransactionForm] = useState({ bookId: '', transactionType: 'BORROW' });
  const navigate = useNavigate();

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Raw token:', token);
      if (!token) {
        throw new Error('No token found');
      }

      const decoded = jwtDecode(token);
      console.log('Decoded JWT:', decoded);
      const userId = decoded.sub;
      console.log('User ID:', userId);

      const authHeader = `Bearer ${token}`;
      console.log('Authorization header:', authHeader);

      const response = await axios.get(`http://localhost:3000/api/web/dashboard/${userId}`, {
        headers: { Authorization: authHeader },
      });
      setData(response.data);
    } catch (error) {
      alert('Failed to fetch dashboard: ' + (error.response?.data?.error || error.message));
      navigate('/users/login');
    }
  };

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const decoded = jwtDecode(token);
      const userId = decoded.sub;
      await axios.post('http://localhost:3000/api/web/books', {
        ...bookForm,
        userId,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Book added successfully');
      setBookForm({ title: '', author: '', isbn: '' });
      fetchDashboard(); // Refresh dashboard
    } catch (error) {
      alert('Failed to add book: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteBook = async (bookId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3000/api/web/books/${bookId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Book deleted successfully');
      fetchDashboard(); // Refresh dashboard
    } catch (error) {
      alert('Failed to delete book: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const decoded = jwtDecode(token);
      const userId = decoded.sub;
      await axios.post('http://localhost:3000/api/web/transactions', {
        userId,
        bookId: transactionForm.bookId,
        transactionType: transactionForm.transactionType,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Transaction created successfully');
      setTransactionForm({ bookId: '', transactionType: 'BORROW' });
      fetchDashboard(); // Refresh dashboard
    } catch (error) {
      alert('Failed to create transaction: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Dashboard</h2>
      <button onClick={fetchDashboard} className="bg-blue-500 text-white p-2 mb-4">Load Dashboard</button>

      {/* Add Book Form */}
      <div className="mb-6">
        <h3 className="text-lg mb-2">Add New Book</h3>
        <form onSubmit={handleBookSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Title"
            value={bookForm.title}
            onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
            className="border p-2 w-full"
          />
          <input
            type="text"
            placeholder="Author"
            value={bookForm.author}
            onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
            className="border p-2 w-full"
          />
          <input
            type="text"
            placeholder="ISBN"
            value={bookForm.isbn}
            onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
            className="border p-2 w-full"
          />
          <button type="submit" className="bg-blue-500 text-white p-2">Add Book</button>
        </form>
      </div>

      {/* Create Transaction Form */}
      <div className="mb-6">
        <h3 className="text-lg mb-2">Create Transaction</h3>
        <form onSubmit={handleTransactionSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Book ID"
            value={transactionForm.bookId}
            onChange={(e) => setTransactionForm({ ...transactionForm, bookId: e.target.value })}
            className="border p-2 w-full"
          />
          <select
            value={transactionForm.transactionType}
            onChange={(e) => setTransactionForm({ ...transactionForm, transactionType: e.target.value })}
            className="border p-2 w-full"
          >
            <option value="BORROW">Borrow</option>
            <option value="PURCHASE">Purchase</option>
            <option value="RETURN">Return</option>
          </select>
          <button type="submit" className="bg-blue-500 text-white p-2">Create Transaction</button>
        </form>
      </div>

      {/* Dashboard Data */}
      {data && (
        <div>
          <h3>User: {data.user?.username}</h3>
          <h4>Books:</h4>
          <ul>
            {data.books.map(book => (
              <li key={book.id} className="mb-2 flex justify-between items-center">
                <span>ID: {book.id} - {book.title} by {book.author}</span>
                <button
                  onClick={() => handleDeleteBook(book.id)}
                  className="bg-red-500 text-white p-1 rounded"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <h4>Transactions:</h4>
          <ul>
            {data.transactions.map(tx => (
              <li key={tx.id} className="mb-2">
                {tx.transactionType} - Book ID: {tx.bookId}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/" element={<Login />} />
    </Routes>
  );
}

export default App;