import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Bot, Shield, ShoppingCart, Map, UserCircle, LogOut } from 'lucide-react';
import Chatbot from './components/Chatbot';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import AdminOverview from './components/AdminOverview';
import AdminDestinations from './components/AdminDestinations';
import AdminBookings from './components/AdminBookings';
import AdminTripPlans from './components/AdminTripPlans';
import TripTable from './components/TripTable';
import CartPage from './components/CartPage';
import LoginRegister from './components/LoginRegister';
import TravelerDashboard from './components/TravelerDashboard';
import SuccessPage from './components/SuccessPage';
import CancelPage from './components/CancelPage';

// Protected Route wrapper - redirects to /login if not authenticated
const ProtectedRoute = ({ children, token }) => {
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [cart, setCart] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const handleAuthChange = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('authChange', handleAuthChange);
    return () => window.removeEventListener('authChange', handleAuthChange);
  }, []);

  const addToCart = (trip) => {
    setCart((prevCart) => [...prevCart, trip]);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    window.dispatchEvent(new Event('authChange'));
  };

  return (
    <Router>
      <div className="app-container">
        <nav className="navbar">
          <Link to="/" className="navbar-logo">
            <Bot size={32} color="#818cf8" />
            AI Tourist Assistant
          </Link>
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
            {token && (
              <>
                <Link to="/">Chat</Link>
                <Link to="/trips" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Map size={18} /> Trips
                </Link>
                <Link to="/cart" style={{ display: 'flex', alignItems: 'center', gap: '5px', position: 'relative' }}>
                  <ShoppingCart size={18} /> Cart
                  {cart.length > 0 && (
                    <span style={{ position: 'absolute', top: '-8px', right: '-12px', background: 'var(--danger)', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>
                      {cart.length}
                    </span>
                  )}
                </Link>
                <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent)' }}>
                  <UserCircle size={18} /> My Account
                </Link>
                <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
                  <LogOut size={18} /> Logout
                </button>
              </>
            )}
            {!token && (
              <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <UserCircle size={18} /> Login
              </Link>
            )}
            <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Shield size={18} /> Admin
            </Link>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginRegister />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />}>
              <Route index element={<AdminOverview />} />
              <Route path="destinations" element={<AdminDestinations />} />
              <Route path="tripplans" element={<AdminTripPlans />} />
              <Route path="bookings" element={<AdminBookings />} />
            </Route>

            {/* Protected routes - require login */}
            <Route path="/" element={<ProtectedRoute token={token}><Chatbot addToCart={addToCart} /></ProtectedRoute>} />
            <Route path="/trips" element={<ProtectedRoute token={token}><TripTable addToCart={addToCart} /></ProtectedRoute>} />
            <Route path="/cart" element={<ProtectedRoute token={token}><CartPage cart={cart} setCart={setCart} /></ProtectedRoute>} />
            <Route path="/success" element={<ProtectedRoute token={token}><SuccessPage setCart={setCart} /></ProtectedRoute>} />
            <Route path="/cancel" element={<ProtectedRoute token={token}><CancelPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute token={token}><TravelerDashboard /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
