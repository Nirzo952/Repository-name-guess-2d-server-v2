const PlayerManager = require('./playerManager');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();
const playerRoom = new Map();

function genCode(len) {
  let s = '';
  for (let i = 0; i < (len || 5); i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
}

function sanitizeRoom(room) {
  if (!room) return null;
  return {
    code: room.code,
    name: room.name,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    roundSeconds: room.roundSeconds,
    difficulty: room.difficulty,
    state: room.state,
    players: (room.players || []).map((p) => ({
      id: p.id, name: p.name, ready: p.ready,
      isHost: p.isHost, score: p.score, connected: p.connected,
    })),
    round: room.round ? sanitizeRound(room.round) : null,
  };
}

function sanitizeRound(r) {
  if (!r) return null;
  return {
    id: r.id, questionerId: r.questionerId, responderId: r.responderId,
    phase: r.phase, questionsUsed: r.questionsUsed, maxQuestions: r.maxQuestions,
    startedAt: r.startedAt, endsAt: r.endsAt,
    history: (r.history || []).map((h) => ({
      type: h.type, text: h.text, fromId: h.fromId,
      correct: h.correct, ts: h.ts,
    })),
  };
}

const RoomManager = {
  create(hostId, hostName, hostSocketId, opts) {
    opts = opts || {};
    let code;
    do { code = genCode(5); } while (rooms.has(code));

    const room = {
      code,
      name: opts.name || ('Room-' + code),
      hostId,
      maxPlayers: Math.max(2, Math.min(8, opts.maxPlayers || 4)),
      roundSeconds: Math.max(30, Math.min(180, opts.roundSeconds || 60)),
      difficulty: opts.difficulty || 'medium',
      players: [],
      state: 'LOBBY',
      round: null,
      createdAt: Date.now(),
    };

    const player = PlayerManager.create(hostId, hostName, hostSocketId);
    player.isHost = true;
    room.players.push(player);

    rooms.set(code, room);
    playerRoom.set(hostId, code);
    return room;
  },

  get(code) {
    return rooms.get(String(code || '').toUpperCase()) || null;
  },

  join(code, playerId, name, socketId) {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) return { error: 'ROOM_NOT_FOUND' };
    if (room.players.length >= room.maxPlayers) return { error: 'ROOM_FULL' };
    if (room.state !== 'LOBBY') return { error: 'GAME_IN_PROGRESS' };
    if (PlayerManager.isNameTaken(room.players, name)) return { error: 'NAME_TAKEN' };

    const player = PlayerManager.create(playerId, name, socketId);
    room.players.push(player);
    playerRoom.set(playerId, room.code);
    return { room, player };
  },

  leave(code, playerId) {
    const room = rooms.get(code);
    if (!room) return null;

    const removed = PlayerManager.remove(room.players, playerId);
    playerRoom.delete(playerId);
    if (!removed) return null;

    if (removed.isHost && room.players.length) {
      room.players[0].isHost = true;
      room.hostId = room.players[0].id;
    }

    if (!room.players.length) {
      rooms.delete(code);
      return { room: null, removed };
    }

    if (room.state === 'PLAYING' && room.round) {
      if (room.round.questionerId === playerId || room.round.responderId === playerId) {
        room.round.phase = 'finished';
      }
    }

    return { room, removed };
  },

  kick(code, hostId, targetId) {
    const room = rooms.get(code);
    if (!room) return { error: 'ROOM_NOT_FOUND' };
    if (room.hostId !== hostId) return { error: 'NOT_HOST' };
    if (targetId === hostId) return { error: 'CANNOT_KICK_HOST' };
    const target = PlayerManager.findById(room.players, targetId);
    if (!target) return { error: 'PLAYER_NOT_FOUND' };
    PlayerManager.remove(room.players, targetId);
    playerRoom.delete(targetId);
    return { room, removed: target };
  },

  setReady(code, playerId, ready) {
    const room = rooms.get(code);
    if (!room) return null;
    const p = PlayerManager.findById(room.players, playerId);
    if (!p) return null;
    p.ready = !!ready;
    return room;
  },

  canStart(room) {
    if (!room) return { ok: false, reason: 'NO_ROOM' };
    if (room.state !== 'LOBBY') return { ok: false, reason: 'ALREADY_STARTED' };
    if (room.players.length < 2) return { ok: false, reason: 'NEED_PLAYERS' };
    if (!room.players.every((p) => p.ready)) return { ok: false, reason: 'NOT_ALL_READY' };
    return { ok: true };
  },

  getCodeOfPlayer(playerId) {
    return playerRoom.get(playerId) || null;
  },

  all() { return Array.from(rooms.values()); },
};

module.exports = { RoomManager, sanitizeRoom, sanitizeRound };
