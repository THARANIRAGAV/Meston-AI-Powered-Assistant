import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AIChat from './AIChat';
import MailTo from './MailTo';
import Unavagam from './Unavagam';
import PolamRight from './PolamRight';
import KasuPay from './KasuPay';
import Maruthuvam from './Maruthuvam'; 
import MestonFlow from './MestonFlow'; 
import { FiHome, FiMessageSquare, FiMail, FiCoffee, FiCreditCard, FiMap, FiActivity, FiLayers, FiSettings, FiLogOut, FiChevronDown, FiUser, FiZap, FiCalendar, FiMic, FiSend } from 'react-icons/fi';
import './Home.css';

const NAV_ITEMS = [
  { id: 'home',   icon: <FiHome />,          label: 'Home' },
  { id: 'chat',   icon: <FiMessageSquare />, label: 'AI Chat' },
  { id: 'mail',   icon: <FiMail />,          label: 'MailTo' },
  { id: 'food',   icon: <FiCoffee />,        label: 'Unavagam' },
  { id: 'pay',    icon: <FiCreditCard />,    label: 'KasuPay' },
  { id: 'ride',   icon: <FiMap />,           label: 'PolamRight' },
  { id: 'health', icon: <FiActivity />,      label: 'Maruthuvam' }, 
  { id: 'flow',   icon: <FiLayers />,        label: 'MestonFlow' }
];

const TECH_DATES = [
  { date: 'Apr 07', event: 'World Health Day' },
  { date: 'Apr 14', event: 'Quantum Day' },
  { date: 'Apr 21', event: 'Innovation Day' },
  { date: 'May 01', event: 'Global AI Summit' }
];

const THEME_COLORS = ['#7B5CFA', '#00C9C8', '#FA5C7B', '#F5A623', '#4CAF50', '#EF4444'];

