// src/firebase/init.js
/**
 * PayPilot AI — Firebase initialization
 *
 * Configuration is loaded from Vite environment variables (.env file).
 * This module exports auth, db, and all convenience wrappers.
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  deleteUser,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  collection, doc, setDoc, getDoc, getDocs,
  query, where, onSnapshot, deleteDoc,
} from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Config from .env (VITE_ prefix required by Vite)
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Auth helpers ────────────────────────────────────────────

/** Email + password sign-in */
export function firebaseSignIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/** Email + password sign-up */
export function firebaseSignUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

/** Google OAuth popup sign-in */
export function firebaseGoogleSignIn() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

/** Send password-reset email */
export function firebaseSendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

/** Delete the currently signed-in user */
export function firebaseDeleteUser() {
  if (!auth.currentUser) throw new Error('No user signed in');
  return deleteUser(auth.currentUser);
}

/** Update the user's display name */
export function firebaseUpdateProfile(displayName) {
  if (!auth.currentUser) return Promise.resolve();
  return updateProfile(auth.currentUser, { displayName });
}

/** Sign-out */
export function firebaseSignOut() {
  return signOut(auth);
}

/** Listen for auth-state changes */
export function firebaseOnAuthStateChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

// Re-export Firestore helpers
export {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, onSnapshot, deleteDoc,
};
