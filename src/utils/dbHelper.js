import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { HERO_TEAM_NAMES } from './teamBalancer';

export const getOrCreateActiveSession = async () => {
  try {
    const { data: activeSessions, error } = await supabase
      .from('tournament_sessions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn("Supabase query info (tournament_sessions table):", error.message);
      return null;
    }

    if (activeSessions && activeSessions.length > 0) {
      return activeSessions[0];
    }

    // Safely count all existing sessions to get the next sequential number (e.g. Session 5)
    const { count } = await supabase
      .from('tournament_sessions')
      .select('*', { count: 'exact', head: true });

    const nextNum = (count || 0) + 1;
    const newName = `Session ${nextNum} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

    // Double check if another tab created an active session in the last 2 seconds
    const { data: doubleCheck } = await supabase
      .from('tournament_sessions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (doubleCheck && doubleCheck.length > 0) {
      return doubleCheck[0];
    }

    const { data: created, error: createErr } = await supabase
      .from('tournament_sessions')
      .insert([{ name: newName, status: 'active' }])
      .select()
      .single();

    if (createErr) {
      console.warn("Could not auto-create active session:", createErr.message);
      return null;
    }

    return created;
  } catch (err) {
    console.warn("Supabase DB error:", err);
    return null;
  }
};

export const fetchParticipantsForSession = async (sessionId) => {
  if (!sessionId) return [];
  try {
    const { data, error } = await supabase
      .from('session_participants')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn("Fetch participants error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("Fetch participants error:", err);
    return [];
  }
};

export const fetchGameScoresForSession = async (sessionId) => {
  if (!sessionId) return [];
  try {
    const { data, error } = await supabase
      .from('session_game_scores')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn("Fetch game scores error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("Fetch game scores error:", err);
    return [];
  }
};

export const saveParticipantToDb = async (sessionId, member) => {
  if (!sessionId) return null;
  try {
    const tId = member.teamId;
    const tName = HERO_TEAM_NAMES[tId - 1] || `Team ${tId}`;
    const { data, error } = await supabase
      .from('session_participants')
      .insert([{
        session_id: sessionId,
        name: member.name,
        gender: member.gender,
        team_id: tId,
        team_name: tName,
        client_id: member.clientId
      }])
      .select()
      .single();

    if (error) {
      console.warn("Failed to save participant to DB:", error.message);
    }
    return data;
  } catch (err) {
    console.warn("Save participant error:", err);
    return null;
  }
};

export const updateParticipantInDb = async (sessionId, payload) => {
  if (!sessionId) return null;
  try {
    const tId = payload.newTeamId || payload.teamId;
    const tName = HERO_TEAM_NAMES[tId - 1] || `Team ${tId}`;
    const { data, error } = await supabase
      .from('session_participants')
      .update({
        name: payload.newName,
        gender: payload.newGender,
        team_id: tId,
        team_name: tName
      })
      .eq('session_id', sessionId)
      .eq('name', payload.oldName);

    if (error) {
      console.warn("Failed to update participant in DB:", error.message);
    }
    return data;
  } catch (err) {
    console.warn("Update participant error:", err);
    return null;
  }
};

export const saveGameScoresToDb = async (sessionId, gameName, scoreUpdates) => {
  if (!sessionId || !scoreUpdates) return null;
  try {
    const RANK_POINTS_MAP = { 25: 1, 18: 2, 15: 3, 12: 4, 10: 5, 8: 6, 5: 7, 3: 8 };

    const rowsToInsert = Object.entries(scoreUpdates).map(([teamIdStr, points]) => {
      const teamId = parseInt(teamIdStr);
      return {
        session_id: sessionId,
        game_name: gameName || 'Game Round',
        team_id: teamId,
        team_name: HERO_TEAM_NAMES[teamId - 1] || `Team ${teamId}`,
        rank: RANK_POINTS_MAP[points] || 8,
        points_awarded: points
      };
    });

    const { data, error } = await supabase
      .from('session_game_scores')
      .insert(rowsToInsert);

    if (error) {
      console.warn("Failed to save game scores to DB:", error.message);
    }
    return data;
  } catch (err) {
    console.warn("Save game scores error:", err);
    return null;
  }
};

export const deleteGameScoreInDb = async (sessionId, gameName) => {
  if (!sessionId || !gameName) return null;
  try {
    const { data, error } = await supabase
      .from('session_game_scores')
      .delete()
      .eq('session_id', sessionId)
      .eq('game_name', gameName);

    if (error) {
      console.warn("Failed to delete game score from DB:", error.message);
    }
    return data;
  } catch (err) {
    console.warn("Delete game score error:", err);
    return null;
  }
};

export const updateGameScoreInDb = async (sessionId, oldGameName, newGameTitle, newScoreUpdates) => {
  if (!sessionId || !oldGameName || !newScoreUpdates) return null;
  try {
    await supabase
      .from('session_game_scores')
      .delete()
      .eq('session_id', sessionId)
      .eq('game_name', oldGameName);

    return await saveGameScoresToDb(sessionId, newGameTitle || oldGameName, newScoreUpdates);
  } catch (err) {
    console.warn("Update game score error:", err);
    return null;
  }
};

export const archiveCurrentSession = async (currentSessionId) => {
  try {
    // Archive all active sessions in Supabase
    await supabase
      .from('tournament_sessions')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('status', 'active');

    const sessionCount = await getArchivedSessionCount();
    const newName = `Session ${sessionCount + 1} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    
    const { data: newSession } = await supabase
      .from('tournament_sessions')
      .insert([{ name: newName, status: 'active' }])
      .select()
      .single();

    return newSession;
  } catch (err) {
    console.warn("Archive session error:", err);
    return null;
  }
};

