import { useState, useRef, useEffect } from 'react';
import { Users, Trophy, Award } from 'lucide-react';
import autoAnimate from '@formkit/auto-animate';
import { HERO_TEAM_NAMES, PREDEFINED_GAMES } from '../utils/teamBalancer';
import { fetchGameScoresForSession } from '../utils/dbHelper';
import { supabase } from '../supabaseClient';

const Dashboard = ({ teams = [], gameScores: propsGameScores = [], activeSession }) => {
  const [view, setView] = useState('teams'); // 'teams', 'leaderboard'
  const [selectedGameTab, setSelectedGameTab] = useState('overall'); // 'overall' or game title
  const [gameScores, setGameScores] = useState(propsGameScores);
  
  const parentRef = useRef(null);
  const matrixTableRef = useRef(null);

  // Click & Drag Scroll Refs
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);
  
  useEffect(() => {
    if (parentRef.current) {
      autoAnimate(parentRef.current);
    }
  }, [parentRef]);

  useEffect(() => {
    if (matrixTableRef.current) {
      autoAnimate(matrixTableRef.current);
    }
  }, [matrixTableRef]);

  useEffect(() => {
    if (propsGameScores && propsGameScores.length > 0) {
      setGameScores(propsGameScores);
    }
  }, [propsGameScores]);

  useEffect(() => {
    if (activeSession?.id && (!propsGameScores || propsGameScores.length === 0)) {
      fetchGameScoresForSession(activeSession.id).then(data => {
        if (data) setGameScores(data);
      });
    }
  }, [activeSession?.id]);

  // Realtime postgres subscription for live DB score updates
  useEffect(() => {
    if (!activeSession?.id) return;
    const channel = supabase
      .channel('dashboard_db_matrix_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_game_scores', filter: `session_id=eq.${activeSession.id}` },
        async () => {
          const freshScores = await fetchGameScoresForSession(activeSession.id);
          if (freshScores) setGameScores(freshScores);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  // Drag-to-scroll handlers for horizontal scroll containers
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - e.currentTarget.offsetLeft;
    scrollLeftRef.current = e.currentTarget.scrollLeft;
    e.currentTarget.style.cursor = 'grabbing';
  };

  const handleMouseLeave = (e) => {
    isDraggingRef.current = false;
    e.currentTarget.style.cursor = 'grab';
  };

  const handleMouseUp = (e) => {
    isDraggingRef.current = false;
    e.currentTarget.style.cursor = 'grab';
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const x = e.pageX - e.currentTarget.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 5) {
      hasMovedRef.current = true;
    }
    e.currentTarget.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleTabClick = (tabTitle) => {
    if (hasMovedRef.current) return; // ignore click if user was dragging
    setSelectedGameTab(tabTitle);
  };

  // Helper to calculate total overall score for a team
  const getTeamOverallScore = (team) => {
    const sumFromGameScores = (gameScores || [])
      .filter(gs => gs.team_id === team.id)
      .reduce((acc, gs) => acc + (gs.points_awarded || 0), 0);
    return Math.max(team.score || 0, sumFromGameScores);
  };

  // Helper to calculate a team's score for the current selected tab
  const getTeamScoreForTab = (team, tab) => {
    if (tab === 'overall') {
      return getTeamOverallScore(team);
    }
    const rec = (gameScores || []).find(gs => gs.game_name === tab && gs.team_id === team.id);
    return rec ? (rec.points_awarded || 0) : 0;
  };

  // Helper to get a team's rank for a specific game
  const getTeamRankForTab = (team, tab) => {
    if (tab === 'overall') return null;
    const rec = (gameScores || []).find(gs => gs.game_name === tab && gs.team_id === team.id);
    return rec ? rec.rank : null;
  };

  // Sort teams from lowest to highest score (left to right) for the active tab bar chart
  const ascendingTeams = [...teams].sort((a, b) => {
    const scoreA = getTeamScoreForTab(a, selectedGameTab);
    const scoreB = getTeamScoreForTab(b, selectedGameTab);
    return scoreA - scoreB;
  });

  // Sort teams dynamically descending (highest to lowest) for the 5-Game Score Matrix
  const matrixSortedTeams = [...teams].sort((a, b) => {
    const scoreA = getTeamOverallScore(a);
    const scoreB = getTeamOverallScore(b);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.id - b.id;
  });

  const currentScoresList = teams.map(t => getTeamScoreForTab(t, selectedGameTab));
  const maxScore = Math.max(...currentScoresList, 1);

  return (
    <div className="glass-panel" style={{ padding: '32px' }}>
      <div className="dashboard-header">
        <h2 className="dashboard-title">
          <Trophy className="text-gradient" size={28} /> 
          Tournament Dashboard
        </h2>
        
        {/* Dashboard Main Tabs */}
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
                        {getTeamOverallScore(team)} pts
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
            {/* Game Scores Filter Tabs (Draggable Left & Right) */}
            <div 
              className="no-scrollbar"
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onWheel={(e) => {
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
              style={{ 
                display: 'flex', 
                gap: '8px', 
                overflowX: 'auto', 
                flexWrap: 'nowrap',
                alignItems: 'center',
                padding: '4px 2px 14px 2px', 
                marginBottom: '24px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                cursor: 'grab',
                userSelect: 'none'
              }}
            >
              <button
                className={`game-tab-pill ${selectedGameTab === 'overall' ? 'active' : ''}`}
                onClick={() => handleTabClick('overall')}
              >
                <Trophy size={14} /> Overall Scores
              </button>

              {PREDEFINED_GAMES.map((gName, idx) => {
                const hasScores = (gameScores || []).some(gs => gs.game_name === gName);
                const isSelected = selectedGameTab === gName;
                return (
                  <button
                    key={gName}
                    className={`game-tab-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => handleTabClick(gName)}
                  >
                    <Award size={14} />
                    <span>{idx + 1}. {gName}</span>
                    {hasScores && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', marginLeft: '2px' }} />}
                  </button>
                );
              })}
            </div>

            {/* Bar Chart Container (Draggable Left & Right) */}
            <div 
              className="vertical-leaderboard-container no-scrollbar"
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              style={{ cursor: 'grab', userSelect: 'none' }}
            >
              {ascendingTeams.map((team, index) => {
                const score = getTeamScoreForTab(team, selectedGameTab);
                const isLeader = score > 0 && score === maxScore;
                const heightPct = isLeader 
                  ? 100 
                  : Math.max(12, Math.round((score / maxScore) * 85));
                
                // Rank calculation
                let descRank;
                if (selectedGameTab === 'overall') {
                  const teamOverall = getTeamOverallScore(team);
                  descRank = teams.filter(t => getTeamOverallScore(t) > teamOverall).length + 1;
                } else {
                  const specificRank = getTeamRankForTab(team, selectedGameTab);
                  descRank = specificRank !== null ? specificRank : null;
                }

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
                        {descRank === 1 ? '🥇 1st' : descRank === 2 ? '🥈 2nd' : descRank === 3 ? '🥉 3rd' : descRank ? `#${descRank}` : '-'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Overall 5-Game Score Breakdown Matrix (Dynamic Rank Sorting) */}
            {selectedGameTab === 'overall' && (
              <div style={{ marginTop: '36px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trophy size={20} className="text-gradient" />
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white' }}>5-Game Score Breakdown Matrix</h3>
                  </div>
                  <span style={{ fontSize: '0.8rem', background: 'rgba(74, 222, 128, 0.12)', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#4ade80', padding: '4px 10px', borderRadius: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                    Live Leaderboard Rankings
                  </span>
                </div>

                <div 
                  className="no-scrollbar"
                  onMouseDown={handleMouseDown}
                  onMouseLeave={handleMouseLeave}
                  onMouseUp={handleMouseUp}
                  onMouseMove={handleMouseMove}
                  style={{ overflowX: 'auto', cursor: 'grab', userSelect: 'none' }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '12px 14px', width: '60px' }}>Rank</th>
                        <th style={{ padding: '12px 14px' }}>Team</th>
                        {PREDEFINED_GAMES.map((g, i) => (
                          <th key={g} style={{ padding: '12px 14px', textAlign: 'center' }}>
                            G{i + 1}: {g}
                          </th>
                        ))}
                        <th style={{ padding: '12px 14px', textAlign: 'center', color: '#ff4d5a', fontWeight: '700' }}>Overall Pts</th>
                      </tr>
                    </thead>
                    <tbody ref={matrixTableRef}>
                      {matrixSortedTeams.map((team, idx) => {
                        const displayName = HERO_TEAM_NAMES[team.id - 1] || team.name;
                        const overallScore = getTeamOverallScore(team);
                        const overallRank = idx + 1;
                        const isLeader = overallRank === 1 && overallScore > 0;

                        return (
                          <tr 
                            key={team.id} 
                            style={{ 
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              background: isLeader 
                                ? 'linear-gradient(90deg, rgba(255, 77, 90, 0.12) 0%, rgba(255, 255, 255, 0.02) 100%)' 
                                : overallRank === 2 ? 'rgba(255, 255, 255, 0.02)' 
                                : 'transparent',
                              borderLeft: isLeader 
                                ? '4px solid #ff4d5a' 
                                : overallRank === 2 ? '4px solid #c0c0c0' 
                                : overallRank === 3 ? '4px solid #cd7f32' 
                                : '4px solid transparent',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            <td style={{ padding: '12px 14px', fontWeight: '700' }}>
                              {overallRank === 1 ? '🥇 1st' : overallRank === 2 ? '🥈 2nd' : overallRank === 3 ? '🥉 3rd' : `#${overallRank}`}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: '700', color: isLeader ? '#ff4d5a' : 'white' }}>
                              {displayName}
                            </td>
                            {PREDEFINED_GAMES.map(g => {
                              const rec = (gameScores || []).find(gs => gs.game_name === g && gs.team_id === team.id);
                              const pts = rec ? rec.points_awarded : 0;
                              const isTopScore = pts === 25;
                              return (
                                <td key={g} style={{ padding: '12px 14px', textAlign: 'center' }}>
                                  {isTopScore ? (
                                    <span style={{ background: 'rgba(74, 222, 128, 0.18)', border: '1px solid #4ade80', color: '#4ade80', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                                      +25 👑
                                    </span>
                                  ) : pts > 0 ? (
                                    <span style={{ color: '#4ade80', fontWeight: '600' }}>+{pts}</span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', fontSize: '1rem', color: isLeader ? '#ff4d5a' : 'white' }}>
                              {overallScore} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', opacity: 0.8 }}>pts</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
