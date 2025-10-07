// Firebase configuration template.
// Copy this file to js/firebase.config.js and fill in your Firebase project details.
// These values are available from Firebase Console > Project Settings.

export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// Expose config globally so the app can pick it up without a bundler.
if (typeof globalThis !== 'undefined') {
  globalThis.__FIREBASE_CONFIG__ = firebaseConfig;
}
