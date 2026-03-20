import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  linkWithPopup,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';

import { firebaseConfig } from './firebase.config.js';

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  linkWithPopup,
  updateProfile,
};
