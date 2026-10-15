// src/pages/Home/PolamRight.jsx
import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiUser, FiDownload, FiCheckCircle, FiShield, FiLock, FiX, FiPhone, FiMic, FiMicOff } from 'react-icons/fi';
import jsPDF from 'jspdf';
import './PolamRight.css';

export default function PolamRight() {
  const userData = JSON.parse(localStorage.getItem('meston_user') || '{"name":"mtharani", "email":"mtharani@meston.ai"}');
  const FALLBACK_IMG = "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400";
  
  const [userWalletBalance, setUserWalletBalance] = useState(0); 
  const [pendingFunds, setPendingFunds] = useState(0);

  useEffect(() => {
    fetch(`http://localhost:8080/api/kasupay/dashboard?email=${userData.email}`)
      .then(res => res.json()).then(data => setUserWalletBalance(data.balance)).catch(e => {});
  }, [userData.email]);
  
  const [messages, setMessages] = useState([{ id: 1, sender: 'ai', type: 'TEXT', content: "Welcome to PolamRight Assistant! 🚕🚆✈️\n\nSpeak or type 'Book a Ride', 'Book a Train', or ask a flight!" }]);
  const [input, setInput] = useState('');
  const [convoState, setConvoState] = useState('IDLE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [activeRide, setActiveRide] = useState(null);
  const [rideStatus, setRideStatus] = useState(''); 
  
  const [showWallet, setShowWallet] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showFundsPopup, setShowFundsPopup] = useState(false);
  const [generatedPin, setGeneratedPin] = useState('');
  const [userPin, setUserPin] = useState('');
  const [paxContext, setPaxContext] = useState({ count: 0, names: [], active: false });

  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const stages = ['Assigned', 'On the way', 'Reached', 'Started', 'Dropped'];
  useEffect(() => {
    let t;
    if (rideStatus === 'Assigned') t = setTimeout(() => setRideStatus('On the way'), 4000);
    else if (rideStatus === 'On the way') t = setTimeout(() => setRideStatus('Reached'), 4000);
    else if (rideStatus === 'Started') t = setTimeout(() => setRideStatus('Dropped'), 6000);
    
    if (rideStatus === 'Reached') {
        addMsg('ai', 'TEXT', "📍 Driver has arrived! Please enter PIN **2910** to start.");
        setShowPinModal(true);
    }
    if (rideStatus === 'Dropped') { processInput("reached destination", "RIDE_COMPLETED_PAY", selectedItem); }
    return () => clearTimeout(t);
  }, [rideStatus]);

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/[*#_]/g, '')));
    }
  };

  const toggleListening = () => {
    if (isListening) { setIsListening(false); window.dispatchEvent(new Event('resume-bg-mic')); return; }
    window.dispatchEvent(new Event('pause-bg-mic'));
    setTimeout(() => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { alert("Browser does not support Voice AI."); return; }
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US'; recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => { const t = event.results[0][0].transcript; setInput(t); processInput(t); };
      recognition.onend = () => { setIsListening(false); window.dispatchEvent(new Event('resume-bg-mic')); };
      try { recognition.start(); } catch (e) {}
    }, 500);
  };

  const addMsg = (sender, type, content) => { setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender, type, content }]); };

  const handleDownload = (t) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("PolamRight E-Ticket", 105, 20, null, null, "center");
    doc.setFontSize(14);
    doc.text(`PNR: ${t.pnr}`, 20, 40);
    doc.text(`Service: ${t.title}`, 20, 50);
    doc.text(`Route: ${t.from} to ${t.to}`, 20, 60);
    doc.text(`Seat: ${t.seat}`, 20, 70);
    doc.text(`Status: CONFIRMED`, 20, 80);
    doc.text(`Passenger(s):`, 20, 100);
    doc.setFontSize(12);
    const splitPax = doc.splitTextToSize(t.passenger, 170);
    doc.text(splitPax, 20, 110);
    doc.save(`PolamRight_Ticket_${t.pnr}.pdf`);
  };

  const processInput = async (rawText, overrideState = null, directData = null) => {
    let text = rawText.trim(); if (!text && !overrideState) return; if (isProcessing) return;

    let currentState = overrideState || convoState; let currentItem = directData || selectedItem;

    if (currentState === 'TRAVEL_WALLET_DEFICIT' && !overrideState) {
        if (!text.toLowerCase().includes('cancel')) { const deficit = currentItem.price - userWalletBalance; if (deficit > 0) setPendingFunds(deficit); }
    }

    if (currentState === "TRAVEL_PAX_COUNT" && !overrideState) {
        const count = parseInt(text);
        if (!isNaN(count) && count > 0) {
            addMsg('user', 'TEXT', text); setPaxContext({ count, names: [], active: true }); addMsg('ai', 'TEXT', `Enter Name & Age for Passenger 1:`); speakText("Enter name and age for passenger 1"); setConvoState('TRAVEL_COLLECTING_PAX'); return; 
        } else { addMsg('user', 'TEXT', text); addMsg('ai', 'TEXT', 'Please enter a valid number of passengers.'); return; }
    }

    if (paxContext.active && !overrideState) {
        addMsg('user', 'TEXT', text); const updatedNames = [...paxContext.names, text];
        if (updatedNames.length < paxContext.count) {
            setPaxContext({ ...paxContext, names: updatedNames }); addMsg('ai', 'TEXT', `Enter Name & Age for Passenger ${updatedNames.length + 1}:`); speakText(`Enter Name and Age for Passenger ${updatedNames.length + 1}`); setInput(''); return; 
        } else {
            setPaxContext({ count: 0, names: [], active: false }); addMsg('ai', 'TEXT', "✅ All passenger details recorded."); text = "pax done"; currentState = "TRAVEL_CONFIRM_DETAILS"; currentItem = { ...currentItem, passengerData: updatedNames.join(" | ") }; setSelectedItem(currentItem);
        }
    } else {
        if (text && !['DRIVER_ASSIGN_EXEC', 'RIDE_COMPLETED_PAY', 'RIDE_START_PIN', 'TRAVEL_FINISH'].includes(currentState)) { addMsg('user', 'TEXT', text); }
    }
    
    setInput(''); setIsProcessing(true); if (directData) setSelectedItem(directData);

    try {
      const res = await fetch('http://localhost:8080/api/transport/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, state: currentState, selectedItem: currentItem, walletBalance: userWalletBalance, userEmail: userData.email, passengerData: currentItem?.passengerData || userData.name }) });
      const data = await res.json();
      setConvoState(data.newState);

      if (data.reply) { addMsg('ai', 'TEXT', data.reply); speakText(data.reply); }
      if (data.uiType === 'DATE_GRID') addMsg('ai', 'DATE_GRID', null);
      if (data.uiType === 'CAROUSEL') addMsg('ai', 'CAROUSEL', data.items);
      
      if (data.uiType === 'ADD_FUNDS_WAIT') {
          setTimeout(() => { setUserWalletBalance(prev => prev + (currentItem.price - userWalletBalance)); processInput("funds_added", "TRAVEL_PAX_COUNT_TRIGGER", currentItem); }, 3000);
      }
      if (data.uiType === 'SEARCH_ANIM') { addMsg('ai', 'RADAR', currentItem); setTimeout(() => processInput("found", "DRIVER_ASSIGN_EXEC", currentItem), 4000); }
      if (data.uiType === 'DRIVER_CARD') { setActiveRide(data.driver); setRideStatus('Assigned'); addMsg('ai', 'DRIVER_CARD', data.driver); }
      if (data.uiType === 'RIDE_STARTED_SUCCESS') setRideStatus('Started');
      if (data.uiType === 'KASUPAY_MODAL') { setGeneratedPin(data.authPin); setShowWallet(true); }
      if (data.uiType === 'TICKET_WAIT') { setTimeout(() => processInput("generate", "TRAVEL_FINISH", currentItem), 3000); }
      if (data.uiType === 'TICKET_TABLE') { addMsg('ai', 'TICKET_TABLE', data.ticket); }

    } catch (e) { addMsg('ai', 'TEXT', "⚠️ Connection Error."); } finally { setIsProcessing(false); }
  };

  const handleKasuPaySubmit = () => {
      if(userPin === generatedPin) { 
          setShowWallet(false); setUserPin(''); 
          const executeDatabasePayment = () => {
              setUserWalletBalance(prev => prev - selectedItem.price);
              fetch('http://localhost:8080/api/kasupay/deduct', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userEmail: userData.email, amount: selectedItem.price, reason: `PolamRight Booking: ${selectedItem.name}` }) });
          };
          if (pendingFunds > 0) {
              setShowFundsPopup(true); setUserWalletBalance(prev => prev + pendingFunds);
              setTimeout(() => { setShowFundsPopup(false); setPendingFunds(0); processInput("success", "PAYMENT_SUCCESS", selectedItem); executeDatabasePayment(); }, 3000);
          } else { processInput("success", "PAYMENT_SUCCESS", selectedItem); executeDatabasePayment(); }
      } else { alert("PIN Incorrect!"); }
  };

  const isStepDone = (step) => stages.indexOf(rideStatus) >= stages.indexOf(step);

  return (
    <div className="polam-container">
      <div className="polam-sidebar">
        <div className="map-frame"><iframe title="m" src="https://www.openstreetmap.org/export/embed.html?bbox=80.24,12.96,80.25,12.98&layer=mapnik&marker=12.97,80.24" /></div>
        
        {activeRide && (
            <div className="sidebar-ride-box">
                <div className="s-status-header">OTP: {activeRide.otp}</div>
                <div className="s-flow"> {stages.map(s => ( <div key={s} className={`s-pnt ${isStepDone(s) ? 'fill' : ''}`}>{s}</div> ))} </div>
                <button className="s-cancel-btn" disabled={['Reached', 'Started', 'Dropped'].includes(rideStatus)} onClick={() => { setActiveRide(null); setRideStatus(''); setConvoState('IDLE'); addMsg('ai', 'TEXT', 'Ride cancelled.'); }}>Cancel Ride</button>
                {rideStatus === 'Dropped' && <div className="s-final-badge"><FiCheckCircle/> Travel Successful</div>}
            </div>
        )}
      </div>

      <div className="polam-chat-pane">
        <div className="p-header">PolamRight Assistant</div>
        <div className="p-stream" ref={scrollRef}>
            {messages.map(m => {
                if (m.type === 'TEXT') return <div key={m.id} className={`p-bubble ${m.sender}`} style={{whiteSpace: 'pre-wrap'}}>{m.content}</div>;
                
                if (m.type === 'DATE_GRID') return (
                  <div key={m.id} className="date-picker-grid">
                    {['15 Apr', '16 Apr', '17 Apr', '18 Apr'].map(d => ( 
                      <button key={d} className="date-btn" onClick={() => processInput(d)}>
                        <span>{d.split(' ')[0]}</span><small>{d.split(' ')[1]}</small>
                      </button> 
                    ))}
                  </div>
                );

                if (m.type === 'CAROUSEL') return (
                  <div key={m.id} className="p-carousel">
                      {m.content.map((v, i) => (
                          <div key={i} className="p-card" onClick={() => { const isRide = ['Bike', 'Auto', 'Mini'].includes(v.name); processInput(v.name, isRide ? "RIDE_CONFIRM_VEHICLE" : "TRAVEL_SELECT_VEHICLE", v); }}>
                              <div className="p-img-box"><img src={v.image} alt={v.name} onError={(e)=>{e.target.src=FALLBACK_IMG}}/></div>
                              <div className="p-card-body"><b>{v.name}</b><br/>₹{v.price}</div>
                          </div>
                      ))}
                  </div>
                );

                if (m.type === 'RADAR') return ( 
                  <div key={m.id} className="radar-container">
                    <div className="radar">
                      <img src={m.content?.image || FALLBACK_IMG} alt="searching" onError={(e)=>{e.target.src=FALLBACK_IMG}}/>
                    </div>
                  </div> 
                );
                
                if (m.type === 'DRIVER_CARD') return ( 
                  <div key={m.id} className="p-driver-ui-card">
                    <div className="pd-header"><FiUser/> Driver Assigned</div>
                    <div className="pd-body">
                      <h3>{m.content.name}</h3>
                      <p>{m.content.model}</p>
                      <div className="pd-plate">{m.content.plate}</div>
                    </div>
                    <div className="pd-footer">
                      <button className="pd-call"><FiPhone/> Call</button>
                      <div className="pd-otp-box">PIN: <b>{m.content.otp}</b></div>
                    </div>
                  </div> 
                );

                if (m.type === 'TICKET_TABLE') return (
                  <div key={m.id} className="ticket-table-ui">
                      <div className="tt-h">E-TICKET <FiDownload className="dl-icon" onClick={() => handleDownload(m.content)} /></div>
                      <table><thead><tr><th>From</th><th>To</th><th>Seat</th></tr></thead><tbody><tr><td>{m.content.from}</td><td>{m.content.to}</td><td><b>{m.content.seat}</b></td></tr></tbody></table>
                      <div className="tt-pax-list"><strong>Passengers:</strong><br/>{m.content.passenger}</div>
                      <div className="tt-f"><span>PNR: {m.content.pnr}</span> <span>{m.content.title}</span></div>
                  </div>
                );

                return null;
            })}
        </div>
        
        <div className="p-input-bar">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key==='Enter' && processInput(input)} placeholder="Type or speak a command..." disabled={isProcessing} />
            <button onClick={toggleListening} style={{background: isListening ? '#ef4444' : '#7B5CFA'}}>{isListening ? <FiMicOff/> : <FiMic/>}</button>
            <button onClick={() => processInput(input)} disabled={isProcessing}><FiSend/></button>
        </div>
      </div>

      {showPinModal && (
          <div className="kasu-overlay">
              <div className="kasu-modal orange-brd">
                  <div className="km-h orange-bg"><FiCheckCircle /> Driver Arrived!</div>
                  <div className="km-b">
                      <p>Your driver is waiting at the pickup location. Enter PIN <b>2910</b> to start your journey:</p>
                      <div className="km-pin-input"><FiLock /><input type="password" maxLength="4" value={userPin} onChange={e => setUserPin(e.target.value)} autoFocus/></div>
                      <button className="km-pay-btn orange-bg" onClick={() => { if(userPin === '2910') { setShowPinModal(false); setUserPin(''); processInput("2910", "RIDE_START_PIN"); } else alert("PIN Incorrect!"); }}>Start Journey</button>
                  </div>
              </div>
          </div>
      )}

      {showWallet && (
          <div className="kasu-overlay">
              <div className="kasu-modal">
                  <div className="km-h"><FiShield /> <span>KasuPay Settlement</span> <FiX onClick={() => setShowWallet(false)} className="km-x" /></div>
                  <div className="km-b">
                      <div style={{fontSize: '12px', color: '#10b981', fontWeight: 'bold', marginBottom: '10px'}}>Secure Auth Balance: ₹{userWalletBalance}</div>
                      <div className="km-amt">₹{selectedItem?.price}</div>
                      <p>Payment for your booking. Enter the random code shown in chat to authorize:</p>
                      <div className="km-pin-input"><FiLock /><input type="password" maxLength="4" value={userPin} onChange={e => setUserPin(e.target.value)} /></div>
                      <button className="km-pay-btn" onClick={handleKasuPaySubmit}>Authorize Payment</button>
                  </div>
                  <div className="km-f">Verification Code: <b>{generatedPin}</b></div>
              </div>
          </div>
      )}

      {showFundsPopup && (
          <div className="kasu-overlay">
              <div className="funds-popup">
                  <FiCheckCircle size={50} color="#fff" style={{marginBottom: '15px'}}/>
                  <h3>Funds Received!</h3>
                  <p>₹{pendingFunds} has been credited to your KasuPay wallet by your contact.</p>
                  <p style={{fontSize: '13px', marginTop: '20px', opacity: 0.8}}>Proceeding to generate ticket...</p>
              </div>
          </div>
      )}
    </div>
  );
}