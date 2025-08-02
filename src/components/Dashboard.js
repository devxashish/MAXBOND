import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Modal from "./Modal"; // Keep Modal for other general confirmations if needed
import BottomTab from "../components/BottomTab";
import "./Dashboard.css";
import { useToast } from "./Toast"; // Changed to Toast

// Helper function for Indian number formatting
const formatIndianNumber = (num) => {
  if (num === null || num === undefined) return '0.00';
  const parts = num.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  if (integerPart.length > 3) {
    let lastThree = integerPart.substring(integerPart.length - 3);
    let otherNumbers = integerPart.substring(0, integerPart.length - 3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  }
  return integerPart + (decimalPart ? '.' + decimalPart : '');
};


// ... (calculateFinancialSummary function - no change, as it calculates raw numbers) ...
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
    if (!Array.isArray(data)) {
      console.warn("calculateFinancialSummary: data is not an array", data);
      return [];
    }
    return data.filter((item) => {
      const itemTime = item.timestamp?.seconds;
      return typeof itemTime === "number" && itemTime >= cutoffStart;
    });
  };

  const filteredExpenses = filterData(expenses);
  const filteredTransactions = filterData(transactions);
  const filteredExternals = filterData(externals);
  const filteredStarting = filterData(startingAmounts);
  const filteredEmpTxns = filterData(employeeTransactions);

  const totalStart = filteredStarting.reduce(
    (sum, s) => sum + Number(s.amount || 0),
    0
  );
  const totalExpense = filteredExpenses.reduce(
    (sum, e) => sum + Number(e.cost || 0),
    0
  );

  const creditTxn = filteredTransactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const debitTxn = filteredTransactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const creditExt = filteredExternals
    .filter((x) => x.type === "credit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const debitExt = filteredExternals
    .filter((x) => x.type === "debit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const creditEmp = filteredEmpTxns
    .filter((x) => x.type === "credit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const debitEmp = filteredEmpTxns
    .filter((x) => x.type === "debit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const totalCredit = totalStart + creditTxn + creditExt + creditEmp;
  const totalDebit = totalExpense + debitTxn + debitExt + debitEmp;
  const netBalance = totalCredit - totalDebit;

  return {
    openingBalance: totalStart,
    totalIncome: totalCredit,
    totalExpenses: totalDebit,
    totalCredit: totalCredit,
    totalDebit: totalDebit,
    netBalance: netBalance,
  };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedTab, setSelectedTab] = useState("daily");
  const [selectedTransactionCategory, setSelectedTransactionCategory] =
    useState("expenses");
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
    netBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showExternal, setShowExternal] = useState(true);
  const [showBalanceForm, setShowBalanceForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [balancePaymentMethod, setBalancePaymentMethod] = useState("cash");

  const [expenseData, setExpenseData] = useState({
    name: "",
    cost: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
  });

  const [showEditTransactionModal, setShowEditTransactionModal] = useState(false);
  const [currentEditingTransaction, setCurrentEditingTransaction] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    amount: "",
    cost: "",
    type: "",
    category: "",
    description: "",
    date: "",
    to: "",
    from: "",
    profession: "",
  });
  const [editPaymentMethod, setEditPaymentMethod] = useState("");


  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({
    title: "",
    message: "",
    onConfirm: null,
    showCancelButton: false,
  });

  const [currentTheme, setCurrentTheme] = useState("light-theme");
  const [showThemeListModal, setShowThemeListModal] = useState(false);

  const themes = [
    { key: "light-theme", name: "Light", icon: "fa-sun" },
    { key: "dark-theme", name: "Dark", icon: "fa-moon" },
    { key: "ios-theme", name: "iOS", icon: "fa-mobile-alt" },
    { key: "pink-gradient-theme", name: "Pink Gradient", icon: "fa-heart" },
    { key: "emerald-zen-theme", name: "Emerald Zen", icon: "fa-leaf" },
    { key: "ocean-breeze-theme", name: "Ocean Breeze", icon: "fa-water" },
    { key: "sunset-glow-theme", name: "Sunset Glow", icon: "fa-fire" },
    { key: "urban-loft-theme", name: "Urban Loft", icon: "fa-building" },
    { key: "green-acre-theme", name: "Green Acre", icon: "fa-tree" },
    { key: "modern-haus-theme", name: "Modern Haus", icon: "fa-cube" },
    { key: "vintage-estate-theme", name: "Vintage Estate", icon: "fa-house-chimney" },
    { key: "coastal-home-theme", name: "Coastal Home", icon: "fa-umbrella-beach" },
    { key: "desert-oasis-theme", name: "Desert Oasis", icon: "fa-cactus" },
    { key: "mountain-chalet-theme", name: "Mountain Chalet", icon: "fa-mountain" },
    { key: "skyline-view-theme", name: "Skyline View", icon: "fa-city" },
    { key: "rustic-cabin-theme", name: "Rustic Cabin", icon: "fa-campground" },
    { key: "golden-gate-theme", name: "Golden Gate", icon: "fa-bridge-water" },
  ];

  const selectTheme = (themeKey) => {
    setCurrentTheme(themeKey);
    setShowThemeListModal(false);
  };

  // Keep openModal/closeModal for other general purpose confirmations if needed
  const openGeneralModal = ( // Renamed to avoid confusion with internal delete logic
    title,
    message,
    onConfirm = null,
    showCancelButton = false
  ) => {
    setModalContent({ title, message, onConfirm, showCancelButton });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalContent({ title: "", message: "", onConfirm: null, showCancelButton: false });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (curr) => {
      if (curr) {
        setUser(curr);
        setIsAdmin(
          curr.email === "rajk4435689@admin.com" || curr.uid === "admin-uid"
        );
      } else {
        navigate("/login");
      }
    });
    return () => unsub();
  }, [navigate]);

  const fetchAllData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const uid = user.uid;

    try {
      const [expSnap, txnSnap, extSnap, startSnap, empSnap] =
        await Promise.all([
          getDocs(query(collection(db, "expenses"), where("uid", "==", uid))),
          getDocs(
            query(collection(db, "transactions"), where("uid", "==", uid))
          ),
          getDocs(
            query(collection(db, "externalPayments"), where("uid", "==", uid))
          ),
          getDocs(
            query(collection(db, "startingAmounts"), where("userId", "==", uid))
          ),
          getDocs(collection(db, `users/${uid}/employeeTransactions`)),
        ]);

      setExpenses(expSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setTransactions(
        txnSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setExternals(
        extSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setStartingAmounts(
        startSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setEmployeeTransactions(
        empSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("error", `Failed to fetch data: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchAllData();
  }, [user, fetchAllData]);

  useEffect(() => {
    if (!user || loading) return;

    const newSummary = calculateFinancialSummary(
      expenses,
      transactions,
      externals,
      startingAmounts,
      employeeTransactions,
      selectedTab
    );

    setSummary(newSummary);
  }, [
    selectedTab,
    expenses,
    transactions,
    externals,
    startingAmounts,
    employeeTransactions,
    user,
    loading,
  ]);

  const handleTab = (tab) => {
    setSelectedTab(tab);
  };

  const getTimeLabel = () => {
    if (selectedTab === "daily") return "Today";
    if (selectedTab === "weekly") return "This Week";
    return "This Month";
  };

  const formatDate = (timestamp) => {
    if (timestamp instanceof Timestamp) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    if (typeof timestamp === "number") {
      return new Date(timestamp * 1000).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return "N/A";
  };

  const formatDateForInput = (timestamp) => {
    if (timestamp instanceof Timestamp) {
      return new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
    }
    if (typeof timestamp === 'number') {
      return new Date(timestamp * 1000).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  const getCategoryIcon = (category) => {
    const icons = {
      shopping: "fa-shopping-bag",
      food: "fa-utensils",
      transport: "fa-car",
      salary: "fa-money-bill-wave",
      investment: "fa-chart-line",
      health: "fa-heart-pulse",
      education: "fa-book",
      entertainment: "fa-film",
      utilities: "fa-bolt",
      other: "fa-wallet",
    };
    return icons[(category || 'other').toLowerCase()] || "fa-wallet";
  };

  const getAllTransactions = () => {
    const expenseTransactions = expenses.map((expense) => ({
      ...expense,
      type: "expense",
      amount: -Number(expense.cost || 0),
      isExpense: true,
      id: `exp-${expense.id}`,
      originalId: expense.id,
      collection: "expenses",
      timestamp: expense.timestamp || Timestamp.now(),
    }));

    const personalTransactions = transactions.map((personalTxn) => ({
      ...personalTxn,
      isPersonal: true,
      id: `txn-${personalTxn.id}`,
      originalId: personalTxn.id,
      collection: "transactions",
      timestamp: personalTxn.timestamp || Timestamp.now(),
    }));


    const externalTransactions = externals.map((external) => ({
      ...external,
      isExternal: true,
      id: `ext-${external.id}`,
      originalId: external.id,
      collection: "externalPayments",
      timestamp: external.timestamp || Timestamp.now(),
    }));

    const startingBalanceTransactions = startingAmounts.map((start) => ({
      ...start,
      type: "credit",
      amount: Number(start.amount || 0),
      isOpeningBalance: true,
      id: `start-${start.id}`,
      originalId: start.id,
      collection: "startingAmounts",
      timestamp: start.timestamp || Timestamp.now(),
    }));

    const employeeLedgerTransactions = employeeTransactions.map((emp) => ({
      ...emp,
      isEmployeeTransaction: true,
      id: `emp-${emp.id}`,
      originalId: emp.id,
      collection: `users/${user.uid}/employeeTransactions`,
      timestamp: emp.timestamp || Timestamp.now(),
    }));

    return [
      ...(startingBalanceTransactions || []),
      ...(personalTransactions || []),
      ...(expenseTransactions || []),
      ...(externalTransactions || []),
      ...(employeeLedgerTransactions || []),
    ];
  };

  const filteredCombinedTransactions = getAllTransactions().filter((t) => {
    if (!showExternal && (t.isExternal || t.isEmployeeTransaction)) return false;

    const now = Timestamp.now().seconds;
    let cutoff = now - 86400;

    if (selectedTab === "weekly") {
      cutoff = now - 7 * 86400;
    } else if (selectedTab === "monthly") {
      const date = new Date();
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      cutoff = firstDay.getTime() / 1000;
    }

    return (
      t.timestamp && typeof t.timestamp.seconds === "number" && t.timestamp.seconds >= cutoff
    );
  });

  const addStartingBalance = async () => {
    if (!user) {
      showToast("error", "Please log in to add a starting balance.");
      return;
    }
    if (
      !balanceAmount ||
      isNaN(Number(balanceAmount)) ||
      Number(balanceAmount) <= 0
    ) {
      showToast("error", "Please enter a valid positive number for the balance.");
      return;
    }
    if (!balanceDate) {
      showToast("error", "Please select a date for the balance.");
      return;
    }
    if (!balancePaymentMethod) {
        showToast("error", "Please select payment method for balance received.");
        return;
    }

    try {
      await addDoc(collection(db, "startingAmounts"), {
        amount: Number(balanceAmount),
        userId: user.uid,
        timestamp: Timestamp.fromDate(new Date(balanceDate)),
        isDailyBalance: true,
        paymentMethod: balancePaymentMethod,
      });

      setBalanceAmount("");
      setBalanceDate(new Date().toISOString().split('T')[0]);
      setBalancePaymentMethod("cash");
      setShowBalanceForm(false);
      await fetchAllData();

      showToast("success", "Balance added successfully!");
    } catch (error) {
      console.error("Error adding balance:", error);
      showToast("error", `Failed to add balance: ${error.message || "Unknown error"}`);
    }
  };

  const handleExpenseChange = (e) => {
    const { name, value } = e.target;
    setExpenseData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addExpense = async () => {
    if (!user) {
      showToast("error", "Please log in to add an expense.");
      return;
    }
    if (!expenseData.name || expenseData.name.trim() === "") {
      showToast("error", "Please enter an expense name.");
      return;
    }
    if (
      !expenseData.cost ||
      isNaN(Number(expenseData.cost)) ||
      Number(expenseData.cost) <= 0
    ) {
      showToast("error", "Please enter a valid positive number for the expense cost.");
      return;
    }
    if (!expenseData.date) {
      showToast("error", "Please select a date for the expense.");
      return;
    }

    try {
      await addDoc(collection(db, "expenses"), {
        name: expenseData.name.trim(),
        category: "other",
        cost: Number(expenseData.cost),
        description: expenseData.description.trim(),
        uid: user.uid,
        timestamp: Timestamp.fromDate(new Date(expenseData.date)),
      });

      setExpenseData({
        name: "",
        cost: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
      });
      setShowExpenseForm(false);
      await fetchAllData();

      showToast("success", "Expense added successfully!");
    } catch (error) {
      console.error("Error adding expense:", error);
      showToast("error", `Failed to add expense: ${error.message || "Unknown error"}`);
    }
  };

  const handleTransactionClick = (transaction) => {
    setCurrentEditingTransaction(transaction);

    const dateToSet = transaction.timestamp ? formatDateForInput(transaction.timestamp) : new Date().toISOString().split('T')[0];

    if (transaction.isExpense) {
      setEditFormData({
        name: transaction.name || "",
        amount: Math.abs(Number(transaction.cost || 0)).toString(),
        cost: Number(transaction.cost || 0).toString(),
        type: "expense",
        category: transaction.category || "other",
        description: transaction.description || "",
        date: dateToSet,
        to: "", from: "", profession: "",
      });
      setEditPaymentMethod("");
    } else if (transaction.isPersonal) {
      setEditFormData({
        name: transaction.name || "",
        amount: Number(transaction.amount || 0).toString(),
        cost: "",
        type: transaction.type || "",
        category: "",
        description: transaction.description || "",
        date: dateToSet,
        to: transaction.to || "",
        from: transaction.from || "",
        profession: "",
      });
      setEditPaymentMethod("");
    } else if (transaction.isExternal) {
      setEditFormData({
        name: transaction.name || "",
        amount: Number(transaction.amount || 0).toString(),
        cost: "",
        type: transaction.type || "",
        category: "",
        description: transaction.description || "",
        date: dateToSet,
        to: "",
        from: "",
        profession: transaction.profession || "",
      });
      setEditPaymentMethod("");
    } else if (transaction.isEmployeeTransaction) {
      setEditFormData({
        name: transaction.name || "",
        amount: Number(transaction.amount || 0).toString(),
        cost: "",
        type: transaction.type || "",
        category: "",
        description: transaction.description || "",
        date: dateToSet,
        to: transaction.to || "",
        from: transaction.from || "",
        profession: "",
      });
      setEditPaymentMethod("");
    } else if (transaction.isOpeningBalance) {
        setEditFormData({
            name: "Total Received (Opening Balance)",
            amount: Math.abs(Number(transaction.amount || 0)).toString(),
            cost: "",
            type: "credit",
            category: "other",
            description: "Daily opening balance",
            date: dateToSet,
            to: "", from: "", profession: "",
        });
        setEditPaymentMethod(transaction.paymentMethod || "cash");
    }

    setShowEditTransactionModal(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    if (name === "paymentMethod" && currentEditingTransaction?.isOpeningBalance) {
        setEditPaymentMethod(value);
    } else {
        setEditFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    }
  };

  const updateTransaction = async () => {
    if (!user || !currentEditingTransaction) {
      showToast("error", "No transaction selected for update or not authenticated.");
      return;
    }

    const { originalId, collection } = currentEditingTransaction;
    const docRefPath = collection === `users/${user.uid}/employeeTransactions`
      ? doc(db, collection, originalId)
      : doc(db, collection, originalId);

    if (!editFormData.amount || isNaN(Number(editFormData.amount)) || Number(editFormData.amount) <= 0) {
        showToast("error", "Please enter a valid positive number for the amount.");
        return;
    }
    if (!editFormData.date) {
        showToast("error", "Please select a date for the transaction.");
        return;
    }
    if (currentEditingTransaction.isOpeningBalance && !editPaymentMethod) {
        showToast("error", "Please select payment method for balance received.");
        return;
    }

    let updateData = {};
    const newTimestamp = Timestamp.fromDate(new Date(editFormData.date));

    if (currentEditingTransaction.isExpense) {
      updateData = {
        name: editFormData.name.trim(),
        category: editFormData.category || "other",
        cost: Number(editFormData.amount),
        description: editFormData.description.trim(),
        timestamp: newTimestamp,
      };
    } else if (currentEditingTransaction.isPersonal) {
      updateData = {
        name: editFormData.name.trim(),
        amount: Number(editFormData.amount),
        type: editFormData.type,
        description: editFormData.description.trim(),
        timestamp: newTimestamp,
        to: editFormData.to.trim(),
        from: editFormData.from.trim(),
      };
    } else if (currentEditingTransaction.isExternal) {
        updateData = {
            name: editFormData.name.trim(),
            amount: Number(editFormData.amount),
            type: editFormData.type,
            profession: editFormData.profession.trim(),
            description: editFormData.description.trim(),
            timestamp: newTimestamp,
        };
    } else if (currentEditingTransaction.isEmployeeTransaction) {
        updateData = {
            name: editFormData.name.trim(),
            amount: Number(editFormData.amount),
            type: editFormData.type,
            description: editFormData.description.trim(),
            timestamp: newTimestamp,
            to: editFormData.to.trim(),
            from: editFormData.from.trim(),
        };
    } else if (currentEditingTransaction.isOpeningBalance) {
        updateData = {
            amount: Number(editFormData.amount),
            timestamp: newTimestamp,
            paymentMethod: editPaymentMethod,
        };
    }

    try {
      await updateDoc(docRefPath, updateData);
      setShowEditTransactionModal(false);
      await fetchAllData();
      showToast("success", "Transaction updated successfully!");
    } catch (error) {
      console.error("Error updating transaction:", error);
      showToast("error", `Failed to update transaction: ${error.message || "Unknown error"}`);
    }
  };

  // --- NEW deleteTransaction function using Toast with Undo ---
  const deleteTransaction = async () => {
    if (!user || !currentEditingTransaction) {
      showToast("error", "No transaction selected for deletion or not authenticated.");
      return;
    }

    // Store the transaction data temporarily for potential undo
    const transactionToDelete = { ...currentEditingTransaction };
    const { originalId, collection: txnCollection } = transactionToDelete;

    // Immediately hide the edit modal
    setShowEditTransactionModal(false);

    // Perform the deletion in the background immediately
    const docRefPath = txnCollection === `users/${user.uid}/employeeTransactions`
        ? doc(db, txnCollection, originalId)
        : doc(db, txnCollection, originalId);

    try {
        await deleteDoc(docRefPath);
        await fetchAllData(); // Optimistically update UI by re-fetching all data

        // Show the undoable toast
        showToast(
            "premium-delete",
            "Transaction deleted. Undo?",
            async () => {
                // This is the UNDO action
                try {
                    // Re-add the deleted transaction
                    let dataToRestore = { ...transactionToDelete };
                    delete dataToRestore.id; // Remove the temporary client-side ID
                    delete dataToRestore.originalId; // Remove originalId
                    delete dataToRestore.collection; // Remove collection info
                    delete dataToRestore.isExpense; // Remove temp flags
                    delete dataToRestore.isPersonal;
                    delete dataToRestore.isExternal;
                    delete dataToRestore.isOpeningBalance;
                    delete dataToRestore.isEmployeeTransaction;

                    // Ensure timestamp is a Firestore Timestamp object
                    if (dataToRestore.timestamp && !(dataToRestore.timestamp instanceof Timestamp)) {
                        dataToRestore.timestamp = Timestamp.fromMillis(dataToRestore.timestamp.seconds * 1000);
                    } else if (!dataToRestore.timestamp) {
                        dataToRestore.timestamp = Timestamp.now();
                    }

                    // For 'startingAmounts' and 'expenses', ensure correct fields are used
                    if (txnCollection === "startingAmounts") {
                        await addDoc(collection(db, txnCollection), {
                            ...dataToRestore,
                            userId: user.uid, // Add userId back for startingAmounts
                        });
                    } else if (txnCollection === "expenses") {
                            await addDoc(collection(db, txnCollection), {
                                ...dataToRestore,
                                uid: user.uid, // Add uid back for expenses
                                cost: dataToRestore.amount ? Math.abs(dataToRestore.amount) : dataToRestore.cost, // Use 'amount' if available, else 'cost'
                            });
                    } else if (txnCollection === `users/${user.uid}/employeeTransactions`) {
                            await addDoc(collection(db, `users/${user.uid}/employeeTransactions`), {
                                ...dataToRestore,
                                // uid: user.uid is implied by the path
                            });
                    }
                    else { // For 'transactions' and 'externalPayments'
                        await addDoc(collection(db, txnCollection), {
                            ...dataToRestore,
                            uid: user.uid, // Add uid back for general transactions
                        });
                    }

                    await fetchAllData(); // Re-fetch data to reflect undo
                    showToast("success", "Transaction restored successfully!");
                } catch (undoError) {
                    console.error("Error undoing transaction:", undoError);
                    showToast("error", `Failed to undo: ${undoError.message || "Unknown error"}`);
                    // If undo fails, maybe re-show original delete success or error
                }
            },
            5000 // Toast will stay for 5 seconds to allow undo
        );

    } catch (error) {
        console.error("Error deleting transaction:", error);
        showToast("error", `Failed to delete transaction: ${error.message || "Unknown error"}`);
    }
  };

  // Helper function to determine class for balance amounts
  const getBalanceAmountClass = (amount) => {
    // Convert to string after formatting for Indian style to get true display length
    const formattedAmountString = `₹${formatIndianNumber(amount)}`;

    // Adjust these thresholds based on visual testing and new font sizes
    // Current default font size is 30px.
    // Lengths include '₹' and commas.
    // Example Lengths:
    // ₹100.00 (7) -> default (30px)
    // ₹1,000.00 (8) -> default (30px)
    // ₹10,000.00 (9) -> default (30px)
    // ₹1,00,000.00 (10) -> font-small (24px)
    // ₹10,00,000.00 (11) -> font-small (24px)
    // ₹1,00,00,000.00 (12) -> font-x-small (18px)
    // ₹10,00,00,000.00 (13) -> font-x-small (18px)
    // ₹1,00,00,00,000.00 (14) -> font-xx-small (14px)

    if (formattedAmountString.length > 13) {
      return "font-xx-small"; // Very small for extremely long numbers (e.g., billions/trillions)
    }
    if (formattedAmountString.length > 11) {
      return "font-x-small"; // Smaller for numbers like crores (1,00,00,000)
    }
    if (formattedAmountString.length > 9) {
      return "font-small"; // Slightly smaller for numbers like lakhs (1,00,000)
    }
    return ""; // Default size
  };


  return (
    <div className={`financial-dashboard-wrapper ${currentTheme}`}>
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
        <div className="theme-switch-container">
          <button className="theme-switch-button" onClick={() => setShowThemeListModal(true)}>
            <i className="fas fa-palette"></i>
          </button>
        </div>
      </header>

      <div className="ios-action-tabs">
        <div
          className="action-tab-item"
          onClick={() => setShowBalanceForm(true)}
        >
          <i className="fas fa-plus-circle"></i>
          <span>Add Balance</span>
        </div>
        <div
          className="action-tab-item"
          onClick={() => setShowExpenseForm(true)}
        >
          <i className="fas fa-receipt"></i>
          <span>Add Expense</span>
        </div>
        <div
          className="action-tab-item"
          onClick={() => navigate("/attendance")}
        >
          <i className="fas fa-map-marker-alt"></i>
          <span>Attendance</span>
        </div>
        <div
          className="action-tab-item"
          onClick={() => navigate("/dashboard/monthly-report")}
        >
          <i className="fas fa-file-alt"></i>
          <span>Report</span>
        </div>
      </div>

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

      {/* Summary Cards */}
      <div className="summary-cards-container">
        <div className="ios-summary-card net-balance-card">
          <div className="balance-title">Net Balance ({getTimeLabel()})</div>
          <div className={`balance-amount ${getBalanceAmountClass(summary.netBalance)}`}>
            ₹{formatIndianNumber(summary.netBalance)}
          </div>
        </div>

        <div className="ios-summary-card total-received-card">
          <div className="balance-title">Total Received ({getTimeLabel()})</div>
          <div className={`balance-amount ${getBalanceAmountClass(summary.totalIncome)}`}>
            ₹{formatIndianNumber(summary.totalIncome)}
          </div>
        </div>

        <div className="ios-summary-card total-expense-card"> {/* Changed class name */}
          <div className="balance-title">Total Expense ({getTimeLabel()})</div>
          <div className={`balance-amount ${getBalanceAmountClass(summary.totalExpenses)}`}>
            ₹{formatIndianNumber(summary.totalExpenses)}
          </div>
        </div>
      </div>


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

      <div className="ios-transaction-sections-wrapper">
        <div className="transaction-segment-control">
          <button
            className={`transaction-segment-item ${
              selectedTransactionCategory === "expenses" ? "active" : ""
            }`}
            onClick={() => setSelectedTransactionCategory("expenses")}
          >
            Expenses
          </button>
          <button
            className={`transaction-segment-item ${
              selectedTransactionCategory === "personal" ? "active" : ""
            }`}
            onClick={() => setSelectedTransactionCategory("personal")}
          >
            Personal
          </button>
          <button
            className={`transaction-segment-item ${
              selectedTransactionCategory === "external" ? "active" : ""
            }`}
            onClick={() => setSelectedTransactionCategory("external")}
          >
            External & Employee
          </button>
        </div>

        {selectedTransactionCategory === "expenses" && (
          <div className="ios-transaction-section">
            <h3>💸 Expenses ({getTimeLabel()})</h3>
            <div className="ios-transaction-list">
              {loading ? (
                <div className="loading-message">Loading expenses...</div>
              ) : (
                filteredCombinedTransactions
                  .filter((txn) => txn.isExpense || txn.isOpeningBalance)
                  .sort((a, b) => {
                    if (a.isOpeningBalance) return -1;
                    if (b.isOpeningBalance) return 1;
                    return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
                  })
                  .map((txn, index) => (
                    <div
                      className="ios-transaction-item"
                      key={txn.id || `exp-${index}`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => handleTransactionClick(txn)}
                    >
                      <div className={`transaction-icon ${txn.isOpeningBalance ? 'income-icon' : 'expense-icon'}`}>
                        <i className={`fas ${txn.isOpeningBalance ? 'fa-money-bill-wave' : getCategoryIcon(txn.category)}`}></i>
                      </div>
                      <div className="transaction-details">
                        <div className="transaction-title">
                          {txn.isOpeningBalance ? `Opening Balance` : txn.name || "Unnamed Expense"}
                          <span className={txn.isOpeningBalance ? "expense-tag" : "expense-tag"}>{txn.isOpeningBalance ? 'Balance' : 'Expense'}</span>
                        </div>
                        <div className="transaction-meta">
                          {txn.category && !txn.isOpeningBalance && (
                            <span className="transaction-category">
                              <i
                                className={`fas ${getCategoryIcon(txn.category)}`}
                              ></i>{" "}
                              {txn.category}
                            </span>
                          )}
                          {txn.isOpeningBalance && txn.paymentMethod && (
                            <span className="transaction-method">
                              <i className="fas fa-money-bill-alt"></i> {txn.paymentMethod}
                            </span>
                          )}
                          {txn.timestamp?.seconds && (
                            <span className="transaction-date">
                              {formatDate(txn.timestamp)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`transaction-amount ${txn.isOpeningBalance ? 'income' : 'expense'}`}>
                        {txn.isOpeningBalance ? "+" : "-"} ₹{formatIndianNumber(Math.abs(Number(txn.amount || txn.cost || 0)))}
                      </div>
                    </div>
                  ))
              )}
              {!loading &&
                filteredCombinedTransactions.filter((txn) => txn.isExpense || txn.isOpeningBalance)
                  .length === 0 && (
                  <div className="ios-empty-state">
                    <i className="fas fa-receipt"></i>
                    <p>No expenses or opening balances found</p>
                  </div>
                )}
            </div>
          </div>
        )}

        {selectedTransactionCategory === "personal" && (
          <div className="ios-transaction-section">
            <h3>💼 Personal Transactions ({getTimeLabel()})</h3>
            <div className="ios-transaction-list">
              {loading ? (
                <div className="loading-message">Loading personal transactions...</div>
              ) : (
                filteredCombinedTransactions
                  .filter(
                    (txn) =>
                      txn.isPersonal
                  )
                  .sort(
                    (a, b) =>
                      (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
                  )
                  .map((txn, index) => (
                    <div
                      className="ios-transaction-item"
                      key={txn.id || `personal-${index}`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => handleTransactionClick(txn)}
                    >
                      <div
                        className={`transaction-icon ${
                          txn.type === "credit" ? "income-icon" : "expense-icon"
                        }`}
                      >
                        <i
                          className={`fas ${
                            txn.type === "credit" ? "fa-arrow-down" : "fa-arrow-up"
                          }`}
                        ></i>
                      </div>
                      <div className="transaction-details">
                        <div className="transaction-title">
                          {txn.name || txn.to || txn.from || "Transaction"}
                        </div>
                        <div className="transaction-meta">
                           {txn.paymentMethod && (
                            <span className="transaction-method">
                              <i className="fas fa-money-bill-alt"></i> {txn.paymentMethod}
                            </span>
                          )}
                          {txn.timestamp?.seconds && (
                            <span className="transaction-date">
                              {formatDate(txn.timestamp)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`transaction-amount ${
                          txn.type === "credit" ? "income" : "expense"
                        }`}
                      >
                        {txn.type === "credit" ? "+" : "-"}{" "}
                        ₹{formatIndianNumber(Math.abs(Number(txn.amount || 0)))}
                      </div>
                    </div>
                  ))
              )}
              {!loading &&
                filteredCombinedTransactions.filter(
                  (txn) =>
                    txn.isPersonal
                ).length === 0 && (
                  <div className="ios-empty-state">
                    <i className="fas fa-exchange-alt"></i>
                    <p>No personal transactions found</p>
                  </div>
                )}
            </div>
          </div>
        )}

        {selectedTransactionCategory === "external" && (
          <div className="ios-transaction-section">
            <h3>🌐 External & Employee Transactions ({getTimeLabel()})</h3>
            <div className="ios-transaction-list">
              {loading ? (
                <div className="loading-message">Loading external/employee transactions...</div>
              ) : (
                filteredCombinedTransactions
                  .filter((txn) => txn.isExternal || txn.isEmployeeTransaction)
                  .sort(
                    (a, b) =>
                      (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
                  )
                  .map((txn, index) => (
                    <div
                      className="ios-transaction-item"
                      key={txn.id || `external-${index}`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => handleTransactionClick(txn)}
                    >
                      <div className="transaction-icon external-icon">
                        <i
                          className={`fas ${
                            txn.isExternal ? "fa-globe" : "fa-users"
                          }`}
                        ></i>
                      </div>
                      <div className="transaction-details">
                        <div className="transaction-title">
                          {txn.isExternal
                            ? `${txn.name} (${txn.profession})`
                            : `Employee: ${txn.from}`}
                          {txn.isExternal && (
                            <span className="external-tag">External</span>
                          )}
                        </div>
                        <div className="transaction-meta">
                           {txn.paymentMethod && (
                            <span className="transaction-method">
                              <i className="fas fa-money-bill-alt"></i> {txn.paymentMethod}
                            </span>
                          )}
                          {txn.timestamp?.seconds && (
                            <span className="transaction-date">
                              {formatDate(txn.timestamp)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`transaction-amount ${
                          txn.type === "credit" ? "income" : "expense"
                        }`}
                      >
                        {txn.type === "credit" ? "+" : "-"}{" "}
                        ₹{formatIndianNumber(Math.abs(Number(txn.amount || 0)))}
                      </div>
                    </div>
                  ))
              )}
              {!loading &&
                filteredCombinedTransactions.filter(
                  (txn) => txn.isExternal || txn.isEmployeeTransaction
                ).length === 0 && (
                  <div className="ios-empty-state">
                    <i className="fas fa-handshake"></i>
                    <p>No external or employee transactions found</p>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>

      <div className="bottom-spacer"></div>

      {showExpenseForm && (
        <div className="modal-overlay">
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
                className="form-input"
                value={expenseData.name}
                onChange={handleExpenseChange}
                placeholder="What did you spend on?"
              />
            </div>

            <div className="form-group">
              <label>Amount (₹)</label>
              <input
                type="number"
                name="cost"
                className="form-input"
                value={expenseData.cost}
                onChange={handleExpenseChange}
                placeholder="Enter amount"
              />
            </div>

            <div className="form-group">
                <label>Date</label>
                <input
                    type="date"
                    name="date"
                    className="form-input"
                    value={expenseData.date}
                    onChange={handleExpenseChange}
                />
            </div>

            <div className="form-group">
              <label>Description (Optional)</label>
              <textarea
                name="description"
                className="form-textarea"
                value={expenseData.description}
                onChange={handleExpenseChange}
                placeholder="Add any details about this expense"
                rows="3"
              />
            </div>

            <button className="save-expense-btn" onClick={addExpense}>
              <i className="fas fa-check"></i> Add Expense
            </button>
          </div>
        </div>
      )}

      {showBalanceForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Balance Received</h3>
              <button className="close-btn" onClick={() => setShowBalanceForm(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="form-group">
              <label>Amount (₹)</label>
              <input
                type="number"
                className="form-input"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="form-group">
                <label>Received Via</label>
                <select
                    name="balancePaymentMethod"
                    className="form-input"
                    value={balancePaymentMethod}
                    onChange={(e) => setBalancePaymentMethod(e.target.value)}
                >
                    <option value="cash">Cash</option>
                    <option value="neft">NEFT</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div className="form-group">
                <label>Date</label>
                <input
                    type="date"
                    className="form-input"
                    value={balanceDate}
                    onChange={(e) => setBalanceDate(e.target.value)}
                />
            </div>
            <button className="save-balance-btn" onClick={addStartingBalance}>
              <i className="fas fa-check"></i> Save Balance
            </button>
          </div>
        </div>
      )}

      {showEditTransactionModal && currentEditingTransaction && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Transaction</h3>
              <div>
                {/* Delete button no longer directly calls delete, but now triggers the undoable toast */}
                <button className="delete-btn" onClick={deleteTransaction}>
                  <i className="fas fa-trash"></i>
                </button>
                <button className="close-btn" onClick={() => setShowEditTransactionModal(false)}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {currentEditingTransaction.isExpense && (
              <>
                <div className="form-group">
                  <label>Expense Name</label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    value={editFormData.name}
                    onChange={handleEditFormChange}
                    placeholder="Expense Name"
                  />
                </div>
              </>
            )}

            {currentEditingTransaction.isPersonal && (
              <>
                <div className="form-group">
                  <label>Transaction Name (Optional)</label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    value={editFormData.name}
                    onChange={handleEditFormChange}
                    placeholder="e.g., Cash from John"
                  />
                </div>
                   <div className="form-group">
                     <label>Type</label>
                     <select
                       name="type"
                       className="form-input"
                       value={editFormData.type}
                       onChange={handleEditFormChange}
                     >
                       <option value="credit">Credit (Income)</option>
                       <option value="debit">Debit (Payment)</option>
                     </select>
                   </div>
                   <div className="form-group">
                     <label>From (Credit) / To (Debit)</label>
                     <input
                       type="text"
                       name={editFormData.type === "credit" ? "from" : "to"}
                       className="form-input"
                       value={editFormData.type === "credit" ? editFormData.from : editFormData.to}
                       onChange={handleEditFormChange}
                       placeholder={editFormData.type === "credit" ? "Source of income" : "Recipient of payment"}
                     />
                   </div>
              </>
            )}

            {currentEditingTransaction.isExternal && (
              <>
                <div className="form-group">
                  <label>Person Name</label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    value={editFormData.name}
                    onChange={handleEditFormChange}
                    placeholder="Person's Name"
                  />
                </div>
                <div className="form-group">
                  <label>Profession/Relation</label>
                  <input
                    type="text"
                    name="profession"
                    className="form-input"
                    value={editFormData.profession}
                    onChange={handleEditFormChange}
                    placeholder="e.g., Mason, Supplier"
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    name="type"
                    className="form-input"
                    value={editFormData.type}
                    onChange={handleEditFormChange}
                  >
                    <option value="credit">Credit (Received)</option>
                    <option value="debit">Debit (Paid)</option>
                  </select>
                </div>
              </>
            )}

            {currentEditingTransaction.isEmployeeTransaction && (
              <>
                <div className="form-group">
                  <label>Employee Name</label>
                  <input
                    type="text"
                    name="from"
                    className="form-input"
                    value={editFormData.from}
                    onChange={handleEditFormChange}
                    placeholder="Employee Name"
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    name="type"
                    className="form-input"
                    value={editFormData.type}
                    onChange={handleEditFormChange}
                  >
                    <option value="credit">Credit (Given to Employee)</option>
                    <option value="debit">Debit (Received from Employee)</option>
                  </select>
                </div>
              </>
            )}

            {currentEditingTransaction.isOpeningBalance && (
                <div className="form-group">
                    <label>Balance Type</label>
                    <input type="text" className="form-input" value="Total Received (Opening Balance)" disabled />
                </div>
            )}

            <div className="form-group">
              <label>Amount (₹)</label>
              <input
                type="number"
                name="amount"
                className="form-input"
                value={editFormData.amount}
                onChange={handleEditFormChange}
                placeholder="Enter amount"
              />
            </div>

            {currentEditingTransaction.isOpeningBalance && (
                <div className="form-group">
                    <label>Received Via</label>
                    <select
                        name="paymentMethod"
                        className="form-input"
                        value={editPaymentMethod}
                        onChange={(e) => setEditPaymentMethod(e.target.value)}
                    >
                        <option value="cash">Cash</option>
                        <option value="neft">NEFT</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            )}

            <div className="form-group">
                <label>Date</label>
                <input
                    type="date"
                    name="date"
                    className="form-input"
                    value={editFormData.date}
                    onChange={handleEditFormChange}
                />
            </div>

            <div className="form-group">
              <label>Description (Optional)</label>
              <textarea
                name="description"
                className="form-textarea"
                value={editFormData.description}
                onChange={handleEditFormChange}
                placeholder="Add any details"
                rows="3"
              />
            </div>

            <button className="update-transaction-btn" onClick={updateTransaction}>
              <i className="fas fa-save"></i> Update Transaction
            </button>
          </div>
        </div>
      )}

      {showThemeListModal && (
        <div className="theme-list-modal-overlay">
          <div className="theme-list-modal-content">
            <button className="theme-list-close-btn" onClick={() => setShowThemeListModal(false)}>
              <i className="fas fa-times"></i>
            </button>
            <h3>Choose Theme</h3>
            <div className="theme-list-grid">
              {themes.map((theme) => (
                <div
                  key={theme.key}
                  className={`theme-item ${currentTheme === theme.key ? 'active-theme' : ''}`}
                  onClick={() => selectTheme(theme.key)}
                >
                  <div className={`theme-preview ${theme.key}`}>
                    <i className={`fas ${theme.icon}`}></i>
                  </div>
                  <span className="theme-name">{theme.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bottom-tab-bar-container">
        <BottomTab />
      </div>

      {/* Main Modal for alerts/confirmations (now used only for non-delete confirmations) */}
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

export default Dashboard;