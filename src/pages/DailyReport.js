// ✅ DailyReport.js (Shows Today's Expenses & Transactions)
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./DailyReport.css";

const DailyReport = () => {
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

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const startTimestamp = Math.floor(todayStart.getTime() / 1000);
      const endTimestamp = Math.floor(todayEnd.getTime() / 1000);

      const expenseSnap = await getDocs(
        query(collection(db, "expenses"), where("uid", "==", user.uid))
      );
      const txnSnap = await getDocs(
        query(collection(db, "transactions"), where("uid", "==", user.uid))
      );

      const todayExpenses = expenseSnap.docs
        .map((doc) => doc.data())
        .filter((exp) => exp.timestamp?.seconds >= startTimestamp && exp.timestamp?.seconds <= endTimestamp);

      const todayTxns = txnSnap.docs
        .map((doc) => doc.data())
        .filter((txn) => txn.timestamp?.seconds >= startTimestamp && txn.timestamp?.seconds <= endTimestamp);

      setExpenses(todayExpenses);
      setTransactions(todayTxns);
    };

    fetchData();
  }, [user]);

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.cost || 0), 0);
  const totalTxn = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return (
    <div className="daily-report-page">
      <h2>📅 Daily Report</h2>

      <section className="summary-card">
        <p><strong>🧾 Total Expenses:</strong> ₹{totalExpense}</p>
        <p><strong>💼 Total Transactions:</strong> ₹{totalTxn}</p>
      </section>

      <section className="data-list">
        <div className="card glass">
          <h3>Expenses</h3>
          {expenses.length > 0 ? (
            expenses.map((e, i) => <p key={i}>• {e.name} — ₹{e.cost}</p>)
          ) : (
            <p>No expenses recorded today.</p>
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
            <p>No transactions recorded today.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default DailyReport;
