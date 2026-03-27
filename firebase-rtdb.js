// ===== Firebase Realtime Database Module =====

import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  push,
  onValue,
  onDisconnect,
  runTransaction,
  off,
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js';

import {
  initializeApp,
  getApp,
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';

let rtdb;

try {
  const app = getApp();
  rtdb = getDatabase(app);
} catch (err) {
  console.log('🔥 Realtime DB init error:', err);
}

// Wrap onValue to return an unsubscribe function
function rtdbOnValue(refObj, callback) {
  onValue(refObj, callback);
  return () => off(refObj, 'value', callback);
}

// Wrap onDisconnect to return the reference
function rtdbOnDisconnect(refObj) {
  return onDisconnect(refObj);
}

export {
  rtdb,
  ref as rtdbRef,
  set as rtdbSet,
  get as rtdbGet,
  update as rtdbUpdate,
  remove as rtdbRemove,
  push as rtdbPush,
  onValue as rtdbOnValueRaw,
  rtdbOnValue,
  rtdbOnDisconnect,
  runTransaction as rtdbRunTransaction,
};
