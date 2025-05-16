// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
// import logo from './logo.svg'; // Импортируем logo.svg

import Login from './components/Login';
import Foodai from './components/Foodai';
import Profile from './components/Profile';
import Journal from './components/Journal';
import PrivateRoute from './components/PrivateRoute';

export default function App() {
  return (
    <div className="App">
      <header className="App-header">
        {/* <h1>ЕдAI</h1> */}
      </header>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Foodai /></PrivateRoute>} />
        <Route path="/journal" element={<PrivateRoute><Journal /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      </Routes>
    </div>
  );
}