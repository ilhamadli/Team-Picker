import { useState } from 'react';
import { Settings, Trash2, Plus, Minus, X, Edit2, Save, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { fetchAllParticipantsHistorical } from '../utils/dbHelper';

const AdminPanel = ({ teams = [], isHost = false, sendCommand }) => {
  const [editingMember, setEditingMember] = useState(null); // { teamId, oldName, newName, newGender }
  const [isExporting, setIsExporting] = useState(false);
  const navigate = useNavigate();

  const clearData = () => {
    if (window.confirm('Are you sure you want to reset and archive the active tournament session? All history will be preserved in Supabase.')) {
      sendCommand({ action: 'CLEAR_DATA' });
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      let rows = [];
      const dbParticipants = await fetchAllParticipantsHistorical();

      if (dbParticipants && dbParticipants.length > 0) {
        rows = dbParticipants.map(item => ({
          "Tournament Session": item.tournaments?.name || "Active Session",
          "Employee Name": item.name,
          "Gender": item.gender,
          "Assigned Team": item.team_name || `Team ${item.team_id}`,
          "Submission Date": item.created_at ? new Date(item.created_at).toLocaleString() : "N/A"
        }));
      } else {
        // Fallback to current local state if DB is empty
        teams.forEach(team => {
          (team.members || []).forEach(member => {
            rows.push({
              "Tournament Session": "Active Session",
              "Employee Name": member.name || member.input || "N/A",
              "Gender": member.gender || "N/A",
              "Assigned Team": team.name,
              "Submission Date": new Date().toLocaleString()
            });
          });
        });
      }

      if (rows.length === 0) {
        alert("No employee participant data to export yet.");
        setIsExporting(false);
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tournament Participants");
      
      const fileName = `Hejaz_Patriot_Participants_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export Excel file.");
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
