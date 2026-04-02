import { onValueCreated } from 'firebase-functions/v2/database';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

initializeApp();

const INACTIVE_THRESHOLD_MS = 30 * 60_000; // 30 minutes
const ROOM_COUNT_THRESHOLD = 20;

// Triggers every time a new room is created.
// If total room count exceeds threshold — removes inactive rooms.
export const cleanupOnRoomCreated = onValueCreated(
  { ref: '/rooms/{roomCode}', region: 'europe-west1' },
  async (event) => {
    const db = getDatabase();
    const roomsRef = db.ref('rooms');

    const snapshot = await roomsRef.once('value');
    if (!snapshot.exists()) return;

    const roomCount = snapshot.numChildren();
    if (roomCount <= ROOM_COUNT_THRESHOLD) {
      console.log(`🧹 ${roomCount} rooms — below threshold, skipping cleanup`);
      return;
    }

    const now = Date.now();
    const deletions = [];

    snapshot.forEach((roomSnap) => {
      const data = roomSnap.val();
      const lastActive = data.lastActive || 0;

      if (now - lastActive > INACTIVE_THRESHOLD_MS) {
        deletions.push(roomSnap.key);
      }
    });

    if (deletions.length === 0) {
      console.log(`🧹 ${roomCount} rooms but none are inactive`);
      return;
    }

    const updates = {};
    for (const roomCode of deletions) {
      updates[`rooms/${roomCode}`] = null;
    }

    await db.ref().update(updates);
    console.log(
      `🧹 Cleaned up ${deletions.length} inactive rooms (${roomCount - deletions.length} remaining)`,
    );
  },
);
