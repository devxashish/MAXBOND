// src/pages/SendNotificationsPage.js
import React, { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

import { showThemedToast } from '../components/CustomToast'; // Use your custom toast function

import styles from "../styles/SendNotificationsPage.module.css";

const SendNotificationsPage = () => {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [globalMessage, setGlobalMessage] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const usersCollectionRef = collection(db, "users");
      const querySnapshot = await getDocs(usersCollectionRef);
      const fetchedUsers = querySnapshot.docs.map((doc) => ({
        value: doc.id,
        label: doc.data().email,
        email: doc.data().email,
        uid: doc.data().uid,
      }));
      setUsers(fetchedUsers);
    } catch (err) {
      console.error("Error fetching users for notification:", err);
      setError("Failed to load users for selection. Check console for details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLoggedInUser(user);
        fetchUsers();
      } else {
        setLoggedInUser(null);
        setUsers([]);
        setLoading(false);
        setError("You must be logged in to send notifications.");
      }
    });
    return () => unsubscribe();
  }, [fetchUsers]);


  const handleSendGlobalToast = async () => {
    if (!globalMessage.trim()) {
      setError("Please enter a message for the global toast.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await addDoc(collection(db, "notifications"), {
        type: "global-toast", // CRITICAL: Ensure this exact string is used
        message: globalMessage.trim(),
        senderId: loggedInUser.uid,
        senderEmail: loggedInUser.email,
        timestamp: serverTimestamp(),
        status: "sent",
        // Ensure no 'recipients' array is added here for global toasts
      });
      showThemedToast(globalMessage.trim(), "info", { title: "Global Toast Sent" });
      setGlobalMessage("");
    } catch (err) {
      console.error("Error sending global toast:", err);
      setError("Failed to send global toast. Please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    }
  };

  const handleSendGlobalAlert = async () => {
    if (!alertMessage.trim()) {
      setError("Please enter a message for the urgent global alert.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await addDoc(collection(db, "notifications"), {
        type: "global-alert", // CRITICAL: Ensure this exact string is used
        message: alertMessage.trim(),
        senderId: loggedInUser.uid,
        senderEmail: loggedInUser.email,
        timestamp: serverTimestamp(),
        status: "sent",
        // Ensure no 'recipients' array is added here for global alerts
      });
      showThemedToast(alertMessage.trim(), "success", { title: "Urgent Alert Sent" }); // Use 'success' for sending feedback
      setAlertMessage("");
    } catch (err) {
      console.error("Error sending global alert:", err);
      setError("Failed to send global alert. Please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    }
  };

  const handleSendPersonalNotification = async () => {
    if (selectedUsers.length === 0) {
      setError("Please select at least one user to send a personal message.");
      return;
    }
    if (!personalMessage.trim()) {
      setError("Please enter a personal message.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const recipientUids = selectedUsers.map((user) => user.uid);
    const recipientEmails = selectedUsers.map((user) => user.email);

    try {
      await addDoc(collection(db, "notifications"), {
        type: "personal-message", // CRITICAL: Ensure this exact string is used
        message: personalMessage.trim(),
        senderId: loggedInUser.uid,
        senderEmail: loggedInUser.email,
        recipients: recipientUids, // This is explicitly needed for personal messages
        recipientEmails: recipientEmails,
        timestamp: serverTimestamp(),
        status: "sent",
      });

      showThemedToast(personalMessage.trim(), "success", { title: `Personal Msg to ${recipientEmails.length} user(s)` });
      setSelectedUsers([]);
      setPersonalMessage("");
    } catch (err) {
      console.error("Error sending personal notification:", err);
      setError("Failed to send personal notification. Please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={`${styles.message} ${styles.loadingMessage}`}>Loading users for selection...</div>
      </div>
    );
  }

  if (error && !loggedInUser) {
    return (
      <div className={styles.container}>
        <div className={`${styles.message} ${styles.error}`}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {error && <div className={`${styles.message} ${styles.error}`}>{error}</div>}
      {success && <div className={`${styles.message} ${styles.success}`}>{success}</div>}

      <h2>Notification & Alert Sender</h2>

      <div className={styles.section}>
        <h3>Global Toast Message</h3>
        <p>This message will appear as a temporary toast notification on all active users' screens when they interact with the app. Users will also receive a silent push notification.</p>
        <textarea
          className={styles.textarea}
          placeholder="Enter global toast message..."
          value={globalMessage}
          onChange={(e) => setGlobalMessage(e.target.value)}
          disabled={loading}
        ></textarea>
        <button className={styles.button} onClick={handleSendGlobalToast} disabled={loading}>
          Send Global Toast
        </button>
      </div>

      <div className={styles.section}>
        <h3>Urgent Global Alert</h3>
        <p>This message will trigger a persistent alert on all users' devices. Active apps will play a call-like ringtone. All users will receive a push notification with sound and vibration (requires app to handle custom sound for mobile).</p>
        <textarea
          className={styles.textarea}
          placeholder="Enter urgent global alert message..."
          value={alertMessage}
          onChange={(e) => setAlertMessage(e.target.value)}
          disabled={loading}
        ></textarea>
        <button className={`${styles.button} ${styles.urgentButton}`} onClick={handleSendGlobalAlert} disabled={loading}>
          Send Urgent Global Alert
        </button>
      </div>

      <div className={styles.section}>
        <h3>Personal Message/Notification</h3>
        <p>Send a direct message or notification to specific users' emails or devices. They will receive an in-app toast and a push notification.</p>
        <label className={styles.label}>Select User(s):</label>
        <Select
          isMulti
          options={users}
          value={selectedUsers}
          onChange={setSelectedUsers}
          className={styles.reactSelectContainer}
          classNamePrefix="react-select"
          isDisabled={loading || users.length === 0}
          placeholder="Select users..."
          styles={{
            control: (provided) => ({ ...provided, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderColor: 'var(--ds-border-color)', boxShadow: 'inset 0 0 5px rgba(0,0,0,0.5)', '&:hover': { borderColor: 'var(--ds-accent-red)' } }),
            menu: (provided) => ({ ...provided, backgroundColor: 'var(--ds-medium-bg)', border: '1px solid var(--ds-accent-red)' }),
            option: (provided, state) => ({ ...provided, backgroundColor: state.isFocused ? 'rgba(114, 61, 71, 0.5)' : 'var(--ds-medium-bg)', color: 'var(--ds-light-text)', '&:hover': { backgroundColor: 'var(--ds-accent-red)', color: 'white' } }),
            multiValue: (provided) => ({ ...provided, backgroundColor: 'var(--ds-accent-red)', color: 'white' }),
            multiValueLabel: (provided) => ({ ...provided, color: 'white' }),
            multiValueRemove: (provided) => ({ ...provided, color: 'white', '&:hover': { backgroundColor: 'var(--ds-dark-bg)', color: 'white' } }),
            singleValue: (provided) => ({ ...provided, color: 'var(--ds-light-text)' }),
            input: (provided) => ({ ...provided, color: 'var(--ds-light-text)' }),
            placeholder: (provided) => ({ ...provided, color: 'rgba(255, 255, 255, 0.5)' }),
          }}
        />
        <textarea
          className={styles.textarea}
          placeholder="Enter personal message..."
          value={personalMessage}
          onChange={(e) => setPersonalMessage(e.target.value)}
          disabled={loading}
        ></textarea>
        <button className={styles.button} onClick={handleSendPersonalNotification} disabled={loading}>
          Send Personal Notification
        </button>
      </div>
    </div>
  );
};

export default SendNotificationsPage;