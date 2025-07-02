import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import "./AddSiteForm.css";

const AddSiteForm = () => {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [sites, setSites] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const fetchSites = async () => {
    const snapshot = await getDocs(collection(db, "sites"));
    const siteList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setSites(siteList);
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !location) {
      alert("Please enter both name and location.");
      return;
    }

    try {
      if (editingId) {
        const siteRef = doc(db, "sites", editingId);
        await updateDoc(siteRef, { name, location });
        alert("✅ Site updated successfully!");
      } else {
        await addDoc(collection(db, "sites"), { name, location });
        alert("✅ Site added successfully!");
      }

      setName("");
      setLocation("");
      setEditingId(null);
      fetchSites();
    } catch (error) {
      console.error("Error saving site:", error);
      alert("❌ Failed to save site.");
    }
  };

  const handleEdit = (site) => {
    setName(site.name);
    setLocation(site.location);
    setEditingId(site.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this site?")) return;
    try {
      await deleteDoc(doc(db, "sites", id));
      alert("🗑️ Site deleted successfully!");
      fetchSites();
    } catch (error) {
      console.error("Error deleting site:", error);
      alert("❌ Failed to delete site.");
    }
  };

  return (
    <div className="site-form-wrapper">
      <h2 className="form-title">
        {editingId ? "✏️ Edit Site" : "➕ Add New Site"}
      </h2>

      <form onSubmit={handleSubmit} className="form-grid">
        <div>
          <label className="form-label">Site Name</label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Site A"
          />
        </div>

        <div>
          <label className="form-label">Location</label>
          <input
            type="text"
            className="form-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Lucknow"
          />
        </div>

        <button
          type="submit"
          className={`form-button ${
            editingId ? "update-btn" : "add-btn"
          }`}
        >
          {editingId ? "Update Site" : "Add Site"}
        </button>
      </form>

      <h3 className="table-title">📋 Existing Sites</h3>

      {sites.length === 0 ? (
        <p>No sites found.</p>
      ) : (
        <table className="site-table">
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
                <td className="actions">
                  <button onClick={() => handleEdit(site)} className="edit-btn">
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(site.id)}
                    className="delete-btn"
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AddSiteForm;