function Home() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(() => JSON.parse(localStorage.getItem('meston_user') || '{"name":"mtharani", "email":"mtharani@meston.ai"}'));
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('meston_theme') || '#7B5CFA');
  const initials = userData.name.substring(0, 2).toUpperCase();
  const [time, setTime] = useState(new Date());
  const [activeNav, setActiveNav] = useState(localStorage.getItem('meston_activeNav') || 'home');
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [query, setQuery] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [pendingRedirection, setPendingRedirection] = useState(null);

  const profileRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    localStorage.setItem('meston_activeNav', activeNav);
  }, [activeNav]);

  useEffect(() => {
    document.documentElement.style.setProperty('--theme-color', themeColor);
    localStorage.setItem('meston_theme', themeColor);
  }, [themeColor]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const fallbackToWikipedia = async (textInput) => {
    try {
      const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(textInput)}`;
      const response = await fetch(searchUrl);
      if (response.ok) {
        const data = await response.json();
        setAiResponse(`Namma AI (Web Search): ${data.extract || "I couldn't find a detailed answer on the web."}`);
      } else {
        setAiResponse(`I couldn't find a direct answer for "${textInput}". Could you rephrase your question?`);
      }
    } catch(e) {
       setAiResponse("Network error. Unable to reach the AI server or the internet.");
    }
    setAiTyping(false);
  };

  const processSearch = async (textInput) => {
    const cleanQuery = textInput.trim().toLowerCase();
    if (!cleanQuery) return;

    setAiTyping(true);
    setAiResponse(null);
    setQuery('');

    // 1. PENDING CONFIRMATION
    if (pendingRedirection) {
      if (['yes', 'y', 'sure', 'ok', 'proceed', 'redirect'].includes(cleanQuery)) {
        setActiveNav(pendingRedirection.id);
        setPendingRedirection(null);
        setAiTyping(false);
      } else if (['no', 'n', 'cancel', 'stop', 'stay'].includes(cleanQuery)) {
        setPendingRedirection(null);
        setAiResponse("Redirection cancelled. What else can I help you with today?");
        setAiTyping(false);
      } else {
        setAiResponse(`Please type 'yes' to proceed to ${pendingRedirection.name}, or 'no' to cancel.`);
        setAiTyping(false);
      }
      return;
    }

    // 2. SMARTER FEATURE DETECTION 
    let targetModule = null;
    const isIntent = (keywords) => keywords.some(kw => cleanQuery.includes(kw));

    if (isIntent(['open mail', 'send an email', 'check inbox'])) {
      targetModule = { id: 'mail', name: 'MailTo' };
    } else if (isIntent(['open chat', 'go to chat', 'ai chat'])) {
      targetModule = { id: 'chat', name: 'AI Chat' };
    } else if (isIntent(['order food', 'open unavagam', 'food delivery'])) {
      targetModule = { id: 'food', name: 'Unavagam' };
    } else if (isIntent(['open kasupay', 'make a payment', 'transfer money'])) {
      targetModule = { id: 'pay', name: 'KasuPay' };
    } else if (isIntent(['book a ride', 'book a cab', 'open polamright'])) {
      targetModule = { id: 'ride', name: 'PolamRight' };
    } else if (isIntent(['open maruthuvam', 'medical emergency', 'book a doctor'])) {
      targetModule = { id: 'health', name: 'Maruthuvam' }; 
    } else if (isIntent(['build a software project', 'build a new app', 'open mestonflow'])) {
      targetModule = { id: 'flow', name: 'MestonFlow AI' }; 
    }

    // If it matches a strict feature intent, ask to redirect
    if (targetModule) {
      setPendingRedirection(targetModule);
      setAiResponse(`It looks like your request is related to the ${targetModule.name} feature. Should I redirect you there? (yes/no)`);
      setAiTyping(false);
      return;
    }

    // 3. BACKEND AI INTEGRATION 
    try {
      const res = await fetch(`http://localhost:8080/api/mestonflow/ask-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: textInput })
      });
      
      if (res.ok) {
        const data = await res.json();
        setAiResponse(`Namma AI:\n\n${data.answer}`);
        setAiTyping(false);
      } else {
        fallbackToWikipedia(textInput);
      }
    } catch (error) {
      fallbackToWikipedia(textInput);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    processSearch(query);
  };

  return (
    <div className="home-page">
      <div className="home-orb home-orb-1" />
      <div className="home-orb home-orb-2" />
      <div className="home-grid" />

      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">M</div>
          <span className="sidebar-logo-text">MES<span>TON</span></span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button 
              key={item.id} 
              className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => { setActiveNav(item.id); setAiResponse(null); setPendingRedirection(null); }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setShowSettingsModal(true)}>
            <FiSettings className="nav-icon" />
            <span className="nav-label">Settings</span>
          </button>
          <button className="nav-item logout-red" onClick={() => setShowLogoutModal(true)}>
            <FiLogOut className="nav-icon" />
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>

      <div className="home-main">
        <div className="top-running-ticker">
          <div className="ticker-label"><FiZap /> LIVE FEED</div>
          <div className="ticker-container">
            <div className="ticker-track">
              <span>AI breakthrough reported in Quantum Processing • Global Carbon shift hits 2026 Milestone • Meston Update live • MestonFlow AI Module Launched • Maruthuvam Health Module Live • </span>
              <span>AI breakthrough reported in Quantum Processing • Global Carbon shift hits 2026 Milestone • Meston Update live • MestonFlow AI Module Launched • Maruthuvam Health Module Live • </span>
            </div>
          </div>
        </div>

        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-time">{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
            <div className="topbar-date">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div className="topbar-right">
            <div className="profile-sec" ref={profileRef}>
              <div className="profile-btn-pill" onClick={() => setShowProfile(!showProfile)}>
                <div className="p-circle">{initials}</div>
                <div className="p-name">{userData.name}</div>
                <FiChevronDown className={`chev ${showProfile ? 'open' : ''}`} />
              </div>
              {showProfile && (
                <div className="profile-drop-card">
                  <div className="user-h">
                    <strong>{userData.name}</strong><span>{userData.email}</span>
                  </div>
                  <button className="p-item logout-c" onClick={() => { setShowProfile(false); setShowLogoutModal(true); }}>
                    <FiLogOut /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-viewport" style={{ padding: activeNav !== 'home' ? '20px' : '0' }}>
          {activeNav === 'home' && (
            <div className="home-dashboard-wrapper">
              <div className="stats-row">
                <div className="glass-stats-card">
                  <div className="stats-title"><FiCalendar /> CRITICAL TECH DATES</div>
                  <div className="stats-grid">
                    {TECH_DATES.map((d, i) => (
                      <div key={i} className="stats-item"><span>{d.date}</span> {d.event}</div>
                    ))}
                  </div>
                </div>
              </div>

              <main className="brand-center-focus">
                <div className="greeting-text">Good afternoon, {userData.name} 👋</div>
                <div className="meston-branding">
                  <h1 className="meston-title">MESTON</h1>
                  <p className="meston-tagline">namma ai</p>
                </div>
                <h2 className="assist-query">What can I help you with today?</h2>
                
                <div className="suggestion-chips">
                  <button className="chip-btn" onClick={() => processSearch("build a software project")}>Build a new app</button> 
                  <button className="chip-btn" onClick={() => processSearch("order food")}>Order Food</button> 
                </div>

                <div className="search-bar-container">
                  <form className={`ultimate-search-bar ${isListening ? 'listening' : ''}`} onSubmit={handleSearchSubmit}>
                    <input className="u-input" type="text" placeholder={pendingRedirection ? "Type 'yes' or 'no'..." : "Ask Meston anything..."} value={query} onChange={e => setQuery(e.target.value)}/>
                    <div className="u-actions">
                      <button type="submit" className="u-send" disabled={!query.trim()}><FiSend /></button>
                    </div>
                  </form>
                  {(aiTyping || aiResponse) && (
                    <div className="namma-response-box">
                      <div className="n-tag">NAMMA AI</div>
                      {/* NEW: Added whiteSpace: 'pre-wrap' so line breaks and code formatting are preserved! */}
                      {aiTyping ? <span style={{color: '#aaa'}}>Processing request...</span> : <div style={{fontSize: '14px', lineHeight: '1.6', color: pendingRedirection ? '#00C9C8' : '#e2e8f0', whiteSpace: 'pre-wrap', fontFamily: 'inherit'}}>{aiResponse}</div>}
                    </div>
                  )}
                </div>
              </main>
            </div>
          )}
          {activeNav === 'chat' && <AIChat />}
          {activeNav === 'mail' && <MailTo />}
          {activeNav === 'food' && <Unavagam />}
          {activeNav === 'ride' && <PolamRight />}
          {activeNav === 'pay'  && <KasuPay />}
          {activeNav === 'health' && <Maruthuvam />}
          {activeNav === 'flow' && <MestonFlow />} 
        </div>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="logout-modal">
            <FiLogOut className="m-icon" />
            <h2>Sign Out</h2>
            <p>Are you sure you want to log out of Meston AI?</p>
            <div className="m-btns">
              <button className="m-btn cancel" onClick={() => setShowLogoutModal(false)}>Cancel</button>
              <button className="m-btn danger" onClick={handleLogout}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="logout-modal" style={{width: '420px'}}>
            <h2>Settings</h2>
            <p>Customize your Meston AI experience.</p>
            
            <div className="settings-form">
              <div className="s-group">
                <label>Display Name</label>
                <input 
                  type="text" 
                  className="s-input" 
                  value={userData.name} 
                  onChange={(e) => setUserData({...userData, name: e.target.value})}
                />
              </div>
              <div className="s-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  className="s-input" 
                  value={userData.email} 
                  onChange={(e) => setUserData({...userData, email: e.target.value})}
                />
              </div>
              <div className="s-group" style={{marginTop: '10px'}}>
                <label>Accent Color</label>
                <div className="color-picker">
                  {THEME_COLORS.map(color => (
                    <button 
                      key={color}
                      className={`color-btn ${themeColor === color ? 'selected' : ''}`}
                      style={{backgroundColor: color}}
                      onClick={() => setThemeColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="m-btns">
              <button className="m-btn cancel" onClick={() => setShowSettingsModal(false)}>Close</button>
              <button className="m-btn confirm" onClick={() => {
                localStorage.setItem('meston_user', JSON.stringify(userData));
                setShowSettingsModal(false);
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;