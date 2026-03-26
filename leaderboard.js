// ===== Leaderboard Manager =====

import {
  db,
  auth,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from './firebase.js';

const LEADERBOARD_COLLECTION = 'leaderboard';
const LEADERBOARD_LIMIT = 50;

export const Leaderboard = {
  // ===== Submit Score =====
  async submitScore({ score, timeMs, bestStreak, timePerCardMs, cardsPlayed }) {
    const user = auth.currentUser;
    if (!user) {
      console.log('🏆 no user, skip leaderboard submit');
      return;
    }

    try {
      const docRef = doc(db, LEADERBOARD_COLLECTION, user.uid);

      // Only overwrite if new score is higher
      const existing = await getDoc(docRef);
      if (existing.exists() && existing.data().score >= score) {
        console.log('🏆 existing score is higher, skip');
        return;
      }

      const entry = {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        score,
        timeMs,
        bestStreak,
        timePerCardMs,
        cardsPlayed,
        updatedAt: serverTimestamp(),
      };

      await setDoc(docRef, entry);
      console.log('🏆 score submitted', entry);
    } catch (err) {
      console.error('🏆 submit failed', err);
    }
  },

  // ===== Fetch Top Scores =====
  async fetchTopScores() {
    try {
      const q = query(
        collection(db, LEADERBOARD_COLLECTION),
        orderBy('score', 'desc'),
        limit(LEADERBOARD_LIMIT),
      );
      const snapshot = await getDocs(q);
      const entries = [];
      snapshot.forEach((docSnap) => {
        entries.push({ id: docSnap.id, ...docSnap.data() });
      });
      return entries;
    } catch (err) {
      console.error('🏆 fetch failed', err);
      return [];
    }
  },

  // ===== Render Leaderboard =====
  async render() {
    if (!$leaderboardList) return;

    $leaderboardLoading.hidden = false;
    $leaderboardEmpty.hidden = true;
    $leaderboardList.innerHTML = '';

    const entries = await this.fetchTopScores();

    $leaderboardLoading.hidden = true;

    if (entries.length === 0) {
      $leaderboardEmpty.hidden = false;
      return;
    }

    const currentUid = auth.currentUser?.uid;

    entries.forEach((entry, index) => {
      const $row = document.createElement('div');
      $row.classList.add('lb-row');
      if (entry.uid === currentUid) {
        $row.classList.add('lb-row--me');
      }

      const rank = index + 1;
      const medal =
        rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
      const timePerCard = Math.round(entry.timePerCardMs / 1000);

      $row.innerHTML = `
        <span class="lb-rank">${medal || rank}</span>
        <span class="lb-name">${this.escapeHtml(entry.displayName)}</span>
        <span class="lb-score">${entry.score}</span>
        <span class="lb-meta">${timePerCard}s · 🔥${entry.bestStreak || 0}</span>
      `;

      $leaderboardList.appendChild($row);
    });
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
