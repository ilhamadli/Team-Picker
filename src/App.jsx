import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import TeamPicker from './components/TeamPicker';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import { supabase } from './supabaseClient';
import { assignToTeam, HERO_TEAM_NAMES } from './utils/teamBalancer';
import { 
  getOrCreateActiveSession, 
  fetchParticipantsForSession, 
  fetchGameScoresForSession,
  saveParticipantToDb, 
  updateParticipantInDb,
  saveGameScoresToDb,
  deleteGameScoreInDb,
  updateGameScoreInDb,
  archiveCurrentSession 
} from './utils/dbHelper';

function App() {
  const location = useLocation();

  const isDashboardOrAdmin = location.pathname === '/dashboard' || location.pathname === '/admin';
  const isHost = isDashboardOrAdmin || localStorage.getItem('is_host') === 'true';
  const [isLeader, setIsLeader] = useState(false);
  const [teams, setTeams] = useState([]);
  const [gameScores, setGameScores] = useState([]);
  const [isRandomizerFinished, setIsRandomizerFinished] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const activeSessionRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Load Active Session, Participants & Game Scores on Mount
  useEffect(() => {
    let isSubscribed = true;
    getOrCreateActiveSession().then(async (session) => {
      if (!isSubscribed || !session) return;
      setActiveSession(session);

      const dbParticipants = await fetchParticipantsForSession(session.id);
      const dbGameScores = await fetchGameScoresForSession(session.id);
      if (isSubscribed) {
        setGameScores(dbGameScores || []);
      }

      // Calculate cumulative team scores from game score history
      const teamScoresMap = {};
      (dbGameScores || []).forEach(gs => {
        teamScoresMap[gs.team_id] = (teamScoresMap[gs.team_id] || 0) + (gs.points_awarded || 0);
      });

      setTeams(prevTeams => {
        const hasDbData = (dbParticipants && dbParticipants.length > 0) || (dbGameScores && dbGameScores.length > 0);

        let reconstructedTeams = Array.from({ length: 8 }, (_, i) => {
          const tId = i + 1;
          const existingTeam = prevTeams.find(item => item.id === tId);

          let calculatedScore = 0;
          if (hasDbData) {
            calculatedScore = teamScoresMap[tId] !== undefined ? teamScoresMap[tId] : (existingTeam ? (existingTeam.score || 0) : 0);
          }

          return {
            id: tId,
            name: HERO_TEAM_NAMES[i] || `Team ${tId}`,
            score: calculatedScore,
            members: []
          };
        });

        if (hasDbData) {
          (dbParticipants || []).forEach(p => {
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
        }

        localStorage.setItem('tournament_teams', JSON.stringify(reconstructedTeams));
        return reconstructedTeams;
      });
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

  const teamsRef = useRef(teams);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  const isRandomizerFinishedRef = useRef(isRandomizerFinished);
  useEffect(() => {
    isRandomizerFinishedRef.current = isRandomizerFinished;
  }, [isRandomizerFinished]);

  // Load Active Session, Participants & Game Scores on Mount
  useEffect(() => {
    let isSubscribed = true;
    getOrCreateActiveSession().then(async (session) => {
      if (!isSubscribed || !session) return;
      setActiveSession(session);

      const dbParticipants = await fetchParticipantsForSession(session.id);
      const dbGameScores = await fetchGameScoresForSession(session.id);

      // Calculate cumulative team scores from game score history
      const teamScoresMap = {};
      (dbGameScores || []).forEach(gs => {
        teamScoresMap[gs.team_id] = (teamScoresMap[gs.team_id] || 0) + (gs.points_awarded || 0);
      });

      setTeams(prevTeams => {
        const savedLocal = localStorage.getItem('tournament_teams');
        const localTeams = savedLocal ? JSON.parse(savedLocal) : [];

        let reconstructedTeams = Array.from({ length: 8 }, (_, i) => {
          const tId = i + 1;
          const existingTeam = prevTeams.find(item => item.id === tId);
          const localTeam = localTeams.find(item => item.id === tId);

          const dbScore = teamScoresMap[tId] || 0;
          const prevScore = existingTeam ? (existingTeam.score || 0) : 0;
          const lScore = localTeam ? (localTeam.score || 0) : 0;

          const finalScore = Math.max(dbScore, prevScore, lScore);

          return {
            id: tId,
            name: `Team ${tId}`,
            score: finalScore,
            members: []
          };
        });

        (dbParticipants || []).forEach(p => {
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

        localStorage.setItem('tournament_teams', JSON.stringify(reconstructedTeams));
        return reconstructedTeams;
      });
    });
    return () => { isSubscribed = false; };
  }, []);

  const sanitizeTeams = (teamList) => {
    if (!Array.isArray(teamList)) return [];
    return teamList.map(t => ({
      ...t,
      name: HERO_TEAM_NAMES[t.id - 1] || t.name || `Team ${t.id}`
    }));
  };

  useEffect(() => {
    const channel = supabase.channel('tournament');
    channelRef.current = channel;

    const handleStorage = (e) => {
      if (e.key === 'tournament_teams' && e.newValue) setTeams(sanitizeTeams(JSON.parse(e.newValue)));
      if (e.key === 'tournament_status' && e.newValue) setIsRandomizerFinished(JSON.parse(e.newValue));
    };

    const savedTeams = localStorage.getItem('tournament_teams');
    const savedStatus = localStorage.getItem('tournament_status');
    if (savedTeams) setTeams(sanitizeTeams(JSON.parse(savedTeams)));
    if (savedStatus) setIsRandomizerFinished(JSON.parse(savedStatus));
    setIsLoaded(true);
    window.addEventListener('storage', handleStorage);

    channel
      .on('broadcast', { event: 'STATE_UPDATE' }, ({ payload }) => {
        if (!isLeaderRef.current && payload.teams) {
          setTeams(prevTeams => {
            return payload.teams.map(inTeam => {
              const prev = prevTeams.find(t => t.id === inTeam.id);
              const maxScore = Math.max(inTeam.score || 0, prev ? (prev.score || 0) : 0);
              return { 
                ...inTeam, 
                name: HERO_TEAM_NAMES[inTeam.id - 1] || inTeam.name || `Team ${inTeam.id}`,
                score: maxScore 
              };
            });
          });
          if (payload.isRandomizerFinished !== undefined) {
            setIsRandomizerFinished(payload.isRandomizerFinished);
          }
          if (payload.gameScores) {
            setGameScores(payload.gameScores);
          }
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
        } else if (payload.action === 'RECORD_GAME_SCORES') {
          setTeams(prevTeams => prevTeams.map(t => ({
            ...t,
            score: (t.score || 0) + (payload.scoreUpdates[t.id] || 0)
          })));
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
        channel.send({
          type: 'broadcast',
          event: 'STATE_UPDATE',
          payload: { teams: teamsRef.current, isRandomizerFinished: isRandomizerFinishedRef.current }
        }).catch(console.error);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (!isLeaderRef.current) {
            channel.send({ type: 'broadcast', event: 'SYNC_REQUEST' }).catch(console.error);
          } else {
            channel.send({
              type: 'broadcast',
              event: 'STATE_UPDATE',
              payload: { teams: teamsRef.current, isRandomizerFinished: isRandomizerFinishedRef.current }
            }).catch(console.error);
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
    if (isHost && isLoaded && isLeader) {
      localStorage.setItem('tournament_teams', JSON.stringify(teams));
      localStorage.setItem('tournament_status', JSON.stringify(isRandomizerFinished));

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'STATE_UPDATE',
          payload: { teams, isRandomizerFinished, gameScores }
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

    if (activeSessionRef.current) {
      saveParticipantToDb(activeSessionRef.current.id, {
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
        const newSession = await archiveCurrentSession(activeSessionRef.current?.id);
        if (newSession) setActiveSession(newSession);
        setTeams([]);
        setIsRandomizerFinished(false);
        localStorage.clear();
        sessionStorage.clear();
      } else if (payload.action === 'TOGGLE_STATUS') {
        setIsRandomizerFinished(prev => !prev);
      } else if (payload.action === 'UPDATE_SCORE') {
        setTeams(prevTeams => prevTeams.map(t => 
          t.id === payload.teamId ? { ...t, score: t.score + payload.points } : t
        ));
      } else if (payload.action === 'RECORD_GAME_SCORES') {
        if (activeSessionRef.current) {
          await saveGameScoresToDb(activeSessionRef.current.id, payload.gameTitle, payload.scoreUpdates);
          const dbGameScores = await fetchGameScoresForSession(activeSessionRef.current.id);
          setGameScores(dbGameScores || []);
        }
        setTeams(prevTeams => prevTeams.map(t => ({
          ...t,
          score: (t.score || 0) + (payload.scoreUpdates[t.id] || 0)
        })));
      } else if (payload.action === 'EDIT_MEMBER') {
        if (activeSessionRef.current) {
          updateParticipantInDb(activeSessionRef.current.id, payload);
        }
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
      } else if (payload.action === 'DELETE_GAME_SCORE') {
        if (activeSessionRef.current) {
          await deleteGameScoreInDb(activeSessionRef.current.id, payload.gameTitle);
          const dbGameScores = await fetchGameScoresForSession(activeSessionRef.current.id);
          setGameScores(dbGameScores || []);
          const teamScoresMap = {};
          (dbGameScores || []).forEach(gs => {
            teamScoresMap[gs.team_id] = (teamScoresMap[gs.team_id] || 0) + (gs.points_awarded || 0);
          });
          setTeams(prevTeams => prevTeams.map(t => ({
            ...t,
            name: HERO_TEAM_NAMES[t.id - 1] || t.name || `Team ${t.id}`,
            score: teamScoresMap[t.id] || 0
          })));
        }
      } else if (payload.action === 'EDIT_GAME_SCORE') {
        if (activeSessionRef.current) {
          await updateGameScoreInDb(activeSessionRef.current.id, payload.oldGameTitle, payload.newGameTitle, payload.scoreUpdates);
          const dbGameScores = await fetchGameScoresForSession(activeSessionRef.current.id);
          setGameScores(dbGameScores || []);
          const teamScoresMap = {};
          (dbGameScores || []).forEach(gs => {
            teamScoresMap[gs.team_id] = (teamScoresMap[gs.team_id] || 0) + (gs.points_awarded || 0);
          });
          setTeams(prevTeams => prevTeams.map(t => ({
            ...t,
            name: HERO_TEAM_NAMES[t.id - 1] || t.name || `Team ${t.id}`,
            score: teamScoresMap[t.id] || 0
          })));
        }
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
          <Route path="/dashboard" element={<Dashboard teams={teams} gameScores={gameScores} activeSession={activeSession} />} />
          <Route path="/admin" element={<AdminPanel teams={teams} isHost={isHost} sendCommand={sendCommand} activeSession={activeSession} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
