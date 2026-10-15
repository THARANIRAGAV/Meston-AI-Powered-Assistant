import React, { useState, useEffect, useRef } from 'react';
import {
  FiCoffee, FiSend, FiStar, FiClock,
  FiCreditCard, FiTrash2, FiMapPin, FiXCircle
} from 'react-icons/fi';
import './Unavagam.css';

export default function Unavagam() {
  const userData = JSON.parse(
    localStorage.getItem('meston_user') ||
    '{"name":"mtharani", "email":"mtharani@meston.ai"}'
  );

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      type: 'TEXT',
      content:
        "Welcome to Unavagam by Meston AI! 🍕\n\nI fetch real-time varied restaurants near your location. Type 'Order pizza', 'Buy biryani', or 'Order dosa'."
    }
  ]);

  const [input, setInput] = useState('');
  const [convoState, setConvoState] = useState('IDLE');
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [mpin, setMpin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('Requesting location...');
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderStage, setOrderStage] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch(
          `http://localhost:8080/api/kasupay/dashboard?email=${userData.email}`
        );
        const data = await res.json();
        setWalletBalance(data.balance);
      } catch (e) {}
    };
    fetchBalance();
  }, [userData.email]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });

          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const data = await res.json();
            setLocationStatus(
              `📍 ${data.address.suburb || data.address.neighbourhood || data.address.city || 'Location Acquired'}`
            );
          } catch (e) {
            setLocationStatus('📍 Location acquired');
          }
        },
        () => setLocationStatus('⚠️ Location access denied')
      );
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let timer;
    if (activeOrder && orderStage !== 'Reached' && orderStage !== '') {
      timer = setTimeout(() => {
        if (orderStage === 'Cooking') setOrderStage('Picked Up');
        else if (orderStage === 'Picked Up') setOrderStage('On the Way');
        else if (orderStage === 'On the Way') {
          setOrderStage('Reached');
          processInput("Rider has reached", "RIDER_REACHED");
        }
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [activeOrder, orderStage]);

  const addMsg = (sender, type, content, extra = {}) => {
    setMessages(prev => [
      ...prev,
      { id: Date.now() + Math.random(), sender, type, content, ...extra }
    ]);
  };

  const processInput = async (text, overrideState = null, directItem = null) => {
    const messageText = text.trim();
    if (!messageText && !overrideState) return;

    if (messageText && overrideState !== 'RIDER_REACHED') {
      addMsg('user', 'TEXT', messageText);
    }

    setInput('');
    setIsProcessing(true);

    const currentState = overrideState || convoState;
    const itemForReceipt = directItem || selectedItem;

    if (directItem) setSelectedItem(directItem);

    try {
      const payload = {
        text: messageText,
        state: currentState,
        latitude: location?.lat,
        longitude: location?.lng,
        walletBalance,
        selectedItem: itemForReceipt,
        expectedOtp: activeOrder?.otp || "",
        userEmail: userData.email
      };

      const res = await fetch('http://localhost:8080/api/food/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setConvoState(data.newState);

      if (data.reply) addMsg('ai', 'TEXT', data.reply);
      if (data.uiType === 'QUICK_REPLIES') addMsg('ai', 'QUICK_REPLIES', data.options);
      else if (data.uiType === 'CAROUSEL') addMsg('ai', 'CAROUSEL', data.items);
      else if (data.uiType === 'RECEIPT') addMsg('ai', 'RECEIPT', itemForReceipt);
      else if (data.uiType === 'MPIN') {
        setMpin('');
        addMsg('ai', 'MPIN', null);
      } else if (data.uiType === 'START_TRACKER') {
        setActiveOrder({
          item: itemForReceipt,
          otp: Math.floor(1000 + Math.random() * 9000).toString()
        });
        setOrderStage('Cooking');
      } else if (data.uiType === 'CANCEL_ORDER') {
        setActiveOrder(null);
        setOrderStage('');
        setSelectedItem(null);
      } else if (data.uiType === 'FINISH_ORDER') {
        if (currentState === 'AWAIT_MPIN') {
          const total =
            itemForReceipt.price +
            Math.round(itemForReceipt.price * 0.05) +
            40;

          setWalletBalance(prev => prev - total);

          fetch('http://localhost:8080/api/kasupay/deduct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userEmail: userData.email,
              amount: total,
              reason: `Unavagam Order: ${itemForReceipt.dish}`
            })
          });
        }

        setActiveOrder(null);
        setOrderStage('');
        setSelectedItem(null);
      }
    } catch (err) {
      addMsg('ai', 'TEXT', "⚠️ Backend error.");
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
        setTimeout(() => processInput(newMpin, 'AWAIT_MPIN'), 400);
      }
    }
  };

  return (
    <div className="unavagam-container">
      
      {/* ── LEFT SIDEBAR ── */}
      <div className="food-sidebar">
        <div className="wallet-card">
          <div className="w-title">KasuPay Wallet <FiCreditCard /></div>
          <div className="w-bal">₹{walletBalance}</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>{locationStatus}</div>
        </div>

        {/* ACTIVE ORDER BANNER */}
        {activeOrder && (
          <div className="active-order-banner">
            <div className="banner-title"><FiCoffee /> Preparing Order</div>
            
            {['Cooking', 'Picked Up', 'On the Way', 'Reached'].map(step => {
              // Highlight the current step AND all previous steps
              const steps = ['Cooking', 'Picked Up', 'On the Way', 'Reached'];
              const isActive = steps.indexOf(step) <= steps.indexOf(orderStage);
              
              return (
                <div key={step} className={`tracker-step ${isActive ? 'active' : ''}`}>
                  {isActive ? '✓ ' : '○ '}{step}
                </div>
              );
            })}

            {orderStage === 'Reached' && (
              <div className="banner-otp">{activeOrder.otp}</div>
            )}

            <button 
              className="cancel-btn" 
              disabled={orderStage === 'Reached' || isProcessing} 
              onClick={() => processInput("cancel", "TRACKING")}
            >
              <FiXCircle /> Cancel Order
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT CHAT AREA ── */}
      <div className="food-chat-pane">
        <div className="chat-header">
          <FiCoffee /> Unavagam Assistant
        </div>
        
        <div className="chat-stream">
          {messages.map(msg => {
            
            /* 1. TEXT BUBBLE */
            if (msg.type === 'TEXT') {
              return (
                <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
                  {msg.content}
                </div>
              );
            }
            
            /* 2. QUICK REPLIES */
            if (msg.type === 'QUICK_REPLIES') {
              return (
                <div key={msg.id} className="quick-replies">
                  {msg.content.map(opt => (
                    <button 
                      key={opt} 
                      className="qr-pill" 
                      onClick={() => processInput(opt)} 
                      disabled={isProcessing}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              );
            }
            
            /* 3. FOOD CAROUSEL */
            if (msg.type === 'CAROUSEL') {
              return (
                <div key={msg.id} className="food-carousel">
                  {msg.content.map((item, idx) => (
                    <div key={idx} className="food-card">
                      <img src={item.image} alt={item.dish} className="fc-img" />
                      <div className="fc-body">
                        <div className="fc-rest">{item.restaurant}</div>
                        <div className="fc-dish">{item.dish}</div>
                        <div className="fc-meta">
                          <span className="fc-price">₹{item.price}</span>
                          <span className="fc-rate"><FiStar style={{ fill: 'currentColor', marginBottom: '-2px' }}/> {item.rating}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px' }}>
                          <FiMapPin style={{ marginBottom: '-2px' }}/> {item.distance}
                        </div>
                        <button 
                          className="fc-btn" 
                          onClick={() => processInput(`Select ${item.dish}`, 'SELECT_ITEM', item)} 
                          disabled={isProcessing}
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            /* 4. RECEIPT/CHECKOUT CARD */
            if (msg.type === 'RECEIPT') {
              const item = msg.content;
              const tax = Math.round(item.price * 0.05);
              const delivery = 40;
              const total = item.price + tax + delivery;
              
              return (
                <div key={msg.id} className="receipt-card">
                  <h3 className="rc-title">Order Summary</h3>
                  <div className="rc-row"><span>{item.dish}</span><span>₹{item.price}</span></div>
                  <div className="rc-row"><span>Taxes (5%)</span><span>₹{tax}</span></div>
                  <div className="rc-row"><span>Delivery Fee</span><span>₹{delivery}</span></div>
                  <div className="rc-total"><span>Total</span><span>₹{total}</span></div>
                  
                  <div className="pay-options">
                    <button 
                      className="pay-btn kasu" 
                      disabled={walletBalance < total || isProcessing} 
                      onClick={() => processInput("kasupay", "CHECKOUT")}
                    >
                      Pay via KasuPay {walletBalance < total ? '(Insufficient)' : ''}
                    </button>
                    <button 
                      className="pay-btn" 
                      disabled={isProcessing} 
                      onClick={() => processInput("cod", "CHECKOUT")}
                    >
                      Cash on Delivery
                    </button>
                  </div>
                </div>
              );
            }

            /* 5. MPIN KEYPAD */
            if (msg.type === 'MPIN') {
              return (
                <div key={msg.id} className="mpin-box">
                  <div className="mpin-title">Enter 4-Digit MPIN</div>
                  <div className="mpin-inputs">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`mpin-dot ${mpin.length > i ? 'filled' : ''}`} />
                    ))}
                  </div>
                  <div className="numpad">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <button key={num} className="num-btn" onClick={() => handleMpinPress(num.toString())}>{num}</button>
                    ))}
                    <button className="num-btn clear" onClick={() => setMpin('')}><FiTrash2 /></button>
                    <button className="num-btn" onClick={() => handleMpinPress('0')}>0</button>
                    <button className="num-btn clear" onClick={() => processInput("cancel")}><FiXCircle /></button>
                  </div>
                </div>
              );
            }

            return null;
          })}
          
          {/* Scroll Target */}
          <div ref={messagesEndRef} />
        </div>

        {/* ── INPUT BAR ── */}
        <div className="chat-input-area">
          <input 
            type="text" 
            className="c-input" 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyPress={e => e.key === 'Enter' && processInput(input)} 
            placeholder="Type 'order pizza' or 'buy biryani'..." 
            disabled={isProcessing} 
          />
          <button 
            className="c-send" 
            onClick={() => processInput(input)} 
            disabled={!input.trim() || isProcessing}
          >
            <FiSend />
          </button>
        </div>
      </div>
      
    </div>
  );
}