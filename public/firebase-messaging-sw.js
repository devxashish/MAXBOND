// public/firebase-messaging-sw.js

// Import the Firebase JS SDK for Firebase products you want to use.
// Ensure these versions match the ones used in your main app's package.json
// or are compatible with your Firebase setup.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// REQUIRED: Initialize Firebase with your project's configuration.
// This configuration MUST match what you use in your main web app.
const firebaseConfig = {
    apiKey: "AIzaSyCEo7zQiOh7xgrMtmCYbkoTHRvAQFePZtA",
    authDomain: "maxbondinfra1.firebaseapp.com",
    projectId: "maxbondinfra1",
    storageBucket: "maxbondinfra1.firebasestorage.app",
    messagingSenderId: "479074725464",
    appId: "1:479074725464:web:106e75c291f3a61a9fa42d",
    measurementId: "G-DGZXQ331ZM" // Optional, if you use Analytics
};

// Initialize the Firebase app in the service worker
const app = firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging
const messaging = app.messaging();

// --- Handle Background Notifications ---
// This listener fires when a message is received while the app is in the background
// (i.e., not in focus, minimized, or closed).
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    // Extract notification data from payload.
    // FCM messages can have a 'notification' field (handled by browser/OS)
    // and/or a 'data' field (handled by service worker).
    const notificationData = payload.notification || {};
    const customData = payload.data || {};

    // Determine title and body, prioritizing 'notification' field then 'data' field
    const notificationTitle = notificationData.title || customData.title || 'New Maxbond Alert';
    const notificationBody = notificationData.body || customData.body || customData.message || 'You have a new message.';

    // Define notification options for `showNotification`
    const notificationOptions = {
        body: notificationBody,
        // Icons: Paths relative to the service worker scope (usually public folder root)
        icon: customData.icon || notificationData.icon || '/maxbond_logo_192x192.png',
        badge: customData.badge || notificationData.badge || '/maxbond_logo_72x72.png', // Shown on some mobile platforms
        
        // Vibration pattern: Parse from customData or use a default
        vibrate: customData.vibration ? JSON.parse(customData.vibration) : [200, 100, 200],

        // Sound: For web push, this typically refers to a system sound or
        // a sound defined by the platform/browser, not a custom MP3 played by SW.
        // If you send 'default' in payload.data.sound, it will play the system default.
        sound: customData.sound, // e.g., 'default' or a specific sound name if supported by platform

        // Data: Pass the full custom data payload to be accessible on notification click
        data: customData,

        // Tag: Allows grouping notifications. A new notification with the same tag
        // will replace an existing one. Use unique tags for distinct notifications.
        tag: customData.tag || 'maxbond-default-notification',

        // Renotify: Ensures the user is re-alerted if a new notification with the same tag arrives.
        renotify: true,

        // Require Interaction: Keeps the notification visible until the user interacts with it.
        // Use carefully, as it can be intrusive.
        requireInteraction: customData.requireInteraction === 'true' || false, // Convert string to boolean

        // Actions: Add buttons to the notification for quick actions
        actions: [
            // Example action buttons. These are defined in your backend payload.
            // { action: 'view_details', title: 'View Details', icon: '/icons/view.png' },
            // { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
        ].filter(Boolean) // Filter out any null/undefined actions
    };

    // Use event.waitUntil to ensure the service worker stays active until the notification is shown.
    event.waitUntil(
        self.registration.showNotification(notificationTitle, notificationOptions)
            .catch(error => {
                console.error('Error showing notification:', error);
            })
    );
});

// --- Handle Notification Clicks ---
// This listener fires when the user clicks on a displayed notification.
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // Close the notification after it's clicked

    const clickedNotificationData = event.notification.data;
    console.log('Notification clicked:', clickedNotificationData);

    // Determine the URL to open based on the custom data from the payload
    // 'click_action' is a common field used by FCM for this purpose.
    const urlToOpen = clickedNotificationData.click_action || self.location.origin + '/home';

    // Use event.waitUntil to ensure the service worker stays active until the window is opened.
    // clients.openWindow() opens a new browser window/tab or focuses an existing one.
    event.waitUntil(
        clients.openWindow(urlToOpen).catch(error => {
            console.error('Error opening window on notification click:', error);
        })
    );
});

// --- Optional: Handle Notification Close ---
// This listener fires when the user dismisses a notification without clicking it.
self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed:', event.notification.tag);
    // You could send an analytics event here, or update a 'read' status in your backend
    // for notifications that are simply dismissed.
});
