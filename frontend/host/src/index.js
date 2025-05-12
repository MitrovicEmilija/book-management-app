import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

console.log('React version:', React.version);
const root = createRoot(document.getElementById('root'));
root.render(<App />);