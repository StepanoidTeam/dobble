// ===== Player Profile Manager =====

import {
  db,
  auth,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from './firebase/firebase.js';
import { EMOJIS_CLASSIC } from './emojis/emojis-classic.js';

const PROFILES_COLLECTION = 'profiles';
const MAX_NAME_LENGTH = 20;

export const Profile = {
  displayName: 'Anonymous',
  avatar: null,

  // ===== Init =====
  init(onReady) {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        await this.load();
        if (onReady) onReady(this.displayName, this.avatar);
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
        const data = snapshot.data();
        this.displayName = data.displayName || 'Anonymous';
        this.avatar = data.avatar || this.randomAvatar();
        // Backfill avatar for existing profiles
        if (!data.avatar) {
          await setDoc(docRef, { avatar: this.avatar }, { merge: true });
        }
        console.log('👤 profile loaded', this.displayName, this.avatar);
      } else {
        this.displayName = user.displayName || 'Anonymous';
        this.avatar = this.randomAvatar();
        await setDoc(docRef, {
          displayName: this.displayName,
          avatar: this.avatar,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('👤 profile created', this.displayName, this.avatar);
      }
    } catch (err) {
      console.error('👤 profile load failed', err);
    }
  },

  // ===== Random Avatar =====
  randomAvatar() {
    return EMOJIS_CLASSIC[Math.floor(Math.random() * EMOJIS_CLASSIC.length)];
  },

  // ===== Update Avatar =====
  async updateAvatar(emoji) {
    const user = auth.currentUser;
    if (!user) return;
    if (!emoji || emoji === this.avatar) return;

    this.avatar = emoji;

    try {
      const profileRef = doc(db, PROFILES_COLLECTION, user.uid);
      await setDoc(
        profileRef,
        { avatar: emoji, updatedAt: serverTimestamp() },
        { merge: true },
      );
      console.log('👤 avatar updated', emoji);
    } catch (err) {
      console.error('👤 avatar update failed', err);
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
