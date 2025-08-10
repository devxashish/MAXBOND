import React, { useState, useEffect } from "react";
import { auth } from "../firebase"; // Import auth
import { onAuthStateChanged } from "firebase/auth"; // Import onAuthStateChanged
import { Capacitor } from '@capacitor/core'; // Import Capacitor

import AddPage from "../pages/AddPage"; // This will include Site + Item + Variant forms
import ReceivedUsedPage from "../pages/ReceivedUsedPage";
import SummaryPage from "../pages/SummaryPage"; // Import the SummaryPage
import MobileExportPage from "../pages/MobileExportPage"; // Import the new MobileExportPage
import AllSitesExportPage from "../pages/AllSitesExportPage"; // Import the new AllSitesExportPage

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
                const userEmail = user.email;
                const currentUserIsAdmin = userEmail && userEmail.endsWith('@admin.com');
                setIsAdmin(currentUserIsAdmin);

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
                return <AddPage />;
            case "received":
                return <ReceivedUsedPage />;
            case "summary":
                return <SummaryPage />;
            case "mobile-export":
                return <MobileExportPage />;
            case "all-sites-export": // New case for AllSitesExportPage
                return <AllSitesExportPage />;
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
                
                {/* New button for All Sites Export */}
                <button
                    className={`tab-button ${activeTab === "all-sites-export" ? "active" : ""}`}
                    onClick={() => setActiveTab("all-sites-export")}
                >
                    <i className="icon-export">📊</i>
                    <span>All Export</span>
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
