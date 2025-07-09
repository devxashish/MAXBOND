// src/components/EditTransferModal.jsx
import React, { useState, useEffect } from "react";
import Modal from "./Modal"; // Using the custom Modal component
import { Timestamp } from "../firebase"; // Import Timestamp

const EditTransferModal = ({ isOpen, onClose, transfer, onSave }) => {
  const [editedItemName, setEditedItemName] = useState("");
  const [editedQuantity, setEditedQuantity] = useState("");
  const [editedUnit, setEditedUnit] = useState("");
  const [editedFromSiteName, setEditedFromSiteName] = useState("");
  const [editedToSiteName, setEditedToSiteName] = useState("");
  const [editedUserId, setEditedUserId] = useState("");
  const [editedTimestamp, setEditedTimestamp] = useState(""); // New state for date
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transfer) {
      setEditedItemName(transfer.itemName || "");
      setEditedQuantity(transfer.quantity || "");
      setEditedUnit(transfer.unit || "");
      setEditedFromSiteName(transfer.fromSiteName || "");
      setEditedToSiteName(transfer.toSiteName || "");
      setEditedUserId(transfer.userId || "");
      if (transfer.timestamp && transfer.timestamp.toDate) {
        const date = transfer.timestamp.toDate();
        setEditedTimestamp(date.toISOString().split('T')[0]); // Format to YYYY-MM-DD
      } else {
        setEditedTimestamp("");
      }
      setError(null);
    }
  }, [transfer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!editedItemName || !editedQuantity || !editedFromSiteName || !editedToSiteName || !editedUserId || !editedTimestamp) {
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
      const newTimestampDate = new Date(editedTimestamp);
      const newTimestamp = Timestamp.fromDate(newTimestampDate);

      await onSave({
        ...transfer, // Keep original transfer properties like IDs
        itemName: editedItemName,
        quantity: Number(editedQuantity),
        unit: editedUnit,
        fromSiteName: editedFromSiteName,
        toSiteName: editedToSiteName,
        userId: editedUserId,
        timestamp: newTimestamp,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save changes.");
      console.error("Error saving edited transfer:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">📝 Edit Transfer Record: {transfer?.itemName || ""}</h3>
        <form onSubmit={handleSubmit} className="edit-item-form"> {/* Reusing edit-item-form styles */}
          {error && <p className="error-message">{error}</p>}

          <div className="edit-item-form-group">
            <label htmlFor="editTransferItemName" className="edit-item-form-label">
              Item Name
            </label>
            <input
              type="text"
              id="editTransferItemName"
              className="form-input"
              value={editedItemName}
              onChange={(e) => setEditedItemName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="edit-item-form-group">
            <label htmlFor="editTransferQuantity" className="edit-item-form-label">
              Quantity
            </label>
            <input
              type="number"
              id="editTransferQuantity"
              className="form-input"
              value={editedQuantity}
              onChange={(e) => setEditedQuantity(e.target.value)}
              min="1"
              required
              disabled={loading}
            />
          </div>

          <div className="edit-item-form-group">
            <label htmlFor="editTransferUnit" className="edit-item-form-label">
              Unit (optional)
            </label>
            <input
              type="text"
              id="editTransferUnit"
              className="form-input"
              value={editedUnit}
              onChange={(e) => setEditedUnit(e.target.value)}
              placeholder="e.g. kg"
              disabled={loading}
            />
          </div>

          <div className="edit-item-form-group">
            <label htmlFor="editTransferFromSite" className="edit-item-form-label">
              From Site Name
            </label>
            <input
              type="text"
              id="editTransferFromSite"
              className="form-input"
              value={editedFromSiteName}
              onChange={(e) => setEditedFromSiteName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="edit-item-form-group">
            <label htmlFor="editTransferToSite" className="edit-item-form-label">
              To Site Name
            </label>
            <input
              type="text"
              id="editTransferToSite"
              className="form-input"
              value={editedToSiteName}
              onChange={(e) => setEditedToSiteName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="edit-item-form-group">
            <label htmlFor="editTransferUserId" className="edit-item-form-label">
              Transferred By (User ID)
            </label>
            <input
              type="text"
              id="editTransferUserId"
              className="form-input"
              value={editedUserId}
              onChange={(e) => setEditedUserId(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="edit-item-form-group">
            <label htmlFor="editTransferTimestamp" className="edit-item-form-label">
              Transfer Date
            </label>
            <input
              type="date"
              id="editTransferTimestamp"
              className="form-input"
              value={editedTimestamp}
              onChange={(e) => setEditedTimestamp(e.target.value)}
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

export default EditTransferModal;
