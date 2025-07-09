// src/components/TransferHistory.jsx
import React, { useEffect, useState } from "react";
import { getAllTransfers, updateTransferRecord, deleteTransferRecord } from "../services/transferService"; // Import update and delete
import { exportToPdf, exportToExcel } from "../utils/exportUtils";
import Modal from "./Modal";
import EditTransferModal from "./EditTransferModal"; // Import the new edit modal
import '../styles/TransferHistory.css'; // Import the new CSS file

const TransferHistory = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", message: "", onConfirm: null, showCancelButton: false });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTransferForEdit, setSelectedTransferForEdit] = useState(null);

  const openModal = (title, message, onConfirm = null, showCancelButton = false) => {
    setModalContent({ title, message, onConfirm, showCancelButton });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalContent({ title: "", message: "", onConfirm: null, showCancelButton: false });
  };

  const fetchTransfers = async () => {
    setLoading(true);
    setError(null);
    try {
      const history = await getAllTransfers();
      setTransfers(history);
    } catch (err) {
      console.error("Error fetching transfer history:", err);
      setError("Failed to load transfer history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleExportPdf = () => {
    if (transfers.length === 0) {
      openModal("No Data", "No transfer records to export.");
      return;
    }
    const headers = ["Date", "Item", "Quantity", "From Site", "To Site", "Transferred By"];
    const formattedData = transfers.map(t => ({
      date: t.timestamp?.toDate ? new Date(t.timestamp.toDate()).toLocaleString() : "N/A",
      item: t.itemName,
      quantity: `${t.quantity} ${t.unit || ""}`,
      fromSite: t.fromSiteName || "Unknown",
      toSite: t.toSiteName || "Unknown",
      transferredBy: t.userId || "N/A",
    }));
    exportToPdf(formattedData, headers, "transfer_history", "Stock Transfer History");
    openModal("Export Successful", "Transfer history successfully exported as PDF.");
  };

  const handleExportExcel = () => {
    if (transfers.length === 0) {
      openModal("No Data", "No transfer records to export.");
      return;
    }
    const formattedData = transfers.map(t => ({
      "Date": t.timestamp?.toDate ? new Date(t.timestamp.toDate()).toLocaleString() : "N/A",
      "Item": t.itemName,
      "Quantity": `${t.quantity} ${t.unit || ""}`,
      "From Site": t.fromSiteName || "Unknown",
      "To Site": t.toSiteName || "Unknown",
      "Transferred By": t.userId || "N/A",
    }));
    exportToExcel(formattedData, "transfer_history");
    openModal("Export Successful", "Transfer history successfully exported as Excel.");
  };

  const handleEditClick = (transfer) => {
    setSelectedTransferForEdit(transfer);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedTransfer = async (updatedTransfer) => {
    try {
      await updateTransferRecord(updatedTransfer.id, {
        itemName: updatedTransfer.itemName,
        quantity: updatedTransfer.quantity,
        unit: updatedTransfer.unit,
        fromSiteName: updatedTransfer.fromSiteName,
        toSiteName: updatedTransfer.toSiteName,
        userId: updatedTransfer.userId,
        timestamp: updatedTransfer.timestamp,
      });
      openModal("Success", "Transfer record updated successfully!");
      fetchTransfers(); // Re-fetch data to reflect changes
    } catch (err) {
      console.error("Error updating transfer record:", err);
      openModal("Error", `Failed to update transfer record: ${err.message || "Unknown error"}`);
    } finally {
      setIsEditModalOpen(false);
      setSelectedTransferForEdit(null);
    }
  };

  const handleDeleteTransfer = async (transferId, itemName) => {
    openModal(
      "Confirm Deletion",
      `Are you sure you want to delete the transfer record for ${itemName}? This will NOT reverse inventory changes.`,
      async () => {
        try {
          await deleteTransferRecord(transferId);
          openModal("Success", "Transfer record deleted successfully!");
          fetchTransfers(); // Re-fetch data to update the list
        } catch (err) {
          console.error("Error deleting transfer record:", err);
          openModal("Error", `Failed to delete transfer record: ${err.message || "Unknown error"}`);
        }
      },
      true // Show cancel button
    );
  };

  return (
    <div className="transfer-history-container">
      <h2 className="transfer-history-title">📜 Transfer History</h2>

      <div className="export-buttons-history">
        <button
          onClick={handleExportPdf}
          className="export-button pdf"
          disabled={transfers.length === 0 || loading}
        >
          Export to PDF
        </button>
        <button
          onClick={handleExportExcel}
          className="export-button excel"
          disabled={transfers.length === 0 || loading}
        >
          Export to Excel
        </button>
      </div>

      {loading && <p className="loading-message">Loading transfer history...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && transfers.length === 0 ? (
        <p className="no-records-message">No transfer records found.</p>
      ) : (
        !loading && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>From Site</th>
                  <th>To Site</th>
                  <th>Transferred By</th>
                  <th>Actions</th> {/* New Actions column */}
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.timestamp?.toDate ? new Date(t.timestamp.toDate()).toLocaleString() : "N/A"}
                    </td>
                    <td>{t.itemName}</td>
                    <td>
                      {t.quantity} {t.unit || ""}
                    </td>
                    <td>{t.fromSiteName || "Unknown"}</td>
                    <td>{t.toSiteName || "Unknown"}</td>
                    <td>{t.userId || "N/A"}</td>
                    <td className="transfer-actions-cell">
                      <button
                        onClick={() => handleEditClick(t)}
                        className="transfer-action-button edit"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTransfer(t.id, t.itemName)}
                        className="transfer-action-button delete"
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
      {selectedTransferForEdit && (
        <EditTransferModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          transfer={selectedTransferForEdit}
          onSave={handleSaveEditedTransfer}
        />
      )}
    </div>
  );
};

export default TransferHistory;
