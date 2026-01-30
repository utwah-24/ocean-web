import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CountryDropdown } from '../components/CountryDropdown';
import './Auth.css';

export function Login() {
  // Backend expects country_code in the form "🇹🇿TZ" (flag + ISO2)
  // We keep ISO2 in state and let the API client normalize it.
  const [countryCode, setCountryCode] = useState('TZ');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate inputs
      if (!phone.trim()) {
        setError('Please enter your phone number');
        setLoading(false);
        return;
      }
      if (!password.trim()) {
        setError('Please enter your password');
        setLoading(false);
        return;
      }

      console.log('[Login] Attempting login with:', {
        countryCode,
        phone: phone.trim(),
        phoneLength: phone.trim().length,
      });

      const response = await apiService.login(countryCode, phone.trim(), password);
      
      if (response && response.token && response.user) {
        login(response.token, response.user);
        navigate('/');
      } else {
        setError('Invalid response from server. Please try again.');
      }
    } catch (err: any) {
      console.error('[Login] Error:', err);
      
      // Parse error message to provide more helpful feedback
      let errorMessage = err.message || 'Login failed. Please check your credentials.';

      // If backend returned field-level validation (e.g. "country_code: ..."),
      // show it directly instead of replacing with generic messaging.
      const looksLikeFieldValidation =
        typeof errorMessage === 'string' &&
        /(^|\s)(country_code|phone|password)\s*:\s*/i.test(errorMessage);
      if (looksLikeFieldValidation) {
        setError(errorMessage);
        return;
      }
      
      // Check for common error patterns
      if (errorMessage.toLowerCase().includes('invalid data') || 
          errorMessage.toLowerCase().includes('validation') ||
          errorMessage.toLowerCase().includes('422')) {
        errorMessage = 'Invalid phone number or password. Please check your credentials and try again.';
      } else if (errorMessage.toLowerCase().includes('401') || 
                 errorMessage.toLowerCase().includes('unauthorized')) {
        errorMessage = 'Invalid credentials. Please check your phone number and password.';
      } else if (errorMessage.toLowerCase().includes('404') || 
                 errorMessage.toLowerCase().includes('not found')) {
        errorMessage = 'User not found. Please check your phone number.';
      } else if (errorMessage.toLowerCase().includes('network') || 
                 errorMessage.toLowerCase().includes('fetch')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Orange Header */}
      <div className="login-header">
        <div className="login-logo-container">
          <div className="login-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="white" strokeWidth="2" fill="none" />
              <circle cx="20" cy="20" r="8" fill="#ff8c42" />
            </svg>
          </div>
          <span className="login-logo-text">Ocean</span>
        </div>
      </div>

      {/* White Content Section */}
      <div className="login-content">
        <h1 className="login-title">Login</h1>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {/* Phone Number Input */}
          <div className="phone-input-group">
            <CountryDropdown
              value={countryCode}
              valueType="iso2"
              onChange={setCountryCode}
              ariaLabel="Select country code"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="phone-input"
              required
            />
          </div>

          {/* Password Input */}
          <div className="password-input-group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="lock-icon">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="password-input"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="password-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              )}
            </button>
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <Link to="/forgot-password" className="forgot-password-link">
          Forgot Password?
        </Link>

        <p className="register-link-text">
          Don't have an account? <Link to="/register" className="register-link">Register here.</Link>
        </p>
      </div>
    </div>
  );
}

