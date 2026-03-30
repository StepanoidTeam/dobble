// ===== Multiplayer Module =====
// Manages room creation, joining, lobby, and real-time game sync via Firebase Realtime Database.

import { auth } from './firebase.js';
import {
  rtdb,
  ref,
  set,
  get,
  update,
  rtdbOnValue,
  rtdbOnDisconnect,
  remove,
  push,
  runTransaction,
  query,
  orderByChild,
  equalTo,
} from './firebase-rtdb.js';
import { buildDeck, findCommonSymbol } from './deck.js';
import { Random } from './seeded-random.js';
import { Profile } from './profile.js';

// ===== Constants =====
const ROOM_CODE_LENGTH = 5;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
const DISCONNECT_TIMEOUT_MS = 30_000;
const MAX_PLAYERS_DEFAULT = 2;
const CARDS_PER_PLAYER = 10;
const HEARTBEAT_INTERVAL_MS = 30_000;
const STALE_THRESHOLD_MS = 90_000;

// ===== Multiplayer Manager =====
export const Multiplayer = {
  roomCode: null,
  roomRef: null,
  isHost: false,
  listeners: [],
  disconnectRefs: [],
  onRoomUpdate: null, // callback(roomData)
  onGameUpdate: null, // callback(gameData)
  onRoundResult: null, // callback(roundData)
  onPlayerLeft: null, // callback(uid)
  disconnectTimers: {},
  heartbeatInterval: null,

  // ===== Room Code Generation =====
  generateRoomCode() {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code +=
        ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return code;
  },

  // ===== Create Room =====
  async createRoom(settings = {}) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    const roomCode = this.generateRoomCode();
    const roomRef = ref(rtdb, `rooms/${roomCode}`);

    // Check if room code already exists
    const snapshot = await get(roomRef);
    if (snapshot.exists()) {
      // Extremely unlikely collision — retry once
      return this.createRoom(settings);
    }

    const displayName = Profile.displayName;

    const roomData = {
      hostUid: uid,
      status: 'waiting',
      maxPlayers: settings.maxPlayers || MAX_PLAYERS_DEFAULT,
      autoMatchmaking: settings.autoMatchmaking || false,
      createdAt: Date.now(),
      lastActive: Date.now(),
      settings: {
        emojiSet: settings.emojiSet || 'base',
      },
      players: {
        [uid]: {
          displayName,
          ready: true,
          score: 0,
          cardsWon: 0,
          connected: true,
          joinedAt: Date.now(),
        },
      },
    };

    await set(roomRef, roomData);

    this.roomCode = roomCode;
    this.roomRef = roomRef;
    this.isHost = true;

    this.setupDisconnectHandlers(uid);
    this.listenToRoom();
    this.startHeartbeat();

    console.log('🎮 Room created:', roomCode);
    return roomCode;
  },

  // ===== Join Room =====
  async joinRoom(roomCode) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    roomCode = roomCode.toUpperCase().trim();
    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
      throw new Error('ROOM_NOT_FOUND');
    }

    const roomData = snapshot.val();

    if (roomData.status !== 'waiting') {
      throw new Error('GAME_ALREADY_STARTED');
    }

    const playerCount = roomData.players
      ? Object.keys(roomData.players).length
      : 0;
    if (playerCount >= roomData.maxPlayers) {
      throw new Error('ROOM_FULL');
    }

    // Already in room?
    if (roomData.players?.[uid]) {
      this.roomCode = roomCode;
      this.roomRef = roomRef;
      this.isHost = roomData.hostUid === uid;
      this.setupDisconnectHandlers(uid);
      this.listenToRoom();
      return roomCode;
    }

    const displayName = Profile.displayName;

    const playerRef = ref(rtdb, `rooms/${roomCode}/players/${uid}`);
    await set(playerRef, {
      displayName,
      ready: false,
      score: 0,
      cardsWon: 0,
      connected: true,
      joinedAt: Date.now(),
    });

    this.roomCode = roomCode;
    this.roomRef = roomRef;
    this.isHost = false;

    this.setupDisconnectHandlers(uid);
    this.listenToRoom();
    this.startHeartbeat();

    console.log('🎮 Joined room:', roomCode);
    return roomCode;
  },

  // ===== Find Room =====
  async findRoom() {
    const roomsRef = ref(rtdb, 'rooms');
    const q = query(roomsRef, orderByChild('status'), equalTo('waiting'));
    const snapshot = await get(q);

    if (!snapshot.exists()) return null;

    const rooms = snapshot.val();
    const now = Date.now();
    for (const [code, data] of Object.entries(rooms)) {
      // delete old rooms at first
      if (!data.lastActive || now - data.lastActive > STALE_THRESHOLD_MS) {
        // Stale room — clean up silently
        remove(ref(rtdb, `rooms/${code}`));
        continue;
      }

      //skip closed
      if (!data.autoMatchmaking) continue;

      const playerCount = data.players ? Object.keys(data.players).length : 0;
      if (playerCount < data.maxPlayers) {
        try {
          return await this.joinRoom(code);
        } catch {
          continue;
        }
      }
    }

    return null;
  },

  // ===== Room Stats =====
  async getRoomStats() {
    const roomsRef = ref(rtdb, 'rooms');
    const q = query(roomsRef, orderByChild('status'), equalTo('waiting'));
    const snapshot = await get(q);

    if (!snapshot.exists()) return { total: 0, available: 0 };

    const rooms = snapshot.val();
    let total = 0;
    let available = 0;
    const now = Date.now();

    for (const data of Object.values(rooms)) {
      if (data.lastActive && now - data.lastActive > STALE_THRESHOLD_MS)
        continue;
      total++;
      if (!data.autoMatchmaking) continue;
      const playerCount = data.players ? Object.keys(data.players).length : 0;
      if (playerCount < data.maxPlayers) available++;
    }

    return { total, available };
  },

  // ===== Heartbeat =====
  startHeartbeat() {
    this.stopHeartbeat();
    const ping = () => {
      if (!this.roomCode) return;
      const lastActiveRef = ref(rtdb, `rooms/${this.roomCode}/lastActive`);
      set(lastActiveRef, Date.now());
    };
    ping();
    this.heartbeatInterval = setInterval(ping, HEARTBEAT_INTERVAL_MS);
  },

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  },

  // ===== Toggle Ready =====
  async toggleReady() {
    const uid = auth.currentUser?.uid;
    if (!uid || !this.roomCode) return;

    const readyRef = ref(rtdb, `rooms/${this.roomCode}/players/${uid}/ready`);
    const snapshot = await get(readyRef);
    const currentReady = snapshot.val();
    await set(readyRef, !currentReady);
  },

  // ===== Start Game (Host Only) =====
  async startGame(symbols) {
    if (!this.isHost || !this.roomCode) return;

    const roomSnapshot = await get(this.roomRef);
    const roomData = roomSnapshot.val();
    const playerUids = Object.keys(roomData.players || {});

    // Check all players ready
    const allReady = playerUids.every((uid) => roomData.players[uid].ready);
    if (!allReady) {
      throw new Error('NOT_ALL_READY');
    }

    // Generate and shuffle deck
    const { deck } = buildDeck(symbols);
    const shuffledDeck = Random.shuffle(deck);

    // Take cards: first = central, rest = shared draw pile
    const totalCardsNeeded = 1 + CARDS_PER_PLAYER * playerUids.length;
    const cardsToUse = shuffledDeck.slice(
      0,
      Math.min(totalCardsNeeded, shuffledDeck.length),
    );

    const centralCard = cardsToUse[0];
    const drawPile = cardsToUse.slice(1);

    // Each player gets their own card from the draw pile
    const playerCardIndices = {};
    const playerCards = {};
    playerUids.forEach((uid, i) => {
      playerCards[uid] = drawPile[i];
      playerCardIndices[uid] = i;
    });

    // Build the game state — shared draw pile model
    const gameState = {
      centralCard,
      drawPile,
      nextDrawIndex: playerUids.length, // next card to deal from pile
      playerCards, // current card per player
      playerCardIndices, // which index each player drew from
      totalRounds: drawPile.length,
      currentRound: 0,
      startedAt: Date.now(),
    };

    // Reset player scores
    const playerUpdates = {};
    playerUids.forEach((uid) => {
      playerUpdates[`players/${uid}/score`] = 0;
      playerUpdates[`players/${uid}/cardsWon`] = 0;
    });

    await update(this.roomRef, {
      status: 'playing',
      game: gameState,
      ...playerUpdates,
    });

    console.log('🎮 Game started! Rounds:', remainingCards.length);
  },

  // ===== Claim Round (Player taps correct symbol) =====
  async claimRound(symbol) {
    const uid = auth.currentUser?.uid;
    if (!uid || !this.roomCode) return false;

    const roomSnapshot = await get(this.roomRef);
    const roomData = roomSnapshot.val();

    if (roomData.status !== 'playing') return false;

    const game = roomData.game;
    const currentRound = game.currentRound;

    // Check if this round already claimed
    const roundRef = ref(rtdb, `rooms/${this.roomCode}/rounds/${currentRound}`);
    const roundSnapshot = await get(roundRef);
    if (roundSnapshot.exists()) {
      console.log('🎮 Round already claimed');
      return false;
    }

    // Verify the symbol is actually common between player's card and central card
    const centralCard = game.centralCard;
    const playerCard = game.playerCards?.[uid];

    if (!playerCard) return false;

    const commonSymbol = findCommonSymbol(centralCard, playerCard);

    if (commonSymbol !== symbol) {
      console.log('🎮 Wrong symbol!', symbol, 'expected', commonSymbol);
      return false;
    }

    // Try to claim — first write wins via DB rules
    try {
      await set(roundRef, {
        winnerId: uid,
        symbol,
        timestamp: Date.now(),
      });
    } catch {
      // Someone else claimed first
      console.log('🎮 Claim rejected — someone was faster');
      return false;
    }

    // Winner takes the central card (score), gets it as their new card
    // A new card from the draw pile becomes the new central card
    const nextDrawIndex = game.nextDrawIndex || 0;
    const nextCentralCard = game.drawPile?.[nextDrawIndex] ?? null;

    const updates = {
      [`game/playerCards/${uid}`]: centralCard,
      ['game/currentRound']: currentRound + 1,
      [`players/${uid}/score`]: (roomData.players[uid]?.score || 0) + 1,
      [`players/${uid}/cardsWon`]: (roomData.players[uid]?.cardsWon || 0) + 1,
    };

    if (nextCentralCard) {
      updates['game/centralCard'] = nextCentralCard;
      updates['game/nextDrawIndex'] = nextDrawIndex + 1;
    }

    // Game ends when draw pile is empty (no new central card)
    if (!nextCentralCard) {
      updates['status'] = 'finished';
    }

    await update(this.roomRef, updates);

    console.log('🎮 Round claimed by', uid, 'symbol:', symbol);
    return true;
  },

  // ===== Get Current Cards =====
  getCurrentCards(roomData) {
    const uid = auth.currentUser?.uid;
    if (!roomData?.game || !uid) return null;

    const game = roomData.game;
    const centralCard = game.centralCard;
    const playerCard = game.playerCards?.[uid] ?? null;

    if (!centralCard) return null;

    return {
      centralCard,
      playerCard,
      isPlayerDone: playerCard === null,
      currentRound: game.currentRound,
      totalRounds: game.totalRounds,
    };
  },

  // ===== Report Wrong Tap =====
  async reportWrongTap() {
    const uid = auth.currentUser?.uid;
    if (!uid || !this.roomCode) return;

    const wrongRef = ref(rtdb, `rooms/${this.roomCode}/wrongTaps/${uid}`);
    await set(wrongRef, Date.now());
  },

  // ===== Listen to Room =====
  listenToRoom() {
    if (!this.roomRef) return;

    const unsub = rtdbOnValue(this.roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        // Room deleted
        this.cleanup();
        return;
      }

      // Check for disconnected players
      this.checkDisconnectedPlayers(data);

      if (this.onRoomUpdate) this.onRoomUpdate(data);
    });

    this.listeners.push(unsub);
  },

  // ===== Disconnect Handling =====
  setupDisconnectHandlers(uid) {
    if (!this.roomCode) return;

    const connectedRef = ref(
      rtdb,
      `rooms/${this.roomCode}/players/${uid}/connected`,
    );
    const onDisc = rtdbOnDisconnect(connectedRef);
    onDisc.set(false);
    this.disconnectRefs.push(onDisc);
  },

  checkDisconnectedPlayers(roomData) {
    if (!roomData.players) return;

    const uid = auth.currentUser?.uid;

    Object.entries(roomData.players).forEach(([playerUid, playerData]) => {
      if (playerUid === uid) return; // Don't check self

      if (!playerData.connected && !this.disconnectTimers[playerUid]) {
        console.log('🎮 Player disconnected:', playerUid);
        this.disconnectTimers[playerUid] = setTimeout(() => {
          console.log('🎮 Player timed out:', playerUid);
          if (this.onPlayerLeft) this.onPlayerLeft(playerUid);
          delete this.disconnectTimers[playerUid];
        }, DISCONNECT_TIMEOUT_MS);
      } else if (playerData.connected && this.disconnectTimers[playerUid]) {
        // Player reconnected
        console.log('🎮 Player reconnected:', playerUid);
        clearTimeout(this.disconnectTimers[playerUid]);
        delete this.disconnectTimers[playerUid];
      }
    });
  },

  // ===== Leave Room =====
  async leaveRoom() {
    const uid = auth.currentUser?.uid;
    if (!uid || !this.roomCode) return;

    try {
      const playerRef = ref(rtdb, `rooms/${this.roomCode}/players/${uid}`);
      await remove(playerRef);

      // If host leaves and room is waiting, delete the room
      if (this.isHost) {
        const snapshot = await get(this.roomRef);
        const data = snapshot.val();
        if (data && data.status === 'waiting') {
          await remove(this.roomRef);
        }
      }

      // Auto-finish if only one player remains during an active game
      await this.autoFinishIfAlone();
    } catch (err) {
      console.log('🎮 Error leaving room:', err);
    }

    this.cleanup();
  },

  // Auto-finish game when only one player is left
  async autoFinishIfAlone() {
    if (!this.roomRef) return;
    try {
      const snapshot = await get(this.roomRef);
      const data = snapshot.val();
      if (!data || data.status !== 'playing') return;

      const remainingPlayers = Object.keys(data.players || {});
      if (remainingPlayers.length <= 1) {
        console.log('🎮 Only one player left — auto-finishing game');
        await update(this.roomRef, { status: 'finished' });
      }
    } catch {
      /* room may already be deleted */
    }
  },

  // ===== Cleanup =====
  cleanup() {
    this.listeners.forEach((unsub) => unsub());
    this.listeners = [];

    this.disconnectRefs.forEach((ref) => {
      try {
        ref.cancel();
      } catch {
        /* ignore */
      }
    });
    this.disconnectRefs = [];

    Object.values(this.disconnectTimers).forEach(clearTimeout);
    this.disconnectTimers = {};

    this.stopHeartbeat();

    this.roomCode = null;
    this.roomRef = null;
    this.isHost = false;
    this.onRoomUpdate = null;
    this.onGameUpdate = null;
    this.onRoundResult = null;
    this.onPlayerLeft = null;
  },

  // ===== Get Room Status =====
  async getRoomData() {
    if (!this.roomRef) return null;
    const snapshot = await get(this.roomRef);
    return snapshot.val();
  },
};
