    // src/components/StockSummaryPage.jsx
    import React, { useEffect, useState } from "react";
    import { getAllInventory, updateInventoryItem, deleteInventoryItem } from "../services/inventoryService"; // Import deleteInventoryItem
    import { getAllSites } from "../services/siteService";
    import { exportToPdf, exportToExcel } from "../utils/exportUtils";
    import Modal from "./Modal";
    import EditInventoryItemModal from "./EditInventoryItemModal"; // Import the edit modal
    import '../styles/StockSummaryPage.css'; // Import the CSS file

    const StockSummaryPage = () => {
      const [inventory, setInventory] = useState([]);
      const [sites, setSites] = useState({});
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [startDate, setStartDate] = useState("");
      const [endDate, setEndDate] = useState("");

      const [isEditModalOpen, setIsEditModalOpen] = useState(false);
      const [selectedItemForEdit, setSelectedItemForEdit] = useState(null);
      const [allSites, setAllSites] = useState([]); // To pass to the edit modal

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

      const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
          const [allInventory, allSitesList] = await Promise.all([
            getAllInventory(),
            getAllSites(),
          ]);

          const sitesMap = allSitesList.reduce((acc, site) => {
            acc[site.id] = site.name;
            return acc;
          }, {});
          setSites(sitesMap);
          setAllSites(allSitesList); // Save all sites for the edit modal

          setInventory(allInventory);
        } catch (err) {
          console.error("Error fetching stock summary:", err);
          setError("Failed to load stock summary.");
        } finally {
          setLoading(false);
        }
      };

      useEffect(() => {
        fetchData();
      }, []);

      const filteredInventory = inventory.filter(item => {
        const itemDate = item.createdAt?.toDate ? new Date(item.createdAt.toDate()) : null;
        if (!itemDate) return false;

        let passesFilter = true;
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0); // Start of the day
          if (itemDate < start) passesFilter = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // End of the day
          if (itemDate > end) passesFilter = false;
        }
        return passesFilter;
      });

      const handleExportPdf = () => {
        if (filteredInventory.length === 0) {
          openModal("No Data", "No stock records to export.");
          return;
        }
        const headers = ["Item Name", "Quantity", "Unit", "Site", "Added Date"];
        const formattedData = filteredInventory.map(item => ({
          itemName: item.itemName,
          quantity: `${item.quantity} ${item.unit || ""}`,
          unit: item.unit || "N/A", // Ensure unit is included for PDF
          site: sites[item.siteId] || "Unknown Site",
          addedDate: item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleString() : "N/A",
        }));
        exportToPdf(formattedData, headers, "stock_summary", "Stock Summary Report");
        openModal("Export Successful", "Stock summary successfully exported as PDF.");
      };

      const handleExportExcel = () => {
        if (filteredInventory.length === 0) {
          openModal("No Data", "No stock records to export.");
          return;
        }
        const formattedData = filteredInventory.map(item => ({
          "Item Name": item.itemName,
          "Quantity": `${item.quantity} ${item.unit || ""}`,
          "Unit": item.unit || "N/A",
          "Site": sites[item.siteId] || "Unknown Site",
          "Added Date": item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleString() : "N/A",
        }));
        exportToExcel(formattedData, "stock_summary");
        openModal("Export Successful", "Stock summary successfully exported as Excel.");
      };

      const handleEditClick = (item) => {
        setSelectedItemForEdit(item);
        setIsEditModalOpen(true);
      };

      const handleSaveEditedItem = async (updatedItem) => {
        try {
          await updateInventoryItem(updatedItem.id, {
            itemName: updatedItem.itemName,
            quantity: updatedItem.quantity,
            unit: updatedItem.unit,
            siteId: updatedItem.siteId,
            createdAt: updatedItem.createdAt, // Ensure createdAt is updated
          });
          openModal("Success", "Item updated successfully!");
          fetchData(); // Re-fetch data to reflect changes and re-apply filters
        } catch (err) {
          console.error("Error updating item:", err);
          openModal("Error", `Failed to update item: ${err.message || "Unknown error"}`);
        } finally {
          setIsEditModalOpen(false);
          setSelectedItemForEdit(null);
        }
      };

      const handleDeleteItem = async (itemId, itemName) => {
        openModal(
          "Confirm Deletion",
          `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
          async () => {
            try {
              await deleteInventoryItem(itemId);
              openModal("Success", "Item deleted successfully!");
              fetchData(); // Re-fetch data to update the list
            } catch (err) {
              console.error("Error deleting item:", err);
              openModal("Error", `Failed to delete item: ${err.message || "Unknown error"}`);
            }
          },
          true // Show cancel button
        );
      };

      return (
        <div className="stock-summary-container">
          <h2 className="stock-summary-title">📊 Full Stock Summary</h2>

          <div className="filter-export-section">
            <div className="filter-group">
              <label htmlFor="startDate" className="filter-label">Start Date:</label>
              <input
                type="date"
                id="startDate"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="endDate" className="filter-label">End Date:</label>
              <input
                type="date"
                id="endDate"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="export-buttons">
              <button
                onClick={handleExportPdf}
                className="export-button pdf"
                disabled={filteredInventory.length === 0 || loading}
              >
                Export to PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="export-button excel"
                disabled={filteredInventory.length === 0 || loading}
              >
                Export to Excel
              </button>
            </div>
          </div>

          {loading && <p className="stock-summary-message">Loading stock summary...</p>}
          {error && <p className="stock-summary-message text-red">{error}</p>}

          {!loading && !error && filteredInventory.length === 0 ? (
            <p className="stock-summary-message">No stock records found.</p>
          ) : (
            !loading && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Site</th>
                      <th>Added Date</th>
                      <th>Actions</th> {/* New column for actions */}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => (
                      <tr key={item.id}>
                        <td>{item.itemName}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unit || "N/A"}</td>
                        <td>{sites[item.siteId] || "Unknown Site"}</td>
                        <td>
                          {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleString() : "N/A"}
                        </td>
                        <td className="stock-summary-actions-cell">
                          <button
                            onClick={() => handleEditClick(item)}
                            className="stock-summary-action-button edit"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.itemName)}
                            className="stock-summary-action-button delete"
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
          {selectedItemForEdit && (
            <EditInventoryItemModal
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              item={selectedItemForEdit}
              onSave={handleSaveEditedItem}
              sites={allSites} // Pass all sites for the dropdown
            />
          )}
        </div>
      );
    };

    export default StockSummaryPage;
    