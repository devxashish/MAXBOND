// src/components/EditReportItemModal.jsx
import React, { useState, useEffect } from "react";
import Modal from "./Modal"; // Your custom Modal component
import { Timestamp } from "../firebase"; // Import Timestamp

const EditReportItemModal = ({ isOpen, onClose, item, type, fieldToEdit, onSave }) => {
  const [editedValue, setEditedValue] = useState("");
  const [editedDate, setEditedDate] = useState(""); // For timestamp editing
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setError(null);
      setLoading(false);

      if (fieldToEdit === "timestamp") {
        // Convert Firestore Timestamp to YYYY-MM-DD for input type="date"
        if (item.timestamp && item.timestamp.toDate) {
          const date = item.timestamp.toDate();
          setEditedDate(date.toISOString().split('T')[0]);
        } else {
          setEditedDate("");
        }
        setEditedValue(""); // Value is handled by editedDate
      } else {
        // For other fields, display the current value
        setEditedValue(String(item[fieldToEdit] || ""));
        setEditedDate(""); // Date is not relevant for other fields
      }
    }
  }, [item, fieldToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let finalValue = editedValue;
    let fieldName = fieldToEdit;

    if (fieldToEdit === "timestamp") {
      if (!editedDate) {
        setError("Please select a date.");
        setLoading(false);
        return;
      }
      const newDate = new Date(editedDate);
      if (isNaN(newDate)) {
        setError("Invalid date selected.");
        setLoading(false);
        return;
      }
      finalValue = Timestamp.fromDate(newDate);
    } else {
      if (!finalValue) {
        setError("Value cannot be empty.");
        setLoading(false);
        return;
      }
      // Convert to number if the field is expected to be numeric (e.g., amount, cost)
      if (fieldToEdit === "amount" || fieldToEdit === "cost") {
        const numValue = parseFloat(finalValue);
        if (isNaN(numValue)) {
          setError("Please enter a valid number.");
          setLoading(false);
          return;
        }
        finalValue = numValue;
      }
    }

    try {
      await onSave(item.id, fieldName, finalValue, type); // Pass type to onSave
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save changes.");
      console.error("Error saving edited report item:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">✏️ Edit {fieldToEdit === "timestamp" ? "Date" : fieldToEdit}</h3>
        <form onSubmit={handleSubmit} className="edit-item-form">
          {error && <p className="error-message">{error}</p>}

          <div className="edit-item-form-group">
            <label htmlFor="editValue" className="edit-item-form-label">
              {fieldToEdit === "timestamp" ? "Select Date" : `Enter new ${fieldToEdit}`}
            </label>
            {fieldToEdit === "timestamp" ? (
              <input
                type="date"
                id="editValue"
                className="form-input"
                value={editedDate}
                onChange={(e) => setEditedDate(e.target.value)}
                required
                disabled={loading}
              />
            ) : (
              <input
                type={fieldToEdit === "amount" || fieldToEdit === "cost" ? "number" : "text"}
                id="editValue"
                className="form-input"
                value={editedValue}
                onChange={(e) => setEditedValue(e.target.value)}
                placeholder={`Enter new ${fieldToEdit}`}
                required
                disabled={loading}
              />
            )}
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

export default EditReportItemModal;
