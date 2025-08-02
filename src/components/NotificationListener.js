import React, { useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc } from 'firebase/firestore'; // For fetching user preferences

import { showThemedToast, dismissToast } from './CustomToast'; // Assume dismissToast is also available

const NotificationListener = () => {
  const audioRef = useRef(null);
  const audioInitialized = useRef(false);
  const audioPermissionToastId = useRef(null); // To keep track of the audio permission toast
  const lastNotificationTimestamp = useRef(Date.now()); // Track last processed notification timestamp
  const currentUserUid = useRef(null); // Store current user's UID

  // State to hold user notification preferences (e.g., sound enabled, specific types)
  const userPreferences = useRef({});

  // --- Audio Handling Functions ---
  const playRingtone = useCallback(() => {
    if (!audioInitialized.current) {
      audioRef.current = new Audio('/sounds/call_ringtone.mp3'); // Your sound file path
      audioRef.current.loop = true;
      audioRef.current.volume = 0.8;
      audioInitialized.current = true;
    }

    // Only play if audio is enabled in user preferences and not already playing
    if (userPreferences.current.enableSound && audioRef.current.paused) {
      audioRef.current.play().catch(e => {
        console.warn("Audio playback blocked:", e);
        if (!audioPermissionToastId.current) {
          audioPermissionToastId.current = showThemedToast(
            "To hear important alerts, please click anywhere on the page to enable audio.",
            "warning",
            {
              autoClose: false,
              toastId: 'audio-permission-warn',
              title: 'Audio Blocked',
              position: 'bottom-center',
              closeButton: true,
              hideProgressBar: true,
              onClose: () => {
                audioPermissionToastId.current = null; // Clear ID when toast is dismissed
              }
            }
          );
        }
      });
      console.log("Attempting to play ringtone...");
    } else if (!userPreferences.current.enableSound) {
      console.log("Ringtone blocked by user preferences.");
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      console.log("Ringtone manually stopped.");
    }
    // Dismiss the audio permission toast if it's active
    if (audioPermissionToastId.current) {
      dismissToast(audioPermissionToastId.current);
      audioPermissionToastId.current = null;
    }
  }, []);

  // --- Utility Function to Mark Notification as Read ---
  const markNotificationAsRead = useCallback(async (notificationId) => {
    if (!currentUserUid.current || !notificationId) return;

    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, {
        [`readBy.${currentUserUid.current}`]: serverTimestamp()
      });
      console.log(`Notification ${notificationId} marked as read by ${currentUserUid.current}`);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  // --- Fetch User Preferences ---
  const fetchUserPreferences = useCallback(async (uid) => {
    try {
      const userDocRef = doc(db, "users", uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const prefs = docSnap.data().preferences || {};
        userPreferences.current = {
          enableSound: prefs.enableSound !== false, // Default to true if not set
          receiveGlobalToasts: prefs.receiveGlobalToasts !== false,
          receiveGlobalAlerts: prefs.receiveGlobalAlerts !== false,
          receivePersonalMessages: prefs.receivePersonalMessages !== false,
          // Add more granular preferences here
        };
        console.log("User preferences loaded:", userPreferences.current);
      } else {
        // Default preferences if user document or preferences don't exist
        userPreferences.current = {
          enableSound: true,
          receiveGlobalToasts: true,
          receiveGlobalAlerts: true,
          receivePersonalMessages: true,
        };
      }
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      // Fallback to default preferences on error
      userPreferences.current = {
        enableSound: true,
        receiveGlobalToasts: true,
        receiveGlobalAlerts: true,
        receivePersonalMessages: true,
      };
    }
  }, []);

  useEffect(() => {
    let unsubscribeFirestore;
    let unsubscribeAuth;

    unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUserUid.current = user.uid;
        await fetchUserPreferences(user.uid); // Fetch preferences on login

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const q = query(
          collection(db, "notifications"),
          where("timestamp", ">", twentyFourHoursAgo),
          orderBy("timestamp", "desc"),
          limit(20)
        );

        unsubscribeFirestore = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const notification = { id: change.doc.id, ...change.doc.data() };
              const notificationTimestamp = notification.timestamp?.toDate().getTime();

              // Only process new notifications (not older ones loaded initially)
              // and ensure it's a valid timestamp
              if (notificationTimestamp && notificationTimestamp > lastNotificationTimestamp.current) {
                console.log("New notification received (from Firestore Listener):", notification);

                const isGlobalToast = notification.type === "global-toast";
                const isGlobalAlert = notification.type === "global-alert";
                const isPersonalMessage = notification.type === "personal-message";

                const isForCurrentUser = isGlobalToast || isGlobalAlert || (isPersonalMessage && notification.recipients?.includes(currentUserUid.current));

                // Check if the user has already read this specific notification
                const hasBeenRead = notification.readBy && notification.readBy[currentUserUid.current];

                if (isForCurrentUser && !hasBeenRead) {
                  // Update timestamp to prevent re-processing this specific notification on subsequent runs
                  lastNotificationTimestamp.current = notificationTimestamp;

                  if (isGlobalToast && userPreferences.current.receiveGlobalToasts) {
                    showThemedToast(notification.message, "info", {
                      position: "top-right",
                      autoClose: 5000,
                      hideProgressBar: false,
                      closeOnClick: true,
                      pauseOnHover: true,
                      draggable: true,
                      title: notification.title || "Global Update", // Allow custom titles
                      onClose: () => markNotificationAsRead(notification.id) // Mark as read on close
                    });
                  } else if (isGlobalAlert && userPreferences.current.receiveGlobalAlerts) {
                    showThemedToast(notification.message, "error", {
                      position: "top-center",
                      autoClose: false,
                      hideProgressBar: true,
                      closeOnClick: false,
                      pauseOnHover: false,
                      draggable: false,
                      onClose: () => {
                        stopRingtone();
                        markNotificationAsRead(notification.id); // Mark as read on close
                      },
                      title: notification.title || "Urgent Alert!", // Allow custom titles
                      icon: notification.icon || '🚨', // Custom icon support
                    });
                    playRingtone();
                  } else if (isPersonalMessage && isForCurrentUser && userPreferences.current.receivePersonalMessages) {
                    showThemedToast(notification.message, "success", {
                      position: "top-right",
                      autoClose: 10000,
                      hideProgressBar: false,
                      closeOnClick: true,
                      pauseOnHover: true,
                      draggable: true,
                      title: notification.title || `Message from ${notification.senderEmail || 'Admin'}`, // Allow custom titles
                      onClose: () => markNotificationAsRead(notification.id) // Mark as read on close
                    });
                  }
                } else {
                  console.log(`Skipping notification (already read or not for user/type preference): ${notification.id}`, notification);
                }
              } else {
                console.log("Skipping old or incomplete notification:", notification);
              }
            }
          });
        }, (error) => {
          console.error("Error listening to notifications:", error);
          showThemedToast("Failed to receive real-time notifications. Check console for details.", "error", { autoClose: 3000, title: "Notification Error" });
        });
      } else {
        // User logged out, clean up
        if (unsubscribeFirestore) unsubscribeFirestore();
        currentUserUid.current = null;
        userPreferences.current = {}; // Clear preferences
        stopRingtone(); // Ensure ringtone stops if logged out
      }
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
        audioInitialized.current = false;
      }
      // Ensure any lingering permission toasts are dismissed on unmount
      if (audioPermissionToastId.current) {
        dismissToast(audioPermissionToastId.current);
        audioPermissionToastId.current = null;
      }
    };
  }, [playRingtone, stopRingtone, markNotificationAsRead, fetchUserPreferences]); // Added dependencies

  return null;
};

export default NotificationListener;