import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const AdminUserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchLatestEntries = async () => {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "users"));
    const userList = [];

    for (let docSnap of snapshot.docs) {
      const user = docSnap.data();
      const userId = docSnap.id;

      // ✅ Get only this user's latest attendance
      const attQuery = query(
        collection(db, "attendance"),
        where("uid", "==", userId),
        orderBy("time", "desc"),
        limit(1)
      );
      const attSnap = await getDocs(attQuery);
      const latest = attSnap.docs[0];

      userList.push({
        id: userId,
        name: user.name || "Unnamed",
        latestLoc: latest?.data()?.locationName || "No Data",
        time: latest?.data()?.timeText || "--",
      });
    }

    setUsers(userList);
    setLoading(false);
  };

  useEffect(() => {
    fetchLatestEntries();
  }, []);

  return (
    <div className="p-6 bg-white rounded-xl shadow-xl">
      <h2 className="text-xl font-bold text-blue-700 mb-4">👥 All Users</h2>
      {loading ? (
        <p className="text-gray-600">Loading users...</p>
      ) : (
        <ul className="space-y-4">
          {users.map((user) => (
            <li
              key={user.id}
              className="p-4 bg-gray-100 rounded-lg hover:bg-blue-50 cursor-pointer"
              onClick={() => navigate(`/admin/user-location/${user.id}`)}
            >
              <div className="font-semibold text-blue-900">{user.name}</div>
              <div className="text-sm text-gray-600">
                📍 {user.latestLoc} — 🕒 {user.time}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminUserList;
