import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Wallet, Globe, Upload, User } from "lucide-react";
import "./BottomTab.css";

const BottomTab = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { label: "Main", path: "/dashboard/main", icon: <Home /> }, // Replaced "Expense"
    { label: "Transactions", path: "/dashboard/transactions", icon: <Wallet /> },
    { label: "External", path: "/dashboard/external-payments", icon: <Globe /> },
    { label: "Export", path: "/dashboard/export", icon: <Upload /> },
    { label: "Profile", path: "/dashboard/profile", icon: <User /> },
  ];

  return (
    <div className="bottom-nav">
      {tabs.map((tab, index) => {
        const isActive = location.pathname === tab.path;
        return (
          <div
            key={index}
            className={`nav-item ${isActive ? "active" : ""}`}
            onClick={() => navigate(tab.path)}
          >
            <div className="nav-icon">{tab.icon}</div>
            <div className="nav-label">{tab.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default BottomTab;
