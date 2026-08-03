import { useState, useEffect } from 'react';
import { Settings, Trash2, X, Edit2, Save, Download, Trophy, Award, History, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportAllDataToExcel, fetchGameScoresForSession } from '../utils/dbHelper';
import { HERO_TEAM_NAMES, PREDEFINED_GAMES } from '../utils/teamBalancer';

const AdminPanel = ({ teams = [], isHost = false, sendCommand, activeSession }) => {
  const [activeTab, setActiveTab] = useState('games'); // 'games', 'roster', 'settings'
  const [editingMember, setEditingMember] = useState(null); // { teamId, oldName, newName, newGender }
  const [isExporting, setIsExporting] = useState(false);
  const [gameTitle, setGameTitle] = useState(PREDEFINED_GAMES[0]);
  const [gameSuccessMsg, setGameSuccessMsg] = useState('');
  const [rankings, setRankings] = useState({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: ''
  });
  const [recordedGames, setRecordedGames] = useState([]);
  const [editingGame, setEditingGame] = useState(null); // { oldGameTitle, gameTitle, rankings }
  const navigate = useNavigate();

  const RANK_CONFIG = [
    { rank: 1, label: '1st Place', points: 25 },
    { rank: 2, label: '2nd Place', points: 18 },
    { rank: 3, label: '3rd Place', points: 15 },
    { rank: 4, label: '4th Place', points: 12 },
    { rank: 5, label: '5th Place', points: 10 },
    { rank: 6, label: '6th Place', points: 8 },
    { rank: 7, label: '7th Place', points: 5 },
    { rank: 8, label: '8th Place', points: 3 }
  ];

  const getTeamDisplayName = (team) => {
    if (!team) return '';
    const baseName = HERO_TEAM_NAMES[team.id - 1] || team.name || `Team ${team.id}`;
    return `${baseName} (Team ${team.id})`;
  };

  const getAvailableTeams = (currentRank) => {
    const chosenOtherTeamIds = Object.entries(rankings)
      .filter(([r, val]) => parseInt(r) !== currentRank && val !== '')
      .map(([_, val]) => parseInt(val));

    return teams.filter(t => !chosenOtherTeamIds.includes(t.id));
  };

  const handleRankChange = (rank, teamIdStr) => {
    setRankings(prev => ({ ...prev, [rank]: teamIdStr }));
  };

  const handleSelectGame = (selectedTitle, gamesList = recordedGames) => {
    setGameTitle(selectedTitle);
    const existing = gamesList.find(g => g.gameTitle === selectedTitle);
    if (existing) {
      setRankings({ ...existing.rankings });
    } else {
      setRankings({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' });
    }
  };

  const submitGameStandings = (e) => {
    e.preventDefault();
    const selectedIds = Object.values(rankings).filter(val => val !== '');
    if (selectedIds.length === 0) {
      alert("Please select team rankings before submitting.");
      return;
    }

    const uniqueIds = new Set(selectedIds);
    if (uniqueIds.size !== selectedIds.length) {
      alert("Validation Error: A team cannot be assigned to multiple rank positions.");
      return;
    }

    const scoreUpdates = {};
    RANK_CONFIG.forEach(({ rank, points }) => {
      const tId = parseInt(rankings[rank]);
      if (tId) scoreUpdates[tId] = points;
    });

    const isAlreadyRecorded = recordedGames.some(g => g.gameTitle === gameTitle);

    if (isAlreadyRecorded) {
      sendCommand({
        action: 'EDIT_GAME_SCORE',
        oldGameTitle: gameTitle,
        newGameTitle: gameTitle,
        scoreUpdates
      });
      setGameSuccessMsg(`Success! Updated standings for ${gameTitle}.`);
    } else {
      sendCommand({ action: 'RECORD_GAME_SCORES', scoreUpdates, gameTitle });
      setGameSuccessMsg(`Success! Awarded points for ${gameTitle}.`);
    }

    setTimeout(() => setGameSuccessMsg(''), 4000);
    setTimeout(loadRecordedGames, 600);
  };

  const loadRecordedGames = async () => {
    if (!activeSession?.id) {
      setRecordedGames([]);
      return;
    }
    const data = await fetchGameScoresForSession(activeSession.id);
    if (!data || data.length === 0) {
      setRecordedGames([]);
      return;
    }

    const gamesMap = {};
    data.forEach(item => {
      const gName = item.game_name || 'Game Round';
      if (!gamesMap[gName]) {
        gamesMap[gName] = {
          gameTitle: gName,
          created_at: item.created_at,
          rankings: {}
        };
      }
      gamesMap[gName].rankings[item.rank] = item.team_id;
    });

    const list = Object.values(gamesMap);
    setRecordedGames(list);

    // Keep active rankings updated if currently viewing a recorded game
    const currentRecorded = list.find(g => g.gameTitle === gameTitle);
    if (currentRecorded) {
      setRankings({ ...currentRecorded.rankings });
    }
  };

  useEffect(() => {
    loadRecordedGames();
  }, [activeSession?.id, teams]);

  const handleDeleteRecordedGame = (gTitle) => {
    if (window.confirm(`Are you sure you want to delete "${gTitle}" from this session? Total team scores will be updated.`)) {
      sendCommand({ action: 'DELETE_GAME_SCORE', gameTitle: gTitle });
      if (gameTitle === gTitle) {
        setRankings({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' });
      }
      setTimeout(loadRecordedGames, 600);
    }
  };

  const handleSaveEditGame = (e) => {
    e.preventDefault();
    if (!editingGame) return;

    const scoreUpdates = {};
    RANK_CONFIG.forEach(({ rank, points }) => {
      const tId = parseInt(editingGame.rankings[rank]);
      if (tId) scoreUpdates[tId] = points;
    });

    sendCommand({
      action: 'EDIT_GAME_SCORE',
      oldGameTitle: editingGame.oldGameTitle,
      newGameTitle: editingGame.gameTitle,
      scoreUpdates
    });

    setEditingGame(null);
    setTimeout(loadRecordedGames, 600);
  };

  const clearData = () => {
    if (window.confirm('Are you sure you want to reset and archive the active tournament session? All history will be preserved in Supabase.')) {
      sendCommand({ action: 'CLEAR_DATA' });
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      await exportAllDataToExcel();
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export Excel file. Make sure your database tables are active.");
    } finally {
      setIsExporting(false);
    }
  };



  const updateTeamScore = (teamId, points) => {
    sendCommand({ action: 'UPDATE_SCORE', teamId, points });
  };

  const editTeamMember = (teamId, oldName, newName, newGender, newTeamId) => {
    sendCommand({ action: 'EDIT_MEMBER', teamId, oldName, newName, newGender, newTeamId });
  };

  const onClose = () => {
    navigate('/dashboard');
  };

  const isAdmin = sessionStorage.getItem('is_admin_logged_in') === 'true';

  if (!isAdmin) {
    return (
      <div className="glass-panel animate-fade-in" style={{ padding: '40px', maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
        <Settings size={48} className="text-gradient" style={{ margin: '0 auto 24px' }} />
        <h2 style={{ marginBottom: '24px' }}>Admin Login</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          const pin = e.target.pin.value;
          if (pin === 'admin123') {
            sessionStorage.setItem('is_admin_logged_in', 'true');
            localStorage.setItem('is_host', 'true');
            window.location.reload();
          } else {
            alert('Incorrect PIN');
          }
        }}>
          <input 
            type="password" 
            name="pin"
            className="input-field" 
            placeholder="Enter PIN" 
            autoFocus
            style={{ marginBottom: '24px' }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '32px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <Settings className="text-gradient" size={28} />
        <h2 style={{ margin: 0, flex: 1 }}>Admin Panel</h2>
        <button 
          className="btn" 
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
          title="Close Admin Panel"
        >
          <X size={18} />
        </button>
        <button 
          className="btn" 
          onClick={() => {
            sessionStorage.removeItem('is_admin_logged_in');
            localStorage.removeItem('is_host');
            window.location.href = '/';
          }}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', padding: '8px 16px', fontSize: '0.9rem' }}
        >
          Logout
        </button>
      </div>

      {/* Browser Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '28px', 
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: '14px',
        flexWrap: 'wrap'
      }}>
        <button
          className="btn"
          style={{
            background: activeTab === 'games' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
            color: activeTab === 'games' ? 'white' : 'var(--text-muted)',
            border: activeTab === 'games' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
            padding: '10px 20px',
            fontSize: '0.95rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={() => setActiveTab('games')}
        >
          <Trophy size={18} /> Game Results & History
        </button>

        <button
          className="btn"
          style={{
            background: activeTab === 'roster' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
            color: activeTab === 'roster' ? 'white' : 'var(--text-muted)',
            border: activeTab === 'roster' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
            padding: '10px 20px',
            fontSize: '0.95rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={() => setActiveTab('roster')}
        >
          <Users size={18} /> Submitted Roster ({teams.reduce((acc, t) => acc + (t.members?.length || 0), 0)})
        </button>

        <button
          className="btn"
          style={{
            background: activeTab === 'settings' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
            color: activeTab === 'settings' ? 'white' : 'var(--text-muted)',
            border: activeTab === 'settings' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
            padding: '10px 20px',
            fontSize: '0.95rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={18} /> Session & Export
        </button>
      </div>

      {/* TAB 1: GAME RESULTS & HISTORY */}
      {activeTab === 'games' && (
        <>
          {/* Game Results Standings Panel */}
          <div className="game-results-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Trophy className="text-gradient" size={24} />
                <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Record Game Results</h3>
              </div>
              {recordedGames.some(g => g.gameTitle === gameTitle) ? (
                <span style={{ background: 'rgba(74, 222, 128, 0.15)', border: '1px solid #4ade80', color: '#4ade80', padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600' }}>
                  ✓ Recorded for {gameTitle}
                </span>
              ) : (
                <span style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem' }}>
                  ⏳ Pending Standings
                </span>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Select one of the 5 predefined games and assign finishing positions for all 8 teams. Points (+25, 18, 15, 12, 10, 8, 5, 3) will be awarded automatically.
            </p>

            {gameSuccessMsg && (
              <div style={{ background: 'rgba(74, 222, 128, 0.15)', border: '1px solid #4ade80', color: '#4ade80', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.95rem', fontWeight: '500' }}>
                {gameSuccessMsg}
              </div>
            )}

            <form onSubmit={submitGameStandings}>
              <div style={{ marginBottom: '24px', maxWidth: '400px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>Select Predefined Game</label>
                <select 
                  className="select-dropdown" 
                  value={gameTitle} 
                  onChange={(e) => handleSelectGame(e.target.value)} 
                  style={{ padding: '10px 14px', fontSize: '1rem', fontWeight: '600' }}
                >
                  {PREDEFINED_GAMES.map((g, idx) => (
                    <option key={g} value={g}>
                      {idx + 1}. {g} {recordedGames.some(rg => rg.gameTitle === g) ? ' (Recorded)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rank-grid">
                {RANK_CONFIG.map(({ rank, label, points }) => (
                  <div key={`rank-${rank}`} className="rank-card">
                    <div className="rank-card-header">
                      <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{label}</span>
                      <span className="rank-pts-badge">+{points} pts</span>
                    </div>
                    <select 
                      className="select-dropdown" 
                      style={{ padding: '8px 28px 8px 12px', fontSize: '0.9rem' }}
                      value={rankings[rank] || ''}
                      onChange={(e) => handleRankChange(rank, e.target.value)}
                    >
                      <option value="">Select Team...</option>
                      {getAvailableTeams(rank).map(t => (
                        <option key={`opt-${rank}-${t.id}`} value={t.id}>{getTeamDisplayName(t)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                <Award size={18} /> {recordedGames.some(g => g.gameTitle === gameTitle) ? `Update Standings for ${gameTitle}` : `Submit Standings for ${gameTitle}`}
              </button>
            </form>
          </div>

          {/* Predefined 5-Game Status Overview & History */}
          <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <History className="text-gradient" size={24} />
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Tournament 5-Game Status & History</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Status and recorded standings for all 5 tournament games in this active session. Click "Edit Standings" to modify any game.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {PREDEFINED_GAMES.map((gName, idx) => {
                const recorded = recordedGames.find(g => g.gameTitle === gName);
                const isSelected = gameTitle === gName;

                return (
                  <div 
                    key={gName} 
                    className="glass-panel" 
                    style={{ 
                      padding: '18px 20px', 
                      background: isSelected ? 'rgba(231, 0, 18, 0.08)' : 'rgba(255,255,255,0.02)', 
                      border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.06)', 
                      borderRadius: '14px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: recorded ? '12px' : '0', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: isSelected ? 'white' : 'var(--primary)' }}>
                          Game {idx + 1}: {gName}
                        </h4>
                        <span style={{ fontSize: '0.85rem', color: recorded ? '#4ade80' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                          {recorded ? `✓ Recorded (${recorded.created_at ? new Date(recorded.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Saved'})` : '⏳ Not Recorded Yet'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn" 
                          style={{ 
                            padding: '6px 14px', 
                            fontSize: '0.85rem', 
                            background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                            color: 'white',
                            border: 'none',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px' 
                          }}
                          onClick={() => {
                            handleSelectGame(gName);
                            window.scrollTo({ top: 100, behavior: 'smooth' });
                          }}
                        >
                          <Edit2 size={14} /> {recorded ? 'Edit Standings' : 'Enter Standings'}
                        </button>
                        {recorded && (
                          <button 
                            className="btn" 
                            style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#ff4d5a', borderColor: 'rgba(231,0,18,0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => handleDeleteRecordedGame(gName)}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {recorded && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                        {RANK_CONFIG.map(({ rank, points }) => {
                          const tId = recorded.rankings[rank];
                          const targetTeam = teams.find(t => t.id === tId);
                          if (!targetTeam) return null;
                          return (
                            <span 
                              key={rank} 
                              style={{ 
                                background: rank === 1 ? 'rgba(255, 77, 90, 0.2)' : 'rgba(255,255,255,0.04)', 
                                border: rank === 1 ? '1px solid #ff4d5a' : '1px solid rgba(255,255,255,0.08)',
                                padding: '4px 10px', 
                                borderRadius: '8px', 
                                fontSize: '0.85rem' 
                              }}
                            >
                              <strong>#{rank}</strong> {getTeamDisplayName(targetTeam)} <span style={{ opacity: 0.7 }}>({points} pts)</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Legacy or Custom Games recorded */}
              {recordedGames.filter(g => !PREDEFINED_GAMES.includes(g.gameTitle)).length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--text-muted)' }}>Other Recorded Games</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {recordedGames.filter(g => !PREDEFINED_GAMES.includes(g.gameTitle)).map((game, idx) => (
                      <div 
                        key={idx} 
                        className="glass-panel" 
                        style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>{game.gameTitle}</h4>
                          <button 
                            className="btn" 
                            style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#ff4d5a', borderColor: 'rgba(231,0,18,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleDeleteRecordedGame(game.gameTitle)}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {RANK_CONFIG.map(({ rank, points }) => {
                            const tId = game.rankings[rank];
                            const targetTeam = teams.find(t => t.id === tId);
                            if (!targetTeam) return null;
                            return (
                              <span key={rank} style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '6px' }}>
                                <strong>#{rank}</strong> {getTeamDisplayName(targetTeam)} ({points} pts)
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* TAB 2: SUBMITTED ROSTER */}
      {activeTab === 'roster' && (
        <div>
          <h3 style={{ margin: '0 0 20px' }}>Submitted Employees & Transfers</h3>
          {teams.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No employees have joined yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {teams.map(team => (
                <div key={`members-${team.id}`} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, color: 'var(--primary)' }}>{getTeamDisplayName(team)}</h4>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '12px' }}>
                      Male: <strong style={{ color: '#4a9eff' }}>{team.members.filter(m => m.gender === 'Male').length}</strong> &nbsp;|&nbsp; 
                      Female: <strong style={{ color: '#ff4a9e' }}>{team.members.filter(m => m.gender === 'Female').length}</strong>
                    </div>
                  </div>
                  {team.members.length === 0 ? (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No members yet.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {team.members.map((member, idx) => {
                        const memberName = member.name || member.input;
                        const isEditing = editingMember?.teamId === team.id && editingMember?.oldName === memberName;
                        
                        return (
                          <li key={idx} style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 0', borderBottom: idx !== team.members.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                          }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '8px', flex: 1, marginRight: '16px', flexWrap: 'wrap' }}>
                                <input 
                                  type="text" 
                                  className="input-field" 
                                  style={{ padding: '6px 12px', fontSize: '0.9rem', flex: '1 1 auto' }}
                                  value={editingMember.newName}
                                  onChange={(e) => setEditingMember({...editingMember, newName: e.target.value})}
                                />
                                <select 
                                  className="select-dropdown"
                                  style={{ padding: '6px 32px 6px 12px', fontSize: '0.9rem', width: 'auto' }}
                                  value={editingMember.newGender}
                                  onChange={(e) => setEditingMember({...editingMember, newGender: e.target.value})}
                                >
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                </select>
                                <select 
                                  className="select-dropdown"
                                  style={{ padding: '6px 32px 6px 12px', fontSize: '0.9rem', width: 'auto' }}
                                  value={editingMember.newTeamId}
                                  onChange={(e) => setEditingMember({...editingMember, newTeamId: parseInt(e.target.value)})}
                                >
                                  {teams.map(t => (
                                    <option key={t.id} value={t.id}>{getTeamDisplayName(t)}</option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div>
                                <span style={{ fontWeight: '500' }}>{memberName}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({member.gender})</span>
                              </div>
                            )}
                            
                            <div>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button 
                                    className="btn" 
                                    style={{ padding: '6px', minWidth: 'auto' }}
                                    onClick={() => setEditingMember(null)}
                                  >
                                    <X size={14} />
                                  </button>
                                  <button 
                                    className="btn btn-primary" 
                                    style={{ padding: '6px', minWidth: 'auto' }}
                                    onClick={() => {
                                      editTeamMember(team.id, editingMember.oldName, editingMember.newName, editingMember.newGender, editingMember.newTeamId);
                                      setEditingMember(null);
                                    }}
                                  >
                                    <Save size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  className="btn" 
                                  style={{ padding: '6px', minWidth: 'auto', background: 'transparent', border: '1px solid var(--glass-border)' }}
                                  onClick={() => setEditingMember({ teamId: team.id, oldName: memberName, newName: memberName, newGender: member.gender, newTeamId: team.id })}
                                  title="Edit Member"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SESSION & EXPORT SETTINGS */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="admin-responsive-box">
            <div>
              <h3 style={{ color: '#4a9eff', margin: '0 0 4px 0' }}>Export Tournament Data</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Download current and historical employee records into an Excel file (.xlsx).</p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={exportToExcel}
              disabled={isExporting}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Download size={16} /> {isExporting ? 'Exporting...' : 'Export to Excel'}
            </button>
          </div>

          <div className="admin-danger-box">
            <div>
              <h3 style={{ color: '#ff4444', margin: '0 0 4px 0' }}>Reset & Archive Session</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Archive current active session to Supabase DB and start a fresh tournament session.</p>
            </div>
            <button 
              className="btn" 
              onClick={clearData}
              style={{ background: '#ff4444', color: 'white', border: 'none' }}
            >
              <Trash2 size={16} /> Reset All Data
            </button>
          </div>
        </div>
      )}

      {/* Edit Game Modal */}
      {editingGame && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--primary)' }}>Edit Game Standings</h3>
              <button className="btn" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => setEditingGame(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditGame}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-muted)' }}>Game Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editingGame.gameTitle} 
                  onChange={(e) => setEditingGame({ ...editingGame, gameTitle: e.target.value })}
                  required 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {RANK_CONFIG.map(({ rank, label, points }) => (
                  <div key={rank} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '100px', fontSize: '0.9rem', fontWeight: '700' }}>{label} ({points} pts):</span>
                    <select 
                      className="select-dropdown" 
                      style={{ flex: 1 }}
                      value={editingGame.rankings[rank] || ''}
                      onChange={(e) => setEditingGame({
                        ...editingGame,
                        rankings: { ...editingGame.rankings, [rank]: e.target.value ? parseInt(e.target.value) : '' }
                      })}
                    >
                      <option value="">-- Select Team --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{getTeamDisplayName(t)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn" onClick={() => setEditingGame(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
