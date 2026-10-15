import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import Home from './pages/Home/Home';
import Maruthuvam from './pages/Home/Maruthuvam';
import EmergencyHub from './pages/Home/EmergencyHub';
 
function App() {
  // FIX 1: Use React state so the app updates immediately when the token changes
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('meston_token'));
 
  // FIX 2: Listen for storage changes (handles cases where token is set/removed)
  useEffect(() => {
    const handleStorageChange = () => {
      setIsLoggedIn(!!localStorage.getItem('meston_token'));
    };
    
    // Listens for changes across different browser tabs
    window.addEventListener('storage', handleStorageChange);
    
    // Optional: Setup a custom event interval if you handle login via React Router's useNavigate without reloading
    const interval = setInterval(handleStorageChange, 1000); 

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <Router>
      {/* Assuming EmergencyHub is a floating widget or global component since it is outside <Routes> */}
      {isLoggedIn && <EmergencyHub />}
      
      <Routes>
        {/* FIX 3: Prevent logged-in users from accessing Auth pages */}
        <Route path="/" element={<Navigate to={isLoggedIn ? "/home" : "/login"} />} />
        <Route path="/login" element={isLoggedIn ? <Navigate to="/home" /> : <Login />} />
        <Route path="/signup" element={isLoggedIn ? <Navigate to="/home" /> : <Signup />} />
 
        {/* Existing code untouched */}
        <Route
          path="/home"
          element={isLoggedIn ? <Home /> : <Navigate to="/login" />}
        />
 
        <Route
          path="/maruthuvam"
          element={isLoggedIn ? <Maruthuvam /> : <Navigate to="/login" />}
        />
      </Routes>
    </Router>
  );
}
 
export default App;