// ✅ MonthlyReportPage.js (Updated)
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
  addDoc,
  Timestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import "./MonthlyReportPage.css";

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchAll = async () => {
      if (!user) return;
      const uid = user.uid;

      const expSnap = await getDocs(query(collection(db, "expenses"), where("uid", "==", uid)));
      const transSnap = await getDocs(query(collection(db, "transactions"), where("uid", "==", uid)));
      const extSnap = await getDocs(query(collection(db, "externalPayments"), where("uid", "==", uid)));
      const startSnap = await getDocs(query(collection(db, "startingAmounts"), where("userId", "==", uid)));
      const empSnap = await getDocs(collection(db, `users/${uid}/employeeTransactions`));

      setExpenses(expSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setTransactions(transSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setExternals(extSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setStartingAmounts(startSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setEmployeeTransactions(empSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };

    fetchAll();
  }, [user]);

  const filterByMonth = (data) => {
    if (!selectedMonth) return data;
    return data.filter((item) => {
      const date = new Date(item.timestamp?.seconds * 1000);
      const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return mStr === selectedMonth;
    });
  };

  const handleDelete = async (type, id) => {
    if (window.confirm("Are you sure?") && window.confirm("Final confirmation?")) {
      try {
        await deleteDoc(doc(db, type, id));
        if (type === "expenses") setExpenses((prev) => prev.filter((e) => e.id !== id));
        if (type === "transactions") setTransactions((prev) => prev.filter((t) => t.id !== id));
        if (type === "externalPayments") setExternals((prev) => prev.filter((x) => x.id !== id));
        if (type === "startingAmounts") setStartingAmounts((prev) => prev.filter((s) => s.id !== id));
      } catch (err) {
        console.error("Error deleting:", err);
      }
    }
  };

  const handleEdit = async (type, id, field, prevValue) => {
    const updated = prompt("Enter updated value:", prevValue);
    if (!updated || updated === prevValue) return;
    if (window.confirm("Confirm edit?") && window.confirm("Final confirm?")) {
      try {
        const ref = doc(db, type, id);
        await updateDoc(ref, { [field]: isNaN(updated) ? updated : Number(updated) });
        if (type === "expenses") setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, [field]: updated } : e));
        if (type === "transactions") setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, [field]: updated } : t));
        if (type === "externalPayments") setExternals((prev) => prev.map((x) => x.id === id ? { ...x, [field]: updated } : x));
        if (type === "startingAmounts") setStartingAmounts((prev) => prev.map((s) => s.id === id ? { ...s, [field]: updated } : s));
      } catch (err) {
        console.error("Error updating:", err);
      }
    }
  };

  const handleAddStarting = async () => {
    if (!newStartAmount || isNaN(newStartAmount)) return alert("Enter valid amount");
    try {
      await addDoc(collection(db, "startingAmounts"), {
        amount: parseFloat(newStartAmount),
        timestamp: Timestamp.now(),
        userId: user.uid,
      });
      setNewStartAmount("");
      alert("Starting amount added");
    } catch (err) {
      console.error("Error adding:", err);
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
    <div className="monthly-report-wrapper">
      <img
        src="https://i.postimg.cc/prnnf7Qs/IMG-20250623-WA0000.jpg"
        alt="Back"
        className="monthly-report-logo"
        onClick={() => navigate("/dashboard")}
      />

      <h2>📊 Monthly Report (Combined)</h2>

      <div className="filter-box">
        <label>Select Month:</label>
        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
      </div>

      <div className="add-starting-box">
        <label>Add Starting Balance:</label>
        <input
          type="number"
          placeholder="Enter amount"
          value={newStartAmount}
          onChange={(e) => setNewStartAmount(e.target.value)}
        />
        <button className="export-btn excel" onClick={handleAddStarting}>➕ Add</button>
      </div>

      <div className="report-summary">
        <p>🏦 Starting Balance: ₹{totalStart}</p>
        <p>💸 Total Expense: ₹{totalExpense}</p>
        <p>💰 Total Credit: ₹{totalCredit}</p>
        <p>🧾 Total Debit: ₹{totalDebit}</p>
        <p>💼 Final Balance: ₹{finalBalance}</p>
      </div>

      <div className="report-table">
        <h3>📋 Full Breakdown</h3>
        <ul>
          {filteredStarting.map((s, i) => (
            <li key={`start-${i}`}>🏦 ₹{s.amount} — {new Date(s.timestamp?.seconds * 1000).toLocaleDateString()} 
              <button onClick={() => handleEdit("startingAmounts", s.id, "amount", s.amount)}>✏️</button>
              <button onClick={() => handleDelete("startingAmounts", s.id)}>❌</button>
            </li>
          ))}
          {filteredExpenses.map((e, i) => (
            <li key={`exp-${i}`} style={{ color: "red" }}>💸 {e.name} - ₹{e.cost} — {new Date(e.timestamp?.seconds * 1000).toLocaleDateString()}
              <button onClick={() => handleEdit("expenses", e.id, "cost", e.cost)}>✏️</button>
              <button onClick={() => handleDelete("expenses", e.id)}>❌</button>
            </li>
          ))}
          {filteredTransactions.map((t, i) => (
            <li key={`txn-${i}`} style={{ color: t.type === "credit" ? "green" : "orange" }}>💼 {t.type.toUpperCase()} ₹{t.amount} to {t.to} — {new Date(t.timestamp?.seconds * 1000).toLocaleDateString()}
              <button onClick={() => handleEdit("transactions", t.id, "amount", t.amount)}>✏️</button>
              <button onClick={() => handleDelete("transactions", t.id)}>❌</button>
            </li>
          ))}
          {filteredExternals.map((x, i) => (
            <li key={`ext-${i}`} style={{ color: x.type === "credit" ? "green" : "orange" }}>🌐 {x.name} ({x.profession}) - {x.type} ₹{x.amount} — {new Date(x.timestamp?.seconds * 1000).toLocaleDateString()}
              <button onClick={() => handleEdit("externalPayments", x.id, "amount", x.amount)}>✏️</button>
              <button onClick={() => handleDelete("externalPayments", x.id)}>❌</button>
            </li>
          ))}
          {filteredEmpTxns.map((x, i) => (
            <li key={`emp-${i}`} style={{ color: x.type === "credit" ? "green" : "orange" }}>👥 {x.type.toUpperCase()} ₹{x.amount} from {x.from} — {new Date(x.timestamp?.seconds * 1000).toLocaleDateString()}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MonthlyReportPage;