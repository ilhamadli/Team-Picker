import { useState, useRef, useEffect } from 'react';
import { Users, Trophy } from 'lucide-react';
import autoAnimate from '@formkit/auto-animate';

const Dashboard = ({ teams = [] }) => {
  const [view, setView] = useState('teams'); // 'teams', 'leaderboard'
  
  const parentRef = useRef(null);
  
  useEffect(() => {
    if (parentRef.current) {
      autoAnimate(parentRef.current);
    }
  }, [parentRef]);

  // Sort teams by score for the leaderboard view
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="glass-panel" style={{ padding: '32px' }}>
      <div className="dashboard-header">
        <h2 className="dashboard-title">
          <Trophy className="text-gradient" size={28} /> 
          Tournament Dashboard
        </h2>
        
        {/* Dashboard Tabs */}
        <div className="dashboard-tabs-container">
          <button 
            className="btn dashboard-tab-btn"
            style={{ 
              background: view === 'teams' ? 'var(--primary)' : 'transparent', 
              color: view === 'teams' ? 'white' : 'var(--text-muted)'
            }}
            onClick={() => setView('teams')}
          >
            <Users size={16} /> Teams Roster
          </button>
          <button 
            className="btn dashboard-tab-btn"
            style={{ 
              background: view === 'leaderboard' ? 'var(--primary)' : 'transparent', 
              color: view === 'leaderboard' ? 'white' : 'var(--text-muted)'
            }}
            onClick={() => setView('leaderboard')}
          >
            <Trophy size={16} /> Team Scores
          </button>
        </div>
      </div>

      <div ref={parentRef}>
        {teams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Users size={64} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: 'white' }}>Waiting for players...</h3>
            <p>Teams will appear here as soon as employees start joining!</p>
          </div>
        ) : view === 'teams' ? (
          <div className="teams-grid">
            {teams.map((team, index) => (
              <div 
                key={team.id} 
                className="glass-panel animate-reveal"
                style={{ padding: '24px', animationDelay: `${index * 0.05}s`, background: 'rgba(255,255,255,0.02)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.4rem' }}>{team.name}</h3>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <Users size={14} /> {team.members.length} / 10
                  </span>
                </div>
                
                {team.members.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>Empty team</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {team.members.map((member, idx) => (
                      <li key={idx} className="animate-fade-in" style={{ 
                        padding: '10px 0', 
                        borderBottom: idx !== team.members.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: member.gender === 'Male' ? '#4dabf7' : '#ff8787' }} />
                        {member.name || member.input} 
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="leaderboard-container">
            {sortedTeams.map((team, index) => (
              <div 
                key={team.id}
                className="glass-panel leaderboard-row"
                style={{ 
                  border: index === 0 ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                  background: index === 0 ? 'linear-gradient(90deg, rgba(231,0,18,0.1) 0%, rgba(255,255,255,0.02) 100%)' : 'var(--glass-bg)',
                  boxShadow: index === 0 ? '0 8px 32px rgba(231,0,18,0.1)' : 'none'
                }}
              >
                <div 
                  className="rank-badge"
                  style={{ 
                    color: index === 0 ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                    textShadow: index === 0 ? '0 0 20px rgba(231,0,18,0.4)' : 'none'
                  }}
                >
                  #{index + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.4rem', color: index === 0 ? 'white' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {team.members.length} members
                  </p>
                </div>
                <div 
                  className="score-display"
                  style={{ color: index === 0 ? 'white' : 'var(--text-muted)' }}
                >
                  {team.score}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
