// js/firebase.js

// ✅ Firebase Setup
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

// ✅ Config
const firebaseConfig = {
  apiKey: "AIzaSyCEo7zQiOh7xgrMtmCYbkoTHRvAQFePZtA",
  authDomain: "maxbondinfra1.firebaseapp.com",
  projectId: "maxbondinfra1",
  storageBucket: "maxbondinfra1.appspot.com",
  messagingSenderId: "479074725464",
  appId: "1:479074725464:web:106e75c291f3a61a9fa42d",
  measurementId: "G-DGZXQ331ZM"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// ✅ Enable Offline Support
enableIndexedDbPersistence(db)
  .then(() => console.log("✅ Firestore offline persistence enabled"))
  .catch((err) => console.error("❌ Offline support failed:", err));



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
