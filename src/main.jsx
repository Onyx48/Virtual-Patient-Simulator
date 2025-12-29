import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; 
import App from './App';
import axios from 'axios';

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
axios.defaults.baseURL = 'http://localhost:5001';

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);