import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

import "./AdminPanel.css";
import AddSiteForm from "../components/AddSiteForm";
import AddUserForm from "../components/AddUserForm";
import AdminAttendancePage from "../pages/AdminAttendancePage";
import AdminUserList from "../pages/AdminUserList"; // 👥 Added
import ExportToExcelPage from "../pages/ExportToExcelPage"; // 📤 Added

const AdminPanel = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("add-user");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "site":
        return (
          <div className="ios-card">
            <h3 className="ios-card-title">🏗️ Manage Sites</h3>
            <AddSiteForm />
          </div>
        );
      case "add-user":
        return (
          <div className="ios-card">
            <h3 className="ios-card-title">👤 Add User</h3>
            <AddUserForm />
          </div>
        );
      case "attendance":
        return (
          <div className="ios-card">
            <h3 className="ios-card-title">📍 Attendance Records</h3>
            <AdminAttendancePage />
          </div>
        );
      case "users":
        return (
          <div className="ios-card">
            <h3 className="ios-card-title">👥 All Users & Live Locations</h3>
            <AdminUserList />
          </div>
        );
      case "export":
        return (
          <div className="ios-card">
            <h3 className="ios-card-title">📤 Export Attendance to Excel</h3>
            <ExportToExcelPage />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="ios-container bg-white/80 backdrop-blur-lg shadow-inner rounded-xl p-4 min-h-screen">
      <div className="ios-header">
        <h1 className="ios-header-title text-blue-800 font-bold drop-shadow">
          Admin Panel
        </h1>
      </div>

      <div className="ios-tab-nav">
        <button
          className={`ios-tab-button ${activeTab === "site" ? "active" : ""}`}
          onClick={() => setActiveTab("site")}
        >
          🏗️ Sites
        </button>
        <button
          className={`ios-tab-button ${activeTab === "add-user" ? "active" : ""}`}
          onClick={() => setActiveTab("add-user")}
        >
          👤 Add User
        </button>
        <button
          className={`ios-tab-button ${activeTab === "attendance" ? "active" : ""}`}
          onClick={() => setActiveTab("attendance")}
        >
          📅 Attendance
        </button>
        <button
          className={`ios-tab-button ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          👥 Users
        </button>
        <button
          className={`ios-tab-button ${activeTab === "export" ? "active" : ""}`}
          onClick={() => setActiveTab("export")}
        >
          📤 Export
        </button>
        <button
          className="ios-tab-button"
          onClick={() => navigate("/dashboard")}
        >
          📊 Dashboard
        </button>
      </div>

      {renderTabContent()}
    </div>
  );
};

export default AdminPanel;
