// src/components/EditInventoryItemModal.jsx
import React, { useState, useEffect } from "react";
import Modal from "./Modal"; // Using the custom Modal component
import { Timestamp } from "../firebase"; // Import Timestamp to convert date strings
import '../styles/EditInventoryItemModal.css'; // Import the CSS file

const EditInventoryItemModal = ({ isOpen, onClose, item, onSave, sites }) => {
  const [editedItemName, setEditedItemName] = useState("");
  const [editedQuantity, setEditedQuantity] = useState("");
  const [editedUnit, setEditedUnit] = useState("");
  const [editedSiteId, setEditedSiteId] = useState("");
  const [editedCreatedAt, setEditedCreatedAt] = useState(""); // New state for date
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false); // Local loading state for save operation

  useEffect(() => {
    if (item) {
      setEditedItemName(item.itemName || "");
      setEditedQuantity(item.quantity || "");
      setEditedUnit(item.unit || "");
      setEditedSiteId(item.siteId || "");
      // Format Firestore Timestamp to YYYY-MM-DD for input type="date"
      if (item.createdAt && item.createdAt.toDate) {
        const date = item.createdAt.toDate();
        setEditedCreatedAt(date.toISOString().split('T')[0]);
      } else {
        setEditedCreatedAt("");
      }
      setError(null);
    }
  }, [item]);

  const handleSubmit = async (e) => { // Made async to handle onSave
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!editedItemName || !editedQuantity || !editedSiteId || !editedCreatedAt) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }
    if (Number(editedQuantity) <= 0) {
      setError("Quantity must be a positive number.");
      setLoading(false);
      return;
    }

    try {
      // Convert date string back to Firestore Timestamp
      const newCreatedAtDate = new Date(editedCreatedAt);
      const newCreatedAtTimestamp = Timestamp.fromDate(newCreatedAtDate);

      await onSave({ // onSave is an async prop from parent
        ...item, // Keep existing item properties
        itemName: editedItemName,
        quantity: Number(editedQuantity),
        unit: editedUnit,
        siteId: editedSiteId,
        createdAt: newCreatedAtTimestamp, // Update createdAt
      });
      onClose(); // Close modal on successful save
    } catch (err) {
      setError(err.message || "Failed to save changes.");
      console.error("Error saving edited item:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay"> {/* Use modal-overlay for the background */}
      <div className="modal-content"> {/* Use modal-content for the modal box */}
        <h3 className="modal-title">📦 Edit Item: {item?.itemName || ""}</h3>
        <form onSubmit={handleSubmit} className="edit-item-form">
          {error && <p className="error-message">{error}</p>}

          <div className="edit-item-form-group">
            <label htmlFor="editItemName" className="edit-item-form-label">
              Item Name
            </label>
            <input
              type="text"
              id="editItemName"
              className="form-input"
              value={editedItemName}
              onChange={(e) => setEditedItemName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="edit-item-form-group">
            <label htmlFor="editQuantity" className="edit-item-form-label">
              Quantity
            </label>
            <input
              type="number"
              id="editQuantity"
              className="form-input"
              value={editedQuantity}
              onChange={(e) => setEditedQuantity(e.target.value)}
              min="1"
              required
              disabled={loading}
            />
          </div>

          <div className="edit-item-form-group">
            <label htmlFor="editUnit" className="edit-item-form-label">
              Unit (optional)
            </label>
            <input
              type="text"
              id="editUnit"
              className="form-input"
              value={editedUnit}
              onChange={(e) => setEditedUnit(e.target.value)}
              placeholder="e.g. kg, liter"
              disabled={loading}
            />
          </div>

          <div className="edit-item-form-group">
            <label htmlFor="editSite" className="edit-item-form-label">
              Site
            </label>
            <select
              id="editSite"
              className="form-select"
              value={editedSiteId}
              onChange={(e) => setEditedSiteId(e.target.value)}
              required
              disabled={loading}
            >
              <option value="">Select Site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

          <div className="edit-item-form-group">
            <label htmlFor="editedCreatedAt" className="edit-item-form-label">
              Added Date
            </label>
            <input
              type="date"
              id="editedCreatedAt"
              className="form-input"
              value={editedCreatedAt}
              onChange={(e) => setEditedCreatedAt(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="edit-item-buttons">
            <button
              type="button"
              onClick={onClose}
              className="edit-item-cancel-button"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="edit-item-save-button"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditInventoryItemModal;
