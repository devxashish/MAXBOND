// src/components/StockUsageForm.jsx
import React, { useEffect, useState } from "react";
import { getAllSites } from "../services/siteService";
import { getInventoryBySite } from "../services/inventoryService";
import { recordItemUsage, getAllUsages, deleteUsageRecord, updateUsageRecord } from "../services/usageService"; // New usage service
import Modal from "./Modal"; // Your custom Modal component
import '../styles/StockUsageForm.css'; // Import the new CSS file
import { db, collection, onSnapshot, query, orderBy } from "../firebase"; // For real-time usage history

const StockUsageForm = () => {
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [siteItems, setSiteItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantityUsed, setQuantityUsed] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", message: "", onConfirm: null, showCancelButton: false });

  const [usageHistory, setUsageHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  const openModal = (title, message, onConfirm = null, showCancelButton = false) => {
    setModalContent({ title, message, onConfirm, showCancelButton });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalContent({ title: "", message: "", onConfirm: null, showCancelButton: false });
  };

  // Fetch sites on component mount
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const siteList = await getAllSites();
        setSites(siteList);
      } catch (err) {
        console.error("Error fetching sites:", err);
        setError("Failed to load sites.");
      }
    };
    fetchSites();
  }, []);

  // Fetch items for selected site
  useEffect(() => {
    const fetchItems = async () => {
      if (!selectedSiteId) {
        setSiteItems([]);
        setSelectedItemId("");
        return;
      }
      try {
        const itemList = await getInventoryBySite(selectedSiteId);
        setSiteItems(itemList);
      } catch (err) {
        console.error("Error fetching inventory items:", err);
        setError("Failed to load items for selected site.");
      }
    };
    fetchItems();
  }, [selectedSiteId]);

  // Fetch usage history in real-time
  useEffect(() => {
    setHistoryLoading(true);
    setHistoryError(null);
    const q = query(collection(db, "usages"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const history = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setUsageHistory(history);
        setHistoryLoading(false);
      },
      (err) => {
        console.error("Error fetching usage history:", err);
        setHistoryError("Failed to load usage history.");
        setHistoryLoading(false);
      }
    );
    return () => unsubscribe(); // Cleanup listener
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    if (!selectedSiteId || !selectedItemId || !quantityUsed) {
      openModal("Required Fields", "Please fill in all required fields.");
      setLoading(false);
      return;
    }
    if (Number(quantityUsed) <= 0) {
      openModal("Invalid Quantity", "Quantity used must be a positive number.");
      setLoading(false);
      return;
    }

    try {
      // Get current user ID (placeholder, replace with actual auth context)
      const userId = "currentUserId123";

      await recordItemUsage({
        siteId: selectedSiteId,
        itemId: selectedItemId,
        quantityUsed: Number(quantityUsed),
        userId,
        notes,
      });
      setSuccess(true);
      setQuantityUsed("");
      setNotes("");
      setSelectedItemId(""); // Clear selected item
      // Optionally re-fetch items for the selected site to update available quantity
      const updatedItemList = await getInventoryBySite(selectedSiteId);
      setSiteItems(updatedItemList);
      openModal("Success", "Usage recorded successfully!");
    } catch (err) {
      console.error("Error recording usage:", err);
      setError(err.message || "Failed to record usage.");
      openModal("Error", `Failed to record usage: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUsage = async (usageId, itemName) => {
    openModal(
      "Confirm Deletion",
      `Are you sure you want to delete the usage record for ${itemName}? This will NOT reverse inventory changes.`,
      async () => {
        try {
          await deleteUsageRecord(usageId);
          openModal("Success", "Usage record deleted successfully!");
          // History will auto-update due to onSnapshot
        } catch (err) {
          console.error("Error deleting usage record:", err);
          openModal("Error", `Failed to delete usage record: ${err.message || "Unknown error"}`);
        }
      },
      true // Show cancel button
    );
  };

  // Note: Editing usage records is complex as it affects past inventory.
  // For simplicity, this example does not include an edit modal for usage history,
  // but the `updateUsageRecord` function is available in the service if needed.
  const handleEditUsageClick = (usage) => {
    openModal("Feature Not Available", "Editing usage records is not directly supported in this view to maintain inventory consistency. Please delete and re-add if necessary.", null, false);
    // If you want to implement editing, you'd create an EditUsageModal similar to EditTransferModal
    // and call updateUsageRecord from there.
  };


  return (
    <div className="stock-usage-container">
      <h2 className="stock-usage-title">🛠️ स्टॉक उपयोग ट्रैक करें</h2>

      <form onSubmit={handleSubmit} className="stock-usage-form-layout">
        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">Usage recorded!</p>}

        <div className="form-group">
          <label htmlFor="selectSiteUsage" className="form-label">
            साइट चुनें
          </label>
          <select
            id="selectSiteUsage"
            className="form-select"
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">साइट चुनें</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="selectItemUsage" className="form-label">
            आइटम चुनें
          </label>
          <select
            id="selectItemUsage"
            className="form-select"
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            disabled={!selectedSiteId || loading}
            required
          >
            <option value="">आइटम चुनें</option>
            {siteItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemName} (उपलब्ध: {item.quantity} {item.unit || ""})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="quantityUsed" className="form-label">
            उपयोग की गई मात्रा
          </label>
          <input
            type="number"
            id="quantityUsed"
            className="form-input"
            value={quantityUsed}
            onChange={(e) => setQuantityUsed(e.target.value)}
            min="1"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="usageNotes" className="form-label">
            नोट्स (वैकल्पिक)
          </label>
          <textarea
            id="usageNotes"
            className="form-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="उपयोग के बारे में कोई भी नोट"
            rows="3"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="stock-usage-submit-button"
          disabled={loading}
        >
          {loading ? "रिकॉर्ड कर रहा है..." : "उपयोग रिकॉर्ड करें"}
        </button>
      </form>

      <div className="usage-history-section">
        <h3 className="usage-history-title">📜 उपयोग इतिहास</h3>
        {historyLoading && <p className="loading-message">उपयोग इतिहास लोड हो रहा है...</p>}
        {historyError && <p className="error-message">{historyError}</p>}
        {!historyLoading && !historyError && usageHistory.length === 0 ? (
          <p className="no-records-message">कोई उपयोग रिकॉर्ड नहीं मिला।</p>
        ) : (
          !historyLoading && (
            <ul className="usage-history-list">
              {usageHistory.map((usage) => (
                <li key={usage.id} className="usage-history-item">
                  <div className="usage-item-details">
                    <p><strong>{usage.itemName}</strong> - {usage.quantityUsed} {usage.unit || ""} ({usage.siteName})</p>
                    <p>दिनांक: {usage.timestamp?.toDate ? new Date(usage.timestamp.toDate()).toLocaleString() : "N/A"}</p>
                    {usage.notes && <p>नोट्स: {usage.notes}</p>}
                    {usage.userId && <p>उपयोगकर्ता: {usage.userId}</p>}
                  </div>
                  <div className="usage-item-actions">
                    {/* Edit button for usage is complex as it affects past inventory.
                        Keeping it simple for now, but updateUsageRecord is in service. */}
                    <button
                      onClick={() => handleEditUsageClick(usage)} // Placeholder for edit
                      className="action-button edit"
                    >
                      ✏️ एडिट करें
                    </button>
                    <button
                      onClick={() => handleDeleteUsage(usage.id, usage.itemName)}
                      className="action-button delete"
                    >
                      🗑️ हटाएँ
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

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

export default StockUsageForm;
