import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./ExternalPaymentsPage.css";

const ExternalPaymentsPage = () => {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("credit");
  const [profession, setProfession] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const q = query(
        collection(db, "externalPayments"),
        where("uid", "==", user.uid)
      );
      const snap = await getDocs(q);
      setEntries(snap.docs.map((doc) => doc.data()));
    };
    fetchData();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !amount || !profession || !contact) {
      alert("Please fill all fields.");
      return;
    }

    const newEntry = {
      uid: user.uid,
      name,
      contact,
      amount: parseFloat(amount),
      profession,
      type,
      timestamp: Timestamp.now(),
    };

    try {
      await addDoc(collection(db, "externalPayments"), newEntry);
      setEntries((prev) => [...prev, newEntry]);
      setName("");
      setAmount("");
      setProfession("");
      setContact("");
    } catch (err) {
      console.error("Error adding external payment:", err);
    }
  };

  return (
    <div className="external-payments-wrapper">
      <img
        src="https://i.postimg.cc/prnnf7Qs/IMG-20250623-WA0000.jpg"
        alt="Back"
        className="external-logo"
        onClick={() => navigate("/dashboard")}
      />

      <h2 className="external-title">🌐 External Payments</h2>

      <form onSubmit={handleSubmit} className="external-form">
        <input
          type="text"
          placeholder="Person's Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Contact (Phone/Email)"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <input
          type="text"
          placeholder="Profession"
          value={profession}
          onChange={(e) => setProfession(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <button type="submit">➕ Add Payment</button>
      </form>

      <div className="external-table">
        <h3>📄 Payment Records</h3>
        <ul>
          {entries.map((item, i) => (
            <li key={i} className={item.type}>
              <strong>{item.name}</strong> ({item.profession})  
              <br />📞 {item.contact} — ₹{item.amount} [{item.type}]
              <br />
              <small>{new Date(item.timestamp.seconds * 1000).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ExternalPaymentsPage;
