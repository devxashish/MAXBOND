import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  FaDownload,
  FaFileExcel,
  FaPrint,
  FaArrowLeft,
  FaWhatsapp,
  FaUser,
} from "react-icons/fa";
import "./ExportPage.css";
import { Filesystem, Directory } from "@capacitor/filesystem";
import SharePromptModal from "../components/SharePromptModal";

const ExportPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState({
    openingBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    totalCredit: 0,
    totalDebit: 0,
    netBalance: 0,
  });
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportPermission, setExportPermission] = useState(false);
  const [exportStatus, setExportStatus] = useState({
    success: false,
    message: "",
  });
  const [storagePermission, setStoragePermission] = useState(false);
  const [userName, setUserName] = useState("");
  const [userSiteName, setUserSiteName] = useState("N/A");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportedFileName, setExportedFileName] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setExportPermission(true);
        setUserName(currentUser.displayName || currentUser.email.split("@")[0]);

        try {
          const profileDocRef = doc(db, "profiles", currentUser.uid);
          const profileDocSnap = await getDoc(profileDocRef);
          if (profileDocSnap.exists()) {
            const profileData = profileDocSnap.data();
            if (profileData.linkedSites && profileData.linkedSites.length > 0) {
              setUserSiteName(profileData.linkedSites[0]);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile for site name:", error);
          setUserSiteName("N/A");
        }
      }
    });

    const checkStoragePermission = async () => {
      try {
        if (isMobileDevice()) {
          const permResult = await Filesystem.requestPermissions();
          setStoragePermission(permResult.publicStorage === "granted");
        } else {
          setStoragePermission(true);
        }
      } catch (error) {
        console.error("Error checking storage permission:", error);
      }
    };

    checkStoragePermission();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const uid = user.uid;

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

        const combined = [
          ...startSnap.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
            recordType: "opening",
            timestamp: doc.data().timestamp,
          })),
          ...expSnap.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
            recordType: "expense",
            timestamp: doc.data().timestamp,
          })),
          ...txnSnap.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
            recordType: "transaction",
            timestamp: doc.data().timestamp,
          })),
          ...extSnap.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
            recordType: "external",
            timestamp: doc.data().timestamp,
          })),
          ...empSnap.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
            recordType: "employee",
            timestamp: doc.data().timestamp,
          })),
        ];

        setAllData(combined);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user]);

  useEffect(() => {
    if (!startDate || !endDate || allData.length === 0) return;

    const filteredData = allData.filter((item) => {
      if (!item.timestamp || !item.timestamp.seconds) return false;
      const date = new Date(item.timestamp.seconds * 1000);
      const itemDate = date.toISOString().split("T")[0];
      return itemDate >= startDate && itemDate <= endDate;
    });

    const expenses = filteredData.filter((d) => d.recordType === "expense");
    const transactions = filteredData.filter(
      (d) => d.recordType === "transaction"
    );
    const externals = filteredData.filter((d) => d.recordType === "external");
    const startingAmounts = filteredData.filter(
      (d) => d.recordType === "opening"
    );
    const employeeTransactions = filteredData.filter(
      (d) => d.recordType === "employee"
    );

    const openingBalance = startingAmounts.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    const totalExpenses = expenses.reduce(
      (sum, item) => sum + (item.cost || 0),
      0
    );

    const creditTransactions = transactions
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const debitTransactions = transactions
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const creditExternals = externals
      .filter((e) => e.type === "credit")
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const debitExternals = externals
      .filter((e) => e.type === "debit")
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const creditEmployees = employeeTransactions
      .filter((e) => e.type === "credit")
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const debitEmployees = employeeTransactions
      .filter((e) => e.type === "debit")
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalIncome = creditTransactions + creditExternals + creditEmployees;
    const totalDebit = debitTransactions + debitExternals + debitEmployees + totalExpenses;
    const netBalance = openingBalance + totalIncome - totalDebit;

    setSummary({
      openingBalance,
      totalIncome,
      totalExpenses,
      totalCredit: totalIncome,
      totalDebit,
      netBalance,
    });
  }, [allData, startDate, endDate]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const generateTransactionRows = () => {
    if (!startDate || !endDate) return [];

    let filteredData = allData.filter((item) => {
      if (!item.timestamp || !item.timestamp.seconds) return false;
      const date = new Date(item.timestamp.seconds * 1000);
      const itemDate = date.toISOString().split("T")[0];
      return itemDate >= startDate && itemDate <= endDate;
    });

    filteredData.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    let runningBalance = 0;
    const rows = [];

    const openingEntry = filteredData.find(
      (item) => item.recordType === "opening"
    );
    const openingBalance = openingEntry ? openingEntry.amount : 0;

    rows.push([
      formatDate(startDate),
      "Opening Balance",
      "",
      openingBalance.toFixed(2),
      `${openingBalance.toFixed(2)} Cr`,
    ]);

    runningBalance = openingBalance;

    filteredData = filteredData.filter((item) => item.recordType !== "opening");

    let actualDebitTotal = 0;
    let actualCreditTotal = 0;

    filteredData.forEach((item) => {
      if (!item.timestamp || !item.timestamp.seconds) return;

      const date = new Date(item.timestamp.seconds * 1000);
      const formattedDate = formatDate(date.toISOString().split("T")[0]);

      let description = "";
      let credit = 0;
      let debit = 0;

      if (item.recordType === "expense") {
        description = item.name || "Expense";
        debit = item.cost || 0;
        actualDebitTotal += debit;
      } else if (item.recordType === "transaction") {
        description = `Transaction: ${item.to || item.email || "Unknown"}`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      } else if (item.recordType === "external") {
        description = `${item.name || "External"} (${
          item.profession || "Unknown"
        })`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      } else if (item.recordType === "employee") {
        description = `Employee: ${item.from || "Unknown"}`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      }

      runningBalance = runningBalance + credit - debit;

      rows.push([
        formattedDate,
        description,
        debit > 0 ? debit.toFixed(2) : "",
        credit > 0 ? credit.toFixed(2) : "",
        `${runningBalance.toFixed(2)} ${runningBalance >= 0 ? "Cr" : "Dr"}`,
      ]);
    });

    rows.push([
      "Grand Total",
      "",
      actualDebitTotal.toFixed(2),
      actualCreditTotal.toFixed(2),
      `${Math.abs(runningBalance).toFixed(2)} ${
        runningBalance >= 0 ? "Cr" : "Dr"
      }`,
    ]);

    return rows;
  };

  const saveFile = async (blob, fileName) => {
    try {
      if (!isMobileDevice()) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);

        return fileName;
      }

      if (!storagePermission) {
        const permResult = await Filesystem.requestPermissions();
        if (permResult.publicStorage !== "granted") {
          throw new Error("Storage permission not granted");
        }
        setStoragePermission(true);
      }

      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      return fileName;
    } catch (error) {
      console.error("Error saving file:", error);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      return fileName;
    }
  };

  const isMobileDevice = () => {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  };

  const handleExport = async (exporter, fileType) => {
    if (!startDate || !endDate) {
      alert("Please select start and end dates first");
      return;
    }

    if (!exportPermission) {
      alert(
        "You don't have permission to export data. Please contact your administrator."
      );
      return;
    }

    if (isMobileDevice() && !storagePermission) {
      try {
        const permResult = await Filesystem.requestPermissions();
        if (permResult.publicStorage === "granted") {
          setStoragePermission(true);
        } else {
          alert(
            "Storage permission is required to save files. Please enable it in your device settings."
          );
          return;
        }
      } catch (error) {
        console.error("Error requesting storage permission:", error);
        alert(
          "Failed to request storage permission. Please check your device settings."
        );
        return;
      }
    }

    setExporting(true);
    setExportStatus({ success: false, message: "" });

    try {
      const fileName = await exporter();
      const location = isMobileDevice()
        ? "Documents folder"
        : "Downloads folder";

      setExportStatus({
        success: true,
        message: `File saved successfully as ${fileName} in your ${location}!`,
      });
      setExportedFileName(fileName);
      setShareModalOpen(true);
    } catch (error) {
      console.error("Export failed:", error);
      setExportStatus({
        success: false,
        message: `Export failed: ${error.message}`,
      });
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const exportDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // --- Page 1: Financial Statement Summary ---
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("MAXBOND INFRA LTD.", 105, 10, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Exported by: ${userName}`, 105, 15, { align: "center" });
    doc.text(`Site Name: ${userSiteName}`, 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(
      `From: ${formatDate(startDate)} To: ${formatDate(endDate)}`,
      105,
      27,
      { align: "center" }
    );

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Opening Balance:", 20, 45);
    doc.text(`${summary.openingBalance.toFixed(2)}`, 50, 45);

    doc.text("Total Income:", 20, 50);
    doc.text(`${summary.totalIncome.toFixed(2)}`, 50, 50);

    doc.text("Total Expenses:", 20, 55);
    doc.text(`${summary.totalExpenses.toFixed(2)}`, 50, 55);

    doc.text("Net Balance:", 20, 60);
    doc.text(
      `${Math.abs(summary.netBalance).toFixed(2)} ${
        summary.netBalance >= 0 ? "Cr" : "Dr"
      }`,
      50,
      60
    );

    autoTable(doc, {
      startY: 70,
      head: [["Date", "Description", "Debit", "Credit", "Balance"]],
      body: generateTransactionRows(),
      theme: "grid",
      headStyles: {
        fillColor: [224, 242, 247], // Light blue header color
        textColor: 0,
        fontStyle: "bold",
        fontSize: 10,
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      didParseCell: function (data) {
        if (data.column.index === 2 && data.cell.raw !== "") {
          data.cell.styles.textColor = [255, 0, 0];
        }
        if (data.column.index === 3 && data.cell.raw !== "") {
          data.cell.styles.textColor = [0, 128, 0];
        }
      },
      columnStyles: {
        0: { cellWidth: 25, lineWidth: 0.1 },
        1: { cellWidth: 70, lineWidth: 0.1 },
        2: { cellWidth: 25, halign: "right", lineWidth: 0.1 },
        3: { cellWidth: 25, halign: "right", lineWidth: 0.1 },
        4: { cellWidth: 35, halign: "right", lineWidth: 0.1 },
      },
      didDrawPage: function (data) {
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(
          `Page ${data.pageNumber} of ${doc.internal.pages.length}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
        doc.text(
          "Generated by Maxbond Finance System",
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: "center" }
        );
        doc.text(
          "Support: 8818050651",
          doc.internal.pageSize.width - 20,
          doc.internal.pageSize.height - 10,
          { align: "right" }
        );
      },
    });

    // --- Page 2: MAXBOND INFRA LTD Template ---
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("MAXBOND INFRA LTD.", doc.internal.pageSize.width / 2, 20, { align: "center" });

    const initialX = 20;
    let currentY = 30;
    const rowHeight = 8;
    const padding = 2;
    const pageWidth = doc.internal.pageSize.width;

    // Row 1: PAGE NO. (1) and SITE NAME
    const pageNoWidth = 50;
    const siteNameWidth = pageWidth - initialX * 2 - pageNoWidth;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    doc.rect(initialX, currentY, pageNoWidth, rowHeight);
    doc.text("PAGE NO. (1)", initialX + padding, currentY + rowHeight / 2, { baseline: "middle" });

    doc.rect(initialX + pageNoWidth, currentY, siteNameWidth, rowHeight);
    doc.text(`SITE NAME: ${userSiteName}`, initialX + pageNoWidth + padding, currentY + rowHeight / 2, { baseline: "middle" });
    currentY += rowHeight;

    // Row 2: ENGINEER NAME, MONTH, YEAR
    const engNameBoxWidth = 75;
    const monthBoxWidth = 50;
    const yearBoxWidth = pageWidth - initialX * 2 - engNameBoxWidth - monthBoxWidth;

    doc.rect(initialX, currentY, engNameBoxWidth, rowHeight);
    doc.text("ENGINEER NAME:", initialX + padding, currentY + rowHeight / 2, { baseline: "middle" });
    doc.text(userName, initialX + padding + 35, currentY + rowHeight / 2, { baseline: "middle" });

    const currentMonth = new Date(startDate).toLocaleString('en-GB', { month: 'long' });
    doc.rect(initialX + engNameBoxWidth, currentY, monthBoxWidth, rowHeight);
    doc.text("MONTH:", initialX + engNameBoxWidth + padding, currentY + rowHeight / 2, { baseline: "middle" });
    doc.text(currentMonth, initialX + engNameBoxWidth + padding + 15, currentY + rowHeight / 2, { baseline: "middle" });

    const currentYear = new Date(startDate).getFullYear();
    doc.rect(initialX + engNameBoxWidth + monthBoxWidth, currentY, yearBoxWidth, rowHeight);
    doc.text("YEAR:", initialX + engNameBoxWidth + monthBoxWidth + padding, currentY + rowHeight / 2, { baseline: "middle" });
    doc.text(String(currentYear), initialX + engNameBoxWidth + monthBoxWidth + padding + 10, currentY + rowHeight / 2, { baseline: "middle" });

    currentY += rowHeight + 5;

    // Main data table headers
    const colDateWidth = 30;
    const colReceivedWidth = 50;
    const colExpensesWidth = 50;
    const colBalanceWidth = pageWidth - initialX * 2 - colDateWidth - colReceivedWidth - colExpensesWidth;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    doc.rect(initialX, currentY, colDateWidth, rowHeight);
    doc.text("DATE", initialX + colDateWidth / 2, currentY + rowHeight / 2, { align: "center", baseline: "middle" });

    doc.rect(initialX + colDateWidth, currentY, colReceivedWidth, rowHeight);
    doc.text("RECEIVED AMT", initialX + colDateWidth + colReceivedWidth / 2, currentY + rowHeight / 2, { align: "center", baseline: "middle" });

    doc.rect(initialX + colDateWidth + colReceivedWidth, currentY, colExpensesWidth, rowHeight);
    doc.text("EXPENSES", initialX + colDateWidth + colReceivedWidth + colExpensesWidth / 2, currentY + rowHeight / 2, { align: "center", baseline: "middle" });

    doc.rect(initialX + colDateWidth + colReceivedWidth + colExpensesWidth, currentY, colBalanceWidth, rowHeight);
    doc.text("BALANCE AMT", initialX + colDateWidth + colReceivedWidth + colExpensesWidth + colBalanceWidth / 2, currentY + rowHeight / 2, { align: "center", baseline: "middle" });

    currentY += rowHeight;

    // Start of the modified logic for page 2
    let runningBalancePage2 = 0;
    let totalReceivedPage2 = 0;
    let totalExpensesPage2 = 0;

    const page1Data = generateTransactionRows(); // Use the same data generation function as page 1
    const openingEntryPage1 = page1Data[0];
    if (openingEntryPage1 && openingEntryPage1[3]) {
        runningBalancePage2 = parseFloat(openingEntryPage1[3]);
        totalReceivedPage2 += runningBalancePage2;
    }

    // Process the data rows, skipping the header and total row
    for (let i = 0; i < page1Data.length - 1; i++) {
        const rowData = page1Data[i];
        if (rowData[1] === "Opening Balance") {
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.rect(initialX, currentY, colDateWidth, rowHeight);
            doc.text(rowData[0], initialX + padding, currentY + rowHeight / 2, { baseline: "middle" });
            doc.rect(initialX + colDateWidth, currentY, colReceivedWidth, rowHeight);
            doc.text(rowData[3], initialX + colDateWidth + colReceivedWidth - padding, currentY + rowHeight / 2, { align: "right", baseline: "middle" });
            doc.rect(initialX + colDateWidth + colReceivedWidth, currentY, colExpensesWidth, rowHeight);
            doc.text(rowData[2], initialX + colDateWidth + colReceivedWidth + colExpensesWidth - padding, currentY + rowHeight / 2, { align: "right", baseline: "middle" });
            doc.rect(initialX + colDateWidth + colReceivedWidth + colExpensesWidth, currentY, colBalanceWidth, rowHeight);
            doc.text(rowData[4], initialX + colDateWidth + colReceivedWidth + colExpensesWidth + colBalanceWidth - padding, currentY + rowHeight / 2, { align: "right", baseline: "middle" });
            currentY += rowHeight;
            continue;
        }

        let received = rowData[3];
        let expense = rowData[2];

        if (received) totalReceivedPage2 += parseFloat(received);
        if (expense) totalExpensesPage2 += parseFloat(expense);

        // Check for page break
        if (currentY + rowHeight > doc.internal.pageSize.height - 30) {
            doc.addPage();
            currentY = 20;
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("MAXBOND INFRA LTD.", pageWidth / 2, 10, { align: "center" });
            currentY += 10;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.rect(initialX, currentY, colDateWidth, rowHeight);
            doc.text("DATE", initialX + colDateWidth / 2, currentY + rowHeight / 2, { align: "center", baseline: "middle" });
            doc.rect(initialX + colDateWidth, currentY, colReceivedWidth, rowHeight);
            doc.text("RECEIVED AMT", initialX + colDateWidth + colReceivedWidth / 2, currentY + rowHeight / 2, { align: "center", baseline: "middle" });
            doc.rect(initialX + colDateWidth + colReceivedWidth, currentY, colExpensesWidth, rowHeight);
            doc.text("EXPENSES", initialX + colDateWidth + colReceivedWidth + colExpensesWidth / 2, currentY + rowHeight / 2, { align: "center", baseline: "middle" });
            doc.rect(initialX + colDateWidth + colReceivedWidth + colExpensesWidth, currentY, colBalanceWidth, rowHeight);
            doc.text("BALANCE AMT", initialX + colDateWidth + colReceivedWidth + colExpensesWidth + colBalanceWidth / 2, currentY + rowHeight / 2, { align: "center", baseline: "middle" });
            currentY += rowHeight;
        }

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.rect(initialX, currentY, colDateWidth, rowHeight);
        doc.text(rowData[0], initialX + padding, currentY + rowHeight / 2, { baseline: "middle" });
        doc.rect(initialX + colDateWidth, currentY, colReceivedWidth, rowHeight);
        doc.text(received, initialX + colDateWidth + colReceivedWidth - padding, currentY + rowHeight / 2, { align: "right", baseline: "middle" });
        doc.rect(initialX + colDateWidth + colReceivedWidth, currentY, colExpensesWidth, rowHeight);
        doc.text(expense, initialX + colDateWidth + colReceivedWidth + colExpensesWidth - padding, currentY + rowHeight / 2, { align: "right", baseline: "middle" });
        doc.rect(initialX + colDateWidth + colReceivedWidth + colExpensesWidth, currentY, colBalanceWidth, rowHeight);
        doc.text(rowData[4], initialX + colDateWidth + colReceivedWidth + colExpensesWidth + colBalanceWidth - padding, currentY + rowHeight / 2, { align: "right", baseline: "middle" });

        currentY += rowHeight;
    }
    // End of the modified logic for page 2

    // TOTAL row for Page 2
    if (currentY + rowHeight > doc.internal.pageSize.height - 30) {
      doc.addPage();
      currentY = 20;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("MAXBOND INFRA LTD.", pageWidth / 2, 10, { align: "center" });
      currentY += 10;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    doc.rect(initialX, currentY, colDateWidth, rowHeight);
    doc.text("TOTAL", initialX + padding, currentY + rowHeight / 2, { baseline: "middle" });

    doc.rect(initialX + colDateWidth, currentY, colReceivedWidth, rowHeight);
    doc.text(totalReceivedPage2.toFixed(2), initialX + colDateWidth + colReceivedWidth - padding, currentY + rowHeight / 2, { align: "right", baseline: "middle" });

    doc.rect(initialX + colDateWidth + colReceivedWidth, currentY, colExpensesWidth, rowHeight);
    doc.text(totalExpensesPage2.toFixed(2), initialX + colDateWidth + colReceivedWidth + colExpensesWidth - padding, currentY + rowHeight / 2, { align: "right", baseline: "middle" });

    doc.rect(initialX + colDateWidth + colReceivedWidth + colExpensesWidth, currentY, colBalanceWidth, rowHeight);
    const finalBalancePage2 =
      (summary.netBalance) >= 0
        ? `${(summary.netBalance).toFixed(2)} Cr`
        : `${Math.abs(summary.netBalance).toFixed(2)} Dr`;
    doc.text(finalBalancePage2, initialX + colDateWidth + colReceivedWidth + colExpensesWidth + colBalanceWidth - padding, currentY + rowHeight / 2, { align: "right", baseline: "middle" });

    currentY += rowHeight + 10;

    // ENGINEER SIGN... (modified to remove border and align left)
    if (currentY + rowHeight > doc.internal.pageSize.height - 30) {
      doc.addPage();
      currentY = 20;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("MAXBOND INFRA LTD.", pageWidth / 2, 10, { align: "center" });
      currentY += 10;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const engineerSignX = initialX; // Aligned to the left
    const engineerSignHeight = 10;
    // Removed doc.rect() to remove the border
    doc.text("ENGINEER SIGN...", engineerSignX, currentY + engineerSignHeight / 2, { align: "left", baseline: "middle" });


    const blob = doc.output("blob");
    const fileName = `MaxBond_Financial_Statement_${startDate}_to_${endDate}.pdf`;
    await saveFile(blob, fileName);
    return fileName;
  };

  const exportToExcel = async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    const borderStyle = {
      top: { style: "thin", color: { auto: 1 } },
      bottom: { style: "thin", color: { auto: 1 } },
      left: { style: "thin", color: { auto: 1 } },
      right: { style: "thin", color: { auto: 1 } },
    };

    const headerMainTitleStyle = {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "FFE0E0E0" } },
      border: borderStyle,
    };

    const headerInfoLabelStyle = {
      font: { sz: 10 },
      alignment: { horizontal: "left", vertical: "center" },
      fill: { fgColor: { rgb: "FFE0E0E0" } },
      border: borderStyle,
    };
    const headerInfoValueStyle = {
        font: { sz: 10, bold: false },
        alignment: { horizontal: "left", vertical: "center" },
        fill: { fgColor: { rgb: "FFFFFFFF" } },
        border: borderStyle,
    };
    const headerInfoValueRightAlignStyle = {
        font: { sz: 10, bold: false },
        alignment: { horizontal: "right", vertical: "center" },
        fill: { fgColor: { rgb: "FFFFFFFF" } },
        border: borderStyle,
    };

    const tableHeaderStyle = {
      font: { bold: true, color: { rgb: "FFFFFFFF" } },
      fill: { fgColor: { rgb: "FF0F2E53" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: borderStyle,
    };

    const dataCellStyle = {
      font: { sz: 9 },
      alignment: { horizontal: "left", vertical: "center" },
      border: borderStyle,
    };

    const dataCellRightAlignStyle = {
        font: { sz: 9 },
        alignment: { horizontal: "right", vertical: "center" },
        border: borderStyle,
    };

    const greenTextStyle = { font: { color: { rgb: "FF008000" } } };
    const redTextStyle = { font: { color: { rgb: "FFFF0000" } } };

    const totalRowStyle = {
      font: { bold: true, sz: 10 },
      fill: { fgColor: { rgb: "FFE0F2F7" } },
      border: borderStyle,
    };
    const totalRowRightAlignStyle = {
        font: { bold: true, sz: 10 },
        alignment: { horizontal: "right", vertical: "center" },
        fill: { fgColor: { rgb: "FFE0F2F7" } },
        border: borderStyle,
    };

    const engineerSignStyle = {
      font: { bold: true, sz: 10 },
      alignment: { horizontal: "center", vertical: "center" },
      border: borderStyle,
    };

    let rowIndex = 1;

    // Helper to ensure cell exists before styling
    const getCell = (sheet, row, col) => {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (!sheet[cellRef]) {
            sheet[cellRef] = { t: 's', v: '' };
        }
        return sheet[cellRef];
    };

    // Row 1: MAXBOND INFRA LTD.
    XLSX.utils.sheet_add_aoa(ws, [["MAXBOND INFRA LTD."]], { origin: `A${rowIndex}` });
    getCell(ws, rowIndex - 1, 0).s = headerMainTitleStyle;
    ws["!merges"] = ws["!merges"] || [];
    ws["!merges"].push({ s: { r: rowIndex - 1, c: 0 }, e: { r: rowIndex - 1, c: 4 } });
    rowIndex++;

    // Row 2: Empty for spacing
    rowIndex++;

    // Row 3: PAGE NO. (1) and SITE NAME
    XLSX.utils.sheet_add_aoa(ws, [
        ["PAGE NO. (1)", "", "SITE NAME:", userSiteName]
    ], { origin: `A${rowIndex}` });

    getCell(ws, rowIndex - 1, 0).s = headerInfoLabelStyle;
    getCell(ws, rowIndex - 1, 1).s = headerInfoValueStyle;
    getCell(ws, rowIndex - 1, 2).s = headerInfoLabelStyle;
    getCell(ws, rowIndex - 1, 3).s = headerInfoValueStyle;
    getCell(ws, rowIndex - 1, 4).s = headerInfoValueStyle;


    ws["!merges"].push({ s: { r: rowIndex - 1, c: 0 }, e: { r: rowIndex - 1, c: 1 } });
    ws["!merges"].push({ s: { r: rowIndex - 1, c: 3 }, e: { r: rowIndex - 1, c: 4 } });
    rowIndex++;

    // Row 4: ENGINEER NAME, MONTH, YEAR
    const currentMonth = new Date(startDate).toLocaleString('en-GB', { month: 'long' });
    const currentYear = new Date(startDate).getFullYear();
    XLSX.utils.sheet_add_aoa(ws, [
        ["ENGINEER NAME:", userName, "MONTH:", currentMonth, "YEAR:", currentYear]
    ], { origin: `A${rowIndex}` });

    getCell(ws, rowIndex - 1, 0).s = headerInfoLabelStyle;
    getCell(ws, rowIndex - 1, 1).s = headerInfoValueStyle;
    getCell(ws, rowIndex - 1, 2).s = headerInfoLabelStyle;
    getCell(ws, rowIndex - 1, 3).s = headerInfoValueRightAlignStyle;
    getCell(ws, rowIndex - 1, 4).s = headerInfoLabelStyle;
    getCell(ws, rowIndex - 1, 5).s = headerInfoValueRightAlignStyle;

    rowIndex += 2;

    // Table Headers
    XLSX.utils.sheet_add_aoa(ws, [["DATE", "RECEIVED AMT", "EXPENSES", "BALANCE AMT"]], { origin: `A${rowIndex}` });
    for (let c = 0; c < 4; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: c });
      getCell(ws, rowIndex - 1, c).s = tableHeaderStyle;
    }
    rowIndex++;

    let runningBalancePage2 = 0;
    let totalReceivedPage2 = 0;
    let totalExpensesPage2 = 0;

    const openingEntryPage2 = allData.find(
      (item) =>
        item.recordType === "opening" && item.timestamp && item.timestamp.seconds
    );
    const openingBalancePage2 = openingEntryPage2 ? openingEntryPage2.amount : 0;

    XLSX.utils.sheet_add_aoa(ws, [[
      formatDate(startDate),
      openingBalancePage2.toFixed(2),
      "",
      `${openingBalancePage2.toFixed(2)} Cr`,
    ]], { origin: `A${rowIndex}` });
    getCell(ws, rowIndex - 1, 0).s = dataCellStyle;
    getCell(ws, rowIndex - 1, 1).s = { ...dataCellRightAlignStyle, ...greenTextStyle };
    getCell(ws, rowIndex - 1, 2).s = dataCellRightAlignStyle;
    getCell(ws, rowIndex - 1, 3).s = dataCellRightAlignStyle;
    rowIndex++;

    const filteredDataPage2 = allData
      .filter((item) => {
        if (!item.timestamp || !item.timestamp.seconds) return false;
        const date = new Date(item.timestamp.seconds * 1000);
        const itemDate = date.toISOString().split("T")[0];
        return itemDate >= startDate && itemDate <= endDate && item.recordType !== "opening";
      })
      .sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    filteredDataPage2.forEach((item) => {
      let received = "";
      let expense = "";
      let currentAmount = 0;

      if (item.recordType === "expense") {
        expense = (item.cost || 0).toFixed(2);
        currentAmount = -(item.cost || 0);
        totalExpensesPage2 += (item.cost || 0);
      } else if (item.recordType === "transaction" && item.type === "credit") {
        received = (item.amount || 0).toFixed(2);
        currentAmount = (item.amount || 0);
        totalReceivedPage2 += (item.amount || 0);
      } else if (item.recordType === "transaction" && item.type === "debit") {
        expense = (item.amount || 0).toFixed(2);
        currentAmount = -(item.amount || 0);
        totalExpensesPage2 += (item.amount || 0);
      } else if (item.recordType === "external" && item.type === "credit") {
        received = (item.amount || 0).toFixed(2);
        currentAmount = (item.amount || 0);
        totalReceivedPage2 += (item.amount || 0);
      } else if (item.recordType === "external" && item.type === "debit") {
        expense = (item.amount || 0).toFixed(2);
        currentAmount = -(item.amount || 0);
        totalExpensesPage2 += (item.amount || 0);
      } else if (item.recordType === "employee" && item.type === "credit") {
        received = (item.amount || 0).toFixed(2);
        currentAmount = (item.amount || 0);
        totalReceivedPage2 += (item.amount || 0);
      } else if (item.recordType === "employee" && item.type === "debit") {
        expense = (item.amount || 0).toFixed(2);
        currentAmount = -(item.amount || 0);
        totalExpensesPage2 += (item.amount || 0);
      }

      runningBalancePage2 += currentAmount;

      const balanceText =
        runningBalancePage2 >= 0
          ? `${runningBalancePage2.toFixed(2)} Cr`
          : `${Math.abs(runningBalancePage2).toFixed(2)} Dr`;

      XLSX.utils.sheet_add_aoa(ws, [[
        formatDate(new Date(item.timestamp.seconds * 1000).toISOString().split("T")[0]),
        received,
        expense,
        balanceText,
      ]], { origin: `A${rowIndex}` });

      getCell(ws, rowIndex - 1, 0).s = dataCellStyle;
      if (received !== "") {
          getCell(ws, rowIndex - 1, 1).s = { ...dataCellRightAlignStyle, ...greenTextStyle };
      } else {
          getCell(ws, rowIndex - 1, 1).s = dataCellRightAlignStyle;
      }
      if (expense !== "") {
          getCell(ws, rowIndex - 1, 2).s = { ...dataCellRightAlignStyle, ...redTextStyle };
      } else {
          getCell(ws, rowIndex - 1, 2).s = dataCellRightAlignStyle;
      }
      getCell(ws, rowIndex - 1, 3).s = dataCellRightAlignStyle;
      rowIndex++;
    });

    // Total row
    const finalBalancePage2 =
      runningBalancePage2 >= 0
        ? `${runningBalancePage2.toFixed(2)} Cr`
        : `${Math.abs(runningBalancePage2).toFixed(2)} Dr`;
    XLSX.utils.sheet_add_aoa(ws, [[
      "TOTAL",
      totalReceivedPage2.toFixed(2),
      totalExpensesPage2.toFixed(2),
      finalBalancePage2,
    ]], { origin: `A${rowIndex}` });

    for (let c = 0; c < 4; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: c });
      getCell(ws, rowIndex - 1, c).s = { ...totalRowStyle };
      if (c > 0) {
        getCell(ws, rowIndex - 1, c).s = { ...getCell(ws, rowIndex - 1, c).s, ...totalRowRightAlignStyle };
      }
    }
    rowIndex++;

    // Empty rows for spacing before Engineer Sign
    rowIndex += 2;

    // Engineer Sign row
    XLSX.utils.sheet_add_aoa(ws, [["ENGINEER SIGN..."]], { origin: `A${rowIndex}` });
    getCell(ws, rowIndex - 1, 0).s = engineerSignStyle;
    ws["!merges"].push({ s: { r: rowIndex - 1, c: 0 }, e: { r: rowIndex - 1, c: 3 } });

    // Column widths
    ws["!cols"] = [
      { wch: 15 }, // DATE
      { wch: 20 }, // RECEIVED AMT
      { wch: 15 }, // EXPENSES
      { wch: 20 }, // BALANCE AMT
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Site Expenses");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "binary" });
    const s2ab = (s) => {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
      return buf;
    };
    const blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });
    const fileName = `MaxBond_Site_Expenses_${startDate}_to_${endDate}.xlsx`;
    await saveFile(blob, fileName);
    return fileName;
  };

  const handlePrint = async () => {
    if (!exportPermission) {
      alert(
        "You don't have permission to print data. Please contact your administrator."
      );
      return;
    }

    if (isMobileDevice()) {
      await handleExport(exportToPDF, "pdf");
    } else {
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>Financial Statement - ${formatDate(startDate)} to ${formatDate(endDate)}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
              
              body {
                font-family: 'Roboto', sans-serif;
                margin: 1.5rem;
                color: #000;
                background-color: #fff;
              }
              
              .print-container {
                max-width: 1000px;
                margin: 0 auto;
              }
              
              .company-header {
                text-align: center;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 2px solid #000;
              }
              
              .company-header h1 {
                font-size: 1.8rem;
                font-weight: 700;
                margin-bottom: 0.25rem;
              }
              
              .date-range {
                text-align: center;
                font-size: 1.1rem;
                font-weight: 500;
                margin-bottom: 1rem;
              }
              
              .export-info {
                text-align: center;
                margin-bottom: 1.5rem;
                font-size: 0.9rem;
              }
              
              .summary-section {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
                margin-bottom: 1.5rem;
              }
              
              .summary-card {
                text-align: center;
                padding: 0.5rem;
                border: 1px solid #000;
                border-radius: 4px;
              }
              
              .summary-card h3 {
                font-size: 0.9rem;
                font-weight: 500;
                margin: 0 0 0.5rem 0;
              }
              
              .summary-card .value {
                font-size: 1.25rem;
                font-weight: 700;
              }
              
              .transactions-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 1.5rem;
                font-size: 0.9rem;
                border: 1px solid #000;
              }
              
              .transactions-table th {
                background-color: #0F2E53;
                color: #fff;
                padding: 0.75rem;
                text-align: left;
                font-weight: 500;
                border-bottom: 2px solid #000;
                border-right: 1px solid #000;
              }
              
              .transactions-table th:last-child {
                border-right: none;
              }
              
              .transactions-table td {
                padding: 0.75rem;
                border-bottom: 1px solid #e0e0e0;
                border-right: 1px solid #000;
              }
              
              .transactions-table td:last-child {
                border-right: none;
              }
              
              .debit {
                text-align: right;
                font-weight: 500;
                color: red;
              }
              
              .credit {
                text-align: right;
                font-weight: 500;
                color: green;
              }
              
              .balance {
                text-align: right;
                font-weight: 500;
              }
              
              .total-row td {
                font-weight: 700;
                border-top: 2px solid #000;
              }
              
              /* Column widths */
              .transactions-table td:nth-child(1),
              .transactions-table th:nth-child(1) {
                width: 15%;
              }
              
              .transactions-table td:nth-child(2),
              .transactions-table th:nth-child(2) {
                width: 45%;
              }
              
              .transactions-table td:nth-child(3),
              .transactions-table th:nth-child(3),
              .transactions-table td:nth-child(4),
              .transactions-table th:nth-child(4),
              .transactions-table td:nth-child(5),
              .transactions-table th:nth-child(5) {
                width: 10%;
                text-align: right;
              }
              
              @media print {
                @page {
                  margin: 1cm;
                }
                
                body {
                  margin: 0;
                  padding: 0;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                
                .transactions-table {
                  page-break-inside: avoid;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              <div class="company-header">
                <h1>MaxBond Financial Statement</h1>
              </div>
              
              <div class="date-range">
                From: ${formatDate(startDate)} To: ${formatDate(endDate)}
              </div>
              
              <div class="export-info">
                Exported by: ${userName} | Site Name: ${userSiteName} | Exported on: ${new Date().toLocaleDateString()}
              </div>
              
              <div class="summary-section">
                <div class="summary-card">
                  <h3>Opening Balance</h3>
                  <div class="value">${summary.openingBalance.toFixed(2)}</div>
                </div>
                <div class="summary-card">
                  <h3>Total Income</h3>
                  <div class="value">${summary.totalIncome.toFixed(2)}</div>
                </div>
                <div class="summary-card">
                  <h3>Total Expenses</h3>
                  <div class="value">${summary.totalExpenses.toFixed(2)}</div>
                </div>
                <div class="summary-card">
                  <h3>Net Balance</h3>
                  <div class="value">
                    ${Math.abs(summary.netBalance).toFixed(2)} ${
                      summary.netBalance >= 0 ? "Cr" : "Dr"
                    }
                  </div>
                </div>
              </div>
              
              <table class="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${generatePrintRows()}
                </tbody>
              </table>
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 1000);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };
  
  const shareOnWhatsApp = async () => {
    if (!exportPermission) {
      alert(
        "You don't have permission to export data. Please contact your administrator."
      );
      return;
    }
    
    // We export to PDF first
    try {
      const fileName = await exportToPDF();
      if (isMobileDevice()) {
        const message = encodeURIComponent(
          `Hello, here is the financial statement for MaxBond Infra from ${formatDate(startDate)} to ${formatDate(endDate)}.`
        );
        const fileUri = await Filesystem.getUri({
          directory: Directory.Documents,
          path: fileName,
        });

        // This is a simplified approach, direct file sharing might require a plugin
        window.open(`whatsapp://send?text=${message}&file=${fileUri.uri}`, '_system');

        setExportStatus({
          success: true,
          message: `PDF saved as ${fileName} in your Documents folder. Attempting to open WhatsApp...`,
        });
      } else {
        const message = encodeURIComponent(
          `Check out the financial statement from ${formatDate(
            startDate
          )} to ${formatDate(endDate)} for MaxBond Infra. Please find the downloaded PDF in your downloads folder.`
        );

        window.open(`https://web.whatsapp.com/send?text=${message}`, "_blank");

        setExportStatus({
          success: true,
          message:
            "WhatsApp web opened. Please send the downloaded PDF file manually.",
        });
      }
    } catch (error) {
      console.error("Sharing failed", error);
      setExportStatus({
        success: false,
        message: "Sharing failed. Please try downloading and sharing manually.",
      });
    }
  };
  
  const handleShareOption = async (option) => {
      setShareModalOpen(false);
      const message = encodeURIComponent(`Hello, here is the financial report for MaxBond Infra from ${formatDate(startDate)} to ${formatDate(endDate)}.`);

      if (option === 'whatsapp') {
          if (isMobileDevice()) {
              const fileUri = await Filesystem.getUri({
                directory: Directory.Documents,
                path: exportedFileName,
              });
              // Note: Direct file sharing via URL scheme can be inconsistent.
              // A native plugin for file sharing is more reliable for production mobile apps.
              window.open(`whatsapp://send?text=${message}&file=${fileUri.uri}`, '_system');
          } else {
              window.open(`https://web.whatsapp.com/send?text=${message}`, '_blank');
              setExportStatus({
                success: true,
                message: "WhatsApp web opened. Please send the downloaded file manually.",
              });
          }
      } else if (option === 'email') {
          window.open(`mailto:?subject=${encodeURIComponent('MaxBond Financial Report')}&body=${message}`, '_self');
      }
  };
  
  const generatePrintRows = () => {
    let rowsHTML = "";
    let runningBalance = 0;
    let actualDebitTotal = 0;
    let actualCreditTotal = 0;

    const openingEntry = allData.find(
      (item) =>
        item.recordType === "opening" && item.timestamp && item.timestamp.seconds
    );
    const openingBalance = openingEntry ? openingEntry.amount : 0;

    rowsHTML += `
      <tr>
        <td>${formatDate(startDate)}</td>
        <td>Opening Balance</td>
        <td class="debit"></td>
        <td class="credit">${openingBalance.toFixed(2)}</td>
        <td class="balance">${openingBalance.toFixed(2)} Cr</td>
      </tr>
    `;

    runningBalance = openingBalance;

    const filteredData = allData
      .filter((item) => {
        if (!item.timestamp || !item.timestamp.seconds) return false;
        const date = new Date(item.timestamp.seconds * 1000);
        const itemDate = date.toISOString().split("T")[0];
        return itemDate >= startDate && itemDate <= endDate && item.recordType !== "opening";
      })
      .sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    filteredData.forEach((item) => {
      if (item.recordType === "opening") return;
      if (!item.timestamp || !item.timestamp.seconds) return;

      const date = new Date(item.timestamp.seconds * 1000);
      const formattedDate = formatDate(date.toISOString().split("T")[0]);

      let description = "";
      let debit = 0;
      let credit = 0;

      if (item.recordType === "expense") {
        description = item.name || "Expense";
        debit = item.cost || 0;
        actualDebitTotal += debit;
      } else if (item.recordType === "transaction") {
        description = `Transaction: ${item.to || item.email || "Unknown"}`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      } else if (item.recordType === "external") {
        description = `${item.name || "External"} (${
          item.profession || "Unknown"
        })`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      } else if (item.recordType === "employee") {
        description = `Employee: ${item.from || "Unknown"}`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      }

      runningBalance = runningBalance + credit - debit;
      const balanceText =
        runningBalance >= 0
          ? `${runningBalance.toFixed(2)} Cr`
          : `${Math.abs(runningBalance).toFixed(2)} Dr`;

      rowsHTML += `
        <tr>
          <td>${formattedDate}</td>
          <td>${description}</td>
          <td class="debit">${debit > 0 ? debit.toFixed(2) : ""}</td>
          <td class="credit">${credit > 0 ? credit.toFixed(2) : ""}</td>
          <td class="balance">${balanceText}</td>
        </tr>
      `;
    });

    const totalBalanceText =
      runningBalance >= 0
        ? `${Math.abs(runningBalance).toFixed(2)} Cr`
        : `${Math.abs(runningBalance).toFixed(2)} Dr`;

    rowsHTML += `
      <tr class="total-row">
        <td><strong>Grand Total</strong></td>
        <td></td>
        <td class="debit"><strong>${actualDebitTotal.toFixed(2)}</strong></td>
        <td class="credit"><strong>${actualCreditTotal.toFixed(2)}</strong></td>
        <td class="balance"><strong>${totalBalanceText}</strong></td>
      </tr>
    `;

    return rowsHTML;
  };

  const generatePreviewRows = () => {
    let rows = [];
    let runningBalance = 0;
    let actualDebitTotal = 0;
    let actualCreditTotal = 0;

    const openingEntry = allData.find(
      (item) =>
        item.recordType === "opening" && item.timestamp && item.timestamp.seconds
    );
    const openingBalance = openingEntry ? openingEntry.amount : 0;

    rows.push(
      <tr className="table-row" key="opening">
        <td>{formatDate(startDate)}</td>
        <td>Opening Balance</td>
        <td></td>
        <td className="credit">{openingBalance.toFixed(2)}</td>
        <td className="balance">{openingBalance.toFixed(2)} Cr</td>
      </tr>
    );

    runningBalance = openingBalance;

    const filteredData = allData
      .filter((item) => {
        if (!item.timestamp || !item.timestamp.seconds) return false;
        const date = new Date(item.timestamp.seconds * 1000);
        const itemDate = date.toISOString().split("T")[0];
        return itemDate >= startDate && itemDate <= endDate && item.recordType !== "opening";
      })
      .sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    filteredData.forEach((item, index) => {
      if (item.recordType === "opening") return;
      if (!item.timestamp || !item.timestamp.seconds) return;

      const date = new Date(item.timestamp.seconds * 1000);
      const formattedDate = formatDate(date.toISOString().split("T")[0]);

      let description = "";
      let debit = 0;
      let credit = 0;

      if (item.recordType === "expense") {
        description = item.name || "Expense";
        debit = item.cost || 0;
        actualDebitTotal += debit;
      } else if (item.recordType === "transaction") {
        description = `Transaction: ${item.to || item.email || "Unknown"}`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      } else if (item.recordType === "external") {
        description = `${item.name || "External"} (${
          item.profession || "Unknown"
        })`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      } else if (item.recordType === "employee") {
        description = `Employee: ${item.from || "Unknown"}`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      }

      runningBalance = runningBalance + credit - debit;
      const balanceText =
        runningBalance >= 0
          ? `${runningBalance.toFixed(2)} Cr`
          : `${Math.abs(runningBalance).toFixed(2)} Dr`;

      rows.push(
        <tr className="table-row" key={index}>
          <td>{formattedDate}</td>
          <td>{description}</td>
          <td className="debit">{debit > 0 ? debit.toFixed(2) : ""}</td>
          <td className="credit">{credit > 0 ? credit.toFixed(2) : ""}</td>
          <td className="balance">{balanceText}</td>
        </tr>
      );
    });

    const totalBalanceText =
      runningBalance >= 0
        ? `${Math.abs(runningBalance).toFixed(2)} Cr`
        : `${Math.abs(runningBalance).toFixed(2)} Dr`;

    rows.push(
      <tr className="table-row total-row" key="total">
        <td>
          <strong>Grand Total</strong>
        </td>
        <td></td>
        <td className="debit">
          <strong>{actualDebitTotal.toFixed(2)}</strong>
        </td>
        <td className="credit">
          <strong>{actualCreditTotal.toFixed(2)}</strong>
        </td>
        <td className="balance">
          <strong>{totalBalanceText}</strong>
        </td>
      </tr>
    );

    return rows;
  };

  return (
    <div className="export-container">
      <div className="back-button" onClick={() => navigate("/dashboard")}>
        <FaArrowLeft /> Back to Dashboard
      </div>

      <div className="header-section">
        <div className="header-content">
          <h1>Financial Reports</h1>
          <p>Generate professional financial statements for any date range</p>
        </div>
      </div>

      {isMobileDevice() && !storagePermission && (
        <div className="permission-alert">
          <p>Please grant storage permission to save files properly</p>
          <button
            onClick={async () => {
              try {
                const permResult = await Filesystem.requestPermissions();
                setStoragePermission(permResult.publicStorage === "granted");
                if (permResult.publicStorage !== "granted") {
                  alert(
                    "Please grant storage permission in your device settings"
                  );
                }
              } catch (error) {
                console.error("Error requesting storage permission:", error);
              }
            }}
          >
            Grant Permission
          </button>
        </div>
      )}

      <div className="platform-tips">
        {isMobileDevice() ? (
          <p className="mobile-tip">
            <strong>Mobile Tip:</strong> Files are saved to your Documents
            folder. Use a file manager app to access them.
          </p>
        ) : (
          <p className="web-tip">
            <strong>Web Tip:</strong> Files are downloaded automatically. Check
            your browser's downloads folder.
          </p>
        )}
      </div>

      <div className="control-panel">
        <div className="date-range-selector">
          <div className="date-input-group">
            <label htmlFor="start-date">From:</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={loading || exporting}
            />
          </div>

          <div className="date-input-group">
            <label htmlFor="end-date">To:</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading || exporting}
            />
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={() => handleExport(exportToPDF, "pdf")}
            disabled={!startDate || !endDate || loading || exporting || !exportPermission}
            className="pdf-btn"
          >
            <FaDownload /> Export PDF
          </button>
          <button
            onClick={() => handleExport(exportToExcel, "excel")}
            disabled={!startDate || !endDate || loading || exporting || !exportPermission}
            className="excel-btn"
          >
            <FaFileExcel /> Export Excel
          </button>
          <button
            onClick={handlePrint}
            disabled={!startDate || !endDate || loading || exporting || !exportPermission}
            className="print-btn"
          >
            <FaPrint /> {isMobileDevice() ? "Save PDF" : "Print Report"}
          </button>
          <button
            onClick={shareOnWhatsApp}
            disabled={!startDate || !endDate || loading || exporting || !exportPermission}
            className="whatsapp-btn"
          >
            <FaWhatsapp /> Share via WhatsApp
          </button>
        </div>
      </div>

      {exportStatus.message && (
        <div
          className={`export-status ${
            exportStatus.success ? "success" : "error"
          }`}
        >
          {exportStatus.message}
        </div>
      )}

      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Generating financial report...</p>
        </div>
      )}

      {exporting && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Exporting file...</p>
        </div>
      )}

      {!loading && !exporting && startDate && endDate && (
        <div className="report-preview">
          <div className="preview-header">
            <h2>Financial Statement Preview</h2>
            <div className="preview-subheader">
              <p>
                From: {formatDate(startDate)} To: {formatDate(endDate)}
              </p>
              <p>
                <FaUser /> {userName}
              </p>
              <p>Site: {userSiteName}</p>
            </div>
          </div>

          <div className="summary-section">
            <div className="summary-card">
              <h3>Opening Balance</h3>
              <div className="value">{summary.openingBalance.toFixed(2)}</div>
            </div>
            <div className="summary-card">
              <h3>Total Income</h3>
              <div className="value">{summary.totalIncome.toFixed(2)}</div>
            </div>
            <div className="summary-card">
              <h3>Total Expenses</h3>
              <div className="value">{summary.totalExpenses.toFixed(2)}</div>
            </div>
            <div className="summary-card">
              <h3>Net Balance</h3>
              <div className="value">
                {Math.abs(summary.netBalance).toFixed(2)}{" "}
                {summary.netBalance >= 0 ? "Cr" : "Dr"}
              </div>
            </div>
          </div>

          <div className="transactions-section">
            <div className="section-header">
              <h3>Transaction Details</h3>
              <span>
                {
                  allData.filter((item) => {
                    if (!item.timestamp || !item.timestamp.seconds) return false;
                    const date = new Date(item.timestamp.seconds * 1000);
                    const itemDate = date.toISOString().split("T")[0];
                    return (
                      itemDate >= startDate &&
                      itemDate <= endDate &&
                      item.recordType !== "opening"
                    );
                  }).length
                }{" "}
                transactions
              </span>
            </div>

            <table className="preview-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>{generatePreviewRows()}</tbody>
            </table>
          </div>

          <div className="preview-footer">
            <p>This is a preview of your financial statement</p>
            <p>
              {isMobileDevice()
                ? "Files will be saved in Documents folder"
                : "Files will be downloaded automatically"}
            </p>
          </div>
        </div>
      )}

      {!loading &&
        !exporting &&
        startDate &&
        endDate &&
        allData.filter((item) => {
          if (!item.timestamp || !item.timestamp.seconds) return false;
          const date = new Date(item.timestamp.seconds * 1000);
          const itemDate = date.toISOString().split("T")[0];
          return itemDate >= startDate && itemDate <= endDate;
        }).length === 0 && (
          <div className="empty-state">
            <div className="empty-content">
              <h3>No Transactions Found</h3>
              <p>There are no transactions for the selected date range</p>
            </div>
          </div>
        )}

      <SharePromptModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onShare={handleShareOption}
        fileName={exportedFileName}
      />
    </div>
  );
};

export default ExportPage;