// src/components/SiteList.jsx
import React, { useEffect, useState } from "react";
import { getAllSites } from "../services/siteService";
import { db, collection, onSnapshot } from "../firebase"; // Import from centralized firebase.js
import '../styles/SiteList.css'; // Import the new CSS file

const SiteList = ({ onSelectSite, selectedSiteId }) => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "sites"),
      (snapshot) => {
        const siteData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSites(siteData);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching sites:", err);
        setError("Failed to load sites.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="site-list-message">Loading sites...</div>;
  }

  if (error) {
    return <div className="site-list-message error-message">{error}</div>;
  }

  return (
    <div className="site-list-container">
      <h2 className="site-list-title">🏗️ Available Sites</h2>
      {sites.length === 0 ? (
        <p className="site-list-message">No sites added yet.</p>
      ) : (
        <ul className="site-list-ul">
          {sites.map((site) => (
            <li
              key={site.id}
              className={`site-list-item ${selectedSiteId === site.id ? "selected" : ""}`}
              onClick={() => onSelectSite(site)}
            >
              <div className="site-item-name">{site.name}</div>
              {site.location && (
                <div className="site-item-location">Location: {site.location}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SiteList;
