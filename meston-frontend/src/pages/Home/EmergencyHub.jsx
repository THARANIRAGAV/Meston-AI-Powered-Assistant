// src/pages/Home/EmergencyHub.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import Webcam from 'react-webcam';
import { FaceMesh } from '@mediapipe/face_mesh';
import * as cam from '@mediapipe/camera_utils';

const EMERGENCY_CONTACT = '+919840663986'; 
const USER_ID = localStorage.getItem('user_id') || 'USER_101';
const WS_URL = 'http://localhost:8080/ws-emergency';

const EmergencyHub = () => {
  const [stompClient, setStompClient] = useState(null);
  const [alarmState, setAlarmState] = useState('SAFE'); 
  const [countdown, setCountdown] = useState(30);
  const [triggerReason, setTriggerReason] = useState('');
  const [location, setLocation] = useState({ lat: 0, lng: 0 });
  
  const [micAllowed, setMicAllowed] = useState(true); 
  const [cameraReady, setCameraReady] = useState(true); 
  const [dismissBanner, setDismissBanner] = useState(false);

  const webcamRef = useRef(null);
  const faceMeshCameraRef = useRef(null);
  const closedEyesTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  
  const recognitionRef = useRef(null);
  const alarmStateRef = useRef('SAFE'); 
  const stompRef = useRef(null);
  
  // CRITICAL FIX: Use a ref for the pause state so it never reads stale data
  const isMicPausedRef = useRef(false);

  useEffect(() => { alarmStateRef.current = alarmState; }, [alarmState]);

  // ─── Command Listeners (Hard Kill Switch) ──────────────────
  useEffect(() => {
    const handlePause = () => {
      isMicPausedRef.current = true;
      if (recognitionRef.current) recognitionRef.current.abort(); // Kill instantly
    };
    const handleResume = () => {
      isMicPausedRef.current = false;
      if (recognitionRef.current && alarmStateRef.current === 'SAFE' && micAllowed) {
        try { recognitionRef.current.start(); } catch (e) {}
      }
    };
    
    window.addEventListener('pause-bg-mic', handlePause);
    window.addEventListener('resume-bg-mic', handleResume);
    return () => {
      window.removeEventListener('pause-bg-mic', handlePause);
      window.removeEventListener('resume-bg-mic', handleResume);
    };
  }, [micAllowed]);

  // ─── Live GPS Tracking ─────────────────────────────────
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.warn('GPS Error:', err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ─── WebSocket Connection ──────────────────────────────
  useEffect(() => {
    const socket = new SockJS(WS_URL);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/alerts/${USER_ID}`, (msg) => {
          if (msg.body === 'RESCUE_DISPATCHED') {
            setAlarmState('RESCUE');
            window.speechSynthesis.speak(new SpeechSynthesisUtterance('Rescue has been dispatched. Help is on the way.'));
          }
        });
      },
    });
    client.activate();
    setStompClient(client);
    stompRef.current = client;
    return () => client.deactivate();
  }, []);

  // ─── Accelerometer Fall Detection ─────────────────────
  useEffect(() => {
    const handleMotion = (event) => {
      if (!event.accelerationIncludingGravity) return;
      const { x, y, z } = event.accelerationIncludingGravity;
      const force = Math.sqrt(x * x + y * y + z * z);
      if (force > 25 && alarmStateRef.current === 'SAFE') {
        initiateEmergencyLoop('Sudden Fall Detected');
      }
    };
    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, []);

  // ─── Continuous Voice Distress ─────────────────────────
  useEffect(() => {
    if (!micAllowed) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      if (isMicPausedRef.current) return; // Ignore if paused
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      const distressWords = ['help', 'pain', 'emergency', 'ambulance'];
      if (distressWords.some((word) => transcript.includes(word)) && alarmStateRef.current === 'SAFE') {
        initiateEmergencyLoop(`Voice Distress Detected`);
      }
    };

    recognition.onend = () => {
      // ONLY restart if we are NOT explicitly paused
      if (alarmStateRef.current === 'SAFE' && micAllowed && !isMicPausedRef.current) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') setMicAllowed(false);
    };

    try { recognition.start(); } catch (e) {}
    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      }
    };
  }, [micAllowed]); // Dependency removed to stop zombie restarts

  // ─── Emergency Loop ───────────────────────────────
  const initiateEmergencyLoop = useCallback((reason) => {
    if (alarmStateRef.current !== 'SAFE') return;
    setAlarmState('COUNTDOWN');
    alarmStateRef.current = 'COUNTDOWN';
    setCountdown(30);
    setTriggerReason(reason);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('Emergency detected. Are you safe? Tap screen to cancel.'));
    if (navigator.vibrate) navigator.vibrate([1000, 300, 1000]);

    sendWSMessage('FALL_DETECTED', reason);
    startFaceMeshCheck(); 

    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          return 0;
        }
        if (prev === 20 || prev === 10) window.speechSynthesis.speak(new SpeechSynthesisUtterance(`Auto rescue in ${prev} seconds. Tap to cancel.`));
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ─── MediaPipe Face Mesh ──────────────────────────────
  const startFaceMeshCheck = useCallback(() => {
    if (!webcamRef.current?.video) return;

    const faceMesh = new FaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true });

    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const calcEAR = (lm, indices) => {
      const [p1, p2, p3, p4, p5, p6] = indices.map((i) => lm[i]);
      return (dist(p2, p6) + dist(p3, p5)) / (2.0 * dist(p1, p4));
    };

    faceMesh.onResults((results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
      const lm = results.multiFaceLandmarks[0];
      const avgEAR = (calcEAR(lm, [33, 160, 158, 133, 153, 145]) + calcEAR(lm, [362, 385, 387, 263, 373, 380])) / 2;

      if (avgEAR < 0.18) { 
        if (!closedEyesTimerRef.current) closedEyesTimerRef.current = setTimeout(() => confirmUnconscious(), 5000);
      } else { 
        clearTimeout(closedEyesTimerRef.current);
        closedEyesTimerRef.current = null;
      }
    });

    faceMeshCameraRef.current = new cam.Camera(webcamRef.current.video, {
      onFrame: async () => { if (webcamRef.current?.video) await faceMesh.send({ image: webcamRef.current.video }); },
      width: 320, height: 240,
    });
    faceMeshCameraRef.current.start();
  }, []);

  const confirmUnconscious = useCallback(() => {
    clearInterval(countdownIntervalRef.current);
    setAlarmState('RESCUE');
    alarmStateRef.current = 'RESCUE';
    sendWSMessage('UNCONSCIOUS_CONFIRMED', 'AI confirmed eyes closed for 5 seconds');
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('Unconsciousness confirmed. Rescue dispatched.'));
    faceMeshCameraRef.current?.stop();
  }, []);

  const sendWSMessage = (type, reason) => {
    const payload = JSON.stringify({ type, userId: USER_ID, lat: location.lat, lng: location.lng, reason });

    if (!navigator.onLine || !stompRef.current?.connected) {
      const smsBody = encodeURIComponent(`🚨 EMERGENCY: ${reason}. Location: https://maps.google.com/?q=$${location.lat},${location.lng}`);
      window.location.href = `sms:${EMERGENCY_CONTACT}?body=${smsBody}`;
      return;
    }
    stompRef.current.publish({ destination: '/app/trigger', body: payload });
  };

  const cancelAlarm = () => {
    clearInterval(countdownIntervalRef.current);
    clearTimeout(closedEyesTimerRef.current);
    closedEyesTimerRef.current = null;
    faceMeshCameraRef.current?.stop();

    setAlarmState('SAFE');
    alarmStateRef.current = 'SAFE';
    setCountdown(30);

    sendWSMessage('CANCEL_ALARM', 'User confirmed safe');
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('Emergency cancelled.'));
  };

  return (
    <>
      <Webcam
        ref={webcamRef}
        audio={false} 
        onUserMediaError={() => setCameraReady(false)} 
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        videoConstraints={{ facingMode: 'user' }}
        mirrored
      />

      {(!micAllowed || !cameraReady) && !dismissBanner && (
        <div style={styles.permissionBanner}>
          <span style={{ fontWeight: '600' }}>⚠️ Background AI Sensors are blocked. Allow Camera/Mic to enable auto-rescue.</span>
          <button onClick={() => setDismissBanner(true)} style={styles.dismissBtn}>Dismiss</button>
        </div>
      )}

      {alarmState === 'COUNTDOWN' && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <div style={styles.pulsingIcon}>🚨</div>
            <h1 style={styles.overlayTitle}>FALL DETECTED</h1>
            <p style={styles.overlaySubtitle}>{triggerReason}</p>
            <div style={styles.countdownCircle}><span style={styles.countdownNumber}>{countdown}</span></div>
            <button onClick={cancelAlarm} style={styles.safeButton}>✅ YES, I AM SAFE</button>
          </div>
        </div>
      )}

      {alarmState === 'RESCUE' && (
        <div style={{ ...styles.overlay, background: 'rgba(0,0,0,0.97)' }}>
          <div style={styles.overlayCard}>
            <div style={{ fontSize: '80px' }}>🚑</div>
            <h1 style={{ ...styles.overlayTitle, color: '#ff4444' }}>AMBULANCE DISPATCHED</h1>
          </div>
        </div>
      )}
    </>
  );
};

const styles = {
  permissionBanner: { position: 'fixed', top: 0, left: 0, right: 0, background: '#ef4444', color: 'white', padding: '12px 24px', zIndex: 99999, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' },
  dismissBtn: { background: 'white', color: '#ef4444', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(200, 0, 0, 0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(8px)' },
  overlayCard: { background: '#fff', borderRadius: '24px', padding: '50px 40px', maxWidth: '440px', width: '90%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  pulsingIcon: { fontSize: '64px', animation: 'pulse 1s infinite' },
  overlayTitle: { margin: 0, color: '#cc0000', fontSize: '2.2rem', fontWeight: 900 },
  overlaySubtitle: { margin: 0, color: '#555', fontSize: '14px', fontStyle: 'italic' },
  countdownCircle: { width: '110px', height: '110px', borderRadius: '50%', background: 'linear-gradient(135deg, #ff4444, #cc0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
  countdownNumber: { fontSize: '42px', fontWeight: 900 },
  safeButton: { background: 'linear-gradient(135deg, #00c851, #007e33)', color: '#fff', border: 'none', padding: '18px 40px', fontSize: '18px', fontWeight: 900, borderRadius: '14px', cursor: 'pointer', width: '100%' },
};

export default EmergencyHub;