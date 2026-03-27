// ===== Multiplayer Module =====
// Manages room creation, joining, lobby, and real-time game sync via Firebase Realtime Database.

import { auth } from './firebase.js';
import {
  rtdb,
  rtdbRef,
  rtdbSet,
  rtdbGet,
  rtdbUpdate,
  rtdbOnValue,
  rtdbOnDisconnect,
  rtdbRemove,
  rtdbPush,
  rtdbRunTransaction,
} from './firebase-rtdb.js';
import { buildDeck, shuffle, findCommonSymbol } from './deck.js';
import { Profile } from './profile.js';

// ===== Constants =====
const ROOM_CODE_LENGTH = 5;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
const DISCONNECT_TIMEOUT_MS = 30_000;
const MAX_PLAYERS_DEFAULT = 2;
const TOTAL_CARDS_MULTIPLAYER = 20;

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
    const roomRef = rtdbRef(rtdb, `rooms/${roomCode}`);

    // Check if room code already exists
    const snapshot = await rtdbGet(roomRef);
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

    await rtdbSet(roomRef, roomData);

    // If autoMatchmaking, also register in matchmaking index
    if (settings.autoMatchmaking) {
      const matchRef = rtdbRef(rtdb, `matchmaking/${roomCode}`);
      await rtdbSet(matchRef, {
        maxPlayers: roomData.maxPlayers,
        currentPlayers: 1,
        createdAt: Date.now(),
      });
    }

    this.roomCode = roomCode;
    this.roomRef = roomRef;
    this.isHost = true;

    this.setupDisconnectHandlers(uid);
    this.listenToRoom();

    console.log('🎮 Room created:', roomCode);
    return roomCode;
  },

  // ===== Join Room =====
  async joinRoom(roomCode) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    roomCode = roomCode.toUpperCase().trim();
    const roomRef = rtdbRef(rtdb, `rooms/${roomCode}`);
    const snapshot = await rtdbGet(roomRef);

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

    const playerRef = rtdbRef(rtdb, `rooms/${roomCode}/players/${uid}`);
    await rtdbSet(playerRef, {
      displayName,
      ready: false,
      score: 0,
      cardsWon: 0,
      connected: true,
      joinedAt: Date.now(),
    });

    // Update matchmaking count
    if (roomData.autoMatchmaking) {
      const matchRef = rtdbRef(rtdb, `matchmaking/${roomCode}/currentPlayers`);
      await rtdbSet(matchRef, playerCount + 1);
    }

    this.roomCode = roomCode;
    this.roomRef = roomRef;
    this.isHost = false;

    this.setupDisconnectHandlers(uid);
    this.listenToRoom();

    console.log('🎮 Joined room:', roomCode);
    return roomCode;
  },

  // ===== Find Room (Auto-matchmaking) =====
  async findRoom() {
    const matchRef = rtdbRef(rtdb, 'matchmaking');
    const snapshot = await rtdbGet(matchRef);

    if (!snapshot.exists()) return null;

    const rooms = snapshot.val();
    for (const [code, data] of Object.entries(rooms)) {
      if (data.currentPlayers < data.maxPlayers) {
        try {
          return await this.joinRoom(code);
        } catch {
          // Room may have filled up, try next
          continue;
        }
      }
    }

    return null;
  },

  // ===== Toggle Ready =====
  async toggleReady() {
    const uid = auth.currentUser?.uid;
    if (!uid || !this.roomCode) return;

    const readyRef = rtdbRef(
      rtdb,
      `rooms/${this.roomCode}/players/${uid}/ready`,
    );
    const snapshot = await rtdbGet(readyRef);
    const currentReady = snapshot.val();
    await rtdbSet(readyRef, !currentReady);
  },

  // ===== Start Game (Host Only) =====
  async startGame(symbols) {
    if (!this.isHost || !this.roomCode) return;

    const roomSnapshot = await rtdbGet(this.roomRef);
    const roomData = roomSnapshot.val();
    const playerUids = Object.keys(roomData.players || {});

    // Check all players ready
    const allReady = playerUids.every((uid) => roomData.players[uid].ready);
    if (!allReady) {
      throw new Error('NOT_ALL_READY');
    }

    // Generate and shuffle deck
    const { deck } = buildDeck(symbols);
    const shuffledDeck = shuffle(deck);

    // Take cards: first = central, rest = shared draw pile
    const totalCardsNeeded = 1 + TOTAL_CARDS_MULTIPLAYER;
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

    await rtdbUpdate(this.roomRef, {
      status: 'playing',
      game: gameState,
      ...playerUpdates,
    });

    // Remove from matchmaking
    if (roomData.autoMatchmaking) {
      const matchRef = rtdbRef(rtdb, `matchmaking/${this.roomCode}`);
      await rtdbRemove(matchRef);
    }

    console.log('🎮 Game started! Rounds:', remainingCards.length);
  },

  // ===== Claim Round (Player taps correct symbol) =====
  async claimRound(symbol) {
    const uid = auth.currentUser?.uid;
    if (!uid || !this.roomCode) return false;

    const roomSnapshot = await rtdbGet(this.roomRef);
    const roomData = roomSnapshot.val();

    if (roomData.status !== 'playing') return false;

    const game = roomData.game;
    const currentRound = game.currentRound;

    // Check if this round already claimed
    const roundRef = rtdbRef(
      rtdb,
      `rooms/${this.roomCode}/rounds/${currentRound}`,
    );
    const roundSnapshot = await rtdbGet(roundRef);
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
      await rtdbSet(roundRef, {
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

    await rtdbUpdate(this.roomRef, updates);

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

    const wrongRef = rtdbRef(rtdb, `rooms/${this.roomCode}/wrongTaps/${uid}`);
    await rtdbSet(wrongRef, Date.now());
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

    const connectedRef = rtdbRef(
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
      const playerRef = rtdbRef(rtdb, `rooms/${this.roomCode}/players/${uid}`);
      await rtdbRemove(playerRef);

      // If host leaves and room is waiting, delete the room
      if (this.isHost) {
        const snapshot = await rtdbGet(this.roomRef);
        const data = snapshot.val();
        if (data && data.status === 'waiting') {
          await rtdbRemove(this.roomRef);
          // Also clean matchmaking
          const matchRef = rtdbRef(rtdb, `matchmaking/${this.roomCode}`);
          await rtdbRemove(matchRef);
        }
      }
    } catch (err) {
      console.log('🎮 Error leaving room:', err);
    }

    this.cleanup();
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
    const snapshot = await rtdbGet(this.roomRef);
    return snapshot.val();
  },
};
