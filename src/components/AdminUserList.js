import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "../styles/AdminUserList.css";

const AdminUserList = () => {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  const fetchLatestEntries = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    const userList = [];

    for (let docSnap of snapshot.docs) {
      const user = docSnap.data();
      const userId = docSnap.id;

      // Get latest attendance for each user
      const attQuery = query(
        collection(db, "attendance"),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const attSnap = await getDocs(attQuery);
      const latest = attSnap.docs.find(d => d.data().uid === userId);

      userList.push({
        id: userId,
        name: user.name || "Unnamed",
        latestLoc: latest?.data()?.locationName || "No Data",
        time: latest?.data()?.timeText || "--",
      });
    }

    setUsers(userList);
  };

  useEffect(() => {
    fetchLatestEntries();
  }, []);

  return (
   <div className="admin-user-list">
  <h2>👥 All Users</h2>
  <ul>
    {users.map((user) => (
      <li
        key={user.id}
        className="user-list-item"
        onClick={() => navigate(`/admin/location/${user.id}`)}
      >
        <div className="name">{user.name}</div>
        <div className="details">
          📍 {user.latestLoc} — 🕒 {user.time}
        </div>
      </li>
    ))}
  </ul>
</div>

  );
};

export default AdminUserList;