const getArchivedSessionCount = async () => {
  try {
    const { count } = await supabase
      .from('tournament_sessions')
      .select('*', { count: 'exact', head: true });
    return count || 1;
  } catch {
    return 1;
  }
};

export const exportAllDataToExcel = async () => {
  try {
    // 1. Fetch active session
    const activeSession = await getOrCreateActiveSession();
    const activeSessionId = activeSession?.id;

    // 2. Fetch active participants & active game scores
    const activeParticipants = activeSessionId ? await fetchParticipantsForSession(activeSessionId) : [];
    const activeGameScores = activeSessionId ? await fetchGameScoresForSession(activeSessionId) : [];

    // Calculate active team scores
    const activeScoresMap = {};
    activeGameScores.forEach(gs => {
      activeScoresMap[gs.team_id] = (activeScoresMap[gs.team_id] || 0) + gs.points_awarded;
    });

    const sheet1Rows = activeParticipants.map(p => ({
      "Session Name": activeSession?.name || "Active Session",
      "Employee Name": p.name,
      "Gender": p.gender,
      "Assigned Team": p.team_name,
      "Current Team Score": (activeScoresMap[p.team_id] || 0) + " pts",
      "Joined Date": new Date(p.created_at).toLocaleString()
    }));

    // 3. Fetch Game Scores Breakdown
    const sheet2Rows = activeGameScores.map(gs => ({
      "Session Name": activeSession?.name || "Active Session",
      "Game Name": gs.game_name,
      "Team Name": gs.team_name,
      "Finishing Rank": gs.rank + (gs.rank === 1 ? 'st' : gs.rank === 2 ? 'nd' : gs.rank === 3 ? 'rd' : 'th') + ' Place',
      "Points Awarded": gs.points_awarded + " pts",
      "Recorded Date": new Date(gs.created_at).toLocaleString()
    }));

    // 4. Fetch Historical Archives
    const { data: allSessions } = await supabase.from('tournament_sessions').select('*').order('created_at', { ascending: false });
    const { data: allParticipants } = await supabase.from('session_participants').select('*, tournament_sessions(name)').order('created_at', { ascending: false });
    const { data: allScores } = await supabase.from('session_game_scores').select('*, tournament_sessions(name)').order('created_at', { ascending: false });

    const sheet3Rows = (allParticipants || []).map(p => ({
      "Session Name": p.tournament_sessions?.name || "N/A",
      "Employee Name": p.name,
      "Gender": p.gender,
      "Team Name": p.team_name,
      "Date": new Date(p.created_at).toLocaleString()
    }));

    const workbook = XLSX.utils.book_new();

    // Append Sheet 1: Active Participants
    const ws1 = XLSX.utils.json_to_sheet(sheet1Rows.length > 0 ? sheet1Rows : [{ "Status": "No active participants yet" }]);
    XLSX.utils.book_append_sheet(workbook, ws1, "Active Roster & Standings");

    // Append Sheet 2: Game Scores Breakdown
    const ws2 = XLSX.utils.json_to_sheet(sheet2Rows.length > 0 ? sheet2Rows : [{ "Status": "No game rounds recorded yet" }]);
    XLSX.utils.book_append_sheet(workbook, ws2, "Game Scores History");

    // Append Sheet 3: Complete Sessions Archive
    const ws3 = XLSX.utils.json_to_sheet(sheet3Rows.length > 0 ? sheet3Rows : [{ "Status": "No archived sessions yet" }]);
    XLSX.utils.book_append_sheet(workbook, ws3, "Sessions Archive");

    const fileName = `Hejaz_Patriot_Tournament_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  } catch (err) {
    console.error("Export all data error:", err);
    throw err;
  }
};
