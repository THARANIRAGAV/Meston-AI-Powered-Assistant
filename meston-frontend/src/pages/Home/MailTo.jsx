import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiInbox, FiSend, FiStar, FiTrash2, FiZap, FiFileText, FiMic, FiMicOff } from 'react-icons/fi';
import './MailTo.css';

const WELCOME_MSG = "Welcome to Mail Assistant! ✉️\n\nSpeak or type commands:\n• 'Compose'\n• 'Email hr@meston.ai to request leave'\n• 'Clear Inbox' / 'Clear Sent'\n• 'Delete [subject]'\n";

export default function MailTo() {
  const userEmail = "mtharani@meston.ai";
  const [activeFolder, setActiveFolder] = useState('INBOX');
  const [emails, setEmails] = useState([]);
  const [messages, setMessages] = useState([{ id: 1, sender: 'ai', type: 'TEXT', content: WELCOME_MSG }]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [convoState, setConvoState] = useState('IDLE');
  const [draft, setDraft] = useState({ id: null, to: '', subject: '', body: '' });
  const [openedEmailId, setOpenedEmailId] = useState(null);
  const [pendingTarget, setPendingTarget] = useState(null);

  const messagesEndRef = useRef(null);
  const undoTimerRef = useRef(null);

  const fetchEmails = useCallback(async () => {
    try {
      const endpoint = activeFolder === 'STARRED' ? 'starred' : `folder/${activeFolder}`;
      const res = await fetch(`http://localhost:8080/api/mail/${endpoint}?email=${userEmail}`);
      setEmails(await res.json());
    } catch (err) {}
  }, [activeFolder]);

  useEffect(() => { fetchEmails(); const interval = setInterval(fetchEmails, 3000); return () => clearInterval(interval); }, [fetchEmails]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/[*#_]/g, '')));
    }
  };

  const toggleListening = () => {
    if (isListening) { setIsListening(false); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Browser does not support Voice."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => { const transcript = event.results[0][0].transcript; setInput(transcript); processUserInput(transcript); };
    recognition.onend = () => setIsListening(false); recognition.start();
  };

  const addMsg = (sender, type, content) => { setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender, type, content, deleted: false }]); };

  const handleEmailClick = async (email) => {
    if (openedEmailId === email.id) return;
    setOpenedEmailId(email.id);
    if (activeFolder === 'DRAFTS') {
      setDraft({ id: email.id, to: email.recipientEmail || '', subject: email.subject || '', body: email.body || '' });
      setConvoState('CONFIRM_SEND'); addMsg('ai', 'TEXT', `Opened draft: "${email.subject}". Type 'send', 'save draft', or 'discard'.`);
      addMsg('ai', 'DRAFT_CARD', { to: email.recipientEmail, subject: email.subject, body: email.body }); return;
    }
    if (!email.read && activeFolder === 'INBOX') { await fetch(`http://localhost:8080/api/mail/read/${email.id}`, { method: 'PUT' }); fetchEmails(); }
    addMsg('ai', 'READ_CARD', email); setConvoState('IDLE');
  };

  const toggleStar = async (e, id) => { e.stopPropagation(); await fetch(`http://localhost:8080/api/mail/star/${id}`, { method: 'PUT' }); fetchEmails(); };

  const executeDelete = async (msgId, emailId, isPermanent) => {
    const method = isPermanent ? 'DELETE' : 'PUT';
    await fetch(`http://localhost:8080/api/mail${isPermanent ? `/delete/${emailId}` : `/trash/${emailId}`}`, { method });
    if (msgId) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true } : m));
    addMsg('ai', 'TEXT', isPermanent ? "🗑️ Permanently deleted." : "🗑️ Moved to trash."); setOpenedEmailId(null); setPendingTarget(null); fetchEmails();
  };

  const processUserInput = async (textInput) => {
    const text = textInput.trim(); if (!text) return;
    addMsg('user', 'TEXT', text); setInput(''); setIsProcessing(true);
    const lower = text.toLowerCase();

    if (convoState === 'UNDO_WAIT') {
      if (lower === 'undo' || lower === 'edit') {
        clearTimeout(undoTimerRef.current); setConvoState('CONFIRM_SEND');
        addMsg('ai', 'TEXT', "🛑 Send stopped. Draft restored. Type 'send', 'save draft', or 'discard'."); addMsg('ai', 'DRAFT_CARD', draft);
      } else addMsg('ai', 'TEXT', "Sending... Type 'undo' before 5 seconds to stop it.");
      setIsProcessing(false); return;
    }

    if (convoState === 'IDLE') {
      if (lower === 'compose') {
        setConvoState('COMPOSE_TO'); setDraft({ id: null, to: '', subject: '', body: '' });
        addMsg('ai', 'TEXT', "Who are we sending this to?"); speakText("Who are we sending this to?");
      } else if (lower.includes('mail ') || lower.includes('email ') || lower.includes('send ')) {
        addMsg('ai', 'TEXT', "✨ Drafting...");
        try {
          const res = await fetch('http://localhost:8080/api/mail/ai/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text }) });
          const data = await res.json();
          const newDraft = { id: null, to: data.to || '', subject: data.subject || '', body: data.body || '' };
          setDraft(newDraft);
          if (!data.to) { setConvoState('COMPOSE_TO'); addMsg('ai', 'TEXT', `Drafted! I couldn't find an email address. Who is this for?`); speakText(`Drafted! Who is this for?`); } 
          else { setConvoState('CONFIRM_SEND'); addMsg('ai', 'TEXT', `Review draft below. Say 'send' to confirm.`); speakText(`Review the draft below. Say send to confirm.`); addMsg('ai', 'DRAFT_CARD', newDraft); }
        } catch (err) { addMsg('ai', 'TEXT', "AI Error."); }
      } else if (lower.includes('clear') || lower.includes('wipe')) {
        let targetFolder = null; if (lower.includes('sent')) targetFolder = 'SENT'; else if (lower.includes('inbox')) targetFolder = 'INBOX'; else if (lower.includes('trash')) targetFolder = 'TRASH'; else if (lower.includes('drafts')) targetFolder = 'DRAFTS';
        if (targetFolder) { setConvoState('CONFIRM_CLEAR'); setPendingTarget(targetFolder); addMsg('ai', 'TEXT', `Are you absolutely sure you want to clear ${targetFolder}? (yes/no)`); speakText(`Are you sure you want to clear ${targetFolder}?`); } 
        else { addMsg('ai', 'TEXT', "Which folder?"); }
      } else if (lower.startsWith('delete ') || lower.startsWith('trash ')) {
        const subj = lower.replace('delete ', '').replace('trash ', '').trim();
        const targetEmail = emails.find(e => e.subject.toLowerCase().includes(subj));
        if (targetEmail) { setConvoState('CONFIRM_DELETE'); setPendingTarget(targetEmail.id); addMsg('ai', 'TEXT', `Delete email: "${targetEmail.subject}"? (yes/no)`); speakText(`Delete email?`); } 
        else { addMsg('ai', 'TEXT', `Couldn't find email with "${subj}".`); }
      } else if (lower === 'delete' || lower === 'trash') {
        if (openedEmailId) { setConvoState('CONFIRM_DELETE'); setPendingTarget(openedEmailId); addMsg('ai', 'TEXT', `Delete this open email? (yes/no)`); } 
        else addMsg('ai', 'TEXT', "Select an email from the left first.");
      } else {
        // LLM FALLBACK FOR GENERAL QUESTIONS
        try {
            const res = await fetch('http://localhost:8080/api/ai/omni', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text }) });
            const data = await res.json();
            addMsg('ai', 'TEXT', data.text); speakText(data.text);
        } catch (e) { addMsg('ai', 'TEXT', "I couldn't reach the AI brain."); }
      }
    } 
    else if (convoState === 'COMPOSE_TO') { setDraft(prev => ({...prev, to: text})); setConvoState('COMPOSE_SUBJ'); addMsg('ai', 'TEXT', `Subject line?`); speakText("Subject line?"); } 
    else if (convoState === 'COMPOSE_SUBJ') { setDraft(prev => ({...prev, subject: text})); setConvoState('COMPOSE_BODY'); addMsg('ai', 'TEXT', `Body?`); speakText("Body?"); } 
    else if (convoState === 'COMPOSE_BODY') { const newDraft = { ...draft, body: text }; setDraft(newDraft); setConvoState('CONFIRM_SEND'); addMsg('ai', 'TEXT', `Draft complete. Say 'send', 'save draft', or 'discard'.`); speakText("Draft complete."); addMsg('ai', 'DRAFT_CARD', newDraft); }
    else if (convoState === 'CONFIRM_SEND') {
      if (lower === 'send' || lower === 'yes') {
        setConvoState('UNDO_WAIT'); addMsg('ai', 'TEXT', `⏳ Sending email... 5 seconds to say 'undo'.`); speakText(`Sending email`);
        undoTimerRef.current = setTimeout(async () => {
          await fetch('http://localhost:8080/api/mail/send', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ...draft, recipientEmail: draft.to || 'unknown@mail.com', senderEmail: userEmail }) });
          if (draft.id) await fetch(`http://localhost:8080/api/mail/delete/${draft.id}`, { method: 'DELETE' });
          setConvoState('IDLE'); setDraft({id: null, to: '', subject: '', body: ''}); addMsg('ai', 'TEXT', "✅ Email sent!"); speakText("Email sent successfully."); fetchEmails();
        }, 5000);
      } else if (lower === 'save draft' || lower === 'draft') {
        await fetch('http://localhost:8080/api/mail/savedraft', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ...draft, recipientEmail: draft.to || 'unknown', senderEmail: userEmail }) });
        if (draft.id) await fetch(`http://localhost:8080/api/mail/delete/${draft.id}`, { method: 'DELETE' });
        setConvoState('IDLE'); setDraft({id: null, to: '', subject: '', body: ''}); addMsg('ai', 'TEXT', "💾 Saved."); fetchEmails();
      } else if (lower === 'discard' || lower === 'no') { setConvoState('IDLE'); setDraft({id: null, to: '', subject: '', body: ''}); addMsg('ai', 'TEXT', "Discarded."); }
    } else if (convoState === 'CONFIRM_CLEAR') {
      if (lower === 'yes') { await fetch(`http://localhost:8080/api/mail/clear?email=${userEmail}&folder=${pendingTarget}`, { method: 'DELETE' }); setConvoState('IDLE'); addMsg('ai', 'TEXT', `✅ Cleared.`); setPendingTarget(null); fetchEmails(); } 
      else { setConvoState('IDLE'); setPendingTarget(null); addMsg('ai', 'TEXT', "Cancelled."); }
    } else if (convoState === 'CONFIRM_DELETE') {
      if (lower === 'yes') { const lastMsg = [...messages].reverse().find(m => m.type === 'READ_CARD' && m.content.id === pendingTarget); executeDelete(lastMsg?.id, pendingTarget, activeFolder === 'TRASH'); setConvoState('IDLE'); } 
      else { setConvoState('IDLE'); setPendingTarget(null); addMsg('ai', 'TEXT', "Cancelled."); }
    }
    setIsProcessing(false);
  };

  return (
    <div className="mailto-container">
      <div className="mail-left-pane">
        <div className="mail-tabs">
          <button className={`mail-tab ${activeFolder === 'INBOX' ? 'active' : ''}`} onClick={() => {setActiveFolder('INBOX'); setOpenedEmailId(null);}}><FiInbox/> Inbox</button>
          <button className={`mail-tab ${activeFolder === 'STARRED' ? 'active' : ''}`} onClick={() => {setActiveFolder('STARRED'); setOpenedEmailId(null);}}><FiStar/> Starred</button>
          <button className={`mail-tab ${activeFolder === 'DRAFTS' ? 'active' : ''}`} onClick={() => {setActiveFolder('DRAFTS'); setOpenedEmailId(null);}}><FiFileText/> Drafts</button>
          <button className={`mail-tab ${activeFolder === 'SENT' ? 'active' : ''}`} onClick={() => {setActiveFolder('SENT'); setOpenedEmailId(null);}}><FiSend/> Sent</button>
          <button className={`mail-tab ${activeFolder === 'TRASH' ? 'active' : ''}`} onClick={() => {setActiveFolder('TRASH'); setOpenedEmailId(null);}}><FiTrash2/> Trash</button>
        </div>
        <div className="mail-items">
          {emails.length === 0 ? <div style={{textAlign:'center', padding:'40px 20px', color:'#94a3b8'}}>Folder is empty.</div> : emails.map(email => (
            <div key={email.id} className={`mail-item ${openedEmailId === email.id ? 'selected' : ''} ${!email.read && activeFolder === 'INBOX' ? 'unread' : ''}`} onClick={() => handleEmailClick(email)}>
              <FiStar className={`mail-item-star ${email.starred ? 'active' : ''}`} onClick={(e) => toggleStar(e, email.id)} />
              <div style={{flex: 1, overflow: 'hidden'}}><span className="m-sender">{activeFolder === 'INBOX' || activeFolder === 'TRASH' ? email.senderEmail : `To: ${email.recipientEmail}`}</span><span className="m-subj">{email.subject}</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="mail-assistant-pane">
        <div className="assistant-header"><div style={{display:'flex', alignItems:'center', gap:'8px'}}><FiZap /> Mail Assistant</div></div>
        <div className="chat-stream">
          {messages.map(msg => {
            if (msg.type === 'TEXT') return <div key={msg.id} className={`chat-bubble ${msg.sender}`} style={{whiteSpace: 'pre-wrap'}}>{msg.content}</div>;
            if (msg.type === 'READ_CARD') {
              const e = msg.content;
              return (
                <div key={msg.id} className={`convo-card ${msg.deleted ? 'deleted' : ''}`}>
                  <div className="card-header"><span className="card-header-title">{e.subject}</span><div className="card-actions">{!msg.deleted && <FiTrash2 className="icon-action" onClick={() => { setConvoState('CONFIRM_DELETE'); setPendingTarget(e.id); addMsg('ai', 'TEXT', `Delete this email? (yes/no)`); }} />}</div></div>
                  <div className="card-body"><div className="card-body-meta"><strong>From:</strong> {e.senderEmail}<br/><strong>To:</strong> {e.recipientEmail}<br/><strong>Date:</strong> {new Date(e.timestamp).toLocaleString()}</div>{e.body}</div>
                </div>
              );
            }
            if (msg.type === 'DRAFT_CARD') {
              const d = msg.content;
              return (
                <div key={msg.id} className="convo-card draft-card">
                  <div className="card-header draft-theme">✨ AI Draft Preview</div>
                  <div className="card-body"><div className="card-body-meta"><strong>To:</strong> {d.to}<br/><strong>Subject:</strong> {d.subject}</div>{d.body}</div>
                  {convoState === 'CONFIRM_SEND' && <div className="draft-actions"><button className="cc-btn primary" onClick={() => processUserInput('send')}>Send Now</button><button className="cc-btn secondary" onClick={() => processUserInput('save draft')}>Save Draft</button></div>}
                </div>
              );
            }
            return null;
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="assistant-input-area">
          <form onSubmit={(e) => { e.preventDefault(); processUserInput(input); }}>
            <div className="input-wrapper">
              <input type="text" className="a-input" placeholder="Type or speak a command..." value={input} onChange={e => setInput(e.target.value)} disabled={isProcessing} />
              <button type="button" className="a-send" onClick={toggleListening} style={{background: isListening ? '#ef4444' : '#e5e7eb', color: isListening ? '#fff' : '#111827'}}>{isListening ? <FiMicOff /> : <FiMic />}</button>
              <button type="submit" className="a-send" disabled={!input.trim() || isProcessing}><FiSend size={18}/></button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}