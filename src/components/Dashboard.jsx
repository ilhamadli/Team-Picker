import { useState, useRef, useEffect } from 'react';
import { Users, Trophy } from 'lucide-react';
import autoAnimate from '@formkit/auto-animate';
import { HERO_TEAM_NAMES } from '../utils/teamBalancer';

const Dashboard = ({ teams = [] }) => {
  const [view, setView] = useState('teams'); // 'teams', 'leaderboard'
  
  const parentRef = useRef(null);
  
  useEffect(() => {
    if (parentRef.current) {
      autoAnimate(parentRef.current);
    }
  }, [parentRef]);

  // Sort teams from lowest to highest score (left to right)
  const ascendingTeams = [...teams].sort((a, b) => (a.score || 0) - (b.score || 0));
  const maxScore = Math.max(...teams.map(t => t.score || 0), 1);

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
            {teams.map((team, index) => {
              const displayName = HERO_TEAM_NAMES[team.id - 1] || team.name;
              return (
                <div 
                  key={team.id} 
                  className="team-card animate-reveal"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="team-card-header">
                    <h3 className="team-card-title" title={displayName}>{displayName}</h3>
                  <div className="team-card-badges">
                    <span className="team-score-badge">
                      {team.score || 0} pts
                    </span>
                    <span className="team-count-badge">
                      <Users size={15} /> {team.members.length} / 10
                    </span>
                  </div>
                </div>
                
                {team.members.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', fontStyle: 'italic', textAlign: 'center', margin: 'auto 0', padding: '24px 0' }}>Empty team</p>
                ) : (
                  <ul className="team-members-list">
                    {team.members.map((member, idx) => (
                      <li key={idx} className="team-member-item animate-fade-in">
                        <div 
                          className="team-member-dot" 
                          style={{ background: member.gender === 'Male' ? '#4dabf7' : '#ff8787' }} 
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.name || member.input}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="vertical-leaderboard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>← Lowest Score</span>
              <span style={{ fontSize: '0.85rem', color: '#ff4d5a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Trophy size={14} /> Leader (Highest Score) →
              </span>
            </div>

            <div className="vertical-leaderboard-container">
              {ascendingTeams.map((team, index) => {
                const score = team.score || 0;
                const heightPct = Math.max(12, Math.round((score / maxScore) * 100));
                const isLeader = index === ascendingTeams.length - 1;
                const descRank = teams.filter(t => (t.score || 0) > score).length + 1;

                return (
                  <div key={team.id} className="bar-column">
                    {/* Top Score Label */}
                    <div className={`bar-score-tag ${isLeader ? 'leader' : ''}`}>
                      {score} <span style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>pts</span>
                    </div>

                    {/* Bar Track & Fill */}
                    <div className="bar-track">
                      <div 
                        className={`bar-fill ${isLeader ? 'bar-leader' : ''}`}
                        style={{ height: `${heightPct}%` }}
                      >
                        {isLeader && <span style={{ fontSize: '1rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>👑</span>}
                      </div>
                    </div>

                    {/* Bottom Team Info */}
                    <div className="bar-team-info">
                      <div className={`bar-team-name ${isLeader ? 'leader' : ''}`} title={HERO_TEAM_NAMES[team.id - 1] || team.name}>
                        {HERO_TEAM_NAMES[team.id - 1] || team.name}
                      </div>
                      <div className={`bar-rank-badge ${isLeader ? 'leader' : ''}`}>
                        {descRank === 1 ? '🥇 1st' : descRank === 2 ? '🥈 2nd' : descRank === 3 ? '🥉 3rd' : `#${descRank}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
