import React, { useEffect, useState } from 'react';
import { 
  manualAttendanceOverride, 
  getGeoZones,
  watchAttendance,
  getUserAttendance
} from '../../services/attendanceService';
import { getCurrentUser } from '../../services/authService';
import './StatusIndicator.css';
import { toast } from 'react-toastify';

export default function StatusIndicator() {
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [manualLoading, setManualLoading] = useState(false);
  const [error, setError] = useState('');
  const [geozones, setGeozones] = useState([]);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const user = getCurrentUser();
        if (!user) return;
        
        const attendanceRecords = await getUserAttendance(user.uid);
        if (attendanceRecords.length > 0) {
          const latestRecord = attendanceRecords[0];
          setStatus({
            status: latestRecord.action === 'in' ? 'in' : 'out',
            entryTime: latestRecord.timestamp
          });
        }
        
        const zones = await getGeoZones();
        setGeozones(zones);
      } catch (error) {
        console.error('Error loading status:', error);
      }
      setLoading(false);
    };
    
    loadStatus();
    
    const user = getCurrentUser();
    if (user) {
      const unsubscribe = watchAttendance((records) => {
        const userRecords = records.filter(r => r.userId === user.uid);
        if (userRecords.length > 0) {
          const latestRecord = userRecords[0];
          setStatus({
            status: latestRecord.action === 'in' ? 'in' : 'out',
            entryTime: latestRecord.timestamp
          });
        }
      });
      
      return () => unsubscribe();
    }
  }, []);

  const handleManualAttendance = async (action) => {
    setManualLoading(true);
    setError('');

    try {
      const user = getCurrentUser();
      if (!user) throw new Error('User not logged in');

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      if (geozones.length === 0) {
        toast.error('No geozones available.');
        return;
      }

      const geozone = geozones[0];

      await manualAttendanceOverride(
        user.uid,
        action,
        geozone,
        location,
        status
      );

      const attendanceRecords = await getUserAttendance(user.uid);
      if (attendanceRecords.length > 0) {
        const latestRecord = attendanceRecords[0];
        setStatus({
          status: latestRecord.action === 'in' ? 'in' : 'out',
          entryTime: latestRecord.timestamp
        });
      }

    } catch (err) {
      toast.error(err.message || 'Attendance failed');
    } finally {
      setManualLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ios-card">
        <div className="ios-spinner-container">
          <div className="ios-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="ios-card">
      <h3 className="ios-card-title">Current Attendance Status</h3>
      
      {error && (
        <div className="ios-alert danger">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}
      
      {status.status === 'in' ? (
        <div className="ios-status in">
          <div className="status-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="status-content">
            <h4>CHECKED IN</h4>
            <p>
              Since: {status.entryTime ? new Date(status.entryTime).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
        </div>
      ) : (
        <div className="ios-status out">
          <div className="status-icon">
            <i className="fas fa-times-circle"></i>
          </div>
          <div className="status-content">
            <h4>CHECKED OUT</h4>
            <p>Not in designated area</p>
          </div>
        </div>
      )}
      
      <div className="ios-button-group">
        <button 
          className={`ios-button success ${manualLoading ? 'loading' : ''}`}
          onClick={() => handleManualAttendance('in')}
          disabled={manualLoading || status?.status === 'in'}
        >
          {manualLoading ? (
            <span className="ios-spinner small"></span>
          ) : (
            <>
              <i className="fas fa-sign-in-alt"></i> Mark IN
            </>
          )}
        </button>
        <button 
          className={`ios-button danger ${manualLoading ? 'loading' : ''}`}
          onClick={() => handleManualAttendance('out')}
          disabled={manualLoading || status?.status !== 'in'}
        >
          {manualLoading ? (
            <span className="ios-spinner small"></span>
          ) : (
            <>
              <i className="fas fa-sign-out-alt"></i> Mark OUT
            </>
          )}
        </button>
      </div>
      
      <div className="ios-card-footer">
        <i className="fas fa-info-circle"></i>
        Manual override is for emergency use only
      </div>
    </div>
  );
}