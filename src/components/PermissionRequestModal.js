import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { db, auth, doc, setDoc, getMessaging, getToken, serverTimestamp } from '../firebase';

// ✅ Use your CSS module
import styles from '../styles/PermissionRequestModal.module.css';

// Replace with your actual key
const VAPID_KEY = 'BAjQRiAgoU1sZ_vQ8HeqOGFFqH57WgL89OI7Ogh6qNRCJ7UTozSmbBRbYjweT__zw01P3iMHLAYnc9mAlIxcDeg';

const PermissionRequestModal = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const alreadyAllowed = localStorage.getItem('permissions_granted');
    if (!alreadyAllowed) {
      setShowPrompt(true);
    }
  }, []);

  const requestAllPermissions = async () => {
    try {
      // 1. Notifications
      if ('Notification' in window && Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        console.log('Notification Permission:', result);
      }

      // 2. Location
      if ('geolocation' in navigator) {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        console.log('Location Permission granted');
      }

      // 3. Wake Lock (background access)
      if ('wakeLock' in navigator) {
        try {
          const lock = await navigator.wakeLock.request('screen');
          console.log('Wake lock acquired');
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') lock.release();
          });
        } catch (e) {
          console.log('Wake lock not supported or failed:', e);
        }
      }

      localStorage.setItem('permissions_granted', 'true');
      setShowPrompt(false);
      toast.success('Permissions granted!');
    } catch (error) {
      console.error('Permission error:', error);
      toast.error('Some permissions failed or were denied.');
    }
  };

  if (!showPrompt) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Allow Permissions</h2>
        <p>To enable full functionality, please allow:</p>
        <ul className={styles.permissionList}>
          <li>🔔 Notifications</li>
          <li>📍 Location Access</li>
          <li>🔋 Background Access</li>
        </ul>
        <button onClick={requestAllPermissions} className={styles.button}>
          Allow All
        </button>
      </div>
    </div>
  );
};

export default PermissionRequestModal;
