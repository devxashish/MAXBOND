import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import "./Signup.css";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      // 👤 Add display name to Firebase Auth user
      await updateProfile(userCred.user, {
        displayName: name,
      });

      // 🗃️ Save user info in Firestore
      await setDoc(doc(db, "users", userCred.user.uid), {
        uid: userCred.user.uid,
        name,
        email,
        createdAt: new Date()
      });

      setMsg("✅ User created successfully!");
      setName("");
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error(error);
      setMsg(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div className="signup-container">
      <h2>Add New Maxbond Member</h2>
      <form onSubmit={handleSignup} className="signup-form">
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="User Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="User Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Create User</button>
      </form>
      {msg && <p className="message">{msg}</p>}
    </div>
  );
};

export default Signup;
