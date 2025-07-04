import React, { useEffect, useState } from "react";
import AttendanceTable from "../components/attendance/AttendanceTable";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import "../styles/AdminAttendancePage.css";

const AdminAttendancePage = () => {
  const [records, setRecords] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchDate, setSearchDate] = useState("");

  const fetchAttendance = async () => {
    const attendanceQuery = query(collection(db, "attendance"), orderBy("time", "desc"));
    const attendanceSnap = await getDocs(attendanceQuery);
    const attendanceData = attendanceSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const usersSnap = await getDocs(collection(db, "users"));
    const users = {};
    usersSnap.docs.forEach((doc) => {
      users[doc.id] = doc.data().name || "Unknown";
    });

    const enrichedData = attendanceData.map((item) => ({
      ...item,
      userName: users[item.uid] || item.uid,
    }));

    setRecords(enrichedData);
    setFiltered(enrichedData);
  };

  const filterByDate = (dateStr) => {
    setSearchDate(dateStr);
    if (!dateStr) return setFiltered(records);
    setFiltered(records.filter((rec) => rec.date === dateStr));
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  return (
    <div className="admin-attendance-page">
      <div className="admin-attendance-header">
        <h1 className="admin-attendance-title">📊 Attendance Records</h1>
        <input
          type="date"
          value={searchDate}
          onChange={(e) => filterByDate(e.target.value)}
          className="admin-attendance-date-input"
        />
      </div>

      <AttendanceTable data={filtered} />
    </div>
  );
};

export default AdminAttendancePage;
