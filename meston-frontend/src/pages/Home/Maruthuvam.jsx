// src/pages/Home/Maruthuvam.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  FiSearch, FiAlertCircle, FiMapPin, FiActivity,
  FiPhoneCall, FiClock, FiUser, FiCalendar, FiCheckCircle, FiHeart, FiCamera
} from 'react-icons/fi';
import './Maruthuvam.css';

const BASE_URL = 'http://localhost:8080/api/maruthuvam';
const USER_ID = localStorage.getItem('user_id') || 'USER_101';

const loadScript = (src) => new Promise((resolve) => {
  if (document.querySelector(`script[src="${src}"]`)) return resolve();
  const script = document.createElement('script');
  script.src = src;
  script.crossOrigin = 'anonymous';
  script.onload = resolve;
  document.head.appendChild(script);
});

export default function Maruthuvam() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [history, setHistory] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const [rescueInfo, setRescueInfo] = useState(null);
  const [isSendingSOS, setIsSendingSOS] = useState(false);

  // --- FOOLPROOF AUTOMATIC SEQUENCE STATE ---
  const [eyesOpen, setEyesOpen] = useState(true);
  const [heartRate, setHeartRate] = useState(72);
  const [testAttempt, setTestAttempt] = useState(1); // 1 = Sleep, 2 = Emergency
  const [aiLoaded, setAiLoaded] = useState(false);
  
  const eyesClosedTimer = useRef(null);
  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const isEyesOpenRef = useRef(true); 

  // 1. INITIALIZE DATA & AI CAMERA
  useEffect(() => {
    fetchHospitals();
    fetchHistory();

    let camera = null;
    let faceMesh = null;

    const initMediaPipe = async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
        setAiLoaded(true);

        faceMesh = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true, 
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults((results) => {
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            const leftEyeDist = Math.abs(landmarks[159].y - landmarks[145].y);
            const rightEyeDist = Math.abs(landmarks[386].y - landmarks[374].y);

            const isClosed = leftEyeDist < 0.015 && rightEyeDist < 0.015;
            const currentlyOpen = !isClosed;

            if (isEyesOpenRef.current !== currentlyOpen) {
              isEyesOpenRef.current = currentlyOpen;
              setEyesOpen(currentlyOpen);
            }
          }
        });

        if (videoRef.current) {
          camera = new window.Camera(videoRef.current, {
            onFrame: async () => { await faceMesh.send({ image: videoRef.current }); },
            width: 320,
            height: 240
          });
          camera.start();
        }
      } catch (err) {
        console.error("Camera/AI blocked:", err);
      }
    };

    initMediaPipe();

    return () => {
      if (camera) camera.stop();
      if (faceMesh) faceMesh.close();
    };
  }, []);

  // 2. NORMAL HEART RATE FLUCTUATION
  useEffect(() => {
    const hrInterval = setInterval(() => {
      // Only fluctuate if we are NOT in an active emergency drop
      if (heartRate > 50 && !rescueInfo) {
        setHeartRate(Math.floor(Math.random() * (85 - 70 + 1) + 70)); 
      }
    }, 2000);
    return () => clearInterval(hrInterval);
  }, [heartRate, rescueInfo]);

  // 3. THE INVISIBLE, FOOLPROOF 10-SECOND SEQUENCE
  useEffect(() => {
    if (!eyesOpen && !rescueInfo) {
      // Start 10-second timer when eyes close
      eyesClosedTimer.current = setTimeout(() => {
        
        if (testAttempt === 1) {
          // --- ATTEMPT 1: NORMAL SLEEP ---
          window.speechSynthesis.speak(new SpeechSynthesisUtterance("Eyes closed for 10 seconds. Vitals are normal. Sleep mode activated."));
          setTestAttempt(2); // Set up next demo for emergency
        } else {
          // --- ATTEMPT 2: MEDICAL EMERGENCY ---
          setHeartRate(42); // Instantly drop the UI heart rate so judges see it!
          window.speechSynthesis.speak(new SpeechSynthesisUtterance("Unconsciousness and critical heart rate detected. Triggering emergency SOS."));
          triggerSOS('AUTO_VITALS_FAILURE_10_SECONDS');
          setTestAttempt(1); // Reset sequence for the next demo
        }
        
      }, 10000); 
    } else {
      // If eyes open before 10s, cancel the alarm and reset heart rate to normal
      clearTimeout(eyesClosedTimer.current);
      if (!rescueInfo) setHeartRate(72);
    }
    
    return () => clearTimeout(eyesClosedTimer.current);
  }, [eyesOpen, rescueInfo, testAttempt]);

  // 4. MICROPHONE LOGIC
  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      setQuery('');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Microphone not supported. Use Chrome.");

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setQuery('Listening... Speak a symptom'); 
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setIsListening(false);
      fetchResults(transcript); 
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'not-allowed') alert("Microphone Access Denied!");
      setQuery('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setQuery(prev => prev === 'Listening... Speak a symptom' ? '' : prev);
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch (e) { console.error("Mic start error:", e); }
  };

  const fetchHospitals = async () => {
    try {
      const res = await fetch(`${BASE_URL}/hospitals/nearby`);
      if (res.ok) setHospitals(await res.json());
    } catch (e) {}
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${BASE_URL}/history/${USER_ID}`);
      if (res.ok) setHistory(await res.json());
    } catch (e) {}
  };

  const fetchResults = async (searchQuery) => {
    if (!searchQuery || !searchQuery.trim()) return;
    setIsSearching(true);
    setResults([]);
    try {
      const res = await fetch(`${BASE_URL}/analyze?query=${encodeURIComponent(searchQuery)}&userId=${USER_ID}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : [data]);
      fetchHistory(); 
    } catch (err) {
      setResults([{ name: 'Connection Error', severity: 'MILD', remedies: 'Check backend.' }]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    fetchResults(query);
  };

  const viewDoctors = async (hospital) => {
    setSelectedHospital(hospital);
    setDoctors([]);
    try {
      const res = await fetch(`${BASE_URL}/doctors`);
      if (res.ok) setDoctors(await res.json());
    } catch (e) {}
  };

  const bookAppointment = async (doctor) => {
    setBookingDoctor(doctor);
    setBookingConfirmed(true);
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(`Appointment booked with Dr. ${doctor.name}.`));
    setTimeout(() => { setBookingConfirmed(false); setBookingDoctor(null); }, 4000);
  };

  const triggerSOS = async (triggerType = 'MANUAL') => {
    if (isSendingSOS) return;
    setIsSendingSOS(true);

    const coords = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: 13.0827, lng: 80.2707 }), 
        { timeout: 2000 } 
      );
    });

    try {
      const res = await fetch(`${BASE_URL}/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: USER_ID, 
          reason: triggerType === 'MANUAL' ? 'Manual Panic Button Pressed' : 'Unconsciousness + Critical Heart Rate', 
          lat: coords.lat, 
          lng: coords.lng 
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRescueInfo(data);
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`Emergency verified. Calling contacts. Ambulance dispatched from ${data.hospital}.`));
      }
    } catch (err) {
      setRescueInfo({ status: 'DISPATCHED', hospital: 'Nearest Hospital', eta: 'Calculating...', callStatus: 'Backend Error.' });
    } finally {
      setIsSendingSOS(false);
    }
  };

  const cancelSOS = () => {
    setRescueInfo(null);
    setHeartRate(72);
    setTestAttempt(1); // Reset sequence to start fresh
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('SOS cancelled.'));
  };

  return (
    <div className="maruthuvam-container">
      <div className="maru-left-pane">
        <div className="maru-header"><FiSearch /> Symptom Analysis Engine</div>
        <div className="maru-content">
          <form className="maru-search-form" onSubmit={handleSearch}>
            <input placeholder="e.g. chest pain, fever..." value={query} onChange={(e) => setQuery(e.target.value)} className={isListening ? 'listening' : ''} readOnly={isListening} />
            <button type="button" className={`mic-btn ${isListening ? 'listening' : ''}`} onClick={toggleVoiceInput} style={{ background: isListening ? '#ef4444' : '', color: isListening ? '#fff' : '' }}>
              {isListening ? '🔴' : '🎙️'}
            </button>
            <button type="submit" disabled={isSearching}>{isSearching ? 'Analyzing...' : 'Analyze'}</button>
          </form>

          {results.map((r, i) => (
            <div key={i} className={`disease-card ${(r.severity || 'mild').toLowerCase()}`}>
              <h3>{r.name}</h3>
              <div className="d-meta">Severity: <strong className={`sev-badge sev-${(r.severity || '').toLowerCase()}`}>{r.severity || 'UNKNOWN'}</strong></div>
              {r.remedies && <p><strong>Remedies:</strong> {r.remedies}</p>}
            </div>
          ))}

          <div className="history-section">
            <h4><FiClock /> Recent Health Logs</h4>
            {history.map((h) => (
              <div className="history-item" key={h.id}>
                <div className="history-main"><span>{h.symptom}</span><strong> → {h.identifiedCondition}</strong></div>
                <div className="history-meta"><span className={`sev-badge sev-${(h.severity || '').toLowerCase()}`}>{h.severity}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="maru-right-pane">
        <div className="maru-header" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}><FiMapPin /> Emergency Network</div>
        <div className="maru-monitor-content">
          
          {rescueInfo ? (
            <div className="rescue-active-card">
              <FiActivity className="beating" style={{ fontSize: 40, color: '#ef4444' }} />
              <h2>🚑 RESCUE IN PROGRESS</h2>
              <p><strong>Hospital:</strong> {rescueInfo.hospital}</p><p><strong>ETA:</strong> {rescueInfo.eta}</p>
              <p style={{color: '#f59e0b', fontSize: '13px'}}>{rescueInfo.callStatus}</p>
              <button className="cancel-sos-btn" onClick={cancelSOS}>✅ Cancel SOS</button>
            </div>
          ) : (
            <button className="sos-btn" onClick={() => triggerSOS('MANUAL')} disabled={isSendingSOS}>
              <FiPhoneCall /> {isSendingSOS ? 'Dispatching...' : 'TRIGGER MANUAL SOS'}
            </button>
          )}

          <div style={{ background: 'rgba(0,201,200,0.05)', padding: '15px', borderRadius: '12px', border: '1px dashed #00C9C8', marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, color: '#00C9C8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiActivity /> Live Hardware Monitoring
              </h4>
              {!aiLoaded && <span style={{fontSize: '11px', color: '#f59e0b'}}>⏳ Loading AI...</span>}
            </div>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <div style={{ flex: 1, background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative', height: '100px' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FiCamera /> {aiLoaded ? 'AI Face Tracker Active' : 'Starting...'}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
                
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{fontSize: '12px', color: '#aaa'}}>Eye Status:</span>
                  <span style={{ padding: '4px 8px', background: eyesOpen ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: eyesOpen ? '#10b981' : '#ef4444', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px' }}>
                    {eyesOpen ? 'Open (Awake)' : 'Closed'}
                  </span>
                </div>
                
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{fontSize: '12px', color: '#aaa'}}>Heart Rate:</span>
                  <span style={{color: heartRate < 50 ? '#ef4444' : '#10b981', fontWeight: 'bold', transition: 'color 0.3s'}}>{heartRate} BPM</span>
                </div>
                
                <div style={{fontSize: '10px', color: '#555', textAlign: 'right', marginTop: '4px'}}>
                  Demo Sequence: {testAttempt === 1 ? 'Sleep' : 'Emergency'}
                </div>

              </div>
            </div>
            <p style={{ fontSize: '11px', color: '#888', margin: 0, lineHeight: 1.4 }}>
              *Close your physical eyes. The first 10-second closure simulates sleep. The second 10-second closure drops HR to 42 and simulates a medical emergency.
            </p>
          </div>

          <div className="hospital-list" style={{marginTop: '15px'}}>
            <h4><FiMapPin /> Nearby Medical Centers</h4>
            {hospitals.map((h) => (
              <div key={h.id} className={`hospital-item ${selectedHospital?.id === h.id ? 'selected' : ''}`}>
                <div className="hospital-info"><strong>{h.name}</strong><span>{h.location}</span></div>
                <button className="view-doctors-btn" onClick={() => viewDoctors(h)}>View Doctors</button>
              </div>
            ))}
          </div>

          {selectedHospital && (
            <div className="doctor-list">
              <h4><FiUser /> Specialists at {selectedHospital.name}</h4>
              {doctors.map((d) => (
                <div key={d.id} className="doctor-item">
                  <div className="doctor-info"><strong>{d.name}</strong><span>{d.specialization} • ₹{d.fee || d.consultation_fee}</span></div>
                  <button className="book-btn" onClick={() => bookAppointment(d)}><FiCalendar /> Book</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}