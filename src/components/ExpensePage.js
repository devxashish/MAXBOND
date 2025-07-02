""// ✅ Updated ExpensePage.js (for export-compatible data structure)

import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  Timestamp,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import "./ExpensePage.css";
import { useNavigate } from "react-router-dom";

const ExpensePage = () => {
  const [user, setUser] = useState(null);
  const [productName, setProductName] = useState("");
  const [productCost, setProductCost] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) navigate("/login");
      setUser(currentUser);
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const expQuery = query(collection(db, "expenses"), where("uid", "==", user.uid));
      const expSnap = await getDocs(expQuery);
      setExpenses(expSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, [user]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!productName || !productCost || isNaN(productCost)) return;
    const newExpense = {
      uid: user.uid,
      name: productName,
      cost: parseFloat(productCost),
      timestamp: Timestamp.now(),
    };
    try {
      const docRef = await addDoc(collection(db, "expenses"), newExpense);
      setExpenses((prev) => [...prev, { ...newExpense, id: docRef.id }]);
      setProductName("");
      setProductCost(0);
    } catch (err) {
      console.error("Error adding expense:", err);
    }
  };

  const handleEdit = async (id, prevValue) => {
    const updated = prompt("Enter updated cost:", prevValue);
    if (updated && window.confirm("Confirm update?") && window.confirm("Final confirmation?")) {
      try {
        const updateData = { cost: parseFloat(updated) };
        await updateDoc(doc(db, "expenses", id), updateData);
        setExpenses((prev) =>
          prev.map((exp) => (exp.id === id ? { ...exp, ...updateData } : exp))
        );
      } catch (err) {
        console.error("Edit failed:", err);
      }
    }
  };

  const handleDelete = async (id) => {
    if (
      window.confirm("Are you sure you want to delete this expense?") &&
      window.confirm("This action is irreversible. Confirm again?")
    ) {
      try {
        await deleteDoc(doc(db, "expenses", id));
        setExpenses((prev) => prev.filter((exp) => exp.id !== id));
      } catch (err) {
        console.error("Delete failed:", err);
      }
    }
  };

  const totalSpent = expenses.reduce((acc, curr) => acc + Number(curr.cost), 0);

  return (
    <div className="expense-page-wrapper">
      <div className="top-bar">
        <img
          src="https://i.postimg.cc/prnnf7Qs/IMG-20250623-WA0000.jpg"
          alt="Back"
          className="back-logo"
          onClick={() => navigate("/dashboard")}
        />
      </div>

      <h1 className="expense-title">💰 Expense Tracker</h1>

      <div className="expense-input-box">
        <form className="expense-form" onSubmit={handleAddExpense}>
          <label>Product Name:</label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
          />

          <label>Cost:</label>
          <input
            type="number"
            value={productCost}
            onChange={(e) => setProductCost(e.target.value)}
            required
          />

          <button className="add-button" type="submit">➕ Add Expense</button>
        </form>
      </div>

      <div className="expense-summary">
        <p>💸 Total Spent: ₹{totalSpent}</p>
      </div>

      <div className="expense-list">
        <h2>📋 Daily Expense List</h2>
        <ul>
          {expenses.map((exp) => (
            <li className="expense-item" key={exp.id}>
              {exp.name} - ₹{exp.cost} — {exp.timestamp?.toDate().toLocaleString()}
              <div>
                <button className="edit-btn" onClick={() => handleEdit(exp.id, exp.cost)}>✏️ Edit</button>
                <button className="delete-btn" onClick={() => handleDelete(exp.id)}>❌ Clear</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ExpensePage;
