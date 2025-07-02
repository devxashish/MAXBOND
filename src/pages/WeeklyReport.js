// ✅ WeeklyReport.js — Last 7 Days Report
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./WeeklyReport.css";

const WeeklyReport = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (curr) => {
      if (curr) setUser(curr);
      else navigate("/login");
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const now = Date.now() / 1000; // current time in seconds
      const weekAgo = now - 7 * 24 * 60 * 60;

      const expSnap = await getDocs(
        query(collection(db, "expenses"), where("uid", "==", user.uid))
      );
      const txnSnap = await getDocs(
        query(collection(db, "transactions"), where("uid", "==", user.uid))
      );

      const filteredExpenses = expSnap.docs
        .map((doc) => doc.data())
        .filter((e) => e.timestamp?.seconds >= weekAgo);

      const filteredTxns = txnSnap.docs
        .map((doc) => doc.data())
        .filter((t) => t.timestamp?.seconds >= weekAgo);

      setExpenses(filteredExpenses);
      setTransactions(filteredTxns);
    };

    fetchData();
  }, [user]);

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.cost || 0), 0);
  const totalTxn = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return (
    <div className="weekly-report-page">
      <h2>📅 Weekly Report</h2>

      <section className="summary-card">
        <p><strong>🧾 Total Expenses (7 Days):</strong> ₹{totalExpense}</p>
        <p><strong>💼 Total Transactions:</strong> ₹{totalTxn}</p>
      </section>

      <section className="data-list">
        <div className="card glass">
          <h3>Expenses</h3>
          {expenses.length > 0 ? (
            expenses.map((e, i) => <p key={i}>• {e.name} — ₹{e.cost}</p>)
          ) : (
            <p>No expenses in the last 7 days.</p>
          )}
        </div>

        <div className="card glass">
          <h3>Transactions</h3>
          {transactions.length > 0 ? (
            transactions.map((t, i) => (
              <p key={i}>
                • {t.type.toUpperCase()} ₹{t.amount} to/from {t.to || t.email}
              </p>
            ))
          ) : (
            <p>No transactions in the last 7 days.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default WeeklyReport;

