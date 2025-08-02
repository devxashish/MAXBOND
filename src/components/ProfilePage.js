// src/pages/ProfilePage.js
import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast, ToastContainer } from 'react-toastify';
import { FaUserCircle, FaEnvelope, FaLock, FaLink, FaArrowLeft, FaCamera, FaSave, FaSignOutAlt, FaPlus, FaTimes } from 'react-icons/fa';

import ThemeSwitcher from '../components/ThemeSwitcher'; // Import ThemeSwitcher

import "./ProfilePage.css";

// --- SearchableDropdown Component (Premium UI) ---
const SearchableDropdown = ({ value, options, onChange, placeholder, disabled, id }) => {
  const [inputValue, setInputValue] = useState(value);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [showOptions, setShowOptions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    const lowerCaseNewValue = newValue.toLowerCase();

    const filtered = options.filter(
      (option) => typeof option === 'string' && option.toLowerCase().includes(lowerCaseNewValue)
    );
    setFilteredOptions(filtered);
    setShowOptions(true);
  };

  const handleOptionClick = (option) => {
    setInputValue(option);
    onChange(option);
    setShowOptions(false);
  };

  const handleFocus = () => {
    setFilteredOptions(options);
    setShowOptions(true);
  };

  return (
    <div className="searchable-dropdown-wrapper" ref={wrapperRef}>
      <input
        type="text"
        id={id}
        className="input-field"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        disabled={disabled}
        autoComplete="off"
      />
      {showOptions && filteredOptions.length > 0 && (
        <ul className="searchable-dropdown-options">
          {filteredOptions.map((option, index) => (
            <li
              key={index}
              onClick={() => handleOptionClick(option)}
              className="searchable-dropdown-option-item"
            >
              {option}
            </li>
          ))}
        </ul>
      )}
      {showOptions && filteredOptions.length === 0 && inputValue && (
        <p className="no-matches-message">No matches found.</p>
      )}
      {inputValue && !disabled && (
        <button
          className="clear-search-button"
          onClick={() => {
            setInputValue("");
            onChange("");
            setFilteredOptions(options);
            setShowOptions(false);
          }}
        >
          <FaTimes />
        </button>
      )}
    </div>
  );
};

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
    email: "",
    emailVerified: false,
  });
  const [loading, setLoading] = useState(true);

  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [actionAfterReauth, setActionAfterReauth] = useState(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [activeTab, setActiveTab] = useState("profile"); // 'profile', 'security', 'linkedSites'

  const [allSites, setAllSites] = useState([]);
  const [selectedSiteToLink, setSelectedSiteToLink] = useState("");
  const [profileSites, setProfileSites] = useState([]);

  const navigate = useNavigate();
  const reauthPasswordRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(true);
        try {
          const docRef = doc(db, "profiles", currentUser.uid);
          const docSnap = await getDoc(docRef);
          let firestoreProfileData = {};
          if (docSnap.exists()) {
            firestoreProfileData = docSnap.data();
          }

          const sitesSnapshot = await getDocs(collection(db, "sites"));
          const fetchedSites = sitesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
          setAllSites(fetchedSites);

          const linkedSiteNames = firestoreProfileData.linkedSites || [];
          setProfileSites(linkedSiteNames);

          setProfile((prev) => ({
            ...prev,
            ...firestoreProfileData,
            name: currentUser.displayName || firestoreProfileData.name || "",
            email: currentUser.email || "",
            emailVerified: currentUser.emailVerified || false,
            phone: firestoreProfileData.phone || "",
            photoURL: currentUser.photoURL || firestoreProfileData.photoURL || "",
          }));

        } catch (err) {
          console.error("Error fetching profile or sites:", err);
          toast.error("Failed to load profile data or sites.", { autoClose: 3000 });
        } finally {
          setLoading(false);
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

    setLoading(true);
    try {
      const fileRef = ref(storage, `profilePics/${user.uid}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      setProfile((prev) => ({ ...prev, photoURL: url }));
      await updateProfile(user, { photoURL: url });

      const { email, emailVerified, ...profileDataToSave } = profile;
      await setDoc(doc(db, "profiles", user.uid), { ...profileDataToSave, photoURL: url }, { merge: true });
      toast.success("Profile picture updated successfully!", { autoClose: 2000 });
    } catch (err) {
      console.error("Error uploading image or updating profile:", err);
      toast.error("Failed to upload image or update profile.", { autoClose: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (user.displayName !== profile.name) {
        await updateProfile(user, { displayName: profile.name });
      }

      const { email, emailVerified, ...profileDataToSave } = profile;
      await setDoc(doc(db, "profiles", user.uid), { ...profileDataToSave, linkedSites: profileSites }, { merge: true });
      toast.success("Profile saved successfully!", { autoClose: 2000 });
    } catch (err) {
      console.error("Error saving profile:", err);
      toast.error("Failed to save profile.", { autoClose: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      toast.info("Logged out successfully!", { autoClose: 2000 });
      navigate("/login");
    } catch (err) {
      console.error("Error logging out:", err);
      toast.error("Failed to log out.", { autoClose: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0).toUpperCase() +
      parts[parts.length - 1].charAt(0).toUpperCase()
    );
  };

  const sendVerificationEmail = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await sendEmailVerification(user);
      toast.info("Verification email sent! Please check your inbox (and spam).", { autoClose: 5000 });
    } catch (err) {
      console.error("Error sending verification email:", err);
      if (err.code === 'auth/too-many-requests') {
        toast.error("Too many requests. Please wait before re-sending verification email.", { autoClose: 4000 });
      } else {
        toast.error(`Failed to send verification email: ${err.message}`, { autoClose: 4000 });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateEmailChange = () => {
    setReauthPassword("");
    setNewEmail("");
    setActionAfterReauth('changeEmail');
    setShowReauthModal(true);
  };

  const handleInitiatePasswordChange = () => {
    setReauthPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setActionAfterReauth('changePassword');
    setShowReauthModal(true);
  };

  const handleReauthenticate = async () => {
    if (!user || !reauthPassword) {
      toast.warn("Please enter your current password to reauthenticate.", { autoClose: 3000 });
      return;
    }
    setLoading(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, reauthPassword);
      await reauthenticateWithCredential(user, credential);
      setReauthPassword("");
      setShowReauthModal(false);

      if (actionAfterReauth === 'changeEmail') {
        toast.success("Authentication successful. You can now change your email.", { autoClose: 2000 });
      } else if (actionAfterReauth === 'changePassword') {
        toast.success("Authentication successful. You can now change your password.", { autoClose: 2000 });
      }
    } catch (err) {
      console.error("Reauthentication error:", err);
      let errorMessage = `Reauthentication failed: ${err.message}`;
      if (err.code === 'auth/wrong-password') {
        errorMessage = "Incorrect password. Please try again.";
      } else if (err.code === 'auth/invalid-email' || err.code === 'auth/user-not-found') {
        errorMessage = "Authentication error. Please re-login.";
        setTimeout(() => signOut(auth).then(() => navigate("/login")), 2000);
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = "Too many attempts. Please try again later.";
      }
      toast.error(errorMessage, { autoClose: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    if (!user) return;
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.warn("Please enter a valid new email address.", { autoClose: 3000 });
      return;
    }
    if (newEmail === profile.email) {
      toast.warn("New email cannot be the same as the current email.", { autoClose: 3000 });
      return;
    }
    setLoading(true);

    try {
      await updateEmail(user, newEmail);
      setProfile((prev) => ({ ...prev, email: newEmail, emailVerified: false }));
      setNewEmail("");
      setActionAfterReauth(null);
      toast.success("Your email has been updated! Please check your new email for a verification link.", { autoClose: 5000 });
      await sendEmailVerification(user);
    } catch (err) {
      console.error("Error changing email:", err);
      let errorMessage = `Failed to change email: ${err.message}`;
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already in use by another account.";
      } else if (err.code === 'auth/requires-recent-login') {
        errorMessage = "Please re-enter your current password for security reasons and try again.";
        setShowReauthModal(true);
      }
      toast.error(errorMessage, { autoClose: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPasswordChange = async () => {
    if (!user) return;
    if (!newPassword || newPassword.length < 6) {
      toast.warn("New password must be at least 6 characters long.", { autoClose: 3000 });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.warn("New password and confirmation do not match.", { autoClose: 3000 });
      return;
    }
    setLoading(true);

    try {
      await updatePassword(user, newPassword);
      setNewPassword("");
      setConfirmNewPassword("");
      setActionAfterReauth(null);
      toast.success("Your password has been changed successfully!", { autoClose: 3000 });
    } catch (err) {
      console.error("Error changing password:", err);
      let errorMessage = `Failed to change password: ${err.message}`;
      if (err.code === 'auth/requires-recent-login') {
        errorMessage = "Please re-enter your current password for security reasons and try again.";
        setShowReauthModal(true);
      }
      toast.error(errorMessage, { autoClose: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetLinkFromProfile = async () => {
    if (!user?.email) {
      toast.warn("Your email address is not available to send a reset link.", { autoClose: 3000 });
      return;
    }
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.info("Password reset link sent to your email! Please check your inbox (and spam folder).", { autoClose: 5000 });
    } catch (error) {
      console.error("Error sending password reset email from profile:", error);
      let errorMessage = `Failed to send reset link: ${error.message}`;
      if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many password reset requests. Please try again later.";
      }
      toast.error(errorMessage, { autoClose: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSiteToProfile = async () => {
    if (!selectedSiteToLink) {
      toast.warn("Please select a site to link.", { autoClose: 3000 });
      return;
    }
    if (profileSites.includes(selectedSiteToLink)) {
      toast.warn("This site is already linked to your profile.", { autoClose: 3000 });
      return;
    }
    const updatedSites = [...profileSites, selectedSiteToLink];
    setProfileSites(updatedSites);
    setSelectedSiteToLink("");
    toast.success("Site added to your profile (remember to save to apply changes)!", { autoClose: 3000 });
    if (user) {
        setLoading(true);
        try {
            await setDoc(doc(db, "profiles", user.uid), { linkedSites: updatedSites }, { merge: true });
            toast.success("Linked sites saved to database!", { autoClose: 2000 });
        } catch (error) {
            console.error("Error saving linked sites:", error);
            toast.error("Failed to save linked sites.", { autoClose: 3000 });
        } finally {
            setLoading(false);
        }
    }
  };

  const handleRemoveSiteFromProfile = async (siteName) => {
    const updatedSites = profileSites.filter(site => site !== siteName);
    setProfileSites(updatedSites);
    toast.info("Site removed from your profile (remember to save to apply changes)!", { autoClose: 3000 });
    if (user) {
        setLoading(true);
        try {
            await setDoc(doc(db, "profiles", user.uid), { linkedSites: updatedSites }, { merge: true });
            toast.success("Linked sites updated in database!", { autoClose: 2000 });
        } catch (error) {
            console.error("Error saving linked sites:", error);
            toast.error("Failed to update linked sites.", { autoClose: 3000 });
        } finally {
            setLoading(false);
        }
    }
  };

  useEffect(() => {
    if (showReauthModal && reauthPasswordRef.current) {
      reauthPasswordRef.current.focus();
    }
  }, [showReauthModal]);

  return (
    <div className="profile-container">
      <ToastContainer />
      {loading && <div className="loading-overlay"><span className="spinner"></span></div>}

      <div className="profile-card">
        <button
          className="profile-back-button"
          onClick={() => navigate("/dashboard")}
          aria-label="Go back to dashboard"
        >
          <FaArrowLeft />
        </button>
        <h2 className="card-title">My Profile</h2>
        <p className="card-subtitle">Manage your personal and security settings</p>

        {/* ThemeSwitcher moved to the top of the card */}
        <ThemeSwitcher />

        <div className="profile-tabs-container">
          <button
            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
            disabled={loading}
          >
            <FaUserCircle className="tab-icon" /> Profile
          </button>
          <button
            className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
            disabled={loading}
          >
            <FaLock className="tab-icon" /> Security
          </button>
          <button
            className={`tab-button ${activeTab === 'linkedSites' ? 'active' : ''}`}
            onClick={() => setActiveTab('linkedSites')}
            disabled={loading}
          >
            <FaLink className="tab-icon" /> Sites
          </button>
        </div>

        <div className="tab-content-wrapper">
          {activeTab === 'profile' && (
            <div className="tab-content">
              <div className="section">
                <h3 className="section-title">Personal Information</h3>
                <div className="profile-photo-area">
                  {profile.photoURL ? (
                    <img src={profile.photoURL} alt="Profile" className="profile-photo-preview" />
                  ) : (
                    <div className="profile-photo-fallback">
                      {getInitials(profile.name || user?.displayName || user?.email)}
                    </div>
                  )}
                  <label className="upload-button">
                    <FaCamera className="button-icon" /> Upload Photo
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={loading} />
                  </label>
                </div>

                <div className="profile-fields">
                  <div className="input-group">
                    <label>Name:</label>
                    <input name="name" value={profile.name} onChange={handleChange} className="input-field" placeholder="Your Full Name" disabled={loading} />
                  </div>
                  <div className="input-group">
                    <label>Profession:</label>
                    <input name="profession" value={profile.profession} onChange={handleChange} className="input-field" placeholder="e.g., Engineer, Designer" disabled={loading} />
                  </div>
                  <div className="input-group">
                    <label>Address:</label>
                    <input name="address" value={profile.address} onChange={handleChange} className="input-field" placeholder="Your Full Address" disabled={loading} />
                  </div>
                  <div className="input-group">
                    <label>Phone Number:</label>
                    <input name="phone" value={profile.phone} onChange={handleChange} className="input-field" placeholder="+91 9876543210" disabled={loading} type="tel" />
                    <small className="hint-text">For contact purposes only.</small>
                  </div>
                  <div className="input-group full-width-input">
                    <label>Job Details:</label>
                    <textarea name="jobDetails" value={profile.jobDetails} onChange={handleChange} className="textarea-field" placeholder="Briefly describe your job or role..." disabled={loading} />
                  </div>
                </div>
                <button className="primary-button" onClick={handleSaveProfile} disabled={loading}>
                  <FaSave className="button-icon" /> Save Personal Info
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="tab-content">
              <div className="section">
                <h3 className="section-title">Account Security</h3>

                <div className="field-row">
                  <label className="label-static"><FaEnvelope /> Email:</label>
                  <p className="value-static">{profile.email}</p>
                  {user && !profile.emailVerified ? (
                    <span className="status-badge status-unverified">Unverified</span>
                  ) : (
                    <span className="status-badge status-verified">Verified</span>
                  )}
                  {user && !profile.emailVerified && (
                    <button
                      className="secondary-button small-button"
                      onClick={sendVerificationEmail}
                      disabled={loading}
                    >
                      Resend Verification
                    </button>
                  )}
                </div>

                <div className="action-area">
                  <button
                    className="secondary-button"
                    onClick={handleInitiateEmailChange}
                    disabled={loading || actionAfterReauth === 'changeEmail'}
                  >
                    Change Email Address
                  </button>
                  {actionAfterReauth === 'changeEmail' && (
                    <div className="action-input-block">
                      <input type="email" placeholder="Enter new email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="input-field" disabled={loading} />
                      <button className="primary-button small-button" onClick={handleConfirmEmailChange} disabled={loading}>
                        Confirm Email Change
                      </button>
                    </div>
                  )}
                </div>

                <div className="action-area">
                  <button
                    className="secondary-button"
                    onClick={handleInitiatePasswordChange}
                    disabled={loading || actionAfterReauth === 'changePassword'}
                  >
                    Change Password
                  </button>
                  {actionAfterReauth === 'changePassword' && (
                    <div className="action-input-block">
                      <input type="password" placeholder="New Password (min 6 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" disabled={loading} />
                      <input type="password" placeholder="Confirm New Password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="input-field" disabled={loading} />
                      <button className="primary-button small-button" onClick={handleConfirmPasswordChange} disabled={loading}>
                        Confirm Password Change
                      </button>
                    </div>
                  )}
                </div>

                <div className="action-area">
                  <button
                    className="secondary-button"
                    onClick={handleSendResetLinkFromProfile}
                    disabled={loading}
                  >
                    Send Password Reset Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'linkedSites' && (
            <div className="tab-content">
              <div className="section">
                <h3 className="section-title">Linked Sites</h3>
                <div className="profile-fields">
                  <div className="input-group">
                    <label htmlFor="site-select">Add/Link Site:</label>
                    <SearchableDropdown
                      id="site-select"
                      value={selectedSiteToLink}
                      options={allSites.map(site => site.name)}
                      onChange={setSelectedSiteToLink}
                      placeholder="Select a site to link"
                      disabled={loading}
                    />
                  </div>
                  <button
                    className="primary-button small-button"
                    onClick={handleAddSiteToProfile}
                    disabled={loading || !selectedSiteToLink}
                  >
                    <FaPlus className="button-icon" /> Link Selected Site
                  </button>

                  {profileSites.length > 0 ? (
                    <div className="linked-sites-list-container full-width-input">
                      <h4 className="sub-section-title">Currently Linked:</h4>
                      <ul className="linked-sites-list">
                        {profileSites.map(siteName => (
                          <li key={siteName} className="linked-site-item">
                            <span>{siteName}</span>
                            <button
                              className="remove-button"
                              onClick={() => handleRemoveSiteFromProfile(siteName)}
                              disabled={loading}
                            >
                              <FaTimes />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="no-sites-message">No sites linked yet. Add one above!</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <button className="logout-button" onClick={handleLogout} disabled={loading}>
          <FaSignOutAlt className="button-icon" /> Logout
        </button>
      </div>

      {showReauthModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Authentication Required</h3>
            <p>For your security, please enter your current password to continue with this action.</p>
            <input
              type="password"
              placeholder="Current Password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              className="input-field"
              disabled={loading}
              ref={reauthPasswordRef}
            />
            <div className="modal-actions">
              <button
                className="primary-button small-button"
                onClick={handleReauthenticate}
                disabled={loading}
              >
                Confirm
              </button>
              <button
                className="secondary-button small-button"
                onClick={() => {
                  setShowReauthModal(false);
                  setActionAfterReauth(null);
                  setReauthPassword("");
                  setNewEmail("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;