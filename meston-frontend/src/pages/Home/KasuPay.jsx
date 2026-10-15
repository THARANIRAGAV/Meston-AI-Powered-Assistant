import React, { useState, useEffect, useRef } from 'react';
import { FiShield, FiSend, FiLock, FiX, FiCheckCircle, FiClock, FiXCircle, FiFileText, FiRefreshCw, FiZap, FiDownload, FiCamera, FiArrowDownLeft } from 'react-icons/fi';
import './KasuPay.css';

export default function KasuPay() {
  const userData = JSON.parse(localStorage.getItem('meston_user') || '{"name":"mtharani", "email":"mtharani@meston.ai"}');
  const [dashboard, setDashboard] = useState({ balance: 0, upiId: '', bankName: '', accNoMasked: '', transactions: [] });
  const [messages, setMessages] = useState([{ id: 1, sender: 'ai', type: 'TEXT', content: "Welcome to KasuPay Secure! 🛡️\n\nI am your conversational UPI assistant. Type 'Send Money', 'Check Balance', 'Scan QR', or 'Pay Bills'." }]);
  const [input, setInput] = useState('');
  const [convoState, setConvoState] = useState('IDLE');
  const [context, setContext] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [mpin, setMpin] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`http://localhost:8080/api/kasupay/dashboard?email=${userData.email}`);
      const data = await res.json();
      setDashboard(data);
    } catch (e) { console.error("DB Error"); }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const addMsg = (sender, type, content) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender, type, content }]);
  };

  const handleDownloadReceipt = (txn) => {
    const data = `--- KASUPAY SECURE RECEIPT ---\nRef ID: ${txn.txnRef}\nStatus: ${txn.status}\nAmount: INR ${txn.amount}\nTo: ${txn.receiverName} (${txn.receiverVpa})\nDate: ${new Date(txn.timestamp).toLocaleString()}\n\nPowered by Meston NPCI Switch`;
    const element = document.createElement("a");
    const file = new Blob([data], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `KasuPay_Receipt_${txn.txnRef}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  const processInput = async (rawText, overrideState = null) => {
    const text = rawText.trim();
    if (!text && !overrideState) return;
    if (isProcessing) return;

    if (text && !['AWAIT_PIN_SEND', 'AWAIT_PIN_BALANCE', 'SIMULATE_RECEIVE'].includes(overrideState || convoState)) {
      addMsg('user', 'TEXT', text);
    }
    setInput('');
    setIsProcessing(true);

    try {
      const payload = { text: text, state: overrideState || convoState, context: context, userEmail: userData.email };
      const res = await fetch('http://localhost:8080/api/kasupay/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      setConvoState(data.newState);
      setContext(data.context);
      
      if (data.reply) addMsg('ai', 'TEXT', data.reply);
      if (data.uiType === 'MPIN_MODAL') { setMpin(''); setShowPinModal(true); }
      if (data.uiType === 'QR_MODAL') { setShowQrModal(true); }
      if (data.uiType === 'RECEIPT_CARD') { addMsg('ai', 'RECEIPT', data.context); }
      
      // Simulates the user receiving their requested money after a delay without user input
      if (data.uiType === 'REQUEST_WAIT') {
        setTimeout(() => {
            processInput(data.context.amount.toString(), 'SIMULATE_RECEIVE');
        }, 5000);
      }
      
      if (data.refreshDashboard) fetchDashboard();

    } catch (e) {
      addMsg('ai', 'TEXT', "⚠️ Network Error. Secure session reset.");
      setConvoState('IDLE');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMpinPress = (num) => {
    if (mpin.length < 4) {
      const newMpin = mpin + num;
      setMpin(newMpin);
      if (newMpin.length === 4) {
        setShowPinModal(false);
        setTimeout(() => processInput(newMpin, convoState), 300);
      }
    }
  };

  return (
    <div className="kasupay-container">
      <div className="kp-sidebar">
        <div className="kp-bank-card">
          <div className="bc-header"><FiShield /> KASUPAY SECURE</div>
          <div className="bc-bank">{dashboard.bankName || 'Loading...'} {dashboard.accNoMasked}</div>
          <div className="bc-upi">{dashboard.upiId}</div>
          <div className="bc-chip"></div>
        </div>
        <div className="kp-history-section">
          <div className="hs-header">Recent Transactions <FiRefreshCw style={{cursor:'pointer'}} onClick={fetchDashboard}/></div>
          <div className="hs-list">
            {dashboard.transactions.length === 0 ? <p className="hs-empty">No recent transactions.</p> :
              dashboard.transactions.map(txn => {
                const isReceive = txn.txnType === 'P2P_RECEIVE';
                return (
                  <div key={txn.id} className="hs-item">
                    <div className="hs-icon-col">
                      {txn.status === 'SUCCESS' ? <FiCheckCircle color="#10b981"/> :
                       txn.status === 'PENDING' ? <FiClock color="#f59e0b"/> : <FiXCircle color="#ef4444"/>}
                    </div>
                    <div className="hs-details">
                      <strong>{isReceive ? `From: ${txn.senderUpiId.split('@')[0]}` : `To: ${txn.receiverName}`}</strong>
                      <span>{new Date(txn.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className={`hs-amount ${txn.status}`}>{isReceive ? '+' : '-'} ₹{txn.amount}</div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>

      <div className="kp-chat-pane">
        <div className="kp-header">
          <div style={{display:'flex', alignItems:'center', gap:'8px'}}><FiShield style={{color: '#3b82f6'}}/> KasuPay Assistant</div>
        </div>
        <div className="kp-stream" ref={scrollRef}>
          {messages.map(m => {
            if (m.type === 'TEXT') return <div key={m.id} className={`kp-bubble ${m.sender}`}>{m.content}</div>;
            if (m.type === 'RECEIPT') {
              const ctx = m.content;
              const isSuccess = ctx.status === 'SUCCESS';
              const isPending = ctx.status === 'PENDING';
              return (
                <div key={m.id} className={`kp-receipt ${isSuccess ? 'success' : isPending ? 'pending' : 'failed'}`}>
                  <div className="rc-icon">
                    {isSuccess ? <FiCheckCircle /> : isPending ? <FiClock /> : <FiXCircle />}
                  </div>
                  <h3>₹{ctx.amount}</h3>
                  <p>To: <b>{ctx.receiverName}</b></p>
                  <p style={{fontSize:'12px', marginTop:'-15px', color:'#94a3b8'}}>{ctx.receiverVpa}</p>
                  <div className="rc-meta">
                    <div>Ref: {ctx.txnRef}</div>
                    <div>Status: {ctx.status}</div>
                    <div>Time: {ctx.timestamp ? new Date(ctx.timestamp).toLocaleString() : 'N/A'}</div>
                  </div>
                  <button className="rc-btn" onClick={() => handleDownloadReceipt(ctx)}><FiDownload/> Download Receipt</button>
                </div>
              );
            }
            return null;
          })}
        </div>
        <div className="kp-quick-actions">
          <button onClick={() => processInput("Send Money")}><FiSend/> Send</button>
          <button onClick={() => processInput("Request Money")}><FiArrowDownLeft/> Request</button>
          <button onClick={() => processInput("Scan QR")}><FiCamera/> Scan QR</button>
          <button onClick={() => processInput("Check Balance")}><FiShield/> Balance</button>
        </div>
        <div className="kp-input-bar">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyPress={e => e.key==='Enter' && processInput(input)}
            placeholder={isProcessing ? "Processing securely..." : "Type a command, VPA, or amount..."}
            disabled={isProcessing}
          />
          <button onClick={() => processInput(input)} disabled={isProcessing || !input.trim()}><FiSend/></button>
        </div>
      </div>

      {showQrModal && (
        <div className="kp-overlay">
          <div className="qr-modal">
            <div className="qr-h"><FiCamera /> Scan any UPI QR <FiX className="qr-x" onClick={() => {setShowQrModal(false); processInput("cancel");}}/></div>
            <div className="qr-b">
              <div className="qr-scanner-box"><div className="qr-line"></div></div>
              <p>Align QR code within frame</p>
              <button className="qr-sim-btn" onClick={() => { setShowQrModal(false); processInput("scanned"); }}>Simulate Scan</button>
            </div>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="kp-overlay">
          <div className="kp-pin-modal">
            <div className="pm-header"><FiLock /> KasuPay Security Gateway</div>
            <div className="pm-body">
              <p>Enter 4-Digit UPI PIN for {dashboard.bankName}</p>
              <div className="pm-dots">
                {[0,1,2,3].map(i => <div key={i} className={`pm-dot ${mpin.length > i ? 'filled' : ''}`} />)}
              </div>
              <div className="pm-numpad">
                {[1,2,3,4,5,6,7,8,9].map(num => (
                  <button key={num} onClick={() => handleMpinPress(num.toString())}>{num}</button>
                ))}
                <button className="clear" onClick={() => setMpin('')}><FiX/></button>
                <button onClick={() => handleMpinPress('0')}>0</button>
                <button className="cancel" onClick={() => { setShowPinModal(false); setMpin(''); processInput("cancel"); }}>Cancel</button>
              </div>
              <div className="pm-hint">Hint: Test PIN is "1234"</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}