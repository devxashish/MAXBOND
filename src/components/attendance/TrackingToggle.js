import React, { useEffect, useState } from 'react';
import {
  initAttendanceTracking,
  stopTracking,
  isTrackingActive
} from '../../services/attendanceService';
import './TrackingToggle.css';

export default function TrackingToggle() {
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        const active = await isTrackingActive();
        setTracking(active);
      } catch (error) {
        console.error('Error initializing tracker:', error);
      }
      setLoading(false);
    };

    initialize();
  }, []);

  const toggleTracking = async () => {
    setLoading(true);
    try {
      const newState = !tracking;
      if (newState) {
        await initAttendanceTracking();
      } else {
        await stopTracking();
      }
      setTracking(newState);
    } catch (error) {
      console.error('Failed to toggle tracking:', error);
    }
    setLoading(false);
  };

  return (
    <div className="ios-card">
      <h3 className="ios-card-title">Location Tracking</h3>

      {loading ? (
        <div className="ios-spinner-container">
          <div className="ios-spinner"></div>
        </div>
      ) : (
        <div className="ios-toggle">
          <label>
            <input
              type="checkbox"
              checked={tracking}
              onChange={toggleTracking}
            />
            <span className="ios-toggle-slider"></span>
            <span className="ios-toggle-label">
              {tracking ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </label>
        </div>
      )}

      <div className="ios-card-footer">
        <i className="fas fa-info-circle"></i>
        When active, your attendance will update automatically
      </div>
    </div>
  );
}