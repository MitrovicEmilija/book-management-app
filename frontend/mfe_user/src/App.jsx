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
      localStorage.setItem('token', response.data.token);
      navigate('/users/dashboard');
    } catch (error) {
      alert('Login failed: ' + error.response?.data?.error);
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
  const navigate = useNavigate();

  const fetchDashboard = async () => {
    try {
      let token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      // Remove redundant "Bearer " if it's there
      token = token.replace(/^Bearer\s+/i, '');

      // Decode the JWT to get the userId
      const decoded = jwtDecode(token);
      console.log(decoded);
      const userId = decoded.sub;
      console.log(userId);

      const response = await axios.get(`http://localhost:3000/api/web/dashboard/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
    } catch (error) {
      alert('Failed to fetch dashboard: ' + (error.response?.data?.error || error.message));
      navigate('/users/login');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Dashboard</h2>
      <button onClick={fetchDashboard} className="bg-blue-500 text-white p-2 mb-4">Load Dashboard</button>
      {data && (
        <div>
          <h3>User: {data.user?.username}</h3>
          <h4>Books:</h4>
          <ul>
            {data.books.map(book => (
              <li key={book.id}>{book.title} by {book.author}</li>
            ))}
          </ul>
          <h4>Transactions:</h4>
          <ul>
            {data.transactions.map(tx => (
              <li key={tx.id}>{tx.transactionType} - Book ID: {tx.bookId}</li>
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