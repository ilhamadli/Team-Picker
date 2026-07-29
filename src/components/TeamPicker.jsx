import { useState, useEffect } from 'react';
import { Sparkles, ArrowLeft } from 'lucide-react';

import { assignToTeam } from '../utils/teamBalancer';

const TeamPicker = ({ teams = [], sendJoinRequest }) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealedTeamId, setRevealedTeamId] = useState(null);
  
  // Use state for clientId so we can generate a new one for each person
  const [clientId, setClientId] = useState(() => Math.random().toString(36).substr(2, 9));

  // Watch teams to see if we got assigned
  useEffect(() => {
    if (isRevealing) {
      let foundTeam = null;
      for (const team of teams) {
        if (team.members && team.members.some(m => m.clientId === clientId)) {
          foundTeam = team.id;
          break;
        }
      }
      
      if (foundTeam) {
        const timer = setTimeout(() => {
          setRevealedTeamId(foundTeam);
          setIsRevealing(false);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [teams, isRevealing, clientId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!gender) {
      setError('Please select a gender');
      return;
    }
    setError('');
    setIsRevealing(true);

    // Compute team assignment
    const { assignedTeamId } = assignToTeam(name.trim(), gender, teams, clientId);

    sendJoinRequest({ name: name.trim(), gender, clientId, forceTeamId: assignedTeamId });

    // Fallback timer ensures screen transitions to thank-you even if state sync delays
    setTimeout(() => {
      setRevealedTeamId(assignedTeamId);
      setIsRevealing(false);
    }, 1200);
  };

  const getTeamDetails = (id) => {
    return teams.find(t => t.id === id);
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
      {!revealedTeamId && !isRevealing && (
        <div className="animate-fade-in">
          <h2 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '2rem' }}>Join the Tournament</h2>
          <p style={{ textAlign: 'center', marginBottom: '32px', color: 'var(--text-muted)' }}>Enter your name and gender to be enrolled to the tournament</p>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Full Name</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Enter your full name"
            />
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Gender</label>
            <div className="select-container">
              <select 
                className="select-dropdown"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="" disabled>Select gender...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          {error && (
            <div style={{ color: '#ff4444', marginBottom: '20px', textAlign: 'center', padding: '12px', background: 'rgba(255,0,0,0.1)', borderRadius: '8px' }}>
              {error}
            </div>
          )}

          <button 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            onClick={handleSubmit}
          >
            <Sparkles size={18} /> Submit Name
          </button>
        </div>
      )}

      {isRevealing && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="glow-effect" style={{ 
            width: '80px', height: '80px', borderRadius: '50%', 
            background: 'var(--primary)', margin: '0 auto 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Sparkles size={32} color="white" />
          </div>
          <h2 className="text-gradient">Submitting...</h2>
          <p style={{ color: 'var(--text-muted)' }}>Please wait while your request is processed.</p>
        </div>
      )}

      {revealedTeamId && (
        <div className="animate-reveal" style={{ textAlign: 'center', padding: '20px 0' }}>
          <h2 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '16px' }}>
            Thank You, {name}!
          </h2>
          
          <div className="glow-effect" style={{ 
            background: 'linear-gradient(135deg, rgba(231,0,18,0.2) 0%, rgba(255,255,255,0.05) 100%)',
            border: '1px solid var(--primary)',
            borderRadius: '24px',
            padding: '40px',
            marginBottom: '40px',
            marginTop: '32px'
          }}>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>
              Your name has been submitted successfully!
            </h3>
          </div>

          <button 
            className="btn" 
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={() => {
              setRevealedTeamId(null);
              setName('');
              setGender('');
              setClientId(Math.random().toString(36).substr(2, 9));
            }}
          >
            <ArrowLeft size={18} /> Go Back
          </button>
        </div>
      )}
    </div>
  );
};

export default TeamPicker;
