import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import "./AddUserForm.css";

const AddUserForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      // 👤 Firebase Auth: create user
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      // 🔤 Update displayName
      await updateProfile(userCred.user, { displayName: name });

      // 🗂 Firestore: Save extra user info
      await setDoc(doc(db, "users", userCred.user.uid), {
        uid: userCred.user.uid,
        name,
        email,
        role,
        createdAt: new Date()
      });

      setMsg("✅ User created successfully!");
      setName("");
      setEmail("");
      setRole("");
      setPassword("");
    } catch (err) {
      console.error("Error creating user:", err);
      setMsg(`❌ ${err.message}`);
    }
  };

  return (
    <div className="add-user-container">
      <div className="header-with-logo-text">
        <img
          src="https://i.postimg.cc/prnnf7Qs/IMG-20250623-WA0000.jpg"
          alt="Maxbond Logo"
          className="back-logo"
          onClick={() => navigate("/admin")}
        />
        <span className="maxbond-title">Maxbond Admin</span>
      </div>

      <div className="add-user-card glass">
        <form onSubmit={handleSubmit} className="add-user-form">
          <div className="form-group">
            <label htmlFor="name">👤 Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="Enter full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">📧 User Email</label>
            <input
              id="email"
              type="email"
              placeholder="Enter user's email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">🛠 User Role</label>
            <input
              id="role"
              type="text"
              placeholder="e.g., Site Manager"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">🔑 Set Password</label>
            <input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="ios-button">➕ Add User</button>

          {msg && <p className="message">{msg}</p>}
        </form>
      </div>
    </div>
  );
};

export default AddUserForm;
