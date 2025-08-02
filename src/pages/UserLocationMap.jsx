import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import styles from "./UserLocationMap.module.css"; // Import CSS Module

// A simple SVG icon for a list item
const AttendanceEntryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.attendanceIcon}>
    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z" clipRule="evenodd" />
  </svg>
);


const UserLocationMap = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [allAttendanceData, setAllAttendanceData] = useState([]); // Array to store all attendance data
  const [userName, setUserName] = useState("Loading User...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserDataAndAttendance = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch user's name
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          setUserName(userDocSnap.data().name || "Unknown User");
        } else {
          setUserName("User Not Found");
        }

        // 2. Fetch ALL user's attendance records
        const attQuery = query(
          collection(db, "attendance"),
          where("uid", "==", userId),
          orderBy("time", "desc") // Order by time descending (latest first)
        );
        const attSnap = await getDocs(attQuery);

        if (!attSnap.empty) {
          const records = attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAllAttendanceData(records);
        } else {
          setError("No attendance records found for this user.");
        }
      } catch (err) {
        console.error("Error fetching user data or attendance for UserLocationMap:", err);
        setError("Failed to load user attendance. Please ensure you are logged in and have read permissions for 'users' and 'attendance' collections. Try again.");
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserDataAndAttendance();
    }
  }, [userId]);

  const handleAttendanceClick = (attendanceId) => {
    navigate(`/admin/single-location/${attendanceId}`);
  };

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading user attendance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.errorState}>
          <p className={styles.errorMessageTitle}>Error!</p>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (allAttendanceData.length === 0) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.noDataState}>
          <p className={styles.noDataTitle}>No Attendance Data!</p>
          <p>No attendance records found for {userName}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.container}>
        <h2 className={styles.pageTitle}>
          <span role="img" aria-label="sparkles">✨</span>
          <span>Attendance for <span className={styles.userNameHighlight}>{userName}</span></span>
          <span role="img" aria-label="sparkles">✨</span>
        </h2>

        <div className={styles.summaryBox}>
          <p className={styles.summaryText}>Total entries: <span className={styles.summaryCount}>{allAttendanceData.length}</span></p>
        </div>

        <ul className={styles.attendanceList}>
          {allAttendanceData.map((record) => (
            <li
              key={record.id}
              className={styles.attendanceListItem}
              onClick={() => handleAttendanceClick(record.id)}
            >
              <div className={styles.listItemBackground}></div>
              <div className={styles.listItemContent}>
                <div className={styles.attendanceIconWrapper}>
                  <AttendanceEntryIcon />
                </div>
                <div>
                  <div className={styles.recordLocation}>{record.locationName || "N/A"}</div>
                  <div className={styles.recordTime}>Time: {record.timeText || "--"}</div>
                  <div className={styles.recordId}>ID: {record.id}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UserLocationMap;