import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./TransactionsPage.css";

const TransactionsPage = () => {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("credit");

  const navigate = useNavigate();

  // 🔐 Check if user is logged in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (curr) => {
      if (curr) setUser(curr);
      else navigate("/login");
    });
    return () => unsub();
  }, [navigate]);

  // 📥 Load previous transactions
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const q = query(collection(db, "transactions"), where("uid", "==", user.uid));
      const snap = await getDocs(q);
      setTransactions(snap.docs.map((doc) => doc.data()));
    };
    fetchData();
  }, [user]);

  // 📤 Send Push Notification
  const sendNotification = async (recipientUid, title, body) => {
    try {
      const tokenSnap = await getDocs(
        query(collection(db, "fcmTokens"), where("uid", "==", recipientUid))
      );

      if (!tokenSnap.empty) {
        const token = tokenSnap.docs[0].data().token;

        await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "key=**REPLACE_WITH_YOUR_SERVER_KEY**" // 🔴 Replace with your real server key
          },
          body: JSON.stringify({
            to: token,
            notification: {
              title,
              body
            }
          })
        });
      }
    } catch (error) {
      console.error("❌ Notification error:", error);
    }
  };

  // ➕ Add Transaction
  const handleAdd = async () => {
    if (!email || !amount || !name) return alert("Please fill all fields.");

    const newEntry = {
      uid: user.uid,
      email,
      name,
      amount: parseFloat(amount),
      type,
      timestamp: Timestamp.now(),
    };

    try {
      // Step 1: Add to admin's record
      await addDoc(collection(db, "transactions"), newEntry);

      // Step 2: Get employee UID by email
      const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
      if (!userSnap.empty) {
        const empDoc = userSnap.docs[0];
        const empUid = empDoc.id;

        // Step 3: Save under their account too
        await addDoc(collection(db, `users/${empUid}/employeeTransactions`), {
          from: user.email,
          name,
          amount: parseFloat(amount),
          type,
          timestamp: Timestamp.now(),
        });

        // Step 4: Send push notification
        await sendNotification(empUid, `💰 ${type.toUpperCase()} of ₹${amount}`, `By ${user.email}`);
      }

      // Step 5: Show in admin's UI too
      setTransactions((prev) => [...prev, newEntry]);
      setEmail("");
      setName("");
      setAmount("");
      setType("credit");
    } catch (err) {
      console.error("❌ Transaction error:", err);
    }
  };

  return (
    <div className="transactions-wrapper">
      <img
        src="https://i.postimg.cc/prnnf7Qs/IMG-20250623-WA0000.jpg"
        alt="Logo"
        className="back-logo"
        onClick={() => navigate("/dashboard")}
      />
      <h2>💼 Transactions</h2>

      <div className="input-box">
        <input
          placeholder="Member Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Member Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <button onClick={handleAdd}>➕ Add</button>
      </div>

      <div className="list-box">
        {transactions.map((t, i) => (
          <p key={i}>
            👤 {t.name} | 📧 {t.email} — ₹{t.amount} — {t.type.toUpperCase()} —{" "}
            {new Date(t.timestamp.seconds * 1000).toLocaleString()}
          </p>
        ))}
      </div>
    </div>
  );
};

export default TransactionsPage;
