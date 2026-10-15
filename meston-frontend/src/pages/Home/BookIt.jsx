import React from 'react';
import { FiBriefcase, FiMic } from 'react-icons/fi';

export default function BookIt() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 100px)', color: '#fff', textAlign: 'center' }}>
      <FiBriefcase style={{ fontSize: '64px', color: '#3b82f6', marginBottom: '20px' }} />
      <h2 style={{ fontSize: '28px', marginBottom: '10px' }}>BookIt AI</h2>
      <p style={{ color: '#9ca3af', maxWidth: '400px', lineHeight: '1.6' }}>
        The intelligent booking and professional services module is in development. You will be able to book appointments and schedule meetings using just your voice.
      </p>
      <button style={{ marginTop: '30px', background: '#334155', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.7 }}>
        <FiMic /> Voice Scheduling Coming Soon
      </button>
    </div>
  );
}