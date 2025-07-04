import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const MyAttendancePage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userUid, setUserUid] = useState(null);

  useEffect(() => {
    // 🔐 Wait for auth to confirm user
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUserUid(user.uid);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!userUid) return;

      try {
        const q = query(
          collection(db, "attendance"),
          where("uid", "==", userUid),
          orderBy("time", "desc")
        );

        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setData(list);
      } catch (err) {
        console.error("❌ Attendance fetch error:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [userUid]);

  return (
    <div className="my-attendance-container">
  <h2 className="my-attendance-title">📌 My Attendance</h2>

  {loading ? (
    <p className="text-center text-gray-500">Loading...</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="my-attendance-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((rec) => (
              <tr key={rec.id}>
                <td>{rec.date}</td>
                <td>{rec.timeText || "--"}</td>
                <td>{rec.locationName || "Unknown"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="3" className="my-attendance-empty">
                No attendance records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )}
</div>

  );
};

export default MyAttendancePage;
