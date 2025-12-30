import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"
import axios from 'axios';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Helper for Auth Headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp < currentTime) {
        // Token expired, logout
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        delete axios.defaults.headers.common['Authorization'];
        window.location.href = '/login';
        return {};
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      // Invalid token, logout
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      delete axios.defaults.headers.common['Authorization'];
      window.location.href = '/login';
      return {};
    }
  }
  return { headers: { Authorization: `Bearer ${token}` } };
};
