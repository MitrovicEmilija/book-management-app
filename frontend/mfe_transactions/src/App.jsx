import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

function AboutUs() {

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">ABOUT US</h2>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<AboutUs />} />
    </Routes>
  );
}

export default App;