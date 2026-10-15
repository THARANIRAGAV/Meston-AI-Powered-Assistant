import React, { useState, useRef } from 'react';
import { FiBriefcase, FiVideo, FiMic, FiUpload, FiVolume2 } from 'react-icons/fi';
import './LearnAndEarn.css';

export default function LearnAndEarn() {
  const [activeTab, setActiveTab] = useState('jobs');
  
  // --- CAREER PORTAL STATE (Unchanged) ---
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState({});

  // --- AI TUTOR STATE (Unchanged) ---
  const [topic, setTopic] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiSpeech, setAiSpeech] = useState("Hi! What would you like to learn today? Type a topic to begin.");
  const [chatHistory, setChatHistory] = useState("");

  // THIS IS THE FIX: This prevents Chrome from crashing (Error Code 5)
  const recognitionRef = useRef(null); 

  const speakText = (text, voicePref = "Google UK English Female") => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name.includes(voicePref)) || voices[0];
    if (selectedVoice) utterance.voice = selectedVoice;
    
    utterance.rate = 0.95; 
    window.speechSynthesis.speak(utterance);
  };

  const handleSearchJobs = async () => {
    setJobs([
      { id: 1, title: "Java Full Stack Developer", company: "Tech Mahindra", skills: "Java, React, MySQL", exp: "0-2 Years", desc: "Build scalable enterprise applications." },
      { id: 2, title: "Kindergarten Teacher", company: "Global Kids School", skills: "Patience, Child Psychology", exp: "Fresher", desc: "Guide and mentor young minds." }
    ]);
  };

  const handleApply = (jobId) => {
    setApplications(prev => ({ ...prev, [jobId]: 'APPLIED' }));
    alert("Application submitted and sent to the HR team!");
  };

  const startTutorSession = () => {
    if (!topic.trim()) return;
    setIsSessionActive(true);
    const greeting = `Great! Let's master ${topic}. I am your interactive tutor. Let's start with the basics. Are you ready?`;
    setAiSpeech(greeting);
    speakText(greeting);
  };

  const handleSendToTutor = async (message) => {
    setAiSpeech("Thinking...");
    setIsListening(false);
    
    try {
      const res = await fetch('http://localhost:8080/api/learn-earn/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, message, history: chatHistory })
      });
      const data = await res.json();
      
      setAiSpeech(data.reply);
      setChatHistory(prev => prev + `\nUser: ${message}\nTutor: ${data.reply}`);
      speakText(data.reply);
    } catch (e) {
      console.error(e);
      setAiSpeech("Sorry, I lost my connection. Can we try again?");
      speakText("Sorry, I lost my connection. Can we try again?");
    }
  };

  // --- FIXED MICROPHONE LOGIC (Memory Safe) ---
  const toggleListen = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    window.speechSynthesis.cancel(); // Stop AI talking immediately

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice input. Please use Google Chrome.");
      return;
    }

    // Assigning to useRef protects it from being deleted by Chrome while speaking
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("Recognized text:", transcript);
      handleSendToTutor(transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert("Microphone Access Denied! Please click the Lock icon in your URL bar, allow Microphone, and refresh the page.");
      }
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="le-container">
      <div className="le-header">
        <h2>Meston <span>Learn & Earn</span></h2>
        <div className="le-tabs">
          <button className={`le-tab ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}><FiBriefcase/> Career Portal</button>
          <button className={`le-tab ${activeTab === 'tutor' ? 'active' : ''}`} onClick={() => { setActiveTab('tutor'); window.speechSynthesis.getVoices(); }}><FiVideo/> Interactive AI Mentor</button>
        </div>
      </div>

      <div className="le-content">
        {/* --- CAREER PORTAL --- */}
        {activeTab === 'jobs' && (
          <div>
            <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
              <input 
                type="text" 
                placeholder="Search jobs (e.g., 'Java Developer')..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{flex: 1, padding: '12px', borderRadius: '8px', background: '#111', color: '#fff', border: '1px solid #333'}} 
              />
              <button onClick={handleSearchJobs} style={{padding: '12px 24px', background: '#00C9C8', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}>Search</button>
            </div>
            
            <div className="job-grid">
              {jobs.map(job => (
                <div key={job.id} className="job-card">
                  <h3 style={{margin: '0 0 5px 0'}}>{job.title}</h3>
                  <p style={{color: '#aaa', margin: '0 0 15px 0'}}>{job.company}</p>
                  <p style={{fontSize: '13px', color: '#ccc', marginBottom: '15px'}}>{job.desc}</p>
                  
                  <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                    <span className="job-tag">{job.exp}</span>
                    <span className="job-tag">{job.skills}</span>
                  </div>
                  
                  {applications[job.id] ? (
                    <div className="tracker-pipeline">
                      <div className="track-step active"><div className="track-dot"/>Applied</div>
                      <div className="track-step active"><div className="track-dot"/>HR Review</div>
                      <div className="track-step"><div className="track-dot"/>Interview</div>
                    </div>
                  ) : (
                    <button style={{width: '100%', padding: '10px', background: '#7B5CFA', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}} onClick={() => handleApply(job.id)}>
                      Easy Apply & Track
                    </button>
                  )}
                </div>
              ))}
              {jobs.length === 0 && <p style={{color: '#888'}}>Type a skill to find matching jobs...</p>}
            </div>
          </div>
        )}

        {/* --- AI INTERACTIVE MENTOR --- */}
        {activeTab === 'tutor' && (
          <div className="tutor-layout">
            <div className="avatar-screen">
              <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop" className="mock-avatar" alt="AI Mentor" />
              <div className="subtitles">
                {isListening ? <span style={{color: '#ef4444'}}>Listening... Speak now!</span> : aiSpeech}
              </div>
            </div>

            <div className="tutor-controls">
              {!isSessionActive ? (
                <>
                  <h3>Setup Your Mentor</h3>
                  <p style={{fontSize: '13px', color: '#aaa'}}>What do you want to master today?</p>
                  <input 
                    type="text" 
                    placeholder="e.g., Java Full Stack, UPSC History..." 
                    value={topic} onChange={e => setTopic(e.target.value)}
                    style={{padding: '12px', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px'}} 
                  />
                  <button style={{padding: '10px', background: 'transparent', border: '1px dashed #00C9C8', color: '#00C9C8', borderRadius: '8px', cursor: 'pointer'}}>
                    <FiUpload/> Attach PDF Syllabus
                  </button>
                  <button onClick={startTutorSession} style={{padding: '12px', background: '#7B5CFA', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px'}}>
                    Start Learning
                  </button>
                </>
              ) : (
                <>
                  <h3 style={{color: '#00C9C8'}}>Topic: {topic}</h3>
                  <p style={{fontSize: '13px', color: '#aaa'}}>The AI is speaking out loud. Use the mic to interrupt or ask questions.</p>
                  
                  <div style={{flex: 1}} />

                  <button className={`mic-interrupt-btn ${isListening ? 'listening' : ''}`} onClick={toggleListen} style={{background: isListening ? '#10b981' : '#ef4444'}}>
                    <FiMic size={20} /> {isListening ? 'Listening (Speak now)' : 'Interrupt / Ask Question'}
                  </button>
                  
                  <button onClick={() => speakText(aiSpeech)} style={{padding: '10px', background: 'transparent', border: '1px solid #333', color: '#fff', borderRadius: '8px', cursor: 'pointer', marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '8px'}}>
                    <FiVolume2/> Replay Audio
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}