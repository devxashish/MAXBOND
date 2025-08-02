// src/pages/Signup.js

import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, collection, getDocs, query, where, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./Signup.css"; // Ensure this CSS is linked

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setMsg("");
    setIsLoading(true);

    try {
      // 1. Check for invitation in Firestore (before Firebase Auth creation)
      // This read operation must be allowed by your Firestore Security Rules for unauthenticated users.
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email.trim()), where("hasSignedUp", "==", false));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setMsg("❌ Access Denied. Your email is not invited or has already signed up. Please contact Maxbond owner or developer.");
        setIsLoading(false);
        return;
      }

      const invitedUserDoc = querySnapshot.docs[0];
      const invitedUserData = invitedUserDoc.data();

      // Optional: Name Matching Logic (if an invited name exists and user provides a name, they must match)
      const providedName = name.trim();
      const invitedName = invitedUserData.name ? invitedUserData.name.trim() : "";

      if (invitedName && providedName && invitedName.toLowerCase() !== providedName.toLowerCase()) {
        setMsg("❌ Provided name does not match the invited name. Please use the exact name you were invited with.");
        setIsLoading(false);
        return;
      }

      // 2. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUserAuth = userCredential.user;

      // 3. Update display name in Firebase Auth (use provided name or invited name)
      const displayNameToSet = providedName || invitedName || email.split('@')[0]; // Fallback to email prefix
      await updateProfile(newUserAuth, {
        displayName: displayNameToSet,
      });

      // 4. Prepare data for updating the existing Firestore user document
      // IMPORTANT: Include all existing fields you want to preserve to satisfy security rules' diff checks.
      const updateData = {
        ...invitedUserData, // Start with all existing data
        uid: newUserAuth.uid,      // Override with the new Firebase Auth UID
        hasSignedUp: true,         // Set to true
        signedUpAt: new Date(),    // Record signup timestamp
        name: displayNameToSet,    // Update name to final chosen name
        // Ensure email, roles, invitedAt are preserved by including invitedUserData
      };

      // 5. Update the existing Firestore user document
      // This update operation must be allowed by your Firestore Security Rules for the newly authenticated user.
      await updateDoc(doc(db, "users", invitedUserDoc.id), updateData);

      setMsg("✅ Account created successfully! Redirecting to login...");
      setName("");
      setEmail("");
      setPassword("");
      // Redirect to login page after successful signup
      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (error) {
      console.error("Signup error:", error);
      let errorMessage = error.message;
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Try logging in or resetting password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'The email address is not valid.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
      } else if (error.code === 'permission-denied') {
          errorMessage = 'Permission denied by server. Your email might not be invited or security rules are too strict.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      setMsg(`❌ ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h2 className="signup-title">Maxbond Member Signup</h2>
        <form onSubmit={handleSignup} className="signup-form">
          <div className="input-group">
            <label htmlFor="name" className="input-label">Full Name (Optional, as invited)</label>
            <input
              type="text"
              id="name"
              placeholder="Your Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="signup-input"
              disabled={isLoading}
            />
          </div>

          <div className="input-group">
            <label htmlFor="email" className="input-label">Your Invited Email</label>
            <input
              type="email"
              id="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="signup-input"
              disabled={isLoading}
            />
          </div>

          <div className="input-group">
            <label htmlFor="password" className="input-label">Set Your Password</label>
            <input
              type="password"
              id="password"
              placeholder="•••••••• (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="signup-input"
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="signup-button" disabled={isLoading}>
            {isLoading ? <span className="spinner"></span> : "Complete Signup"}
          </button>
        </form>

        {msg && (
          <div className={`message ${msg.startsWith('✅') ? 'success-message' : 'error-message'}`}>
            <p>{msg}</p>
          </div>
        )}

        <div className="signup-login-link">
          <p>Already have an account? <a href="/login">Login here</a></p>
        </div>
      </div>
    </div>
  );
};

export default Signup;