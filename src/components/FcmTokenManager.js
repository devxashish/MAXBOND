// src/components/FcmTokenManager.js
import React, { useState, useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'react-toastify'; // Keep toast for general warnings from this component
import { onAuthStateChanged } from 'firebase/auth';
// VAPID Key: REPLACE WITH YOUR ACTUAL VAPID_KEY
const VAPID_KEY = 'BAjQRiAgoU1sZ_vQ8HeqOGFFqH57WgL89OI7Ogh6qNRCJ7UTozSmbBRbYjweT__zw01P3iMHLAYnc9mAlIxcDeg';

const FcmTokenManager = () => {
  const [currentUserId, setCurrentUserId] = useState(null);

  const requestPermissionAndSaveToken = useCallback(async (userUid) => {
    if (!userUid) {
        console.warn("FCM: No user UID available to request token.");
        return;
    }

    try {
      const messaging = getMessaging();

      if (!('serviceWorker' in navigator)) {
        console.warn('FCM: Service Worker is not supported in this browser.');
        toast.error("Push notifications not supported by your browser.");
        return;
      }

      // Check if service worker is active. Register if not.
      let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (!registration) {
          console.log('FCM: Service Worker not registered, attempting to register.');
          registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          await navigator.serviceWorker.ready; // Wait for activation
          console.log('FCM: Service Worker registered and ready.');
      }


      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        console.log('FCM: Notification permission granted.');

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        console.log('FCM: Device token obtained:', token);

        // Save token to Firestore for the current user
        const tokenDocRef = doc(db, 'users', userUid, 'fcmTokens', token);
        await setDoc(tokenDocRef, { token: token, timestamp: new Date(), uid: userUid }, { merge: true });
        toast.success("Push notifications enabled!"); // Toast for the user
        console.log("FCM: Device token saved successfully to Firestore.");

        // Handle foreground messages - show a toast when app is open
        onMessage(messaging, (payload) => {
          console.log('FCM: Foreground message received: ', payload);
          const { title, body } = payload.notification || { title: 'Notification', body: 'New message' };
          const messageContent = payload.data?.message || body; // Prefer data.message
          
          toast.info(messageContent, {
            position: "bottom-left",
            autoClose: 8000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            title: title // Use FCM notification title
          });

          // Play sound for urgent alerts even in foreground if configured
          if (payload.data?.type === 'global-alert' && payload.data?.sound === 'call_ringtone') {
              const audio = new Audio('/sounds/call_ringtone.mp3');
              audio.volume = 0.8;
              audio.play().catch(e => console.error("FCM: Error playing foreground alert sound:", e));
              setTimeout(() => audio.pause(), 10000);
          }
        });

      } else if (permission === 'denied') {
        toast.warn("Notification permission denied. Push notifications will not be received on this device.");
        console.warn("FCM: Notification permission denied by user.");
      } else {
        toast.info("Notification permission request dismissed. You can enable it in browser settings.");
        console.log("FCM: Notification permission request dismissed or not interacted with.");
      }
    } catch (error) {
      console.error("FCM: Error setting up push notifications:", error);
      // More specific errors could be checked here (e.g., messaging/unsupported-browser)
      toast.error("Failed to set up push notifications. Please check console.");
    }
  }, []);

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        // Only request permission if we haven't already or if it's currently denied
        // The PermissionRequestModal handles the initial user prompt, this component
        // ensures the token setup is attempted when a user is logged in.
        requestPermissionAndSaveToken(user.uid);
      } else {
        setCurrentUserId(null);
      }
    });

    return () => {
      authUnsubscribe();
    };
  }, [requestPermissionAndSaveToken]);

  return null;
};

export default FcmTokenManager;
