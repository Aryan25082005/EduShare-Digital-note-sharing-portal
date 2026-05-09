// Firebase Configuration - EduShare

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  deleteDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


// ✅ YOUR REAL FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBKqtVdqrvif1373rrlxyMfBFwCXe-8_rI",
  authDomain: "edushare-6564c.firebaseapp.com",
  projectId: "edushare-6564c",
  storageBucket: "edushare-6564c.firebasestorage.app",
  messagingSenderId: "510352849012",
  appId: "1:510352849012:web:d2d02a37e1b44cb2b5b921",
  measurementId: "G-RYJYTYZE8Y"
};


// 🔥 Initialize Firebase
const app = initializeApp(firebaseConfig);


// 🔥 Services
const auth = getAuth(app);
const db   = getFirestore(app);
const storage = getStorage(app);


// 🔥 Export everything
export {
  auth,
  db,
  storage,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  ref,
  uploadBytesResumable,
  getDownloadURL
};