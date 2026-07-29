import { supabase } from '../supabaseClient';

export const getOrCreateActiveTournament = async () => {
  try {
    const { data: activeTournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn("Supabase query info (tournaments table may need creation):", error.message);
      return null;
    }

    if (activeTournaments && activeTournaments.length > 0) {
      return activeTournaments[0];
    }

    // Create default active tournament
    const newName = `Tournament ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const { data: created, error: createErr } = await supabase
      .from('tournaments')
      .insert([{ name: newName, status: 'active' }])
      .select()
      .single();

    if (createErr) {
      console.warn("Could not auto-create active tournament row:", createErr.message);
      return null;
    }

    return created;
  } catch (err) {
    console.warn("Supabase DB not accessible, falling back to local state:", err);
    return null;
  }
};

export const fetchParticipantsForTournament = async (tournamentId) => {
  if (!tournamentId) return [];
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn("Error fetching participants:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("Fetch participants error:", err);
    return [];
  }
};

export const saveParticipantToDb = async (tournamentId, member) => {
  if (!tournamentId) return null;
  try {
    const { data, error } = await supabase
      .from('participants')
      .insert([{
        tournament_id: tournamentId,
        name: member.name,
        gender: member.gender,
        team_id: member.teamId,
        team_name: `Team ${member.teamId}`,
        client_id: member.clientId
      }])
      .select()
      .single();

    if (error) {
      console.warn("Failed to save participant to DB (check if SQL tables exist):", error.message);
    }
    return data;
  } catch (err) {
    console.warn("Save participant error:", err);
    return null;
  }
};

export const archiveCurrentTournamentSession = async (currentTournamentId) => {
  try {
    if (currentTournamentId) {
      // Archive current
      await supabase
        .from('tournaments')
        .update({ status: 'archived' })
        .eq('id', currentTournamentId);
    }

    // Create fresh active session
    const newName = `Tournament ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    const { data: newTournament } = await supabase
      .from('tournaments')
      .insert([{ name: newName, status: 'active' }])
      .select()
      .single();

    return newTournament;
  } catch (err) {
    console.warn("Archive tournament session error:", err);
    return null;
  }
};

export const fetchAllParticipantsHistorical = async () => {
  try {
    const { data: participants, error } = await supabase
      .from('participants')
      .select(`
        id,
        name,
        gender,
        team_id,
        team_name,
        created_at,
        tournaments (
          name,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("Fetch historical participants error:", error.message);
      return [];
    }
    return participants || [];
  } catch (err) {
    console.warn("Fetch historical participants error:", err);
    return [];
  }
};
