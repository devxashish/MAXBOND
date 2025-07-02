import React, { useState } from 'react';
import { manualAttendanceOverride } from '../../services/attendanceService';
import { getCurrentUser } from '../../services/authService';
import { toast } from 'react-toastify';
import './ManualAttendanceButton.css';

export default function ManualAttendanceButton({ currentStatus, geozones }) {
  const [loading, setLoading] = useState(false);
  
  const handleManualAttendance = async (action) => {
    setLoading(true);
    
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('User not logged in');
      
      // Get current position
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });
      
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      if (!geozones || geozones.length === 0) {
        throw new Error('No geo-zones defined');
      }
      
      const nearestZone = geozones[0]; // In a real app, find nearest zone
      
      await manualAttendanceOverride(
        user.uid,
        action,
        nearestZone,
        location,
        currentStatus
      );
      
      toast.success(`Successfully marked ${action.toUpperCase()}`);
    } catch (err) {
      console.error('Manual attendance error:', err);
      toast.error(err.message || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ios-card">
      <h3 className="ios-card-title">Manual Attendance</h3>
      
      <div className="ios-button-group">
        <button
          className={`ios-button primary ${loading ? 'loading' : ''}`}
          onClick={() => handleManualAttendance('in')}
          disabled={loading || currentStatus?.status === 'in'}
        >
          {loading ? (
            <span className="ios-spinner small"></span>
          ) : (
            <>
              <i className="fas fa-sign-in-alt"></i> Check In
            </>
          )}
        </button>
        
        <button
          className={`ios-button danger ${loading ? 'loading' : ''}`}
          onClick={() => handleManualAttendance('out')}
          disabled={loading || currentStatus?.status !== 'in'}
        >
          {loading ? (
            <span className="ios-spinner small"></span>
          ) : (
            <>
              <i className="fas fa-sign-out-alt"></i> Check Out
            </>
          )}
        </button>
      </div>
      
      <div className="ios-card-footer">
        <i className="fas fa-info-circle"></i>
        Use only when automatic detection fails
      </div>
    </div>
  );
}