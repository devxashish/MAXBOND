// App.js
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import ADMIN_EMAILS from "./constants/adminEmails";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// ✅ Component Imports
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import AttendancePage from "./pages/AttendancePage";
import AdminPanel from "./components/AdminPanel";
import AddUserForm from "./components/AddUserForm";
import ExpensePage from "./components/ExpensePage";
import ProfilePage from "./components/ProfilePage";
import ReportsPage from "./pages/ReportsPage";
import ExportPage from "./pages/ExportPage";
import TransactionsPage from "./pages/TransactionsPage";
import ExternalPaymentsPage from "./pages/ExternalPaymentsPage";
import DailyReport from "./pages/DailyReport";
import WeeklyReport from "./pages/WeeklyReport";
import MonthlyReportPage from "./pages/MonthlyReportPage";
import SiteList from "./components/SiteList";
import AddSiteForm from "./components/AddSiteForm";
import MainPage from "./components/MainPage";
import AdminAttendancePage from "./pages/AdminAttendancePage";
import AdminUserList from "./pages/AdminUserList";
import UserLocationView from "./pages/UserLocationView";
import SiteStockPage from "./components/SiteStockPage"; // make sure path is correct



// ✅ Admin email set
const adminEmailSet = new Set(ADMIN_EMAILS);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Firebase auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("✅ Firebase Auth Triggered:", currentUser);
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ✅ While Firebase is loading, show a loader
  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
      }}>
        🔄 Loading... Please wait.
      </div>
    );
  }

  return (
    <Router>
      <ToastContainer position="top-center" autoClose={3000} />
      <Routes>

        {/* ✅ Smart redirect on "/" route */}
        <Route
          path="/"
          element={
            user
              ? adminEmailSet.has(user.email)
                ? <Navigate to="/admin" replace />
                : <Navigate to="/dashboard" replace />
              : <Navigate to="/login" replace />
          }
        />
        <Route path="/dashboard/site-stock" element={<SiteStockPage />} />

        {/* 🔓 Public */}
        <Route path="/login" element={<Login />} />

        {/* 🔐 Admin Routes */}
        <Route
          path="/admin"
          element={user && adminEmailSet.has(user.email) ? <AdminPanel /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin/add-user"
          element={user && adminEmailSet.has(user.email) ? <AddUserForm /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin/add-site"
          element={user && adminEmailSet.has(user.email) ? <AddSiteForm /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin-attendance"
          element={user && adminEmailSet.has(user.email) ? <AdminAttendancePage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin/users"
          element={user && adminEmailSet.has(user.email) ? <AdminUserList /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin/location/:userId"
          element={user && adminEmailSet.has(user.email) ? <UserLocationView /> : <Navigate to="/login" replace />}
        />

        {/* 🔐 User Routes */}
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/reports" element={user ? <ReportsPage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/profile" element={user ? <ProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/expense" element={user ? <ExpensePage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/export" element={user ? <ExportPage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/transactions" element={user ? <TransactionsPage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/external-payments" element={user ? <ExternalPaymentsPage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/main" element={user ? <MainPage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/daily-report" element={user ? <DailyReport /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/weekly-report" element={user ? <WeeklyReport /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/monthly-report" element={user ? <MonthlyReportPage /> : <Navigate to="/login" replace />} />

        {/* ✅ Attendance - Open to all logged-in users */}
        <Route path="/attendance" element={<AttendancePage />} />

        {/* ❌ 404 fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
