// src/components/AddSiteForm.jsx
import React, { useEffect, useState } from "react";
import {
  addSite,
  getAllSites,
  updateSite,
  deleteSite,
} from "../services/siteService";
import Modal from "./Modal"; // Import the new Modal component
import './AddSiteForm.css'; // Import the new CSS file

const AddSiteForm = () => {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [sites, setSites] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", message: "", onConfirm: null, showCancelButton: false });

  const openModal = (title, message, onConfirm = null, showCancelButton = false) => {
    setModalContent({ title, message, onConfirm, showCancelButton });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalContent({ title: "", message: "", onConfirm: null, showCancelButton: false });
  };

  const fetchSites = async () => {
    setLoading(true);
    setError(null);
    try {
      const siteList = await getAllSites();
      setSites(siteList);
    } catch (err) {
      console.error("Error fetching sites:", err);
      setError("Failed to load existing sites.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!name || !location) {
      openModal("Required Fields", "Please enter both name and location.");
      setLoading(false);
      return;
    }

    try {
      if (editingId) {
        await updateSite(editingId, { name, location });
        openModal("Success", "✅ Site updated successfully!");
      } else {
        await addSite(name, location);
        openModal("Success", "✅ Site added successfully!");
      }

      setName("");
      setLocation("");
      setEditingId(null);
      fetchSites(); // Re-fetch to update the list
    } catch (err) {
      console.error("Error saving site:", err);
      setError(err.message || "Failed to save site.");
      openModal("Error", `❌ Failed to save site: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (site) => {
    setName(site.name);
    setLocation(site.location);
    setEditingId(site.id);
  };

  const handleDelete = async (id) => {
    openModal(
      "Confirm Deletion",
      "Are you sure you want to delete this site? This action cannot be undone.",
      async () => {
        setLoading(true);
        setError(null);
        try {
          await deleteSite(id);
          openModal("Success", "🗑️ Site deleted successfully!");
          fetchSites(); // Re-fetch to update the list
        } catch (err) {
          console.error("Error deleting site:", err);
          setError(err.message || "Failed to delete site.");
          openModal("Error", `❌ Failed to delete site: ${err.message || "Unknown error"}`);
        } finally {
          setLoading(false);
        }
      },
      true // Show cancel button
    );
  };

  return (
    <div className="site-form-container">
      <h2 className="form-title">
        {editingId ? "✏️ Edit Site" : "➕ Add New Site"}
      </h2>

      <form onSubmit={handleSubmit} className="form-layout">
        <div className="form-group">
          <label htmlFor="siteName" className="form-label">Site Name</label>
          <input
            type="text"
            id="siteName"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Site A"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="location" className="form-label">Location</label>
          <input
            type="text"
            id="location"
            className="form-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Lucknow"
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          className={`form-submit-button ${editingId ? "edit-mode" : "add-mode"}`}
          disabled={loading}
        >
          {loading ? (editingId ? "Updating..." : "Adding...") : (editingId ? "Update Site" : "Add Site")}
        </button>
      </form>

      {error && <p className="error-message">{error}</p>}

      <h3 className="existing-sites-title">📋 Existing Sites</h3>

      {loading && <p className="loading-message">Loading sites...</p>}
      {!loading && sites.length === 0 ? (
        <p className="no-sites-message">No sites found.</p>
      ) : (
        !loading && (
          <div className="site-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.id}>
                    <td>{site.name}</td>
                    <td>{site.location}</td>
                    <td className="site-actions-cell">
                      <button
                        onClick={() => handleEdit(site)}
                        className="action-button edit"
                        disabled={loading}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(site.id)}
                        className="action-button delete"
                        disabled={loading}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalContent.title}
        message={modalContent.message}
        onConfirm={modalContent.onConfirm}
        showCancelButton={modalContent.showCancelButton}
      />
    </div>
  );
};

export default AddSiteForm;
