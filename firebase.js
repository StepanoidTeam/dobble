// Import the functions you need from the SDKs you need
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js';
import { firebaseConfig } from './firebase.config.js';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// todo(vmyshko): do stuff...

console.log('fbapp', app);
