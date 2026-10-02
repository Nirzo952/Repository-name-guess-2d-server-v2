module.exports = {
  normalizeName(name) {
    return String(name || '').trim().slice(0, 16) || 'Player';
  },
  normalizeCode(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  },
  isNameTaken(players, name) {
    const n = String(name).toLowerCase();
    return (players || []).some((p) => p.name.toLowerCase() === n);
  },
  create(playerId, name, socketId) {
    return {
      id: playerId,
      name: this.normalizeName(name),
      socketId: socketId,
      ready: false,
      isHost: false,
      score: 0,
      connected: true,
      item: null,
      joinedAt: Date.now(),
    };
  },
  findBySocket(players, socketId) {
    return (players || []).find((p) => p.socketId === socketId) || null;
  },
  findById(players, id) {
    return (players || []).find((p) => p.id === id) || null;
  },
  remove(players, id) {
    const idx = (players || []).findIndex((p) => p.id === id);
    if (idx < 0) return null;
    return players.splice(idx, 1)[0];
  },
};
