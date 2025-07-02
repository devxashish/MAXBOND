import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "./ProfilePage.css";

const storage = getStorage();

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({
    name: "",
    profession: "",
    address: "",
    phone: "",
    jobDetails: "",
    photoURL: "",
  });

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const docRef = doc(db, "profiles", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile((prev) => ({ ...prev, ...docSnap.data() }));
        }
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    const fileRef = ref(storage, `profilePics/${user.uid}`);
    await uploadBytes(fileRef, file);

    const url = await getDownloadURL(fileRef);
    setProfile((prev) => ({ ...prev, photoURL: url }));
    await setDoc(doc(db, "profiles", user.uid), { ...profile, photoURL: url });
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, "profiles", user.uid), profile);
      alert("✅ Profile saved successfully!");
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("❌ Error saving profile");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="ios-profile-container">
      <div className="ios-profile-card glass">
        <img
          src="https://i.postimg.cc/prnnf7Qs/IMG-20250623-WA0000.jpg"
          alt="Back"
          className="profile-back-logo"
          onClick={() => navigate("/dashboard")}
        />
        <h2>👤 My Profile</h2>

        {profile.photoURL ? (
          <img src={profile.photoURL} alt="Profile" className="profile-photo-preview" />
        ) : (
          <div className="profile-photo-fallback">
            {profile.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}

        <label>Upload Profile Picture:</label>
        <input type="file" accept="image/*" onChange={handleImageUpload} />

        <label>Name:</label>
        <input name="name" value={profile.name} onChange={handleChange} />

        <label>Profession:</label>
        <input name="profession" value={profile.profession} onChange={handleChange} />

        <label>Address:</label>
        <input name="address" value={profile.address} onChange={handleChange} />

        <label>Phone Number:</label>
        <input name="phone" value={profile.phone} onChange={handleChange} />

        <label>Job Details:</label>
        <textarea
          name="jobDetails"
          value={profile.jobDetails}
          onChange={handleChange}
        />

        <button className="ios-button" onClick={handleSave}>💾 Save</button>
        <button className="ios-logout-btn" onClick={handleLogout}>🚪 Logout</button>
      </div>
    </div>
  );
};

export default ProfilePage;
