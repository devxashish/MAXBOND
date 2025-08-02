import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

import styles from "./AdminPanel.module.css"; // CSS Modules import
import AddUserForm from "../components/AddUserForm";
import AdminUserList from "../pages/AdminUserList";
import ManageUsersPage from "../pages/ManageUsersPage";
import ManageRolesPage from "../pages/ManageRolesPage";
import SendNotificationsPage from "../pages/SendNotificationsPage"; // NEW IMPORT: For the new tab

const AdminPanel = () => {
  const navigate = useNavigate();
  // Set initial active tab to 'send-notifications' as requested
  const [activeTab, setActiveTab] = useState("send-notifications");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Redirect to login if no user is authenticated
      if (!user) {
        navigate("/login");
      }
      // Optional: Add server-side admin role check here if needed for security
      // For example, fetch user's roles from Firestore 'users' collection
      // and redirect if not admin.
    });
    return () => unsubscribe();
  }, [navigate]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "add-user":
        return (
          <>
            <h3 className={styles.cardTitle}>
              <span role="img" aria-label="user-plus">➕</span> Add New User
            </h3>
            <AddUserForm />
          </>
        );
      case "users-list":
        return (
          <>
            <h3 className={styles.cardTitle}>
              <span role="img" aria="users">👥</span> Users List & Attendance
            </h3>
            <AdminUserList />
          </>
        );
      case "manage-users":
        return (
          <>
            <h3 className={styles.cardTitle}>
              <span role="img" aria-label="settings">🔧</span> Manage Existing Users
            </h3>
            <ManageUsersPage />
          </>
        );
      case "manage-roles":
        return (
          <>
            <h3 className={styles.cardTitle}>
              <span role="img" aria-label="gear">⚙️</span> Manage User Roles
            </h3>
            <ManageRolesPage />
          </>
        );
      case "send-notifications": // NEW CASE FOR NOTIFICATION PAGE
        return (
          <>
            <h3 className={styles.cardTitle}>
              <span role="img" aria-label="megaphone">📢</span> Send Notifications & Alerts
            </h3>
            <SendNotificationsPage />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.adminPanelContainer}>
      {/* REMOVED: Background Video Element */}
      {/* REMOVED: Overlay for dimming/blurring the video */}

      <div className={styles.header}>
        <h1 className={styles.headerTitle}>
          Admin Panel
          <span className={styles.headerFlare}>🔥</span>
        </h1>
        {/* Decorative elements for the Demon Slayer theme */}
        <div className={styles.headerBladeLeft}></div>
        <div className={styles.headerBladeRight}></div>
      </div>

      <div className={styles.tabNav}>
        <button
          className={`${styles.tabButton} ${activeTab === "add-user" ? styles.active : ""}`}
          onClick={() => setActiveTab("add-user")}
        >
          <span className={styles.tabIcon}>👤</span> Add User
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "users-list" ? styles.active : ""}`}
          onClick={() => setActiveTab("users-list")}
        >
          <span className={styles.tabIcon}>👥</span> Users List
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "manage-users" ? styles.active : ""}`}
          onClick={() => setActiveTab("manage-users")}
        >
          <span className={styles.tabIcon}>🔧</span> Manage Users
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "manage-roles" ? styles.active : ""}`}
          onClick={() => setActiveTab("manage-roles")}
        >
          <span className={styles.tabIcon}>⚙️</span> Manage Roles
        </button>
        {/* NEW TAB BUTTON */}
        <button
          className={`${styles.tabButton} ${activeTab === "send-notifications" ? styles.active : ""}`}
          onClick={() => setActiveTab("send-notifications")}
        >
          <span className={styles.tabIcon}>📧</span> Send Notifications
        </button>
        <button
          className={styles.tabButton}
          onClick={() => navigate("/home")}
        >
          <span className={styles.tabIcon}>📊</span> Dashboard
        </button>
      </div>

      <div className={styles.contentArea}>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AdminPanel;