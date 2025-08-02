import React, { useState, useEffect } from "react";
import { auth } from "../firebase"; // Import auth
import { onAuthStateChanged } from "firebase/auth"; // Import onAuthStateChanged
import { Capacitor } from '@capacitor/core'; // Import Capacitor

import AddPage from "../pages/AddPage"; // This will include Site + Item + Variant forms
import ReceivedUsedPage from "../pages/ReceivedUsedPage";
import SummaryPage from "../pages/SummaryPage"; // Import the SummaryPage
import MobileExportPage from "../pages/MobileExportPage"; // Import the new MobileExportPage

import "../styles/main-page.css"; // Premium styles

const MainPage = () => {
  // State to manage which tab is currently active
  const [activeTab, setActiveTab] = useState("received"); // Default to received for non-admins
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true); // To check if user roles are loaded
  const [isCapacitor, setIsCapacitor] = useState(false); // New state for Capacitor environment

  useEffect(() => {
    // Check if running in Capacitor environment
    setIsCapacitor(typeof Capacitor !== 'undefined' && Capacitor.isNative);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Your Firebase rule checks request.auth.token.admin == true (from custom claims)
        // For client-side isAdmin check, it's safer to rely on custom claims from the token.
        // However, if your admin check is strictly based on email ending with '@admin.com',
        // and you're not setting custom claims, then keep the email check.
        // For consistency with recent changes, let's stick to custom claims for isAdmin.
        // If custom claims are not set, you'll need to set them via Firebase Admin SDK.

        // --- RECOMMENDED: Admin check using custom claims (requires Admin SDK setup) ---
        // try {
        //   const idTokenResult = await user.getIdTokenResult(true); // Force refresh to get latest claims
        //   const currentUserIsAdmin = idTokenResult.claims.admin === true;
        //   setIsAdmin(currentUserIsAdmin);
        // } catch (error) {
        //   console.error("Error fetching custom claims:", error);
        //   setIsAdmin(false);
        // }

        // --- ALTERNATIVE: Admin check using email (less secure for access control, but matches your rule regex) ---
        const userEmail = user.email;
        const currentUserIsAdmin = userEmail && userEmail.endsWith('@admin.com');
        setIsAdmin(currentUserIsAdmin);
        // --- END OF ADMIN CHECK ---

        // If a non-admin user lands on 'add' tab (e.g., by refreshing)
        // and 'add' is the default, redirect them to 'received'.
        if (!currentUserIsAdmin && activeTab === "add") {
            setActiveTab("received");
        }
      } else {
        setIsAdmin(false); // No user, not admin
        setActiveTab("received"); // Reset to a non-admin tab
      }
      setLoadingUser(false); // User role loaded
    });

    return () => unsubscribe(); // Cleanup subscription
  }, [activeTab]); // Depend on activeTab to potentially redirect non-admins

  // Function to render the correct component based on the active tab
  const renderTabContent = () => {
    if (loadingUser) {
        return (
            <div className="tab-placeholder loading-state">
                <p>Loading user roles...</p>
            </div>
        );
    }

    switch (activeTab) {
      case "add":
        // AddPage access is still restricted to isAdmin if you kept the client-side check there.
        // If your Firebase rules allow ALL authenticated users to modify global items,
        // then remove the isAdmin check here. Given your last request ("AddPage me koi error nhi ana chiye na koi site add karne me na del karne me na item add or dell me oi error nhi iske liya firebase or addpage dono update karke do complete code"),
        // AddPage is now meant for all authenticated users to manage GLOBAL data.
        return <AddPage />; // Render AddPage directly for any logged-in user
        
      case "received":
        return <ReceivedUsedPage />;
      case "summary":
        return <SummaryPage />;
      case "mobile-export": // This content will be rendered for all users now
        return <MobileExportPage />;
      case "more":
        // Placeholder for future More Settings Page
        return (
          <div className="tab-placeholder">
            <p>⚙️ More Settings</p>
            <p>Coming Soon!</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="main-page-container">
      <header className="main-header">
        <h1>Inventory Manager</h1>
        <p>Your simple solution for tracking items.</p>
      </header>

      <main className="tab-content-area">
        {renderTabContent()}
      </main>

      {/* Bottom navigation tabs */}
      <nav className="bottom-tabs-navigation">
        {/* "Add" tab visible based on isAdmin status */}
        {isAdmin && (
          <button
            className={`tab-button ${activeTab === "add" ? "active" : ""}`}
            onClick={() => setActiveTab("add")}
          >
            <i className="icon-plus">➕</i>
            <span>Add</span>
          </button>
        )}

        <button
          className={`tab-button ${activeTab === "received" ? "active" : ""}`}
          onClick={() => setActiveTab("received")}
        >
          <i className="icon-exchange">🔄</i>
          <span>In/Out</span>
        </button>

        <button
          className={`tab-button ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          <i className="icon-summary">📈</i>
          <span>Summary</span>
        </button>

        
          <button
          className={`tab-button ${activeTab === "mobile-export" ? "active" : ""}`}
          onClick={() => setActiveTab("mobile-export")}
        >
          <i className="icon-export">📄</i>
          <span>M-Export</span>
        </button>
        

        <button
          className={`tab-button ${activeTab === "more" ? "active" : ""}`}
          onClick={() => setActiveTab("more")}
        >
          <i className="icon-more">•••</i>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
};

export default MainPage;