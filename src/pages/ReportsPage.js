// ✅ ReportsPage.js – Overview of Daily, Weekly, Monthly Reports
import React from "react";
import { useNavigate } from "react-router-dom";
import "./ReportsPage.css";

const ReportsPage = () => {
  const navigate = useNavigate();

  const reports = [
    {
      title: "📅 Daily Report",
      description: "View all today's expenses and transactions",
      path: "/dashboard/daily-report",
    },
    {
      title: "🗓 Weekly Report",
      description: "See your weekly performance",
      path: "/dashboard/weekly-report",
    },
    {
      title: "📆 Monthly Report",
      description: "Track your monthly financials",
      path: "/dashboard/monthly-report",
    },
  ];

  return (
    <div className="reports-page">
      <h2>📊 Reports Overview</h2>

      <div className="report-cards">
        {reports.map((r, i) => (
          <div
            className="report-card glass"
            key={i}
            onClick={() => navigate(r.path)}
          >
            <h3>{r.title}</h3>
            <p>{r.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsPage;
