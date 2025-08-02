// src/App.js
import React, { useState, useEffect, useMemo } from "react"; // Added useMemo
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, app } from "./firebase"; // Import 'app' from firebase.js
import { getMessaging, getToken, onMessage } from "firebase/messaging"; // Import getMessaging, getToken, onMessage
import ADMIN_EMAILS from "./constants/adminEmails"; // Assuming this file exists and contains admin emails

// Material-UI Imports
import {
    ThemeProvider as MuiThemeProvider,
    createTheme,
    CssBaseline,
    CircularProgress
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// Custom Contexts and Components
import { ThemeProvider } from './contexts/ThemeContext';
import Signup from './components/Signup';
import useAppUpdateCheck from './hooks/useAppUpdateCheck';
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import HomePage from "./components/HomePage";
import AttendancePage from "./pages/AttendancePage";
import AdminPanel from "./components/AdminPanel";
import ExpensePage from "./components/ExpensePage";
import ProfilePage from "./components/ProfilePage";
import ReportsPage from "./pages/ReportsPage";
import ExportPage from "./pages/ExportPage";
import TransactionsPage from "./pages/TransactionsPage";
import ExternalPaymentsPage from "./pages/ExternalPaymentsPage";
import DailyReport from "./pages/DailyReport";
import WeeklyReport from "./pages/WeeklyReport";
import MonthlyReportPage from "./pages/MonthlyReportPage";
import MainPage from "./components/MainPage";
import ReceivedUsedPage from "./pages/ReceivedUsedPage";
import SummaryPage from "./pages/SummaryPage";
import DetailsPage from "./pages/DetailsPage";
import FuelEntryPage from './pages/FuelEntryPage';

import { ToastProvider } from './components/Toast';
import SingleLocationMap from "./pages/SingleLocationMap";
import UserLocationMap from "./pages/UserLocationMap";

// Import your global theme CSS
import './styles/ThemeContext.css';
import 'react-toastify/dist/ReactToastify.css';

// FCM related components
import { ToastContainer } from 'react-toastify';
import NotificationListener from './components/NotificationListener'; // Ensure this component handles Firestore updates if needed
import FcmTokenManager from './components/FcmTokenManager'; // Ensure this component handles saving token to Firestore
import { toast } from 'react-toastify'; // Import toast for web notifications

const adminEmailSet = new Set(ADMIN_EMAILS);
const MAXBOND_LOGO_URL = "https://i.postimg.cc/prnnf7Qs/IMG-20250623-WA0000.jpg";

const muiAppTheme = createTheme({
    typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    },
    palette: {
        primary: {
            main: '#007aff',
        },
        secondary: {
            main: '#5856d6',
        },
        warning: {
            light: '#fff3cd',
            main: '#ffc107',
            dark: '#e0a800',
            contrastText: '#856404',
        },
        success: {
            main: '#28a745',
        },
        error: {
            main: '#dc3545',
        },
        background: {
            default: '#f0f2f5',
            paper: '#ffffff',
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 600,
                },
                containedPrimary: {
                    boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)',
                    '&:hover': {
                        boxShadow: '0 44px 12px rgba(0, 122, 255, 0.35)',
                        transform: 'translateY(-1px)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                        boxShadow: '0 1px 4px rgba(0, 122, 255, 0.2)',
                    }
                },
                outlinedPrimary: {
                    borderColor: '#007aff',
                    color: '#007aff',
                    '&:hover': {
                        backgroundColor: 'rgba(0, 122, 255, 0.05)',
                    }
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                    backgroundColor: '#fdfdfd',
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#007aff !important',
                        boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.2)',
                    },
                },
                notchedOutline: {
                    borderColor: '#e0e0e0',
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    color: '#8e8e93',
                    fontSize: '15px',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: '10px',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                    transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
                    '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 6px 15px rgba(0, 0, 0, 0.08)',
                    }
                }
            }
        },
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    borderRadius: '10px',
                    border: '1px solid #e0e0e0',
                    boxShadow: 'none',
                }
            }
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: '#f8f8f8',
                    fontWeight: 600,
                    color: '#4a4a4d',
                    padding: '12px 16px',
                    borderBottom: '1px solid #e0e0e0',
                },
                body: {
                    padding: '10px 16px',
                    color: '#3a3a3c',
                    borderBottom: '1px solid #f0f0f0',
                    '&:last-child': {
                        borderBottom: 'none',
                    },
                }
            }
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                }
            }
        },
        MuiTypography: {
            styleOverrides: {
                h4: {
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#1c1c1e',
                },
                h5: {
                    fontSize: '22px',
                    fontWeight: 600,
                    color: '#2c2c2e',
                },
                h6: {
                    fontSize: '18px',
                    fontWeight: 500,
                    color: '#3a3a3c',
                },
                body2: {
                    color: '#6a6a6f',
                }
            }
        }
    }
});

