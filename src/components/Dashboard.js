import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { db, auth } from "../firebase";
import { 
  collection, 
  getDocs, 
  query, 
  where,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import "./Dashboard.css";
import BottomTab from "../components/BottomTab";

// Unified financial calculation function
export const calculateFinancialSummary = (
  expenses,
  transactions,
  externals,
  startingAmounts,
  employeeTransactions,
  period
) => {
  const now = Date.now() / 1000;
  let cutoffStart = now;
  
  if (period === "daily") {
    cutoffStart = now - 86400;
  } else if (period === "weekly") {
    cutoffStart = now - 7 * 86400;
  } else if (period === "monthly") {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    cutoffStart = firstDay.getTime() / 1000;
  }

  const filterData = (data) => {
    return data.filter(item => {
      const itemTime = item.timestamp?.seconds;
      return itemTime >= cutoffStart;
    });
  };

  const filteredExpenses = filterData(expenses);
  const filteredTransactions = filterData(transactions);
  const filteredExternals = filterData(externals);
  const filteredStarting = filterData(startingAmounts);
  const filteredEmpTxns = filterData(employeeTransactions);
  
  const totalStart = filteredStarting.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalExpense = filteredExpenses.reduce((sum, e) => sum + Number(e.cost || 0), 0);
  
  const creditTxn = filteredTransactions
    .filter(t => t.type === "credit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    
  const debitTxn = filteredTransactions
    .filter(t => t.type === "debit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    
  const creditExt = filteredExternals
    .filter(x => x.type === "credit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
    
  const debitExt = filteredExternals
    .filter(x => x.type === "debit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
    
  const creditEmp = filteredEmpTxns
    .filter(x => x.type === "credit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
    
  const debitEmp = filteredEmpTxns
    .filter(x => x.type === "debit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
  
  const totalCredit = creditTxn + creditExt + creditEmp;
  const totalDebit = debitTxn + debitExt + debitEmp;
  const netBalance = totalStart + totalCredit - totalExpense - totalDebit;
  
  return {
    openingBalance: totalStart,
    totalIncome: totalCredit,
    totalExpenses: totalExpense + totalDebit,
    totalCredit,
    totalDebit,
    netBalance
  };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedTab, setSelectedTab] = useState("daily");
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [externals, setExternals] = useState([]);
  const [startingAmounts, setStartingAmounts] = useState([]);
  const [employeeTransactions, setEmployeeTransactions] = useState([]);
  const [summary, setSummary] = useState({
    openingBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    totalCredit: 0,
    totalDebit: 0,
    netBalance: 0
  });
  const [loading, setLoading] = useState(true);
  const [showExternal, setShowExternal] = useState(true);
  const [showBalanceForm, setShowBalanceForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [expenseData, setExpenseData] = useState({
    name: "",
    category: "other",
    cost: "",
    description: ""
  });

  // Categories for expense form
  const categories = [
    "Shopping", "Food", "Transport", "Utilities", 
    "Entertainment", "Health", "Education", "Other"
  ];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (curr) => {
      if (curr) {
        setUser(curr);
       setIsAdmin(curr.email === "rajk4435689@admin.com" || curr.uid === "admin-uid");
    }else navigate("/login");
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!user) return;
      setLoading(true);
      const uid = user.uid;
      
      try {
        // Fetch all collections
        const [
          expSnap, 
          txnSnap, 
          extSnap, 
          startSnap, 
          empSnap
        ] = await Promise.all([
          getDocs(query(collection(db, "expenses"), where("uid", "==", uid))),
          getDocs(query(collection(db, "transactions"), where("uid", "==", uid))),
          getDocs(query(collection(db, "externalPayments"), where("uid", "==", uid))),
          getDocs(query(collection(db, "startingAmounts"), where("userId", "==", uid))),
          getDocs(collection(db, `users/${uid}/employeeTransactions`))
        ]);
        
        // Set all data
        setExpenses(expSnap.docs.map(doc => doc.data()));
        setTransactions(txnSnap.docs.map(doc => doc.data()));
        setExternals(extSnap.docs.map(doc => doc.data()));
        setStartingAmounts(startSnap.docs.map(doc => doc.data()));
        setEmployeeTransactions(empSnap.docs.map(doc => doc.data()));
        
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    const newSummary = calculateFinancialSummary(
      expenses,
      transactions,
      externals,
      startingAmounts,
      employeeTransactions,
      selectedTab
    );
    
    setSummary(newSummary);
  }, [selectedTab, expenses, transactions, externals, startingAmounts, employeeTransactions, user]);

  const handleTab = (tab) => {
    setSelectedTab(tab);
  };

  const getTimeLabel = () => {
    if (selectedTab === "daily") return "Today";
    if (selectedTab === "weekly") return "This Week";
    return "This Month";
  };

  // Format date for display
  const formatDate = (seconds) => {
    return new Date(seconds * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get category icon
  const getCategoryIcon = (category) => {
    const icons = {
      "shopping": "fa-shopping-bag",
      "food": "fa-utensils",
      "transport": "fa-car",
      "salary": "fa-money-bill-wave",
      "investment": "fa-chart-line",
      "health": "fa-heart-pulse",
      "education": "fa-book",
      "entertainment": "fa-film",
      "utilities": "fa-bolt",
      "other": "fa-wallet"
    };
    return icons[category?.toLowerCase()] || "fa-wallet";
  };

  // Combine all data for display
  const getAllTransactions = () => {
    // Convert expenses to transaction-like objects
    const expenseTransactions = expenses.map(expense => ({
      ...expense,
      type: "expense",
      amount: -expense.cost,
      isExpense: true,
      id: `exp-${expense.id}`,
      timestamp: expense.timestamp || { seconds: Date.now() / 1000 }
    }));

    // Convert external payments
    const externalTransactions = externals.map(external => ({
      ...external,
      isExternal: true,
      id: `ext-${external.id}`
    }));

    // Convert starting balances to transaction-like objects
    const startingBalanceTransactions = startingAmounts.map(start => ({
      ...start,
      type: "opening_balance",
      amount: start.amount,
      isOpeningBalance: true,
      id: `start-${start.id}`,
      timestamp: start.timestamp || { seconds: Date.now() / 1000 }
    }));

    // Combine all data sources
    return [
      ...startingBalanceTransactions,
      ...transactions,
      ...expenseTransactions,
      ...externalTransactions,
      ...employeeTransactions
    ];
  };

  // Filter combined transactions
  const filteredTransactions = getAllTransactions().filter(t => {
    // Skip external transactions if toggle is off
    if (!showExternal && t.isExternal) return false;
    
    // Filter by time period
    const now = Date.now() / 1000;
    let cutoff = now - 86400; // Daily by default
    
    if (selectedTab === "weekly") {
      cutoff = now - 7 * 86400;
    } else if (selectedTab === "monthly") {
      const date = new Date();
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      cutoff = firstDay.getTime() / 1000;
    }
    
    return t.timestamp?.seconds >= cutoff;
  });

  // Sort by timestamp (newest first)
  const sortedTransactions = [...filteredTransactions].sort((a, b) => 
    b.timestamp?.seconds - a.timestamp?.seconds
  );

  // Add starting balance to Firestore
  const addStartingBalance = async () => {
    if (!user || !balanceAmount || isNaN(balanceAmount)) return;
    
    try {
      await addDoc(collection(db, "startingAmounts"), {
        amount: Number(balanceAmount),
        userId: user.uid,
        timestamp: serverTimestamp(),
        isDailyBalance: true
      });
      
      // Refresh data
      const startSnap = await getDocs(query(collection(db, "startingAmounts"), where("userId", "==", user.uid)));
      setStartingAmounts(startSnap.docs.map(doc => doc.data()));
      
      // Reset form
      setBalanceAmount("");
      setShowBalanceForm(false);
      
      alert("Morning balance added successfully!");
    } catch (error) {
      console.error("Error adding morning balance:", error);
      alert("Failed to add morning balance");
    }
  };

  // Handle expense form changes
  const handleExpenseChange = (e) => {
    const { name, value } = e.target;
    setExpenseData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add new expense
  const addExpense = async () => {
    if (!user || !expenseData.cost || isNaN(expenseData.cost)) return;
    
    try {
      await addDoc(collection(db, "expenses"), {
        name: expenseData.name,
        category: expenseData.category,
        cost: Number(expenseData.cost),
        description: expenseData.description,
        uid: user.uid,
        timestamp: serverTimestamp()
      });
      
      // Refresh data
      const expSnap = await getDocs(query(collection(db, "expenses"), where("uid", "==", user.uid)));
      setExpenses(expSnap.docs.map(doc => doc.data()));
      
      // Reset form
      setExpenseData({
        name: "",
        category: "other",
        cost: "",
        description: ""
      });
      setShowExpenseForm(false);
      
      alert("Expense added successfully!");
    } catch (error) {
      console.error("Error adding expense:", error);
      alert("Failed to add expense");
    }
  };

  return (
    <div className="financial-dashboard">
      {/* iOS-style Header */}
      <header className="ios-header">
        <div className="header-content">
           {isAdmin && (
            <button 
              className="admin-back-button"
              onClick={() => navigate("/admin")}
            >
              <i className="fas fa-arrow-left"></i> Admin
            </button>
          )}
          <h1 className="header-title">MAXBOND</h1>
          <div className="header-icon">
            <i className="fas fa-chart-pie"></i>
          </div>
        </div>
      </header>

      {/* iOS Segment Control */}
      <div className="ios-segment-control">
        <button 
          className={`segment-item ${selectedTab === "daily" ? "active" : ""}`}
          onClick={() => handleTab("daily")}
        >
          Daily
        </button>
        <button 
          className={`segment-item ${selectedTab === "weekly" ? "active" : ""}`}
          onClick={() => handleTab("weekly")}
        >
          Weekly
        </button>
        <button 
          className={`segment-item ${selectedTab === "monthly" ? "active" : ""}`}
          onClick={() => handleTab("monthly")}
        >
          Monthly
        </button>
      </div>

      {/* Summary Card */}
      <div className="ios-summary-card">
        <div className="balance-title">Total Balance</div>
        <div className="balance-amount">₹{summary.netBalance.toFixed(2)}</div>
        
        <div className="balance-stats">
          <div className="stat-item">
            <div className="stat-label">Income</div>
            <div className="stat-value income">₹{summary.totalIncome.toFixed(2)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Expenses</div>
            <div className="stat-value expense">₹{summary.totalExpenses.toFixed(2)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Credit</div>
            <div className="stat-value income">₹{summary.totalCredit.toFixed(2)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Debit</div>
            <div className="stat-value expense">₹{summary.totalDebit.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* External Toggle */}
      <div className="ios-toggle-container">
        <div className="toggle-label">Show External Transactions</div>
        <label className="ios-toggle-switch">
          <input 
            type="checkbox" 
            checked={showExternal}
            onChange={() => setShowExternal(!showExternal)}
          />
          <span className="ios-toggle-slider"></span>
        </label>
      </div>

      {/* Transaction List */}
      <div className="ios-transaction-section">
        <h3>Recent Transactions & Expenses</h3>
        <div className="ios-transaction-list">
          {sortedTransactions.length > 0 ? (
            sortedTransactions
              .slice(0, 10)
              .map((txn, index) => (
                <div 
                  className="ios-transaction-item" 
                  key={index}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="transaction-icon" 
                    style={{ 
                      backgroundColor: txn.isOpeningBalance ? "#34C759" : 
                                      txn.isExternal ? "#FF9500" : 
                                      txn.isExpense ? "#FF3B30" : "#007AFF" 
                    }}>
                    <i className={`fas ${
                      txn.isOpeningBalance ? "fa-sun" :
                      txn.isExpense ? "fa-money-bill-wave" :
                      txn.type === "credit" ? "fa-arrow-down" : 
                      txn.type === "debit" ? "fa-arrow-up" : 
                      "fa-exchange-alt"
                    }`}></i>
                  </div>
                  <div className="transaction-details">
                    <div className="transaction-title">
                      {txn.isOpeningBalance ? "Morning Balance" : txn.name || txn.to || txn.email || "Unknown"}
                      {txn.isExpense && <span className="expense-tag">Expense</span>}
                      {txn.isExternal && !txn.isExpense && <span className="external-tag">External</span>}
                    </div>
                    <div className="transaction-meta">
                      {txn.category && !txn.isOpeningBalance && (
                        <span className="transaction-category">
                          <i className={`fas ${getCategoryIcon(txn.category)}`}></i>
                          {txn.category}
                        </span>
                      )}
                      {txn.timestamp?.seconds && (
                        <span className="transaction-date">
                          {formatDate(txn.timestamp.seconds)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`transaction-amount ${
                    txn.isOpeningBalance ? "income" : 
                    txn.isExpense || (txn.type && txn.type === "debit") ? "expense" : "income"
                  }`}>
                    {txn.isOpeningBalance ? "" : (txn.isExpense || (txn.type && txn.type === "debit") ? "-" : "+")}
                    ₹{Math.abs(Number(txn.amount || txn.cost || 0)).toFixed(2)}
                  </div>
                </div>
              ))
          ) : (
            <div className="ios-empty-state">
              <i className="fas fa-receipt"></i>
              <p>No transactions found</p>
            </div>
          )}
        </div>
      </div>

      {/* ATTENDANCE TRACKING CARD */}
      

      {/* Add Expense Form Modal */}
      {showExpenseForm && (
        <div className="expense-form-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add New Expense</h3>
              <button className="close-btn" onClick={() => setShowExpenseForm(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="form-group">
              <label>Expense Name</label>
              <input
                type="text"
                name="name"
                value={expenseData.name}
                onChange={handleExpenseChange}
                placeholder="What did you spend on?"
              />
            </div>
            
            <div className="form-group">
              <label>Category</label>
              <div className="category-grid">
                {categories.map(cat => (
                  <div 
                    key={cat}
                    className={`category-item ${expenseData.category === cat.toLowerCase() ? "active" : ""}`}
                    onClick={() => setExpenseData(prev => ({...prev, category: cat.toLowerCase()}))}
                  >
                    <i className={`fas ${getCategoryIcon(cat)}`}></i>
                    <span>{cat}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="form-group">
              <label>Amount (₹)</label>
              <input
                type="number"
                name="cost"
                value={expenseData.cost}
                onChange={handleExpenseChange}
                placeholder="Enter amount"
              />
            </div>
            
            <div className="form-group">
              <label>Description (Optional)</label>
              <textarea
                name="description"
                value={expenseData.description}
                onChange={handleExpenseChange}
                placeholder="Add any details about this expense"
                rows="3"
              />
            </div>
            
            <button 
              className="save-expense-btn"
              onClick={addExpense}
            >
              <i className="fas fa-check"></i> Add Expense
            </button>
          </div>
        </div>
      )}

      {/* Add Balance Form Modal */}
      {showBalanceForm && (
        <div className="balance-form-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Morning Balance</h3>
              <button className="close-btn" onClick={() => setShowBalanceForm(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="form-group">
              <label>Amount (₹)</label>
              <input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <button 
              className="save-btn"
              onClick={addStartingBalance}
            >
              <i className="fas fa-check"></i> Save Balance
            </button>
          </div>
        </div>
      )}

      {/* Footer Buttons */}
<div className="ios-footer">
  <button 
    className="ios-add-balance-button"
    onClick={() => setShowBalanceForm(true)}
  >
    <i className="fas fa-plus-circle"></i> Add Balance
  </button>
  
  {/* Add View Attendance Button */}
<button
  onClick={() => navigate("/attendance")}
  className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 transition"
>
  📍 Location Attendance
</button>


  
  <button 
    className="ios-add-expense-button"
    onClick={() => setShowExpenseForm(true)}
  >
    <i className="fas fa-receipt"></i> Add Expense
  </button>
  
  <button 
    className="ios-report-button"
    onClick={() => navigate("/dashboard/monthly-report")}
  >
    <i className="fas fa-file-alt"></i> Report
  </button>
</div>

      <BottomTab />
    </div>
  );
};

export default Dashboard;