import {
  auth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  linkWithPopup,
  updateProfile,
} from './firebase.js';

export function getCurrentUser() {
  return auth.currentUser;
}

(async function () {
  await signInAnonymously(auth);

  const user = await getCurrentUser();

  // updateProfile(user, { displayName: 'kekero', photoURL: '🍆' });

  console.log('🔥signed anon', user);
})();