function AppContent() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const updateNeeded = useAppUpdateCheck('1.0.1');

    // Initialize Firebase Messaging instance
    const messaging = useMemo(() => {
        if (app) { // Ensure Firebase app is initialized before getting messaging service
            return getMessaging(app);
        }
        return null;
    }, [app]); // Dependency on 'app' to re-initialize if app somehow changes

    useEffect(() => {
        const requestNotificationPermission = async () => {
            // Check if Notification API is available in the browser
            if ('Notification' in window && Notification.permission !== 'granted') {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted' && messaging) { // Only proceed if permission granted and messaging is initialized
                        const token = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' }); // Replace with your actual VAPID key
                        console.log('FCM Token:', token);
                        // TODO: You might want to save this token to Firestore (in user's document)
                        // for this specific user's device, so you can send targeted notifications.
                    }
                } catch (error) {
                    console.error("Error requesting notification permission or getting token:", error);
                }
            } else if (Notification.permission === 'granted') {
                console.log('Notification permission already granted.');
                // You might still want to get/refresh the token here if messaging is available
                if (messaging) {
                    getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' }).then(token => {
                        console.log('FCM Token (already granted):', token);
                    }).catch(error => {
                        console.error('Error getting token when permission already granted:', error);
                    });
                }
            } else {
                console.warn("Notifications not supported or permission denied.");
            }
        };

        // For web, onMessage handles foreground messages
        let unsubscribeOnMessage = () => {};
        if (messaging) {
            unsubscribeOnMessage = onMessage(messaging, (payload) => {
                console.log('Foreground notification received:', payload);
                if (payload.notification) {
                    toast.info(payload.notification.body, {
                        position: "top-right",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                    });
                }
            });
        }

        requestNotificationPermission();

        return () => {
            // Cleanup: unsubscribe from onMessage listener
            unsubscribeOnMessage();
        };
    }, [messaging]); // Dependency on 'messaging' to ensure it's initialized

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Loader component to show during initial loading or update check.
    const LoadingScreen = ({ message, showButton = false, onButtonClick }) => (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            color: muiAppTheme.palette.text.primary,
            backgroundColor: muiAppTheme.palette.background.default,
            textAlign: 'center',
            padding: '20px',
            position: 'fixed', // Fixed position to cover entire viewport
            top: 0,
            left: 0,
            width: '100%',
            zIndex: 10000, // High z-index to appear on top of all other content
        }}>
            <img
                src={MAXBOND_LOGO_URL}
                alt="Maxbond Logo"
                style={{ marginBottom: '20px', maxWidth: '150px', maxHeight: '150px', borderRadius: '50%', objectFit: 'cover' }}
            />
            {/* Show CircularProgress only for initial loading, not for update messages */}
            {message.includes("RUK JAO LOAD HO RHA HAI") && <CircularProgress sx={{ mb: 2, color: muiAppTheme.palette.primary.main }} />}
            <p>{message.replace("🚀 नया अपडेट उपलब्ध है!", "").trim()}</p> {/* Extract message part, remove button text */}
            {showButton && (
                <button
                    onClick={onButtonClick}
                    style={{
                        backgroundColor: muiAppTheme.palette.primary.main,
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px 25px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(0, 122, 255, 0.3)',
                        transition: 'background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out, transform 0.1s ease-in-out',
                        marginTop: '20px'
                    }}
                >
                    अपडेट करें 🔄
                </button>
            )}
        </div>
    );

    if (loading) {
        return <LoadingScreen message="🔄 RUK JAO LOAD HO RHA HAI." />;
    }

    if (updateNeeded) {
        const handleUpdateClick = () => {
            caches.keys().then(names => {
                for (let name of names) caches.delete(name);
            }).finally(() => {
                window.location.reload(true);
            });
        };
        return <LoadingScreen message="🚀 नया अपडेट उपलब्ध है!" showButton={true} onButtonClick={handleUpdateClick} />;
    }

    // Main app content rendering when loaded and no update needed
    return (
        <MuiThemeProvider theme={muiAppTheme}>
            <CssBaseline />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Router>
                    <ToastProvider>
                        {/* FCM related components: These do NOT render visible UI elements.
                            They manage background processes like listening to Firestore changes
                            and handling FCM token registration. */}
                        {user && <NotificationListener />}
                        {user && <FcmTokenManager />}

                        {/* ToastContainer: This is the actual rendering container for all toasts. */}
                        <ToastContainer
                            position="top-right"
                            autoClose={5000}
                            hideProgressBar={false}
                            newestOnTop={false}
                            closeOnClick={true}
                            rtl={false}
                            pauseOnFocusLoss={true}
                            draggable={true}
                            pauseOnHover={true}
                        />

                        {/* Define your application routes here. */}
                        <Routes>
                            {/* --- Public Routes (accessible without authentication) --- */}
                            <Route path="/login" element={<Login />} />
                            <Route path="/signup" element={<Signup />} />

                            {/* --- Protected Routes (require user to be logged in) --- */}
                            {/* Root path: Redirect to /home if authenticated, else to /login */}
                            <Route path="/" element={user ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />} />

                            {/* General User Pages */}
                            <Route path="/home" element={user ? <HomePage /> : <Navigate to="/login" replace />} />
                            <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
                            <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/login" replace />} />
                            <Route path="/attendance" element={user ? <AttendancePage /> : <Navigate to="/login" replace />} />
                            <Route path="/fuel-entry" element={user ? <FuelEntryPage /> : <Navigate to="/login" replace />} />
                            <Route path="/site-stock" element={user ? <MainPage /> : <Navigate to="/login" replace />} />
                            <Route path="/dashboard/expense" element={user ? <ExpensePage /> : <Navigate to="/login" replace />} />
                            <Route path="/dashboard/transactions" element={user ? <TransactionsPage /> : <Navigate to="/login" replace />} />
                            <Route path="/dashboard/external-payments" element={user ? <ExternalPaymentsPage /> : <Navigate to="/login" replace />} />
                            <Route path="/dashboard/received-used" element={user ? <ReceivedUsedPage /> : <Navigate to="/login" replace />} />
                            <Route path="/summary" element={user ? <SummaryPage /> : <Navigate to="/login" replace />} />
                            <Route path="/details/:itemId" element={user ? <DetailsPage /> : <Navigate to="/login" replace />} />
                            <Route path="/dashboard/reports" element={user ? <ReportsPage /> : <Navigate to="/login" replace />} />
                            <Route path="/dashboard/export" element={user ? <ExportPage /> : <Navigate to="/login" replace />} />
                            <Route path="/dashboard/daily-report" element={user ? <DailyReport /> : <Navigate to="/login" replace />} />
                            <Route path="/dashboard/weekly-report" element={user ? <WeeklyReport /> : <Navigate to="/login" replace />} />
                            <Route path="/dashboard/monthly-report" element={user ? <MonthlyReportPage /> : <Navigate to="/login" replace />} />

                            {/* Admin-Only Routes (conditional rendering based on user email) */}
                            <Route path="/admin" element={user && adminEmailSet.has(user.email) ? <AdminPanel /> : <Navigate to="/login" replace />} />
                            <Route path="/admin/user-attendance/:userId" element={user && adminEmailSet.has(user.email) ? <UserLocationMap /> : <Navigate to="/login" replace />} />
                            <Route path="/admin/single-location/:attendanceId" element={user && adminEmailSet.has(user.email) ? <SingleLocationMap /> : <Navigate to="/login" replace />} />

                            {/* Fallback Route: For any unmatched URL */}
                            <Route path="*" element={user ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />} />
                        </Routes>
                    </ToastProvider>
                </Router>
            </LocalizationProvider>
        </MuiThemeProvider>
    );
}

// App wrapper for ThemeContext
function App() {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}

export default App;