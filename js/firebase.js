import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

function resolveFirebaseConfig() {
  const env = (import.meta.env) || {};
  const envConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
  };

  const hasEnvConfig = Object.values(envConfig).every(Boolean);
  if (hasEnvConfig) {
    return envConfig;
  }

  let moduleConfig;
  try {
    if (typeof import.meta.glob === 'function') {
      const modules = import.meta.glob('./firebase.config.js', { eager: true });
      const mod = modules['./firebase.config.js'];
      if (mod) {
        moduleConfig = mod.firebaseConfig || mod.default;
      }
    }
  } catch (error) {
    console.warn('Optional firebase.config.js lookup failed:', error);
  }

  if (!moduleConfig && typeof globalThis !== 'undefined') {
    moduleConfig = globalThis.__FIREBASE_CONFIG__;
  }

  if (!moduleConfig || !moduleConfig.apiKey) {
    throw new Error('Firebase configuration is missing. Provide .env values or js/firebase.config.js');
  }

  return moduleConfig;
}

const firebaseConfig = resolveFirebaseConfig();

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence for Firestore
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('Browser does not support offline persistence');
    }
  });
} catch (err) {
  console.warn('Persistence setup failed:', err);
}

// Auth helper functions
export const signInWithEmail = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signUpWithEmail = (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const signOut = () => {
  return firebaseSignOut(auth);
};

// Auth state observer
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = () => auth.currentUser;

// Check if user is authenticated
export const isAuthenticated = () => !!auth.currentUser;
