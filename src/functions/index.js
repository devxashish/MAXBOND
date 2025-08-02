// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Listener for new notifications added to Firestore
exports.sendPushNotificationOnNewMessage = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snapshot, context) => {
    const notificationData = snapshot.data();
    const { type, message, senderEmail, recipients, recipientEmails } = notificationData;

    let tokens = [];
    let title = "New Notification";
    let body = message;
    let sound = "default"; // Default sound for push notifications (FCM default)
    let vibrationPattern = [0, 500, 200, 500]; // Default vibrate, pause, vibrate

    functions.logger.log(`Processing notification: Type=${type}, Message=${message}`);

    if (type === "global-toast") {
      title = "Update from Admin";
      body = message;
      sound = "default"; // Silent push
      vibrationPattern = [0]; // No vibration
      functions.logger.log("Global Toast created. Sending silent push to all users.");

      // Fetch all FCM tokens from all users for global messages
      try {
        const usersSnapshot = await db.collection("users").get();
        for (const userDoc of usersSnapshot.docs) {
          const fcmTokensSnapshot = await db.collection(`users/${userDoc.id}/fcmTokens`).get();
          fcmTokensSnapshot.forEach(tokenDoc => {
            if (tokenDoc.data().token) {
              tokens.push(tokenDoc.data().token);
            }
          });
        }
      } catch (error) {
        functions.logger.error("Error fetching all FCM tokens for global toast:", error);
        return null; // Cannot send if tokens can't be fetched
      }

    } else if (type === "global-alert") {
      title = "🔥 URGENT GLOBAL ALERT!";
      body = `🚨 ${message}`;
      // 'call_ringtone' should be the name of the sound file (e.g., call_ringtone.mp3)
      // pre-bundled within your native Android/iOS app's resources for native notifications.
      // For web, the service worker will try to play `public/sounds/call_ringtone.mp3`.
      sound = "call_ringtone"; // This should match your sound file name without extension for native apps
      vibrationPattern = [0, 1000, 500, 1000, 500, 1000]; // More intense vibration
      functions.logger.log("Global Alert created. Sending high-priority push to all users.");

      // Fetch all FCM tokens from all users for global messages
      try {
        const usersSnapshot = await db.collection("users").get();
        for (const userDoc of usersSnapshot.docs) {
          const fcmTokensSnapshot = await db.collection(`users/${userDoc.id}/fcmTokens`).get();
          fcmTokensSnapshot.forEach(tokenDoc => {
            if (tokenDoc.data().token) {
              tokens.push(tokenDoc.data().token);
            }
          });
        }
      } catch (error) {
        functions.logger.error("Error fetching all FCM tokens for global alert:", error);
        return null;
      }

    } else if (type === "personal-message") {
      title = `📢 Message from ${senderEmail || "Admin"}`;
      body = message;
      sound = "default"; // Default sound for personal messages
      vibrationPattern = [0, 200, 100, 200]; // Mild vibration
      functions.logger.log("Personal Message created. Sending push to specific recipients.");

      // Fetch FCM tokens for specified recipients
      if (recipients && recipients.length > 0) {
        for (const recipientUid of recipients) {
          try {
            const fcmTokensSnapshot = await db.collection(`users/${recipientUid}/fcmTokens`).get();
            fcmTokensSnapshot.forEach(tokenDoc => {
              if (tokenDoc.data().token) {
                tokens.push(tokenDoc.data().token);
              }
            });
          } catch (error) {
            functions.logger.error(`Error fetching FCM tokens for user ${recipientUid}:`, error);
          }
        }
      } else {
        functions.logger.warn("Personal message created without recipients. Not sending push notification.", notificationData);
        return null;
      }
    } else {
      functions.logger.warn("Unknown notification type. Not sending push notification.", notificationData);
      return null;
    }

    if (tokens.length === 0) {
      functions.logger.log(`No FCM tokens found for type: ${type}. Not sending.`);
      return null;
    }

    // Remove duplicate tokens before sending
    tokens = [...new Set(tokens)];

    // Construct the FCM message payload
    const payload = {
      notification: { // For displaying the visible notification
        title: title,
        body: body,
        icon: '/maxbond_logo_192x192.png' // Icon to display in notification
      },
      data: { // Custom data payload accessible on client (even in background)
        type: type,
        message: message,
        senderEmail: senderEmail || "Admin",
        sound: sound, // Custom sound name for client to interpret
        vibration: JSON.stringify(vibrationPattern), // Send as string, parse on client
        // Add any other custom data you want to send
        click_action: 'https://maxbond-a1x8v01pn-ashishgamins-projects.vercel.app/home' // URL to open on notification click
      },
      // APNs (iOS) specific options
      apns: {
        payload: {
          aps: {
            alert: { title: title, body: body },
            // For custom sounds on iOS, sound value must be registered in app bundle.
            sound: sound === "call_ringtone" ? { critical: 1, name: "call_ringtone.mp3", volume: 1.0 } : sound,
            'content-available': 1, // For background app wake-up
            badge: 1, // Optional: Increment app badge
          },
        },
        headers: { 'apns-priority': '10' }, // High priority
      },
      // Android specific options
      android: {
        priority: 'high',
        notification: {
          sound: sound, // Android uses resource name (e.g., 'call_ringtone')
          vibrate_timings_millis: vibrationPattern, // Android expects array of numbers
          visibility: 'public', // For lock screen visibility
          // default_vibration_pattern: true, default_sound: true, // Use if sound/vibration is 'default'
        },
      },
      // Webpush specific options
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
            vibrate: vibrationPattern,
            // Custom sound for web push is typically handled by the service worker playing Audio()
            // based on the `data.sound` payload.
        }
      },
    };

    functions.logger.log(`Sending FCM to ${tokens.length} tokens for type: ${type}`);

    try {
      const response = await admin.messaging().sendEachForMulticast({ tokens, ...payload });
      functions.logger.log('Successfully sent message:', response);

      if (response.responses) {
        const tokensToRemove = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            functions.logger.error(`Failed to send message to ${tokens[idx]}:`, resp.error);
            if (resp.error.code === 'messaging/invalid-registration-token' ||
                resp.error.code === 'messaging/registration-token-not-registered' ||
                resp.error.code === 'messaging/device-not-registered') {
              tokensToRemove.push(tokens[idx]);
            }
          }
        });

        if (tokensToRemove.length > 0) {
          functions.logger.log("Cleaning up invalid FCM tokens:", tokensToRemove);
          const promises = tokensToRemove.map(async (token) => {
            const tokenQuerySnapshot = await db.collectionGroup('fcmTokens').where('token', '==', token).get();
            tokenQuerySnapshot.forEach(async (doc) => {
              await doc.ref.delete();
              functions.logger.log(`Deleted invalid token ${token} from ${doc.ref.path}`);
            });
          });
          await Promise.all(promises);
        }
      }
      return { success: true, response: response };
    } catch (error) {
      functions.logger.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  });