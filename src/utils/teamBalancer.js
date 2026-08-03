export const HERO_TEAM_NAMES = [
  'Pattimura',
  'Diponegoro',
  'Teuku Umar',
  'Ngurah Rai',
  'Imam Bonjol',
  'Hasanuddin',
  'Antasari',
  'R.A Kartini',
  'Bung Tomo',
  'Soedirman'
];

export const PREDEFINED_GAMES = [
  'Bola Sumpit',
  'Balap Kelereng & Makan Kerupuk',
  'Bola Corong',
  'Estafet Sarung',
  'Kaos Kaki Ajaib'
];

export const assignToTeam = (name, gender, currentTeams, clientId = null, forceTeamId = null) => {
  let teams = [...currentTeams];

  // Initialize 8 teams if empty
  if (teams.length === 0) {
    teams = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: HERO_TEAM_NAMES[i] || `Team ${i + 1}`,
      score: 0,
      members: []
    }));
  } else {
    teams = teams.map(t => ({
      ...t,
      name: HERO_TEAM_NAMES[t.id - 1] || t.name
    }));
  }

  const MAX_MEMBERS = 10;
  
  // Check if person already exists
  const existingTeam = teams.find(t => (t.members || []).some(m => {
    const memberName = m.name || m.input || '';
    return memberName.toLowerCase() === name.toLowerCase();
  }));

  if (existingTeam) {
    // If they exist, just update their clientId so their screen resolves and keep them on the same team
    const updatedTeams = teams.map(team => {
      if (team.id === existingTeam.id) {
        return {
          ...team,
          members: team.members.map(m => {
            const memberName = m.name || m.input || '';
            if (memberName.toLowerCase() === name.toLowerCase()) {
              return { ...m, clientId };
            }
            return m;
          })
        };
      }
      return team;
    });
    return { updatedTeams, assignedTeamId: existingTeam.id };
  }

  // If client already computed a team, just append them to it
  if (forceTeamId) {
    const targetTeam = teams.find(t => t.id === forceTeamId);
    if (targetTeam) {
      const updatedTeams = teams.map(team => {
        if (team.id === targetTeam.id) {
          return {
            ...team,
            members: [...team.members, { name, gender, clientId }]
          };
        }
        return team;
      });
      return { updatedTeams, assignedTeamId: targetTeam.id };
    }
  }

  // Find teams with space
  let availableTeams = teams.filter(t => t.members.length < MAX_MEMBERS);

  // If all are full, create a new team
  if (availableTeams.length === 0) {
    const newTeamId = teams.length + 1;
    const newTeam = {
      id: newTeamId,
      name: HERO_TEAM_NAMES[newTeamId - 1] || `Team ${newTeamId}`,
      score: 0,
      members: []
    };
    teams.push(newTeam);
    availableTeams = [newTeam];
  }

  // Find teams with the lowest count of the requested gender
  let minGenderCount = Infinity;
  let candidateTeams = [];

  availableTeams.forEach(team => {
    const genderCount = team.members.filter(m => m.gender === gender).length;
    if (genderCount < minGenderCount) {
      minGenderCount = genderCount;
      candidateTeams = [team];
    } else if (genderCount === minGenderCount) {
      candidateTeams.push(team);
    }
  });

  // Pick randomly from candidates to keep it unpredictable
  const selectedTeam = candidateTeams[Math.floor(Math.random() * candidateTeams.length)];

  // Update the team
  const updatedTeams = teams.map(team => {
    if (team.id === selectedTeam.id) {
      return {
        ...team,
        members: [...team.members, { name, gender, clientId }]
      };
    }
    return team;
  });

  return { updatedTeams, assignedTeamId: selectedTeam.id };
};
