import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import "./AdminPanel.css";
import AttendanceList from "../components/attendance/AttendanceList";
import AdminGeofenceManager from "../components/attendance/AdminGeofenceManager";
import AddSiteForm from "../components/AddSiteForm";

const AdminPanel = () => {
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState(0);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/login");
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersCol = collection(db, "users");
        const userSnapshot = await getCountFromServer(usersCol);
        setUserCount(userSnapshot.data().count);

        const attendanceCol = collection(db, "attendance");
        const attendanceSnapshot = await getCountFromServer(attendanceCol);
        setAttendanceCount(attendanceSnapshot.data().count);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayQuery = query(
          collection(db, "attendance"),
          where("timestamp", ">=", today),
          where("type", "==", "in")
        );

        const todaySnapshot = await getDocs(todayQuery);
        setTodayAttendance(todaySnapshot.docs.map((doc) => doc.data()));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const presentCount = todayAttendance.length;
  const absentCount = Math.max(userCount - presentCount, 0);
  const presentPercentage = userCount ? (presentCount / userCount) * 100 : 0;
  const absentPercentage = userCount ? (absentCount / userCount) * 100 : 0;

  if (loading) {
    return (
      <div className="ios-container">
        <div className="ios-spinner"></div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <>
            <div className="ios-card">
              <h2 className="ios-card-title">Welcome, Admin 👋</h2>
              <p className="ios-card-subtitle">Real-time attendance monitoring system</p>

              <div className="ios-stats-grid">
                <div className="ios-stat-card">
                  <div className="ios-stat-value">{userCount}</div>
                  <div className="ios-stat-label">Registered Users</div>
                </div>
                <div className="ios-stat-card">
                  <div className="ios-stat-value">{attendanceCount}</div>
                  <div className="ios-stat-label">Total Records</div>
                </div>
                <div className="ios-stat-card">
                  <div className="ios-stat-value">{presentCount}</div>
                  <div className="ios-stat-label">Present Today</div>
                </div>
                <div className="ios-stat-card">
                  <div className="ios-stat-value">{absentCount}</div>
                  <div className="ios-stat-label">Absent Today</div>
                </div>
              </div>
            </div>

            <div className="ios-card">
              <h3 className="ios-card-title">Live Attendance Overview</h3>
              <div className="ios-attendance-chart">
                <div
                  className="ios-chart-bar present"
                  style={{ width: `${presentPercentage}%` }}
                >
                  {presentCount} IN
                </div>
                <div
                  className="ios-chart-bar absent"
                  style={{ width: `${absentPercentage}%` }}
                >
                  {absentCount} OUT
                </div>
              </div>
            </div>

            <div className="ios-card">
              <h3 className="ios-card-title">Recent Check-ins</h3>
              <AttendanceList adminView={true} limit={5} />
            </div>
          </>
        );
      case 'geofence':
        return <AdminGeofenceManager />;
      case 'attendance':
        return (
          <div className="ios-card">
            <h3 className="ios-card-title">All Attendance Records</h3>
            <AttendanceList adminView={true} />
          </div>
        );
      case 'site':
        return (
          <div className="ios-card">
            <h3 className="ios-card-title">Manage Sites</h3>
            <AddSiteForm />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="ios-container">
      <div className="ios-header">
        <img
          src="https://i.postimg.cc/prnnf7Qs/IMG-20250623-WA0000.jpg"
          alt="Logo"
          className="ios-header-logo"
          onClick={() => navigate("/")}
        />
        <h1 className="ios-header-title">Admin Panel</h1>
      </div>

      <div className="ios-tab-nav">
        <button
          className={`ios-tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <i className="fas fa-tachometer-alt"></i> Dashboard
        </button>
        <button
          className={`ios-tab-button ${activeTab === 'geofence' ? 'active' : ''}`}
          onClick={() => setActiveTab('geofence')}
        >
          <i className="fas fa-map-marked-alt"></i> Geofence
        </button>
        <button
          className={`ios-tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          <i className="fas fa-clipboard-list"></i> Attendance
        </button>
        <button
          className={`ios-tab-button ${activeTab === 'site' ? 'active' : ''}`}
          onClick={() => setActiveTab('site')}
        >
          <i className="fas fa-warehouse"></i> Sites
        </button>
        <button
          className="ios-tab-button"
          onClick={() => navigate("/dashboard")}
        >
          <i className="fas fa-chart-line"></i> Main Dashboard
        </button>
        <button
          className="ios-tab-button"
          onClick={() => navigate("/admin/add-user")}
        >
          <i className="fas fa-user-plus"></i> Add User
        </button>
      </div>

      {renderTabContent()}
    </div>
  );
};

export default AdminPanel;
