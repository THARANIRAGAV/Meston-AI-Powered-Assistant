import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiMic, FiMicOff, FiPhone, FiVideo, FiMoreVertical, FiSearch, FiMessageSquare, FiPaperclip, FiTrash2, FiUserX, FiDelete } from 'react-icons/fi';
import './AIChat.css';

// SVG Icons for WhatsApp-style ticks
const SingleTick = ({ color }) => (
  <svg viewBox="0 0 16 15" width="16" height="15" fill={color}>
    <path d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
  </svg>
);

const DoubleTick = ({ color }) => (
  <svg viewBox="0 0 16 15" width="16" height="15" fill={color}>
    <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
  </svg>
);

export default function AIChat() {
  const WELCOME_MESSAGE = "Welcome to AI Chat! 👋\n\nCommands you can use:\n• 'Add contact [Name]'\n• 'Send message to [Name]'\n• 'Video / Voice call [Name]'\n• 'Clear chat with [Name]'\n• 'Delete contact [Name]'";
  
  const [aiMessages, setAiMessages] = useState([{ sender: 'ai', text: WELCOME_MESSAGE }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const [activeView, setActiveView] = useState('AI');
  const [contactHistory, setContactHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [aiState, setAiState] = useState('IDLE');
  const [currentContact, setCurrentContact] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  
  const [activeCall, setActiveCall] = useState(null);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: '', target: '' });
  
  // Message Status and Delete Logic States
  const [msgStatus, setMsgStatus] = useState({}); 
  const [deletedForMe, setDeletedForMe] = useState([]); 
  const [deleteMenu, setDeleteMenu] = useState({ isOpen: false, msgId: null, x: 0, y: 0, isWithinMinute: false });

  const messagesEndRef = useRef(null);

  useEffect(() => { fetchContacts(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages, contactHistory, isTyping, activeView]);

  const fetchContacts = async (query = '') => {
    try {
      const url = query ? `http://localhost:8080/api/ai/contacts/search?query=${query}` : `http://localhost:8080/api/ai/contacts/list`;
      const res = await fetch(url); setContacts(await res.json());
    } catch (err) {}
  };

  const handleSearch = (e) => { setSearchTerm(e.target.value); fetchContacts(e.target.value); };

  const loadHistory = async (name) => {
    try {
      const res = await fetch(`http://localhost:8080/api/ai/chat/history?name=${name}`); 
      setContactHistory(await res.json());
    } catch (err) {}
  };

  const handleContactClick = (contactName) => {
    setActiveView(contactName); if (contactName !== 'AI') loadHistory(contactName);
  };

  const confirmModalAction = async () => {
    const { type, target } = modalConfig; setModalConfig({ isOpen: false, type: '', target: '' });
    try {
      if (type === 'CLEAR_CHAT') { await fetch(`http://localhost:8080/api/ai/chat/clear?name=${target}`, { method: 'DELETE' }); loadHistory(target); }
      else if (type === 'DELETE_CONTACT') { await fetch(`http://localhost:8080/api/ai/contacts/delete?name=${target}`, { method: 'DELETE' }); setActiveView('AI'); fetchContacts(); }
    } catch (err) {}
  };

  const handleManualSend = async (text, attachmentUrl = null) => {
    const newMsg = { contactName: activeView, sender: 'USER', content: text, attachmentUrl }; setInput('');
    try { 
      const res = await fetch('http://localhost:8080/api/ai/chat/direct', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newMsg) }); 
      const savedMsg = await res.json();

      // Trigger Realistic Read Receipt Animation
      setMsgStatus(prev => ({ ...prev, [savedMsg.id]: 'SENT' }));
      setTimeout(() => setMsgStatus(prev => ({ ...prev, [savedMsg.id]: 'DELIVERED' })), 1000);
      setTimeout(() => setMsgStatus(prev => ({ ...prev, [savedMsg.id]: 'READ' })), 3000);

      loadHistory(activeView); 
    } catch (err) {}
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/[*#_]/g, '')));
    }
  };

  const toggleListening = () => {
    if (isListening) { setIsListening(false); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript; setInput(transcript);
      if (activeView === 'AI') handleAISend(transcript); else handleManualSend(transcript);
    };
    recognition.onend = () => setIsListening(false); recognition.start();
  };

  const handleAISend = async (overrideText = null) => {
    const userText = overrideText || input; if (!userText.trim()) return;
    setInput(''); setIsTyping(true); setAiMessages(prev => [...prev, { sender: 'user', text: userText }]);

    try {
      const response = await fetch('http://localhost:8080/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText, state: aiState, currentContact: currentContact, pendingAction: pendingAction, pendingMessage: pendingMessage })
      });
      const data = await response.json();
      setAiState(data.state); setCurrentContact(data.currentContact); setPendingAction(data.pendingAction); setPendingMessage(data.pendingMessage);
      setAiMessages(prev => [...prev, { sender: 'ai', text: data.message }]); speakText(data.message);

      if (data.message.includes("📞 Connecting")) {
        setActiveCall({ name: data.currentContact, type: data.message.includes("video") ? 'Video' : 'Audio' }); setTimeout(() => setActiveCall(null), 4000);
      }
      fetchContacts();
    } catch (error) { setAiMessages(prev => [...prev, { sender: 'ai', text: "Server Error." }]); } finally { setIsTyping(false); }
  };

  // --- DELETE MESSAGE LOGIC ---
  const handleOpenDeleteMenu = (e, msg) => {
    const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now();
    const isWithinMinute = (Date.now() - msgTime) < 60000; 
    const rect = e.target.getBoundingClientRect();
    setDeleteMenu({
      isOpen: true,
      msgId: msg.id,
      isWithinMinute,
      x: rect.left - 180, // Offset to the left of the click
      y: rect.bottom + 5
    });
  };

  const executeMessageDelete = async (type) => {
    const { msgId } = deleteMenu;
    setDeleteMenu({ isOpen: false, msgId: null, x: 0, y: 0, isWithinMinute: false });

    if (type === 'ME') {
      setDeletedForMe(prev => [...prev, msgId]); // Hide locally
    } else if (type === 'EVERYONE') {
      try {
        await fetch(`http://localhost:8080/api/ai/chat/message/${msgId}`, { method: 'DELETE' });
        loadHistory(activeView); // Refresh from DB
      } catch (err) {}
    }
  };

  // Status Helper for Messages
  const renderMessageTicks = (msg) => {
    if (msg.sender !== 'USER') return null;
    const status = msgStatus[msg.id] || 'READ'; // Default to READ for older history messages
    const color = status === 'READ' ? '#4ECDC4' : 'rgba(255,255,255,0.6)'; // Blue vs Gray
    
    return (
      <span style={{ marginLeft: '6px', display: 'flex', alignItems: 'center' }}>
        {status === 'SENT' ? <SingleTick color={color} /> : <DoubleTick color={color} />}
      </span>
    );
  };

  return (
    <div className="wa-container" style={{position: 'relative'}}>
      
      {/* GLOBAL MODALS */}
      {modalConfig.isOpen && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1c1e2d', padding: '24px', borderRadius: '12px', width: '360px', textAlign: 'center', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{marginTop: 0, marginBottom: '15px'}}>{modalConfig.type === 'CLEAR_CHAT' ? 'Clear Chat' : 'Delete Contact'}</h3>
            <p style={{color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '24px'}}>Are you sure you want to proceed?</p>
            <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
              <button onClick={() => setModalConfig({ isOpen: false, type: '', target: '' })} style={{padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer'}}>Cancel</button>
              <button onClick={confirmModalAction} style={{padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#ff4d4f', color: '#fff', cursor: 'pointer'}}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING DELETE MESSAGE MENU */}
      {deleteMenu.isOpen && (
        <>
          <div className="delete-popup-overlay" onClick={() => setDeleteMenu({ ...deleteMenu, isOpen: false })} />
          <div className="delete-popup-menu" style={{ top: deleteMenu.y, left: deleteMenu.x }}>
            <button onClick={() => executeMessageDelete('ME')}>
              <FiTrash2 /> Delete for me
            </button>
            {deleteMenu.isWithinMinute && (
              <button onClick={() => executeMessageDelete('EVERYONE')}>
                <FiDelete /> Delete for everyone
              </button>
            )}
          </div>
        </>
      )}

      {/* CALL SCREEN */}
      {activeCall && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9998, background: activeCall.type === 'Video' ? '#1c1e21' : '#075e54', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{fontSize: '24px', marginBottom: '10px'}}>{activeCall.type} Calling...</div>
          <div style={{fontSize: '40px', fontWeight: 'bold', marginBottom: '50px'}}>{activeCall.name}</div>
          <div onClick={() => setActiveCall(null)} style={{ background: '#ff3b30', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '30px' }}><FiPhone style={{transform: 'rotate(135deg)'}} /></div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className="wa-sidebar">
        <div className="wa-sidebar-header"><div className="my-avatar">M</div><div className="wa-header-icons"><FiMessageSquare className="h-icon" /><FiMoreVertical className="h-icon" /></div></div>
        <div className="wa-search-bar"><div className="wa-search-inner"><FiSearch className="search-icon" /><input type="text" placeholder="Search contacts..." value={searchTerm} onChange={handleSearch} /></div></div>
        <div className="wa-chat-list">
          <div className={`wa-chat-item ${activeView === 'AI' ? 'active' : ''}`} onClick={() => handleContactClick('AI')}>
            <div className="chat-list-avatar ai-bg">AI</div><div className="wa-chat-details"><div className="wa-chat-top"><h4>AI Assistant</h4></div><div className="wa-chat-bottom"><p>Talk to Meston AI</p></div></div>
          </div>
          <div style={{borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '5px 15px'}}></div>
          {contacts.map(c => (
            <div key={c.id} className={`wa-chat-item ${activeView === c.contactName ? 'active' : ''}`} onClick={() => handleContactClick(c.contactName)}>
              <div className="chat-list-avatar" style={{background: '#6a4ee8'}}>{c.contactName.charAt(0).toUpperCase()}</div>
              <div className="wa-chat-details"><div className="wa-chat-top"><h4>{c.contactName}</h4></div><div className="wa-chat-bottom"><p>{c.phoneNumber}</p></div></div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CHAT */}
      <div className="wa-main">
        <div className="wa-main-header">
          <div className="header-left">
            <div className={`chat-avatar ${activeView === 'AI' ? 'ai-bg' : ''}`} style={{background: activeView !== 'AI' ? '#6a4ee8' : ''}}>{activeView === 'AI' ? 'AI' : activeView.charAt(0).toUpperCase()}</div>
            <div className="chat-info"><h3>{activeView === 'AI' ? 'AI Assistant' : activeView}</h3><span>{activeView === 'AI' ? 'Online' : 'Contact'}</span></div>
          </div>
          <div className="header-right">
            {activeView !== 'AI' && (
              <>
                <FiVideo className="h-icon" onClick={() => setActiveCall({name: activeView, type: 'Video'})} />
                <FiPhone className="h-icon" onClick={() => setActiveCall({name: activeView, type: 'Audio'})} />
                <FiDelete className="h-icon" onClick={() => setModalConfig({isOpen:true, type:'CLEAR_CHAT', target:activeView})} style={{marginLeft: '15px'}} />
                <FiUserX className="h-icon" onClick={() => setModalConfig({isOpen:true, type:'DELETE_CONTACT', target:activeView})} style={{color: '#ff4d4f'}} />
              </>
            )}
          </div>
        </div>

        <div className="wa-chat-area">
          {activeView === 'AI' && aiMessages.map((msg, i) => (
            <div key={i} className={`wa-message-row ${msg.sender}`}><div className={`wa-bubble ${msg.sender}`} style={{whiteSpace: 'pre-wrap'}}><p>{msg.text}</p></div></div>
          ))}

          {activeView !== 'AI' && contactHistory.filter(msg => !deletedForMe.includes(msg.id)).map((msg, i) => (
            <div key={i} className={`wa-message-row ${msg.sender === 'USER' ? 'user' : 'ai'}`}>
              <div className={`wa-bubble ${msg.sender === 'USER' ? 'user' : 'ai'}`} style={{background: msg.sender==='USER'?'#7B5CFA':'#1c1e2d', color: '#fff'}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                  <div style={{ flex: 1 }}>
                    {msg.attachmentUrl && <img src={msg.attachmentUrl} alt="attachment" style={{width:'100%', maxHeight: '250px', borderRadius:'8px', marginBottom: '8px'}} />}
                    <p>{msg.content}</p>
                  </div>
                  {msg.sender === 'USER' && (
                     <FiTrash2 style={{color: '#ff4d4f', cursor: 'pointer', flexShrink: 0}} onClick={(e) => handleOpenDeleteMenu(e, msg)} />
                  )}
                </div>
                {/* Meta details: Time and Ticks */}
                <div className={`msg-meta ${msg.sender === 'USER' ? 'user-meta' : 'ai-meta'}`}>
                  <span>{new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {renderMessageTicks(msg)}
                </div>
              </div>
            </div>
          ))}

          {isTyping && activeView === 'AI' && <div className="wa-message-row ai"><div className="wa-bubble ai typing"><span></span><span></span><span></span></div></div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="wa-input-area">
          {activeView !== 'AI' && <FiPaperclip className="wa-icon-btn" onClick={() => handleManualSend("📷 Photo", "https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=400&auto=format&fit=crop")} />}
          <form onSubmit={(e) => { e.preventDefault(); if(activeView === 'AI') handleAISend(); else handleManualSend(input); }} className="wa-form" style={{display: 'flex', gap: '10px'}}>
            <input type="text" placeholder={activeView === 'AI' ? "Speak or type 'Add contact John'..." : "Type or speak your message..."} value={input} onChange={(e) => setInput(e.target.value)} />
            <button type="button" onClick={toggleListening} style={{background: 'none', border: 'none', color: isListening ? '#ff4d4f' : '#54656f', fontSize: '24px', cursor: 'pointer', padding: '0 10px'}}>{isListening ? <FiMicOff /> : <FiMic />}</button>
          </form>
          <FiSend className={`wa-icon-btn ${input.trim() ? 'send-active' : ''}`} onClick={() => { if(activeView === 'AI') handleAISend(); else handleManualSend(input); }} />
        </div>
      </div>
    </div>
  );
}