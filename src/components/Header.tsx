import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import logoImage from '../assets/logo.jpeg';
import './Header.css';

export function Header() {
  const { getTotalItems } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo" onClick={closeMobileMenu}>
          <img src={logoImage} alt="Ocean" className="logo-image" />
        </Link>

        <nav className="nav">
          <Link to="/" className="nav-link" onClick={closeMobileMenu}>Home</Link>
          <Link to="/products" className="nav-link" onClick={closeMobileMenu}>Products</Link>
          <Link to="/ads" className="nav-link" onClick={closeMobileMenu}>Ads</Link>
          <Link to="/network" className="nav-link" onClick={closeMobileMenu}>Network</Link>
          <Link to="/messages" className="nav-link" onClick={closeMobileMenu}>Messages</Link>
        </nav>

        <div className="header-actions">
          <Link to="/cart" className="cart-link" aria-label="Cart" onClick={closeMobileMenu}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            {getTotalItems() > 0 && (
              <span className="cart-badge">{getTotalItems()}</span>
            )}
          </Link>

          {isAuthenticated ? (
            <>
              <Link 
                to="/my-profile" 
                className="user-name"
                onClick={closeMobileMenu}
                title="View my seller profile"
              >
                Hi, {user?.name}
              </Link>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="login-btn" onClick={closeMobileMenu}>Login</Link>
              <Link to="/register" className="register-btn" onClick={closeMobileMenu}>Sign Up</Link>
            </>
          )}

          <button 
            className="hamburger-btn" 
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
        <nav className="mobile-nav">
          <Link to="/" className="mobile-nav-link" onClick={closeMobileMenu}>Home</Link>
          <Link to="/products" className="mobile-nav-link" onClick={closeMobileMenu}>Products</Link>
          <Link to="/ads" className="mobile-nav-link" onClick={closeMobileMenu}>Ads</Link>
          <Link to="/network" className="mobile-nav-link" onClick={closeMobileMenu}>Network</Link>
          <Link to="/messages" className="mobile-nav-link" onClick={closeMobileMenu}>Messages</Link>
        </nav>
      </div>
    </header>
  );
}

