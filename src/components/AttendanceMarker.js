import React, { useState, useEffect } from "react";
import { auth, db, Timestamp } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { getAddressFromCoords } from "../utils/getAddressFromCoords";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "../styles/AttendanceMarker.css";

const AttendanceMarker = () => {
  const [status, setStatus] = useState("📍 Ready to mark IN or OUT");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);

  const fetchTodayEntries = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];
    const q = query(
      collection(db, "attendance"),
      where("uid", "==", user.uid),
      where("date", "==", today),
      orderBy("timestamp", "desc")
    );

    const snap = await getDocs(q);
    const list = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setEntries(list);
  };

  const markAttendance = async (type) => {
    setLoading(true);
    setStatus("📡 Fetching your location...");

    try {
      if (!navigator.geolocation) {
        setStatus("❌ Geolocation not supported.");
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const locationName = await getAddressFromCoords(latitude, longitude);

          const user = auth.currentUser;
          if (!user) {
            setStatus("⚠️ User not logged in.");
            setLoading(false);
            return;
          }

          const timeNow = new Date().toLocaleTimeString("en-IN");
          const today = new Date().toISOString().split("T")[0];

          await addDoc(collection(db, "attendance"), {
            uid: user.uid,
            date: today,
            timestamp: Timestamp.now(),
            type,
            timeText: timeNow,
            latitude,
            longitude,
            locationName,
          });

          setStatus(`✅ Marked ${type.toUpperCase()} at ${locationName}`);
          fetchTodayEntries();
        },
        (err) => {
          console.error("Location error:", err);
          setStatus("❌ Location access denied.");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } catch (error) {
      console.error("Attendance Error:", error);
      setStatus("❌ Error marking attendance.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportToPDF = () => {
    const doc = new jsPDF();
    doc.text("📊 Attendance Timeline", 14, 16);

    const tableData = entries.map((entry, i) => [
      i + 1,
      `${entry.date} ${entry.timeText || "--"}`,
      entry.type.toUpperCase(),
      entry.locationName || "--",
    ]);

    autoTable(doc, {
      head: [["#", "Date & Time", "Type", "Location"]],
      body: tableData,
      startY: 22,
    });

    doc.save("attendance-log.pdf");
  };

  useEffect(() => {
    fetchTodayEntries();
  }, []);

  return (
    <div className="attendance-container">
      <h1 className="attendance-title">🕒 Mark IN / OUT Anytime</h1>

      <div className="attendance-buttons">
        <button
          onClick={() => markAttendance("in")}
          disabled={loading}
          className="btn-in"
        >
          {loading ? "Marking..." : "📥 Mark IN"}
        </button>

        <button
          onClick={() => markAttendance("out")}
          disabled={loading}
          className="btn-out"
        >
          {loading ? "Marking..." : "📤 Mark OUT"}
        </button>
      </div>

      <button onClick={handleExportToPDF} className="btn-export">
        📄 Export to PDF
      </button>

      <p className="status-text">{status}</p>

      <div className="timeline-container">
        <h2 className="timeline-header">📊 Today’s Attendance Timeline</h2>
        {entries.length === 0 ? (
          <p className="empty-message">No entries marked yet.</p>
        ) : (
          <ul className="timeline-list">
            {entries.map((entry) => (
              <li key={entry.id} className="timeline-entry">
                <div className="entry-type">
                  {entry.type === "in" ? "🟢 IN" : "🔴 OUT"} —{" "}
                  {entry.timeText || "--"}
                </div>
                <div className="entry-location">
                  📍 {entry.locationName || "Unknown"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AttendanceMarker;
