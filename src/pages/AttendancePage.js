import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ADMIN_EMAILS from "../constants/adminEmails";
import { getCurrentUser } from "../services/authService";
import { getGeoZones, startTracking, stopTracking } from "../services/attendanceService";

import StatusIndicator from "../components/attendance/StatusIndicator";
import TrackingToggle from "../components/attendance/TrackingToggle";
import GeoZoneForm from "../components/attendance/GeoZoneForm";
import GeoZoneManager from "../components/attendance/GeoZoneManager";
import AttendanceList from "../components/attendance/AttendanceList";
import MyStatusMap from "../components/attendance/MyStatusMap";
import ManualAttendanceButton from "../components/attendance/ManualAttendanceButton";
import AdminLivePreview from "../components/attendance/AdminLivePreview";

import "./AttendancePage.css";

export default function AttendancePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('status');
  const [geozones, setGeozones] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);

  useEffect(() => {
    const current = getCurrentUser();

    if (!current) {
      navigate("/login");
    } else {
      setUser(current);
      const adminStatus = ADMIN_EMAILS.includes(current.email);
      setIsAdmin(adminStatus);

      const loadGeozones = async () => {
        try {
          const zones = await getGeoZones();
          setGeozones(zones || []);
        } catch (err) {
          console.error("Error loading geo zones:", err);
          setGeozones([]);
        }
      };
      loadGeozones();
    }

    return () => {
      if (current) {
        stopTracking();
      }
    };
  }, [navigate]);

  useEffect(() => {
    if (user && !isAdmin && geozones.length > 0) {
      startTracking(user.uid, geozones);
    }
  }, [user, geozones, isAdmin]);

  if (!user) {
    return (
      <div className="ios-container">
        <div className="ios-spinner"></div>
        <p>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="ios-container">
      <h1 className="ios-page-title">Attendance System</h1>

      {/* Tab Navigation */}
      <div className="ios-segmented-control">
        <button
          className={activeTab === 'status' ? 'active' : ''}
          onClick={() => setActiveTab('status')}
        >
          My Status
        </button>
        {isAdmin && (
          <>
            <button
              className={activeTab === 'geozones' ? 'active' : ''}
              onClick={() => setActiveTab('geozones')}
            >
              Zones
            </button>
            <button
              className={activeTab === 'attendance' ? 'active' : ''}
              onClick={() => setActiveTab('attendance')}
            >
              Records
            </button>
            <button
              className={activeTab === 'live' ? 'active' : ''}
              onClick={() => setActiveTab('live')}
            >
              Live View
            </button>
          </>
        )}
      </div>

      <div className="ios-content">
        {activeTab === 'status' && (
          <>
            <StatusIndicator onStatusChange={setCurrentStatus} />
            <TrackingToggle />
            <MyStatusMap />
            <ManualAttendanceButton currentStatus={currentStatus} geozones={geozones} />
            <AttendanceList adminView={isAdmin} />
          </>
        )}

        {isAdmin && activeTab === 'geozones' && (
          <>
            <GeoZoneForm />
            <GeoZoneManager />
          </>
        )}

        {isAdmin && activeTab === 'attendance' && (
          <AttendanceList adminView={true} />
        )}

        {isAdmin && activeTab === 'live' && (
          <AdminLivePreview />
        )}
      </div>
    </div>
  );
}