import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ You missed this import
import SiteList from "./SiteList";
import SiteInventory from "./SiteInventory";
import TransferForm from "./TransferForm";
import TransferHistory from "./TransferHistory";
import AddItemForm from "./AddItemForm";
import "./MainPage.css"; // ✅ iOS-style CSS added

const MainPage = () => {
  const [selectedSite, setSelectedSite] = useState(null);
  const navigate = useNavigate(); // ✅ You forgot to define this

  return (
    <div className="main-container">
      {/* ✅ iOS-style Back Button */}
      <button className="back-button" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <h1 className="main-heading">📦 Site Stock Manager</h1>

      {/* Grid Layout */}
      <div className="main-grid grid-three">
        {/* Site List */}
        <div className="main-card">
          <SiteList onSelectSite={setSelectedSite} />
        </div>

        {/* Site Inventory */}
        <div className="main-card col-span-2">
          <SiteInventory site={selectedSite} />
        </div>
      </div>

      {/* Add Item + Transfer Form */}
      <div className="main-grid grid-two margin-top">
        <div className="main-card">
          <AddItemForm />
        </div>
        <div className="main-card">
          <TransferForm />
        </div>
      </div>

      {/* Transfer History */}
      <div className="main-card margin-top">
        <TransferHistory />
      </div>
    </div>
  );
};

export default MainPage;
