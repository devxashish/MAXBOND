import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, collection, getDocs } from "firebase/firestore";
import Select from 'react-select'; // Assuming react-select is used for dropdown
import styles from "./AddUserForm.css"; // Using CSS Modules

const AddUserForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);

  const navigate = useNavigate();

  // Fetch available roles from Firestore
  useEffect(() => {
    const fetchAvailableRoles = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "roles"));
        const rolesData = querySnapshot.docs.map(doc => ({
          value: doc.data().name,
          label: doc.data().name,
          id: doc.id
        }));
        setAvailableRoles(rolesData);
      } catch (err) {
        console.error("Error fetching available roles:", err);
        setMsg("❌ Failed to load available roles. Please try again.");
      }
    };
    fetchAvailableRoles();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    if (selectedRoles.length === 0) {
      setMsg("❌ Please select at least one role for the user.");
      setLoading(false);
      return;
    }

    // Basic email format validation
    if (!email.includes('@') || !email.includes('.')) {
      setMsg("❌ Please enter a valid email address.");
      setLoading(false);
      return;
    }

    try {
      // Create Firebase Auth user directly here
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const newUserAuth = userCred.user;

      // Update display name
      await updateProfile(newUserAuth, {
        displayName: name.trim(), // Use provided name for display name
      });

      // Get an array of just the role values
      const rolesToSave = selectedRoles.map(role => role.value);

      // Save user info in Firestore, linked by their new UID
      await setDoc(doc(db, "users", newUserAuth.uid), { // Use newUserAuth.uid as doc ID
        uid: newUserAuth.uid,
        name: name.trim(),
        email: email.trim(),
        roles: rolesToSave,
        createdAt: new Date(), // Use createdAt for directly added users
        hasSignedUp: true, // Mark as signed up since created directly
        invitedAt: null, // No explicit invitation for direct creation
      });

      setMsg("✅ User created successfully!");
      setName("");
      setEmail("");
      setSelectedRoles([]);
      setPassword("");
    } catch (err) {
      console.error("Error creating user:", err);
      let errorMessage = err.message;
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use by another account.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'The email address is not valid.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      }
      setMsg(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
   

      <div className={styles.addUserCard}>
        <form onSubmit={handleSubmit} className={styles.addUserForm}>
          <h2>Create New User Account</h2>
          <div className={styles.formGroup}>
            <label htmlFor="name">👤 Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="Enter full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">📧 User Email</label>
            <input
              id="email"
              type="email"
              placeholder="Enter user's email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">🔑 Set Password</label>
            <input
              id="password"
              type="password"
              placeholder="Create a password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="roles-select">🛠 User Role(s)</label>
            <Select
              id="roles-select"
              isMulti
              name="roles"
              options={availableRoles}
              className={styles.reactSelectContainer} // Apply module class
              classNamePrefix="react-select" // Used by react-select internally
              placeholder="Select Role(s)"
              value={selectedRoles}
              onChange={setSelectedRoles}
              isDisabled={loading || availableRoles.length === 0}
              styles={{
                // Custom styles for react-select to match theme
                control: (provided) => ({
                  ...provided,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'var(--ds-border-color)',
                  boxShadow: 'inset 0 0 5px rgba(0,0,0,0.5)',
                  '&:hover': {
                    borderColor: 'var(--ds-accent-red)',
                  }
                }),
                menu: (provided) => ({
                  ...provided,
                  backgroundColor: 'var(--ds-medium-bg)',
                  border: '1px solid var(--ds-accent-red)',
                }),
                option: (provided, state) => ({
                  ...provided,
                  backgroundColor: state.isFocused ? 'var(--ds-accent-purple)' : 'var(--ds-medium-bg)',
                  color: 'var(--ds-light-text)',
                  '&:hover': {
                    backgroundColor: 'var(--ds-accent-red)',
                    color: 'white',
                  }
                }),
                multiValue: (provided) => ({
                  ...provided,
                  backgroundColor: 'var(--ds-accent-red)',
                  color: 'white',
                }),
                multiValueLabel: (provided) => ({
                  ...provided,
                  color: 'white',
                }),
                multiValueRemove: (provided) => ({
                  ...provided,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'var(--ds-dark-bg)',
                    color: 'white',
                  }
                }),
                singleValue: (provided) => ({
                  ...provided,
                  color: 'var(--ds-light-text)',
                }),
                input: (provided) => ({
                  ...provided,
                  color: 'var(--ds-light-text)',
                }),
                placeholder: (provided) => ({
                  ...provided,
                  color: 'rgba(255, 255, 255, 0.5)',
                }),
              }}
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "Creating User..." : "➕ Create User"}
          </button>

          {/* Manage Users and Manage Roles buttons removed as per request */}
          {/* They are now handled directly as tabs in AdminPanel.jsx */}

          {msg && <p className={`${styles.message} ${msg.startsWith('✅') ? styles.success : styles.error}`}>{msg}</p>}
        </form>
      </div>
    
  );
};

export default AddUserForm;