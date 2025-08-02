import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useParams } from "react-router-dom";

const UserLocationView = () => {
  const { userId } = useParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const q = query(
        collection(db, "attendance"),
        where("uid", "==", userId),
        orderBy("time", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(list);
    } catch (err) {
      console.error("❌ Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [userId]);

  return (
    <div className="p-6 bg-white rounded-xl shadow-xl min-h-screen">
      <h2 className="text-xl font-bold text-blue-800 mb-4 shadow-sm">
        📍 Location History
      </h2>

      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500 italic">No attendance records found.</p>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-4 bg-blue-50 rounded-lg shadow-sm transition hover:shadow-md"
            >
              <div className="font-semibold text-blue-900">
                {log.type === "in" ? "🟢 IN" : "🔴 OUT"} — {log.timeText || "--"}
              </div>
              <div className="text-sm text-gray-600">📆 {log.date}</div>
              <div className="text-sm text-gray-600">
                📍 {log.locationName || "Unknown Location"}
              </div>
              {log.latitude && log.longitude && (
                <a
                  href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 text-sm underline mt-1 inline-block"
                >
                  🌐 View on Google Maps
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserLocationView;
