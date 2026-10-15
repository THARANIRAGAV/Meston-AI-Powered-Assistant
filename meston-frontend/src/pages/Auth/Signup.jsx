import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState({ width: '0%', color: 'transparent', label: '' });
  const [terms, setTerms] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setGlobalError('');
    if (name === 'password') checkStrength(value);
    validateField(name, value);
  };

  const checkStrength = (p) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    const levels = [
      { width: '0%', color: 'transparent', label: '' },
      { width: '25%', color: '#FF5E5E', label: 'Weak' },
      { width: '50%', color: '#FFA94D', label: 'Fair' },
      { width: '75%', color: '#FFD93D', label: 'Good' },
      { width: '100%', color: '#4ECDC4', label: 'Strong' },
    ];
    setStrength(levels[score] || levels[0]);
  };

  const validateField = (name, value) => {
    let msg = '';
    if (name === 'name' && value && value.trim().length < 2) msg = 'Name is too short';
    if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) msg = 'Enter a valid email';
    if (name === 'password' && value && value.length < 6) msg = 'Minimum 6 characters';
    if (name === 'confirm' && value && value !== form.password) msg = 'Passwords do not match';
    setErrors(prev => ({ ...prev, [name]: msg }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');
    const { name, email, password, confirm } = form;

    if (!name || !email || !password || !confirm) { setGlobalError('Please fill in all fields.'); return; }
    if (name.trim().length < 2) { setGlobalError('Please enter your full name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setGlobalError('Enter a valid email address.'); return; }
    if (password.length < 6) { setGlobalError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setGlobalError('Passwords do not match.'); return; }
    if (!terms) { setGlobalError('Please accept the Terms of Service to continue.'); return; }

    setLoading(true);
    try {
      // TODO: Replace with real API call
      // await axios.post('/api/auth/signup', { name, email, password });
      navigate('/login');
    } catch (err) {
      setGlobalError('Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = () => (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
  const EyeOffIcon = () => (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  return (
    <div className="auth-page">
      <div className="auth-orb orb1" />
      <div className="auth-orb orb2" />
      <div className="auth-orb orb3" />
      <div className="auth-grid" />

      <div className="auth-card">
        <div className="auth-logo">MES<span>TON</span></div>
        <div className="auth-tagline">CREATE YOUR ACCOUNT</div>

        {/* TABS — Signup active, Login as Link */}
        <div className="auth-tabs">
          <Link to="/login" className="auth-tab-inactive">Login</Link>
          <span className="auth-tab-active">Sign Up</span>
        </div>

        <form onSubmit={handleSubmit}>
          {globalError && (
            <div className="auth-error-box" style={{ display: 'block' }}>
              {globalError}
            </div>
          )}

          {/* Full Name */}
          <div className="auth-field">
            <label>Full Name</label>
            <div className="auth-input-wrap">
              <input type="text" name="name" placeholder="Your full name" value={form.name} onChange={handleChange} />
            </div>
            {errors.name && <div className="field-error" style={{ display: 'block' }}>{errors.name}</div>}
          </div>

          {/* Email */}
          <div className="auth-field">
            <label>Email Address</label>
            <div className="auth-input-wrap">
              <input type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} />
            </div>
            {errors.email && <div className="field-error" style={{ display: 'block' }}>{errors.email}</div>}
          </div>

          {/* Password */}
          <div className="auth-field">
            <label>Password</label>
            <div className="auth-input-wrap">
              <input 
                type={showPass ? 'text' : 'password'} 
                name="password"
                placeholder="Create a strong password" 
                value={form.password}
                onChange={handleChange}
                style={{ paddingRight: '48px' }}
              />
              <button type="button" className="eye-toggle" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {/* Strength bar */}
            <div className="strength-bar">
              <div className="strength-fill" style={{ width: strength.width, background: strength.color }} />
            </div>
            {strength.label && (
              <div style={{ fontSize: '11px', marginTop: '4px', color: strength.color, fontWeight: 600 }}>
                {strength.label}
              </div>
            )}
            {errors.password && <div className="field-error" style={{ display: 'block' }}>{errors.password}</div>}
          </div>

          {/* Confirm Password */}
          <div className="auth-field">
            <label>Confirm Password</label>
            <div className="auth-input-wrap">
              <input 
                type={showConfirm ? 'text' : 'password'} 
                name="confirm"
                placeholder="Re-enter your password" 
                value={form.confirm}
                onChange={handleChange}
                style={{ paddingRight: '48px' }}
              />
              <button type="button" className="eye-toggle" onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.confirm && <div className="field-error" style={{ display: 'block' }}>{errors.confirm}</div>}
          </div>

          {/* Terms */}
          <div className="check-row">
            <input type="checkbox" id="terms" checked={terms} onChange={e => setTerms(e.target.checked)} />
            <label htmlFor="terms">
              I agree to the{' '}
              <span style={{ color: '#7B5CFA', cursor: 'pointer' }}>Terms of Service</span>
              {' '}and{' '}
              <span style={{ color: '#7B5CFA', cursor: 'pointer' }}>Privacy Policy</span>
            </label>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <><span className="spinner" />Creating Account...</> : 'Create My Account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;