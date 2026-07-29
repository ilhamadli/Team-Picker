import { useState } from 'react';
import { Settings, Trash2, Plus, Minus, X, Edit2, Save, Download, Trophy, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportAllDataToExcel } from '../utils/dbHelper';

const AdminPanel = ({ teams = [], isHost = false, sendCommand }) => {
  const [editingMember, setEditingMember] = useState(null); // { teamId, oldName, newName, newGender }
  const [isExporting, setIsExporting] = useState(false);
  const [gameTitle, setGameTitle] = useState('Game 1');
  const [gameSuccessMsg, setGameSuccessMsg] = useState('');
  const [rankings, setRankings] = useState({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: ''
  });
  const navigate = useNavigate();

  const RANK_CONFIG = [
    { rank: 1, label: '1st Place', points: 8 },
    { rank: 2, label: '2nd Place', points: 7 },
    { rank: 3, label: '3rd Place', points: 6 },
    { rank: 4, label: '4th Place', points: 5 },
    { rank: 5, label: '5th Place', points: 4 },
    { rank: 6, label: '6th Place', points: 3 },
    { rank: 7, label: '7th Place', points: 2 },
    { rank: 8, label: '8th Place', points: 1 }
  ];

  const getAvailableTeams = (currentRank) => {
    const chosenOtherTeamIds = Object.entries(rankings)
      .filter(([r, val]) => parseInt(r) !== currentRank && val !== '')
      .map(([_, val]) => parseInt(val));

    return teams.filter(t => !chosenOtherTeamIds.includes(t.id));
  };

  const handleRankChange = (rank, teamIdStr) => {
    setRankings(prev => ({ ...prev, [rank]: teamIdStr }));
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

    sendCommand({ action: 'RECORD_GAME_SCORES', scoreUpdates, gameTitle });

    setGameSuccessMsg(`Success! Awarded points (+8 to +1) for ${gameTitle}.`);
    setTimeout(() => setGameSuccessMsg(''), 4000);

    // Reset form to blank defaults
    setRankings({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' });
    setGameTitle('Game 1');
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

      {/* Game Results Standings Panel */}
      <div className="game-results-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Trophy className="text-gradient" size={24} />
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Record Game Results (8-Team Scoring)</h3>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Assign finishing position for all 8 teams. Points (+8 for 1st down to +1 for 8th) will be calculated automatically.
        </p>

        {gameSuccessMsg && (
          <div style={{ background: 'rgba(74, 222, 128, 0.15)', border: '1px solid #4ade80', color: '#4ade80', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.95rem', fontWeight: '500' }}>
            {gameSuccessMsg}
          </div>
        )}

        <form onSubmit={submitGameStandings}>
          <div style={{ marginBottom: '20px', maxWidth: '300px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Game / Round Name</label>
            <input 
              type="text" 
              className="input-field" 
              value={gameTitle} 
              onChange={(e) => setGameTitle(e.target.value)} 
              placeholder="e.g. Game 1, Tug of War..." 
              style={{ padding: '10px 14px', fontSize: '0.95rem' }}
            />
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
                  value={rankings[rank]}
                  onChange={(e) => handleRankChange(rank, e.target.value)}
                >
                  <option value="">Select Team...</option>
                  {getAvailableTeams(rank).map(t => (
                    <option key={`opt-${rank}-${t.id}`} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
            <Award size={18} /> Submit Game Standings & Award Points
          </button>
        </form>
      </div>

      <h3 style={{ marginBottom: '20px' }}>Manage Team Scores</h3>
      
      {teams.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No teams available to manage yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {teams.map(team => (
            <div key={team.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <div>
                <span style={{ fontWeight: '600', marginRight: '16px' }}>{team.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{team.score} pts</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn" style={{ padding: '8px', minWidth: '40px' }} onClick={() => updateTeamScore(team.id, -10)}>
                  <Minus size={16} />
                </button>
                <button className="btn btn-primary" style={{ padding: '8px', minWidth: '40px' }} onClick={() => updateTeamScore(team.id, 10)}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ margin: '32px 0 20px' }}>Submitted Employees</h3>
      {teams.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No employees have joined yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {teams.map(team => (
            <div key={`members-${team.id}`} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)' }}>{team.name}</h4>
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
                                <option key={t.id} value={t.id}>{t.name}</option>
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
  );
};

export default AdminPanel;
