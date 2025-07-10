// src/components/SiteStockPage.jsx
import React, { useState, useEffect } from "react";
import AddSiteForm from "./AddSiteForm";
import AddItemForm from "./AddItemForm";
import SiteInventory from "./SiteInventory";
import TransferForm from "./TransferForm";
import SiteList from "./SiteList";
import TransferHistory from "./TransferHistory";
import StockSummaryPage from "./StockSummaryPage";
import StockUsageForm from "./StockUsageForm"; // Import the new component

import './SiteStockPage.css'; // Import the main page CSS

const SiteStockPage = () => {
  const [activeTab, setActiveTab] = useState("inventory"); // Default to 'inventory' tab
  const [selectedSite, setSelectedSite] = useState(null); // For SiteInventory display
  const [key, setKey] = useState(0); // Key to force re-render/animation on tab change

  // Update key on activeTab change to trigger content animation
  useEffect(() => {
    setKey(prevKey => prevKey + 1);
  }, [activeTab]);

  // Helper component for styled tab buttons
  const TabButton = ({ label, icon, isActive, onClick, className }) => {
    return (
      <button
        className={`tab-button ${className} ${isActive ? "active" : ""}`}
        onClick={onClick}
      >
        <span className="tab-button-icon">{icon}</span>
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="site-stock-page-wrapper">
      {/* Hero Section */}
      <div className="hero-section">
        {/* Removed: <div className="hero-background-pattern" style={{ backgroundImage: 'url("https://placehold.co/1200x400/ffffff/000000?text=Abstract+Pattern")' }}></div> */}
        <div className="hero-content">
          <h1 className="hero-title">
            🏗️ Site Stock Manager
          </h1>
          <p className="hero-subtitle">
            Efficiently track and manage inventory across all your construction sites.
          </p>
          <div className="hero-buttons">
            <button className="hero-button primary">
              Get Started
            </button>
            <button className="hero-button secondary">
              Learn More
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <TabButton
            label="Manage Sites"
            icon="🏗️"
            isActive={activeTab === "sites"}
            onClick={() => setActiveTab("sites")}
            className="sites"
          />
          <TabButton
            label="Add Item"
            icon="➕"
            isActive={activeTab === "add"}
            onClick={() => setActiveTab("add")}
            className="add"
          />
          <TabButton
            label="View Inventory"
            icon="📦"
            isActive={activeTab === "inventory"}
            onClick={() => setActiveTab("inventory")}
            className="inventory"
          />
          <TabButton
            label="Transfer Stock"
            icon="🔁"
            isActive={activeTab === "transfer"}
            onClick={() => setActiveTab("transfer")}
            className="transfer"
          />
          <TabButton
            label="Transfer History"
            icon="📜"
            isActive={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className="history"
          />
          <TabButton
            label="Stock Usage" // New Tab
            icon="🛠️"
            isActive={activeTab === "usage"}
            onClick={() => setActiveTab("usage")}
            className="usage" // Specific class for styling
          />
          <TabButton
            label="Stock Summary"
            icon="📊"
            isActive={activeTab === "summary"}
            onClick={() => setActiveTab("summary")}
            className="summary"
          />
        </div>

        {/* Tab Content Area with Animation */}
        <div key={key} className="tab-content-area">
          {activeTab === "sites" && <AddSiteForm />}

          {activeTab === "add" && <AddItemForm />}

          {activeTab === "inventory" && (
            <div className="inventory-layout-grid">
              <div>
                <SiteList onSelectSite={setSelectedSite} selectedSiteId={selectedSite?.id} />
              </div>
              <div>
                <SiteInventory site={selectedSite} />
              </div>
            </div>
          )}

          {activeTab === "transfer" && <TransferForm />}

          {activeTab === "history" && <TransferHistory />}

          {activeTab === "usage" && <StockUsageForm />} {/* New Content */}

          {activeTab === "summary" && <StockSummaryPage />}
        </div>
      </div>
    </div>
  );
};

export default SiteStockPage;
