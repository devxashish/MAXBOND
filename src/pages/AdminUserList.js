import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
} from "firebase/firestore"; // Removed query, orderBy, limit, where as not needed for initial user list fetch
import { useNavigate } from "react-router-dom";
import styles from "./AdminUserList.module.css"; // Import CSS Module

// A simple SVG icon for a user (can be customized further for anime style)
const UserIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={styles.userIcon} // Apply CSS module class
  >
    <path
      fillRule="evenodd"
      d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.623 18.623 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
      clipRule="evenodd"
    />
  </svg>
);

const AdminUserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchUsers = async () => { // Renamed function
    setLoading(true);
    setError(null);
    const userList = [];

    try {
      // Fetch all users
      const usersSnapshot = await getDocs(collection(db, "users"));

      if (usersSnapshot.empty) {
        setError("No users found in the database.");
        setLoading(false);
        return;
      }

      for (let docSnap of usersSnapshot.docs) {
        const user = docSnap.data();
        const userId = docSnap.id;

        userList.push({
          id: userId,
          name: user.name || "Unnamed User", // Ensure a fallback name
          // Removed latestLoc and time as they are not shown in this list anymore
        });
      }
      setUsers(userList);
    } catch (err) {
      console.error("Error fetching users for AdminUserList:", err);
      // More specific error message for the user, reflecting potential rule issue
      setError("Failed to load users. Please ensure you are logged in and have read permissions for the 'users' collection. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    // The main container for AdminUserList content.
    // It will inherit background/transparency from AdminPanel's contentArea.
    <div className={styles.adminUserListContent}>
      {/* Title is typically handled by AdminPanel's cardTitle, but keeping it here for context if standalone */}
      {/* <h2 className={styles.pageTitle}>
        <span role="img" aria-label="stars">🌟</span>
        <span>All Users List</span>
        <span role="img" aria-label="stars">🌟</span>
      </h2> */}

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading user data...</p>
        </div>
      ) : error ? (
        <div className={styles.errorState}>
          <p className={styles.errorMessageTitle}>Oops! An Error Occurred!</p>
          <p>{error}</p>
          <button onClick={fetchUsers} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className={styles.noUsersState}>
          <p className={styles.noUsersTitle}>No Users Found!</p>
          <p>No registered users in the database.</p>
        </div>
      ) : (
        <ul className={styles.userList}>
          {users.map((user) => (
            <li
              key={user.id}
              className={styles.userListItem}
              // Navigating to a user's attendance list
              onClick={() => navigate(`/admin/user-attendance/${user.id}`)}
            >
              <div className={styles.listItemBackground}></div> {/* Decorative background */}
              <div className={styles.listItemContent}>
                <div className={styles.userIconWrapper}>
                  <UserIcon />
                </div>
                <div className={styles.userName}>{user.name}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminUserList;