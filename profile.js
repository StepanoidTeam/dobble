// ===== Player Profile Manager =====

import {
  db,
  auth,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from './firebase.js';

const PROFILES_COLLECTION = 'profiles';
const MAX_NAME_LENGTH = 20;

export const Profile = {
  displayName: 'Anonymous',

  // ===== Init =====
  init(onReady) {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        await this.load();
        if (onReady) onReady(this.displayName);
      }
    });
  },

  // ===== Load Profile =====
  async load() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, PROFILES_COLLECTION, user.uid);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        this.displayName = snapshot.data().displayName || 'Anonymous';
        console.log('👤 profile loaded', this.displayName);
      } else {
        this.displayName = user.displayName || 'Anonymous';
        await setDoc(docRef, {
          displayName: this.displayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('👤 profile created', this.displayName);
      }
    } catch (err) {
      console.error('👤 profile load failed', err);
    }
  },

  // ===== Update Display Name =====
  async updateDisplayName(name) {
    const user = auth.currentUser;
    if (!user) return;

    const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!trimmed || trimmed === this.displayName) return;

    this.displayName = trimmed;

    try {
      // Update profile
      const profileRef = doc(db, PROFILES_COLLECTION, user.uid);
      await setDoc(
        profileRef,
        { displayName: trimmed, updatedAt: serverTimestamp() },
        { merge: true },
      );

      // Update leaderboard entry if exists
      const lbRef = doc(db, 'leaderboard', user.uid);
      const lbSnap = await getDoc(lbRef);
      if (lbSnap.exists()) {
        await setDoc(lbRef, { displayName: trimmed }, { merge: true });
      }

      console.log('👤 name updated', trimmed);
    } catch (err) {
      console.error('👤 name update failed', err);
    }
  },
};
