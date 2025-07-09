// src/pages/MonthlyReportPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Assuming react-router-dom is used for navigation
import { db, auth, collection, getDocs, query, where, deleteDoc, doc, updateDoc, addDoc, Timestamp } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import Modal from "../components/Modal"; // Import your custom Modal
import EditReportItemModal from "../components/EditReportItemModal"; // Import the new edit modal for report items
import './MonthlyReportPage.css'; // Import the new CSS file

const MonthlyReportPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [externals, setExternals] = useState([]);
  const [startingAmounts, setStartingAmounts] = useState([]);
  const [employeeTransactions, setEmployeeTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [newStartAmount, setNewStartAmount] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", message: "", onConfirm: null, showCancelButton: false });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState(null);
  const [editItemType, setEditItemType] = useState("");
  const [editField, setEditField] = useState("");

  const openModal = (title, message, onConfirm = null, showCancelButton = false) => {
    setModalContent({ title, message, onConfirm, showCancelButton });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalContent({ title: "", message: "", onConfirm: null, showCancelButton: false });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Redirect to login if not authenticated
        // navigate("/login");
        // For development without full auth setup, you might temporarily skip navigation
        console.log("User not authenticated. Skipping navigation to /login for now.");
        // If you want to proceed without auth for testing, set a dummy user:
        // setUser({ uid: "dummyUserId" });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchAllData = async () => {
    if (!user) return;
    const uid = user.uid;

    try {
      const expSnap = await getDocs(query(collection(db, "expenses"), where("uid", "==", uid)));
      const transSnap = await getDocs(query(collection(db, "transactions"), where("uid", "==", uid)));
      const extSnap = await getDocs(query(collection(db, "externalPayments"), where("uid", "==", uid)));
      const startSnap = await getDocs(query(collection(db, "startingAmounts"), where("userId", "==", uid)));
      // Employee transactions are nested, so fetch them correctly
      const empSnap = await getDocs(collection(db, `users/${uid}/employeeTransactions`));

      setExpenses(expSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setTransactions(transSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setExternals(extSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setStartingAmounts(startSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setEmployeeTransactions(empSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching all data:", err);
      openModal("Error", `Failed to fetch data: ${err.message || "Unknown error"}`);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [user]); // Re-fetch when user changes

  const filterByMonth = (data) => {
    if (!selectedMonth) return data;
    return data.filter((item) => {
      const date = item.timestamp?.toDate ? item.timestamp.toDate() : null;
      if (!date) return false;
      const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return mStr === selectedMonth;
    });
  };

  const handleDelete = async (type, id, itemName = "this item") => {
    openModal(
      "Confirm Deletion",
      `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
      async () => {
        try {
          // Special handling for nested employeeTransactions
          const collectionPath = type.startsWith("users/") ? type : type;
          await deleteDoc(doc(db, collectionPath, id));
          openModal("Success", `🗑️ ${itemName} deleted successfully!`);
          fetchAllData(); // Re-fetch all data to update UI
        } catch (err) {
          console.error("Error deleting:", err);
          openModal("Error", `❌ Failed to delete ${itemName}: ${err.message || "Unknown error"}`);
        }
      },
      true // Show cancel button
    );
  };

  const handleEditClick = (item, type, field) => {
    setSelectedItemForEdit(item);
    setEditItemType(type);
    setEditField(field);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedItem = async (itemId, field, updatedValue, type) => {
    try {
      const collectionPath = type.startsWith("users/") ? type : type;
      const ref = doc(db, collectionPath, itemId);
      await updateDoc(ref, { [field]: updatedValue });
      openModal("Success", `✅ ${field} updated successfully!`);
      fetchAllData(); // Re-fetch all data to update UI
    } catch (err) {
      console.error("Error updating:", err);
      openModal("Error", `❌ Failed to update ${field}: ${err.message || "Unknown error"}`);
    } finally {
      setIsEditModalOpen(false);
      setSelectedItemForEdit(null);
      setEditItemType("");
      setEditField("");
    }
  };

  const handleAddStarting = async () => {
    if (!newStartAmount || isNaN(newStartAmount)) {
      openModal("Invalid Amount", "Please enter a valid number for the starting balance.");
      return;
    }
    if (!user) {
      openModal("Authentication Error", "User not authenticated. Please log in.");
      return;
    }
    try {
      await addDoc(collection(db, "startingAmounts"), {
        amount: parseFloat(newStartAmount),
        timestamp: Timestamp.now(),
        userId: user.uid,
      });
      setNewStartAmount("");
      openModal("Success", "Starting amount added successfully!");
      fetchAllData(); // Re-fetch all data to update UI
    } catch (err) {
      console.error("Error adding:", err);
      openModal("Error", `Failed to add starting amount: ${err.message || "Unknown error"}`);
    }
  };

  const filteredExpenses = filterByMonth(expenses);
  const filteredTransactions = filterByMonth(transactions);
  const filteredExternals = filterByMonth(externals);
  const filteredStarting = filterByMonth(startingAmounts);
  const filteredEmpTxns = filterByMonth(employeeTransactions);

  const totalStart = filteredStarting.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalExpense = filteredExpenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const creditTxn = filteredTransactions.filter((t) => t.type === "credit").reduce((sum, t) => sum + Number(t.amount), 0);
  const debitTxn = filteredTransactions.filter((t) => t.type === "debit").reduce((sum, t) => sum + Number(t.amount), 0);
  const creditExt = filteredExternals.filter((x) => x.type === "credit").reduce((sum, x) => sum + Number(x.amount), 0);
  const debitExt = filteredExternals.filter((x) => x.type === "debit").reduce((sum, x) => sum + Number(x.amount), 0);
  const creditEmp = filteredEmpTxns.filter((x) => x.type === "credit").reduce((sum, x) => sum + Number(x.amount), 0);
  const debitEmp = filteredEmpTxns.filter((x) => x.type === "debit").reduce((sum, x) => sum + Number(x.amount), 0);

  const totalCredit = creditTxn + creditExt + creditEmp;
  const totalDebit = debitTxn + debitExt + debitEmp;
  const finalBalance = totalStart + totalCredit - totalExpense - totalDebit;

  return (
    <div className="report-page-container"> {/* New wrapper for the entire page to apply global background */}
      <div className="report-hero-section">
        <h2 className="report-main-title">📊 Monthly Report (Combined)</h2>
      </div>

      <div className="monthly-report-wrapper"> {/* This now acts as the content card */}
        <div className="filter-box">
          <label className="filter-label">Select Month:</label>
          <input type="month" className="form-input" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
        </div>

        <div className="add-starting-box">
          <label className="add-starting-label">Add Starting Balance:</label>
          <input
            type="number"
            className="form-input"
            placeholder="Enter amount"
            value={newStartAmount}
            onChange={(e) => setNewStartAmount(e.target.value)}
          />
          <button className="primary-button add-starting-button" onClick={handleAddStarting}>➕ Add</button>
        </div>

        <div className="report-summary">
          <p>🏦 Starting Balance: <span className="summary-amount">₹{totalStart.toFixed(2)}</span></p>
          <p>💸 Total Expense: <span className="summary-amount">₹{totalExpense.toFixed(2)}</span></p>
          <p>💰 Total Credit: <span className="summary-amount">₹{totalCredit.toFixed(2)}</span></p>
          <p>🧾 Total Debit: <span className="summary-amount">₹{totalDebit.toFixed(2)}</span></p>
          <p className="final-balance">💼 Final Balance: <span className="summary-amount">₹{finalBalance.toFixed(2)}</span></p>
        </div>

        <div className="report-table">
          <h3 className="breakdown-title">📋 Full Breakdown</h3>
          <ul className="breakdown-list">
            {filteredStarting.map((s) => (
              <li key={`start-${s.id}`} className="breakdown-item">
                <span className="item-text">🏦 ₹{Number(s.amount).toFixed(2)} — {new Date(s.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                <div className="item-actions">
                  <button className="action-button edit" onClick={() => handleEditClick(s, "startingAmounts", "amount")}>✏️</button>
                  <button className="action-button edit" onClick={() => handleEditClick(s, "startingAmounts", "timestamp")}>📅</button>
                  <button className="action-button delete" onClick={() => handleDelete("startingAmounts", s.id, "Starting Balance")}>❌</button>
                </div>
              </li>
            ))}
            {filteredExpenses.map((e) => (
              <li key={`exp-${e.id}`} className="breakdown-item expense-item">
                <span className="item-text">💸 {e.name} - ₹{Number(e.cost).toFixed(2)} — {new Date(e.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                <div className="item-actions">
                  <button className="action-button edit" onClick={() => handleEditClick(e, "expenses", "name")}>✏️</button>
                  <button className="action-button edit" onClick={() => handleEditClick(e, "expenses", "cost")}>💰</button>
                  <button className="action-button edit" onClick={() => handleEditClick(e, "expenses", "timestamp")}>📅</button>
                  <button className="action-button delete" onClick={() => handleDelete("expenses", e.id, e.name)}>❌</button>
                </div>
              </li>
            ))}
            {filteredTransactions.map((t) => (
              <li key={`txn-${t.id}`} className={`breakdown-item ${t.type === "credit" ? "credit-item" : "debit-item"}`}>
                <span className="item-text">💼 {t.type.toUpperCase()} ₹{Number(t.amount).toFixed(2)} {t.type === "debit" ? "to" : "from"} {t.to || t.from} — {new Date(t.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                <div className="item-actions">
                  <button className="action-button edit" onClick={() => handleEditClick(t, "transactions", "amount")}>💰</button>
                  <button className="action-button edit" onClick={() => handleEditClick(t, "transactions", "to")}>➡️</button>
                  <button className="action-button edit" onClick={() => handleEditClick(t, "transactions", "timestamp")}>📅</button>
                  <button className="action-button delete" onClick={() => handleDelete("transactions", t.id, `Transaction to ${t.to || t.from}`)}>❌</button>
                </div>
              </li>
            ))}
            {filteredExternals.map((x) => (
              <li key={`ext-${x.id}`} className={`breakdown-item ${x.type === "credit" ? "credit-item" : "debit-item"}`}>
                <span className="item-text">🌐 {x.name} ({x.profession}) - {x.type} ₹{Number(x.amount).toFixed(2)} — {new Date(x.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                <div className="item-actions">
                  <button className="action-button edit" onClick={() => handleEditClick(x, "externalPayments", "amount")}>💰</button>
                  <button className="action-button edit" onClick={() => handleEditClick(x, "externalPayments", "name")}>✏️</button>
                  <button className="action-button edit" onClick={() => handleEditClick(x, "externalPayments", "profession")}>💼</button>
                  <button className="action-button edit" onClick={() => handleEditClick(x, "externalPayments", "timestamp")}>📅</button>
                  <button className="action-button delete" onClick={() => handleDelete("externalPayments", x.id, `${x.name} (${x.profession})`)}>❌</button>
                </div>
              </li>
            ))}
            {filteredEmpTxns.map((x) => (
              <li key={`emp-${x.id}`} className={`breakdown-item ${x.type === "credit" ? "credit-item" : "debit-item"}`}>
                <span className="item-text">👥 {x.type.toUpperCase()} ₹{Number(x.amount).toFixed(2)} from {x.from} — {new Date(x.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                <div className="item-actions">
                  <button className="action-button edit" onClick={() => handleEditClick(x, `users/${user.uid}/employeeTransactions`, "amount")}>💰</button>
                  <button className="action-button edit" onClick={() => handleEditClick(x, `users/${user.uid}/employeeTransactions`, "from")}>👤</button>
                  <button className="action-button edit" onClick={() => handleEditClick(x, `users/${user.uid}/employeeTransactions`, "timestamp")}>📅</button>
                  <button className="action-button delete" onClick={() => handleDelete(`users/${user.uid}/employeeTransactions`, x.id, `Employee Txn from ${x.from}`)}>❌</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          title={modalContent.title}
          message={modalContent.message}
          onConfirm={modalContent.onConfirm}
          showCancelButton={modalContent.showCancelButton}
        />
        {isEditModalOpen && selectedItemForEdit && (
          <EditReportItemModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            item={selectedItemForEdit}
            type={editItemType}
            fieldToEdit={editField}
            onSave={handleSaveEditedItem}
          />
        )}
      </div>
    </div>
  );
};

export default MonthlyReportPage;
