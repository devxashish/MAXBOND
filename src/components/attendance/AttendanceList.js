import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import './AttendanceList.css';

export default function AttendanceList({ adminView = false, showAll = false, limit: itemsLimit }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error("User not logged in");
        }

        let attendanceQuery;

        if (adminView || showAll) {
          attendanceQuery = query(
            collection(db, 'attendance'),
            orderBy('timestamp', 'desc')
          );
        } else {
          attendanceQuery = query(
            collection(db, 'attendance'),
            where('userId', '==', currentUser.uid),
            orderBy('timestamp', 'desc')
          );
        }

        if (itemsLimit) {
          attendanceQuery = query(attendanceQuery, limit(itemsLimit));
        }

        const snapshot = await getDocs(attendanceQuery);
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRecords(items);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch attendance");
      }
      setLoading(false);
    };

    fetchAttendance();
  }, [adminView, showAll, itemsLimit]);

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
      <h3 className="ios-card-title">
        {adminView ? "All Attendance Records" : "Your Attendance History"}
      </h3>

      {error && (
        <div className="ios-alert danger">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}

      {records.length === 0 ? (
        <div className="ios-alert info">
          <i className="fas fa-info-circle"></i>
          No attendance records found
        </div>
      ) : (
        <div className="ios-table-container">
          <table className="ios-table">
            <thead>
              <tr>
                {adminView && <th>User</th>}
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const timestamp = record.timestamp?.toDate?.();
                const dateStr = timestamp ? format(timestamp, 'yyyy-MM-dd') : 'N/A';
                const timeStr = timestamp ? format(timestamp, 'hh:mm a') : 'N/A';
                return (
                  <tr key={record.id}>
                    {adminView && <td>{record.userName || 'Unknown'}</td>}
                    <td>{dateStr}</td>
                    <td>{timeStr}</td>
                    <td>
                      <span className={`ios-badge ${record.type === 'in' ? 'success' : 'danger'}`}>
                        {record.type?.toUpperCase()}
                      </span>
                    </td>
                    <td>{record.geoZoneName || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}