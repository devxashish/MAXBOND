// js/firebase.js

// ✅ Firebase Setup with Enhanced Location Services
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

// ✅ Geofencing Helper Functions
export const isInsideGeofence = (userLat, userLng, geozone) => {
  const R = 6371e3; // Earth radius in meters
  const ϕ1 = geozone.lat * Math.PI/180;
  const ϕ2 = userLat * Math.PI/180;
  const Δϕ = (userLat - geozone.lat) * Math.PI/180;
  const Δλ = (userLng - geozone.lng) * Math.PI/180;

  const a = Math.sin(Δϕ/2) * Math.sin(Δϕ/2) +
            Math.cos(ϕ1) * Math.cos(ϕ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const distance = R * c;
  return distance <= geozone.radius;
};

// ✅ Location Services
export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => resolve(position),
        error => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      reject(new Error('Geolocation is not supported by your browser'));
    }
  });
};

// ✅ Location Tracking State
export const initTracker = () => {
  return localStorage.getItem('trackingEnabled') === 'true';
};

export const setTrackingEnabled = (enabled) => {
  localStorage.setItem('trackingEnabled', enabled.toString());
  return enabled;
};

// Track user's current status with entry time
const userStatus = {};

// Start continuous location tracking
export const startTracking = async (userId, geozones) => {
  // Clear any existing interval
  if (userStatus[userId]?.intervalId) {
    clearInterval(userStatus[userId].intervalId);
  }

  // Initialize user status
  if (!userStatus[userId]) {
    userStatus[userId] = {
      status: 'out',
      entryTime: null,
      intervalId: null
    };
  }

  // Create tracking interval
  const intervalId = setInterval(async () => {
    try {
      const position = await getCurrentPosition();
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      // Check geofence status
      let currentStatus = userStatus[userId].status;
      let shouldMarkIn = false;
      let shouldMarkOut = false;
      let targetZone = null;

      for (const geozone of geozones) {
        const inside = isInsideGeofence(location.lat, location.lng, geozone);

        if (inside && currentStatus === 'out') {
          shouldMarkIn = true;
          targetZone = geozone;
          currentStatus = 'in';
          userStatus[userId].entryTime = new Date();
          break;
        } else if (!inside && currentStatus === 'in') {
          shouldMarkOut = true;
          currentStatus = 'out';
          userStatus[userId].entryTime = null;
          break;
        }
      }

      // Update status and log event
      if (shouldMarkIn || shouldMarkOut) {
        userStatus[userId].status = currentStatus;
        await logAttendanceEvent(
          userId,
          shouldMarkIn ? 'in' : 'out',
          shouldMarkIn ? targetZone.id : null,
          shouldMarkIn ? targetZone.name : null
        );
      }
    } catch (error) {
      console.error('Location tracking error:', error);
    }
  }, 30000); // 30 seconds

  // Store interval ID
  userStatus[userId].intervalId = intervalId;
};

// Stop tracking for user
export const stopTracking = (userId) => {
  if (userStatus[userId]?.intervalId) {
    clearInterval(userStatus[userId].intervalId);
    userStatus[userId].intervalId = null;
  }
};

// Get current status with entry time
export const getCurrentStatus = (userId) => {
  return userStatus[userId] || {
    status: 'out',
    entryTime: null
  };
};

// Log attendance event
export const logAttendanceEvent = async (userId, type, geoZoneId, geoZoneName, method = 'auto') => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  const userName = userDoc.data()?.name || 'Unknown';

  const eventData = {
    userId,
    userName,
    type,
    timestamp: new Date(),
    method,
    geoZoneId: type === 'in' ? geoZoneId : null,
    geoZoneName: type === 'in' ? geoZoneName : null
  };

  const docRef = await addDoc(collection(db, 'attendance'), eventData);
  return { id: docRef.id, ...eventData };
};

export {
  app,
  auth,
  db,
  functions
};