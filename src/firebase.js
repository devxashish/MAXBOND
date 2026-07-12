// src/firebase.js
// ✅ Secure Firebase Setup - Configuration from Environment Variables

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  updateDoc,
  deleteDoc,
  enableIndexedDbPersistence,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// ✅ Secure Config - Read from environment variables
// These values are injected at build time and NOT visible in source code
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// ✅ Validate that required environment variables are set
if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId
) {
  console.error(
    "❌ Firebase configuration is incomplete. Please check your .env file."
  );
  console.error("Required variables:", {
    apiKey: !!firebaseConfig.apiKey,
    authDomain: !!firebaseConfig.authDomain,
    projectId: !!firebaseConfig.projectId
  });
}

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// ✅ Enable Offline Support
enableIndexedDbPersistence(db)
  .then(() => console.log("✅ Firestore offline persistence enabled"))
  .catch((err) => {
    // Persistence fails silently if user is signed into multiple tabs
    if (err.code !== "failed-precondition") {
      console.error("❌ Offline support failed:", err);
    }
  });

// ✅ Export essentials
export {
  app,
  auth,
  db,
  functions,
  Timestamp,
  serverTimestamp,
  setDoc,
  getDoc,
  addDoc,
  doc,
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc
};
