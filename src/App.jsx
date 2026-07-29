import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import TeamPicker from './components/TeamPicker';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import { supabase } from './supabaseClient';
import { assignToTeam } from './utils/teamBalancer';
import { 
  getOrCreateActiveTournament, 
  fetchParticipantsForTournament, 
  saveParticipantToDb, 
  archiveCurrentTournamentSession 
} from './utils/dbHelper';

function App() {
  const location = useLocation();

  const isDashboardOrAdmin = location.pathname === '/dashboard' || location.pathname === '/admin';
  const isHost = isDashboardOrAdmin || localStorage.getItem('is_host') === 'true';
  const [isLeader, setIsLeader] = useState(false);
  const [teams, setTeams] = useState([]);
  const [isRandomizerFinished, setIsRandomizerFinished] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTournament, setActiveTournament] = useState(null);
  const activeTournamentRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    activeTournamentRef.current = activeTournament;
  }, [activeTournament]);

  // Load Active Tournament & DB Participants on Mount
  useEffect(() => {
    let isSubscribed = true;
    getOrCreateActiveTournament().then(async (t) => {
      if (!isSubscribed || !t) return;
      setActiveTournament(t);
      const dbParticipants = await fetchParticipantsForTournament(t.id);
      if (dbParticipants && dbParticipants.length > 0) {
        let reconstructedTeams = Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          name: `Team ${i + 1}`,
          score: 0,
          members: []
        }));
        dbParticipants.forEach(p => {
          const tId = p.team_id || 1;
          const targetTeam = reconstructedTeams.find(item => item.id === tId);
          if (targetTeam) {
            targetTeam.members.push({
              name: p.name,
              gender: p.gender,
              clientId: p.client_id || Math.random().toString(36).substr(2, 9)
            });
          }
        });
        setTeams(reconstructedTeams);
        localStorage.setItem('tournament_teams', JSON.stringify(reconstructedTeams));
      }
    });
    return () => { isSubscribed = false; };
  }, []);

  // Leader Election for Host Tabs
  useEffect(() => {
    if (isHost) {
      if (typeof navigator !== 'undefined' && navigator.locks) {
        const controller = new AbortController();
        navigator.locks.request('tournament_host', { signal: controller.signal }, () => {
          setIsLeader(true);
          // Hold lock indefinitely until tab is closed
          return new Promise(() => {});
        }).catch(() => {});
        return () => controller.abort();
      } else {
        // Fallback for older browsers (e.g. some Smart TVs)
        setIsLeader(true);
      }
    } else {
      setIsLeader(false);
    }
  }, [isHost]);

  const isLeaderRef = useRef(isLeader);
  useEffect(() => {
    isLeaderRef.current = isLeader;
  }, [isLeader]);

  useEffect(() => {
    const channel = supabase.channel('tournament');
    channelRef.current = channel;

    const handleStorage = (e) => {
      if (e.key === 'tournament_teams' && e.newValue) setTeams(JSON.parse(e.newValue));
      if (e.key === 'tournament_status' && e.newValue) setIsRandomizerFinished(JSON.parse(e.newValue));
    };

    const savedTeams = localStorage.getItem('tournament_teams');
    const savedStatus = localStorage.getItem('tournament_status');
    if (savedTeams) setTeams(JSON.parse(savedTeams));
    if (savedStatus) setIsRandomizerFinished(JSON.parse(savedStatus));
    setIsLoaded(true);
    window.addEventListener('storage', handleStorage);

    channel
      .on('broadcast', { event: 'STATE_UPDATE' }, ({ payload }) => {
        if (!isLeaderRef.current) {
          setTeams(payload.teams);
          setIsRandomizerFinished(payload.isRandomizerFinished);
        }
      })
      .on('broadcast', { event: 'JOIN_REQUEST' }, ({ payload }) => {
        setTeams(prevTeams => {
          try {
            const { updatedTeams } = assignToTeam(payload.name, payload.gender, prevTeams, payload.clientId, payload.forceTeamId);
            localStorage.setItem('tournament_teams', JSON.stringify(updatedTeams));
            return updatedTeams;
          } catch (e) {
            console.error(e);
            return prevTeams;
          }
        });
      })
      .on('broadcast', { event: 'ADMIN_COMMAND' }, ({ payload }) => {
        if (!isLeaderRef.current) return;
        if (payload.action === 'CLEAR_DATA') {
          setTeams([]);
          setIsRandomizerFinished(false);
        } else if (payload.action === 'TOGGLE_STATUS') {
          setIsRandomizerFinished(prev => !prev);
        } else if (payload.action === 'UPDATE_SCORE') {
          setTeams(prevTeams => prevTeams.map(t => 
            t.id === payload.teamId ? { ...t, score: t.score + payload.points } : t
          ));
        } else if (payload.action === 'EDIT_MEMBER') {
          setTeams(prevTeams => {
            if (!payload.newTeamId || payload.newTeamId === payload.teamId) {
              return prevTeams.map(t => {
                if (t.id === payload.teamId) {
                  return {
                    ...t,
                    members: t.members.map(m => 
                      (m.name || m.input) === payload.oldName 
                        ? { ...m, name: payload.newName, gender: payload.newGender }
                        : m
                    )
                  };
                }
                return t;
              });
            } else {
              let memberToMove = null;
              const teamsAfterRemoval = prevTeams.map(t => {
                if (t.id === payload.teamId) {
                  const m = t.members.find(m => (m.name || m.input) === payload.oldName);
                  if (m) memberToMove = { ...m, name: payload.newName, gender: payload.newGender };
                  return {
                    ...t,
                    members: t.members.filter(m => (m.name || m.input) !== payload.oldName)
                  };
                }
                return t;
              });
              if (memberToMove) {
                return teamsAfterRemoval.map(t => {
                  if (t.id === payload.newTeamId) {
                    return { ...t, members: [...t.members, memberToMove] };
                  }
                  return t;
                });
              }
              return teamsAfterRemoval;
            }
          });
        }
      })
      .on('broadcast', { event: 'SYNC_REQUEST' }, () => {
        if (!isLeaderRef.current) return;
        setTeams(prev => [...prev]); // Trigger broadcast
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (!isLeaderRef.current) {
            channel.send({ type: 'broadcast', event: 'SYNC_REQUEST' }).catch(console.error);
          } else {
            setTeams(prev => [...prev]); // Initial broadcast
          }
        }
      });

    return () => {
      window.removeEventListener('storage', handleStorage);
      supabase.removeChannel(channel);
    };
  }, [isHost]);

  // Host broadcast effect
  useEffect(() => {
    if (isHost && isLoaded) {
      localStorage.setItem('tournament_teams', JSON.stringify(teams));
      localStorage.setItem('tournament_status', JSON.stringify(isRandomizerFinished));

      if (channelRef.current && isLeader) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'STATE_UPDATE',
          payload: { teams, isRandomizerFinished }
        }).catch(console.error);
      }
    }
  }, [teams, isRandomizerFinished, isHost, isLoaded, isLeader]);

  const sendJoinRequest = (payload) => {
    let finalTeamId = payload.forceTeamId;

    setTeams(prevTeams => {
      try {
        const { updatedTeams, assignedTeamId } = assignToTeam(payload.name, payload.gender, prevTeams, payload.clientId, payload.forceTeamId);
        finalTeamId = assignedTeamId;
        localStorage.setItem('tournament_teams', JSON.stringify(updatedTeams));
        return updatedTeams;
      } catch (e) {
        console.error(e);
        return prevTeams;
      }
    });

    const { assignedTeamId: computedTeamId } = assignToTeam(payload.name, payload.gender, teams, payload.clientId, payload.forceTeamId);
    const targetTeamId = finalTeamId || computedTeamId || 1;

    if (activeTournamentRef.current) {
      saveParticipantToDb(activeTournamentRef.current.id, {
        name: payload.name,
        gender: payload.gender,
        teamId: targetTeamId,
        clientId: payload.clientId
      });
    }

    if (channelRef.current) {
      return channelRef.current.send({
        type: 'broadcast',
        event: 'JOIN_REQUEST',
        payload: { ...payload, forceTeamId: targetTeamId }
      }).catch(console.error);
    }
    return Promise.resolve();
  };

  const sendCommand = async (payload) => {
    if (isLeader) {
      if (payload.action === 'CLEAR_DATA') {
        if (activeTournamentRef.current) {
          const newSession = await archiveCurrentTournamentSession(activeTournamentRef.current.id);
          if (newSession) setActiveTournament(newSession);
        }
        setTeams([]);
        setIsRandomizerFinished(false);
        localStorage.removeItem('tournament_teams');
        localStorage.removeItem('tournament_status');
      } else if (payload.action === 'TOGGLE_STATUS') {
        setIsRandomizerFinished(prev => !prev);
      } else if (payload.action === 'UPDATE_SCORE') {
        setTeams(prevTeams => prevTeams.map(t => 
          t.id === payload.teamId ? { ...t, score: t.score + payload.points } : t
        ));
      } else if (payload.action === 'EDIT_MEMBER') {
        setTeams(prevTeams => {
          if (!payload.newTeamId || payload.newTeamId === payload.teamId) {
            return prevTeams.map(t => {
              if (t.id === payload.teamId) {
                return {
                  ...t,
                  members: t.members.map(m => 
                    (m.name || m.input) === payload.oldName 
                      ? { ...m, name: payload.newName, gender: payload.newGender }
                      : m
                  )
                };
              }
              return t;
            });
          } else {
            let memberToMove = null;
            const teamsAfterRemoval = prevTeams.map(t => {
              if (t.id === payload.teamId) {
                const m = t.members.find(m => (m.name || m.input) === payload.oldName);
                if (m) memberToMove = { ...m, name: payload.newName, gender: payload.newGender };
                return {
                  ...t,
                  members: t.members.filter(m => (m.name || m.input) !== payload.oldName)
                };
              }
              return t;
            });
            if (memberToMove) {
              return teamsAfterRemoval.map(t => {
                if (t.id === payload.newTeamId) {
                  return { ...t, members: [...t.members, memberToMove] };
                }
                return t;
              });
            }
            return teamsAfterRemoval;
          }
        });
      }
    } else {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ADMIN_COMMAND',
          payload
        }).catch(console.error);
      }
    }
  };

  return (
    <div className="container" style={{ position: 'relative', minHeight: '100vh', paddingBottom: '60px' }}>
      <header className="header header-container">
        <div className="animate-fade-in logo-left-container">
          <img src="/logo-left.png" alt="Hejaz Logo" className="header-logo logo-left" />
        </div>
        
        <div className="header-text">
          <h1 className="title text-gradient animate-fade-in">Hejaz Patriot</h1>
          <p className="subtitle animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Hejaz Indonesia Independence Day Tournament 2026
          </p>
        </div>

        <div className="animate-fade-in logo-right-container">
          <img src="/logo-right.png" alt="81 Logo" className="header-logo logo-right" />
        </div>
      </header>

      <main className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <Routes>
          <Route path="/" element={<TeamPicker teams={teams} sendJoinRequest={sendJoinRequest} />} />
          <Route path="/dashboard" element={<Dashboard teams={teams} />} />
          <Route path="/admin" element={<AdminPanel teams={teams} isHost={isHost} sendCommand={sendCommand} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
