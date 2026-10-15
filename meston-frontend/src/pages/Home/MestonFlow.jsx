import React, { useState, useEffect, useCallback } from 'react';
import './MestonFlow.css'; 

// SVG Icons
const IconCpu = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/></svg>;
const IconZap = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 L13 2 Z"/></svg>;
const IconCheckCircle = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14 9 11"/></svg>;
const IconTerminal = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>;
const IconArchive = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect width="22" height="5" x="1" y="3" rx="1"/><line x1="10" x2="14" y1="12" y2="12"/></svg>;

export default function MestonFlow() {
  const [currentView, setCurrentView] = useState('pipeline'); 
  
  const [activeStep, setActiveStep] = useState(1);
  const [highestStepReached, setHighestStepReached] = useState(1);

  const [idea, setIdea] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectId, setProjectId] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [tasks, setTasks] = useState([]);
  
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [devLog, setDevLog] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  
  const [checkedTests, setCheckedTests] = useState([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [liveAppUrl, setLiveAppUrl] = useState(null);
  
  const [history, setHistory] = useState([]);

  const API_BASE = "http://localhost:8080/api/mestonflow";
  const steps = ["SOW & Scope", "Architecture", "Development", "QA Testing", "Cloud Deploy", "Maintenance"];

  const fetchTasksAndUpdates = useCallback(async (id) => {
    try {
      const taskRes = await fetch(`${API_BASE}/project/${id}/tasks`);
      if (taskRes.ok) setTasks(await taskRes.json());
    } catch (e) { console.error("Error fetching tasks", e); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/projects/history`);
      if (res.ok) setHistory(await res.json());
    } catch (e) { console.error("Error fetching history"); }
  }, []);

  const resumeLatestProject = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/project/latest`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.projectId) {
          setProjectId(data.projectId);
          setProjectData(data);
          setIdea(data.rawIdea || '');
          fetchTasksAndUpdates(data.projectId);
          if (data.dbSchema) unlockStep(3);
        }
      }
    } catch (e) { console.log("No active session found"); }
  }, [fetchTasksAndUpdates]);

  useEffect(() => {
    resumeLatestProject();
    fetchHistory();
  }, [resumeLatestProject, fetchHistory]);

  const unlockStep = (stepNumber) => {
    if (stepNumber > highestStepReached) setHighestStepReached(stepNumber);
    setActiveStep(stepNumber);
  };

  const handleStartNewProject = () => {
    setProjectId(null); // Passing null tells the backend to make a NEW project
    setProjectData(null);
    setTasks([]);
    setIdea('');
    setActiveStep(1);
    setHighestStepReached(1);
    setLiveAppUrl(null);
    setCurrentView('pipeline');
  };

  const handleGenerateRequirements = async () => {
    if (!idea.trim()) return;
    setIsGenerating(true);
    setCheckedTests([]);
    
    try {
      const res = await fetch(`${API_BASE}/generate-srs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, projectId }) 
      });
      const data = await res.json();
      
      setProjectId(data.projectId);
      setProjectData(data);
      fetchTasksAndUpdates(data.projectId);
      unlockStep(2); 
    } catch (error) {
      alert("Backend connection failed.");
    } finally {
      setIsGenerating(false);
      fetchHistory(); 
    }
  };

  const proceedToDevelopment = () => {
    if (tasks.length === 0) { alert("No tasks generated."); return; }
    unlockStep(3);
  };

  const proceedToQA = () => {
    const allDone = tasks.length > 0 && tasks.every(t => t.status === 'DONE');
    if (!allDone) { alert("Complete all AI Coding tasks first."); return; }
    unlockStep(4);
  };

  const openDevModal = async (task) => {
    setActiveTaskId(task.id);
    setDevLog('');
    setDevModalOpen(true);
    setIsGeneratingCode(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/${task.id}/generate-code`);
      const data = await res.json();
      setDevLog(data.code);
    } catch (e) { setDevLog("// Connection error"); } 
    finally { setIsGeneratingCode(false); }
  };

  const handleCompleteTask = async () => {
    if (!devLog.trim()) return;
    setDevModalOpen(false);
    try {
      await fetch(`${API_BASE}/tasks/${activeTaskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitLog: devLog })
      });
      fetchTasksAndUpdates(projectId);
    } catch (e) { console.error(e); }
  };

  const handleDeployment = async () => {
    setIsDeploying(true);
    try {
      const res = await fetch(`${API_BASE}/project/${projectId}/deploy`, { method: 'POST' });
      const data = await res.json();
      
      if (data.liveUrl) {
        setLiveAppUrl(data.liveUrl);
        unlockStep(6);
      } else { 
        // This will now show the EXACT error from Java/Netlify
        alert("Deployment Error: " + (data.error || "Unknown Netlify Error")); 
      }
    } catch (e) { 
      alert("Engine unreachable. Is Spring Boot running?"); 
    } finally { 
      setIsDeploying(false); 
    }
  };

  return (
    <div className="mestonflow-container">
      
      <div className="mf-header">
        <h2><IconCpu /> Meston<span>Flow AI</span></h2>
        <div style={{display: 'flex', gap: '15px'}}>
            <button 
                onClick={handleStartNewProject}
                style={{background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '8px 16px', borderRadius: '8px', border: '1px solid #8b5cf6', cursor: 'pointer', fontWeight: 'bold'}}
            >
                + New Project
            </button>
            <button 
                onClick={() => setCurrentView(currentView === 'pipeline' ? 'archive' : 'pipeline')}
                style={{background: 'transparent', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', border: '1px solid #475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
            >
                <IconArchive /> {currentView === 'pipeline' ? 'View Archive' : 'Back to Pipeline'}
            </button>
        </div>
      </div>

      {currentView === 'archive' ? (
          <div className="mf-content">
              <h3 style={{fontSize: '24px', margin: '0 0 30px 0'}}>Project Backup & Archive</h3>
              <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                  {history.map(proj => (
                      <div key={proj.id} style={{background: '#131320', padding: '24px', borderRadius: '12px', border: '1px solid #334155'}}>
                          <div style={{color: '#8b5cf6', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px'}}>PROJECT ID: {proj.id}</div>
                          <div style={{fontSize: '20px', fontWeight: 'bold', marginBottom: '15px'}}>{proj.rawIdea}</div>
                          
                          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
                              <div style={{background: '#0b0b14', padding: '10px', borderRadius: '6px', fontSize: '12px'}}>
                                  <span style={{color: '#94a3b8'}}>Budget:</span> {proj.budget}
                              </div>
                              <div style={{background: '#0b0b14', padding: '10px', borderRadius: '6px', fontSize: '12px'}}>
                                  <span style={{color: '#94a3b8'}}>Timeline:</span> {proj.timeline}
                              </div>
                          </div>
                          
                          <div style={{color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: '#0b0b14', padding: '15px', borderRadius: '8px', fontFamily: 'monospace'}}>
                            {proj.srsContent}
                          </div>
                      </div>
                  ))}
                  {history.length === 0 && <div style={{color: '#64748b'}}>No archived projects found.</div>}
              </div>
          </div>
      ) : (
          <>
            <div className="entrepreneur-stepper">
              {steps.map((s, i) => {
                const stepNum = i + 1;
                const isUnlocked = stepNum <= highestStepReached;
                return (
                  <div key={i} className={`e-step ${activeStep === stepNum ? 'active' : ''} ${isUnlocked ? 'unlocked' : 'locked'}`} onClick={() => isUnlocked && setActiveStep(stepNum)}>
                    <div className="e-circle">{stepNum}</div>
                    <span className="e-label">{s}</span>
                  </div>
                );
              })}
            </div>

            <div className="mf-content">
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

                {activeStep === 1 && (
                  <div className="mf-card">
                    <h3 style={{marginTop: 0, fontSize: '24px', marginBottom: '20px'}}>Phase 1: SOW & Project Scope</h3>
                    <textarea className="mf-textarea" value={idea} onChange={e => setIdea(e.target.value)} placeholder="E.g., A food delivery app with authentication..." />
                    <button className="mf-btn" style={{marginTop: '20px', width: '100%'}} onClick={handleGenerateRequirements} disabled={isGenerating || !idea.trim()}>
                      {isGenerating ? 'AI Writing Statement of Work...' : 'Generate SOW & Plan'} <IconZap />
                    </button>

                    {projectData && projectData.srsContent && (
                      <div style={{marginTop: '40px', padding: '24px', border: '1px solid #10b981', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.05)'}}>
                        <h4 style={{color: '#10b981', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px'}}><IconCheckCircle /> Statement of Work (SOW) & SDLC Approved</h4>
                        <div className="mf-pre-block">{projectData.srsContent}</div>
                        <button className="mf-btn mf-btn-success" style={{width: '100%', marginTop: '20px'}} onClick={() => unlockStep(2)}>Review Architecture &rarr;</button>
                      </div>
                    )}
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="mf-card" style={{borderColor: 'rgba(245, 158, 11, 0.4)'}}>
                    <h3 style={{color: '#f59e0b', marginTop: 0, fontSize: '24px'}}>Phase 2: System Architecture</h3>
                    <div style={{marginBottom: '24px', marginTop: '24px'}}>
                      <span style={{fontSize: '13px', color: '#94a3b8', fontWeight: 'bold'}}>DATABASE SCHEMA</span>
                      <div className="mf-pre-block">{projectData?.dbSchema}</div>
                    </div>
                    <div style={{marginBottom: '30px'}}>
                      <span style={{fontSize: '13px', color: '#94a3b8', fontWeight: 'bold'}}>API ROUTE MAP</span>
                      <div className="mf-pre-block">{projectData?.apiDesign}</div>
                    </div>
                    <button className="mf-btn mf-btn-success" style={{width: '100%'}} onClick={proceedToDevelopment}>Approve Architecture</button>
                  </div>
                )}

                {activeStep === 3 && (
                  <div>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                          <h3 style={{fontSize: '24px', margin: 0}}>Phase 3: Development</h3>
                          <button className="mf-btn mf-btn-success" style={{padding: '10px 20px'}} onClick={proceedToQA}>Move to QA &rarr;</button>
                      </div>
                      <div className="mf-kanban">
                      {['TODO', 'IN_PROGRESS', 'DONE'].map(status => (
                          <div key={status} className="mf-kanban-col">
                          <h4 style={{fontSize: '14px', color: '#94a3b8', margin: '0 0 20px 0'}}>{status.replace('_', ' ')}</h4>
                          {tasks.filter(t => t.status === status).map(task => (
                              <div key={task.id} className="mf-task-card">
                              <div style={{fontSize: '15px', fontWeight: 'bold', marginBottom: '16px'}}>{task.title}</div>
                              {status !== 'DONE' ? (
                                  <button className="mf-btn" style={{width: '100%', padding: '10px'}} onClick={() => openDevModal(task)}>Trigger AI</button>
                              ) : (
                                  <div style={{fontSize: '13px', color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px'}}><IconCheckCircle /> MERGED</div>
                              )}
                              </div>
                          ))}
                          </div>
                      ))}
                      </div>
                  </div>
                )}

                {activeStep === 4 && (
                  <div className="mf-card" style={{borderColor: 'rgba(239, 68, 68, 0.5)'}}>
                    <h3 style={{color: '#ef4444', marginTop: 0}}>Phase 4: Quality Assurance</h3>
                    <div className="qa-checklist">
                      {projectData?.testCases?.map((test, i) => (
                        <label key={i} className="qa-item">
                          <input type="checkbox" checked={checkedTests.includes(i)} onChange={(e) => { e.target.checked ? setCheckedTests([...checkedTests, i]) : setCheckedTests(checkedTests.filter(val => val !== i)); }} />
                          <span>{test}</span>
                        </label>
                      ))}
                    </div>
                    <button className="mf-btn mf-btn-success" style={{width: '100%'}} disabled={checkedTests.length === 0} onClick={() => unlockStep(5)}>Sign Off QA</button>
                  </div>
                )}

                {activeStep === 5 && (
                  <div className="mf-card" style={{textAlign: 'center', borderColor: 'rgba(45, 212, 191, 0.5)', padding: '60px 30px'}}>
                    <h3 style={{color: '#2dd4bf', fontSize: '32px', margin: '0 0 10px 0'}}>Phase 5: Cloud Launch</h3>
                    {!liveAppUrl ? (
                      <button className="mf-btn" style={{padding: '24px 48px', borderRadius: '50px'}} onClick={handleDeployment} disabled={isDeploying}>
                        {isDeploying ? "Uploading to Netlify..." : "Deploy Live Website"} <IconZap />
                      </button>
                    ) : (
                      <div style={{padding: '40px', background: 'rgba(16, 185, 129, 0.05)', border: '2px solid #10b981', borderRadius: '16px'}}>
                        <h4 style={{color: '#10b981', fontSize: '24px', margin: '0 0 30px 0'}}>APPLICATION LIVE</h4>
                        <a href={liveAppUrl} target="_blank" rel="noreferrer" className="mf-btn mf-btn-success">View Deployed App</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
      )}

      {devModalOpen && (
        <div className="mf-modal-overlay">
          <div className="mf-modal">
            <h3 style={{color: '#2dd4bf'}}><IconTerminal /> AI Developer Terminal</h3>
            {isGeneratingCode ? (
              <div style={{minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6'}}>Writing Files...</div>
            ) : (
              <textarea className="mf-textarea" style={{fontFamily: 'monospace', color: '#10b981', minHeight: '400px', background: '#0b0b14'}} value={devLog} onChange={e => setDevLog(e.target.value)} />
            )}
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '20px'}}>
              <button style={{color: '#94a3b8', cursor: 'pointer', background: 'none', border: 'none'}} onClick={() => setDevModalOpen(false)}>Cancel</button>
              <button className="mf-btn" disabled={isGeneratingCode} onClick={handleCompleteTask}>Push to Repository</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}