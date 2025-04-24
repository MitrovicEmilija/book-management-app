import React, { useState } from 'react';
import axios from 'axios';

const UserApp = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [token, setToken] = useState(null);
  const [error, setError] = useState('');

  const API_URL = 'http://localhost:3000/api/web';

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/users/register`, { username, email, password, role });
      alert(response.data.message);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/users/login`, { username: loginUsername, password: loginPassword });
      setToken(response.data.token);
      localStorage.setItem('token', response.data.token);
      setError('');
      alert('Login successful');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">User Service</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {!token ? (
        <>
          <h3 className="text-xl mb-2">Register</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              onClick={handleRegister}
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
            >
              Register
            </button>
          </div>
          <h3 className="text-xl mt-6 mb-2">Login</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <button
              onClick={handleLogin}
              className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
            >
              Login
            </button>
          </div>
        </>
      ) : (
        <div>
          <p className="text-green-500">Logged in! Token: {token.substring(0, 10)}...</p>
          <button
            onClick={() => {
              setToken(null);
              localStorage.removeItem('token');
            }}
            className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserApp;