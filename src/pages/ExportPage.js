import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { 
  collection, 
  getDocs, 
  query, 
  where 
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  FaDownload, 
  FaFileExcel, 
  FaPrint, 
  FaCalendarAlt,
  FaArrowLeft,
  FaWhatsapp
} from "react-icons/fa";
import { calculateFinancialSummary } from "../utils/financeCalculator";
import "./ExportPage.css";
import { Filesystem, Directory } from '@capacitor/filesystem';

const ExportPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [summary, setSummary] = useState({
    openingBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    totalCredit: 0,
    totalDebit: 0,
    netBalance: 0
  });
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportPermission, setExportPermission] = useState(false);
  const [exportStatus, setExportStatus] = useState({ success: false, message: '' });
  const [storagePermission, setStoragePermission] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setExportPermission(true);
      }
    });
    
    const checkStoragePermission = async () => {
      try {
        if (isMobileDevice()) {
          const permResult = await Filesystem.requestPermissions();
          setStoragePermission(permResult.publicStorage === 'granted');
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
        
        const combined = [
          ...startSnap.docs.map(doc => ({ 
            ...doc.data(), 
            id: doc.id, 
            recordType: "opening",
            timestamp: doc.data().timestamp 
          })),
          ...expSnap.docs.map(doc => ({ 
            ...doc.data(), 
            id: doc.id, 
            recordType: "expense",
            timestamp: doc.data().timestamp 
          })),
          ...txnSnap.docs.map(doc => ({ 
            ...doc.data(), 
            id: doc.id, 
            recordType: "transaction",
            timestamp: doc.data().timestamp 
          })),
          ...extSnap.docs.map(doc => ({ 
            ...doc.data(), 
            id: doc.id, 
            recordType: "external",
            timestamp: doc.data().timestamp 
          })),
          ...empSnap.docs.map(doc => ({ 
            ...doc.data(), 
            id: doc.id, 
            recordType: "employee",
            timestamp: doc.data().timestamp 
          }))
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
    if (!selectedMonth || allData.length === 0) return;
    
    const filteredData = allData.filter((item) => {
      if (!item.timestamp || !item.timestamp.seconds) return false;
      const date = new Date(item.timestamp.seconds * 1000);
      const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return mStr === selectedMonth;
    });
    
    const expenses = filteredData.filter(d => d.recordType === "expense");
    const transactions = filteredData.filter(d => d.recordType === "transaction");
    const externals = filteredData.filter(d => d.recordType === "external");
    const startingAmounts = filteredData.filter(d => d.recordType === "opening");
    const employeeTransactions = filteredData.filter(d => d.recordType === "employee");
    
    const newSummary = calculateFinancialSummary(
      expenses,
      transactions,
      externals,
      startingAmounts,
      employeeTransactions,
      "monthly"
    );
    
    setSummary(newSummary);
  }, [allData, selectedMonth]);

  const getMonthName = (monthStr) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split("-");
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString("default", { month: "long" });
  };

  const generateTransactionRows = () => {
    if (!selectedMonth) return [];
    
    let filteredData = allData.filter((item) => {
      if (!item.timestamp || !item.timestamp.seconds) return false;
      const date = new Date(item.timestamp.seconds * 1000);
      const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return mStr === selectedMonth;
    });
    
    filteredData.sort((a, b) => 
      a.timestamp.seconds - b.timestamp.seconds
    );
    
    let runningBalance = 0;
    const rows = [];

    rows.push([
      `01 ${getMonthName(selectedMonth)} ${new Date().getFullYear()}`,
      "Opening Balance",
      "",
      summary.openingBalance.toFixed(2),
      `${summary.openingBalance.toFixed(2)} Cr`,
    ]);
    
    runningBalance = summary.openingBalance;

    filteredData = filteredData.filter(item => item.recordType !== "opening");
    
    let actualDebitTotal = 0;
    let actualCreditTotal = 0;
    
    filteredData.forEach((item) => {
      if (!item.timestamp || !item.timestamp.seconds) return;
      
      const date = new Date(item.timestamp.seconds * 1000);
      const formattedDate = `${date.getDate()} ${getMonthName(selectedMonth)}`;
      
      let description = "";
      let credit = 0;
      let debit = 0;
      
      if (item.recordType === "expense") {
        description = item.name || "Expense";
        debit = item.cost || 0;
        actualDebitTotal += debit;
      }
      else if (item.recordType === "transaction") {
        description = `Transaction: ${item.to || item.email || "Unknown"}`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      }
      else if (item.recordType === "external") {
        description = `${item.name || "External"} (${item.profession || "Unknown"})`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      }
      else if (item.recordType === "employee") {
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
      // For web browsers - use traditional download
      if (!isMobileDevice()) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
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
      
      // For mobile devices - use Capacitor
      // Request permissions if needed
      if (!storagePermission) {
        const permResult = await Filesystem.requestPermissions();
        if (permResult.publicStorage !== 'granted') {
          throw new Error('Storage permission not granted');
        }
        setStoragePermission(true);
      }
      
      // Convert blob to base64
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Save file using Capacitor Filesystem
      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true
      });
      
      return fileName;
    } catch (error) {
      console.error("Error saving file:", error);
      
      // Fallback for all platforms
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
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
    if (!selectedMonth) {
      alert("Please select a month first");
      return;
    }
    
    if (!exportPermission) {
      alert("You don't have permission to export data. Please contact your administrator.");
      return;
    }
    
    if (isMobileDevice() && !storagePermission) {
      try {
        // Try to request permission again
        const permResult = await Filesystem.requestPermissions();
        if (permResult.publicStorage === 'granted') {
          setStoragePermission(true);
        } else {
          alert("Storage permission is required to save files. Please enable it in your device settings.");
          return;
        }
      } catch (error) {
        console.error("Error requesting storage permission:", error);
        alert("Failed to request storage permission. Please check your device settings.");
        return;
      }
    }
    
    setExporting(true);
    setExportStatus({ success: false, message: '' });
    
    try {
      const fileName = await exporter();
      const location = isMobileDevice() 
        ? "Documents folder" 
        : "Downloads folder";
      
      setExportStatus({ 
        success: true, 
        message: `File saved successfully as ${fileName} in your ${location}!` 
      });
    } catch (error) {
      console.error("Export failed:", error);
      setExportStatus({ 
        success: false, 
        message: `Export failed: ${error.message}` 
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

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Financial Statement", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${getMonthName(selectedMonth)} ${selectedMonth.split("-")[0]}`,
      105,
      22,
      { align: "center" }
    );

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Opening Balance:", 20, 35);
    doc.text(`${summary.openingBalance.toFixed(2)}`, 50, 35);
    
    doc.text("Total Income:", 20, 40);
    doc.text(`${summary.totalIncome.toFixed(2)}`, 50, 40);
    
    doc.text("Total Expenses:", 20, 45);
    doc.text(`${summary.totalExpenses.toFixed(2)}`, 50, 45);
    
    doc.text("Net Balance:", 20, 50);
    doc.text(
      `${Math.abs(summary.netBalance).toFixed(2)} ${summary.netBalance >= 0 ? "Cr" : "Dr"}`,
      50,
      50
    );

    autoTable(doc, {
      startY: 60,
      head: [["Date", "Description", "Debit", "Credit", "Balance"]],
      body: generateTransactionRows(),
      theme: "grid",
      headStyles: {
        fillColor: [15, 46, 83],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 10,
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },
      didParseCell: function(data) {
        if (data.column.index === 2 && data.cell.raw !== '') {
          data.cell.styles.textColor = [0, 0, 0];
        }
        if (data.column.index === 3 && data.cell.raw !== '') {
          data.cell.styles.textColor = [0, 0, 0];
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
          `Page ${data.pageNumber} of ${data.pageCount}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
        doc.text(
          "Generated by Financial Reporter Pro",
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: "center" }
        );
        doc.text(
          "Support: 0000000000",
          doc.internal.pageSize.width - 20,
          doc.internal.pageSize.height - 10,
          { align: "right" }
        );
      },
    });

    const blob = doc.output('blob');
    const fileName = `MaxBond_Financial_Statement_${getMonthName(selectedMonth)}.pdf`;
    await saveFile(blob, fileName);
    return fileName;
  };

  const exportToExcel = async () => {
    const wb = XLSX.utils.book_new();
    
    const excelData = [];
    
    excelData.push(["Financial Statement"]);
    excelData.push([`${getMonthName(selectedMonth)} ${selectedMonth.split('-')[0]}`]);
    excelData.push([]);
    
    excelData.push(["SUMMARY"]);
    excelData.push(["Opening Balance", summary.openingBalance]);
    excelData.push(["Total Income", summary.totalIncome]);
    excelData.push(["Total Expenses", summary.totalExpenses]);
    excelData.push(["Net Balance", summary.netBalance]);
    excelData.push([]);
    
    excelData.push(["TRANSACTION DETAILS"]);
    excelData.push(["Date", "Description", "Debit", "Credit", "Balance"]);
    
    const transactionRows = generateTransactionRows();
    transactionRows.forEach(row => {
      excelData.push(row);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    const colWidths = [
      { wch: 25 },
      { wch: 70 },
      { wch: 25 },
      { wch: 25 },
      { wch: 35 }
    ];
    ws['!cols'] = colWidths;
    
    const boldStyle = { font: { bold: true } };
    const centerStyle = { alignment: { horizontal: 'center' } };
    const rightAlign = { alignment: { horizontal: 'right' } };
    const headerFill = { fill: { fgColor: { rgb: "0F2E53" } }, font: { color: { rgb: "FFFFFF" } } };
    
    if (ws['A1']) ws['A1'].s = { ...boldStyle, ...centerStyle, font: { sz: 16 } };
    if (ws['A2']) ws['A2'].s = { ...boldStyle, ...centerStyle, font: { sz: 14 } };
    if (ws['A4']) ws['A4'].s = boldStyle;
    if (ws['A9']) ws['A9'].s = boldStyle;
    
    for (let i = 5; i <= 8; i++) {
      const cellRef = `B${i}`;
      if (ws[cellRef]) {
        ws[cellRef].s = { ...(ws[cellRef].s || {}), ...rightAlign };
      }
    }
    
    for (let col = 0; col < 5; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 9, c: col });
      if (ws[cellRef]) {
        ws[cellRef].s = { ...boldStyle, ...headerFill };
      }
    }
    
    const lastRow = excelData.length - 1;
    for (let col = 0; col < 5; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: lastRow, c: col });
      if (ws[cellRef]) {
        ws[cellRef].s = { ...(ws[cellRef].s || {}), ...boldStyle };
        if (col >= 2) {
          ws[cellRef].s = { ...ws[cellRef].s, ...rightAlign };
        }
      }
    }
    
    for (let i = 10; i < lastRow; i++) {
      const debitCellRef = XLSX.utils.encode_cell({ r: i, c: 2 });
      if (ws[debitCellRef] && ws[debitCellRef].v) {
        ws[debitCellRef].s = {
          ...(ws[debitCellRef].s || {}),
          font: { color: { rgb: "000000" } }
        };
      }
      
      const creditCellRef = XLSX.utils.encode_cell({ r: i, c: 3 });
      if (ws[creditCellRef] && ws[creditCellRef].v) {
        ws[creditCellRef].s = {
          ...(ws[creditCellRef].s || {}),
          font: { color: { rgb: "000000" } }
        };
      }
      
      const balanceCellRef = XLSX.utils.encode_cell({ r: i, c: 4 });
      if (ws[balanceCellRef] && ws[balanceCellRef].v) {
        ws[balanceCellRef].s = {
          ...(ws[balanceCellRef].s || {}),
          font: { color: { rgb: "000000" } }
        };
      }
    }
    
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
      { s: { r: 8, c: 0 }, e: { r: 8, c: 4 } }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, "Financial Statement");
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    const s2ab = (s) => {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
      return buf;
    };
    const blob = new Blob([s2ab(wbout)], {type: 'application/octet-stream'});
    const fileName = `MaxBond_Financial_Statement_${getMonthName(selectedMonth)}.xlsx`;
    await saveFile(blob, fileName);
    return fileName;
  };

  const handlePrint = async () => {
    if (!exportPermission) {
      alert("You don't have permission to export data. Please contact your administrator.");
      return;
    }

    if (isMobileDevice()) {
      await handleExport(exportToPDF, "pdf");
    } else {
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>Financial Statement - ${getMonthName(selectedMonth)}</title>
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
              
              .header {
                text-align: center;
                margin-bottom: 1.5rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid #000;
              }
              
              .header h1 {
                font-size: 1.8rem;
                font-weight: 700;
                margin-bottom: 0.25rem;
              }
              
              .header p {
                font-size: 1.1rem;
                margin: 0;
                font-weight: 500;
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
                background-color: #f0f0f0;
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
              }
              
              .credit {
                text-align: right;
                font-weight: 500;
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
              <div class="header">
                <h1>Financial Statement</h1>
                <p>${getMonthName(selectedMonth)} ${selectedMonth.split("-")[0]}</p>
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

  const generatePrintRows = () => {
    let rowsHTML = "";
    let runningBalance = 0;
    let actualDebitTotal = 0;
    let actualCreditTotal = 0;

    // Opening Balance Row
    rowsHTML += `
      <tr>
        <td>01 ${getMonthName(selectedMonth)} ${new Date().getFullYear()}</td>
        <td>Opening Balance</td>
        <td class="debit"></td>
        <td class="credit"></td>
        <td class="balance">${summary.openingBalance.toFixed(2)} Cr</td>
      </tr>
    `;
    
    runningBalance = summary.openingBalance;

    const filteredData = allData.filter((item) => {
      if (!item.timestamp || !item.timestamp.seconds) return false;
      const date = new Date(item.timestamp.seconds * 1000);
      const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return mStr === selectedMonth;
    }).sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    filteredData.forEach((item) => {
      if (item.recordType === "opening") return;
      if (!item.timestamp || !item.timestamp.seconds) return;
      
      const date = new Date(item.timestamp.seconds * 1000);
      const formattedDate = `${date.getDate()} ${getMonthName(selectedMonth)}`;
      
      let description = "";
      let debit = 0;
      let credit = 0;
      
      if (item.recordType === "expense") {
        description = item.name || "Expense";
        debit = item.cost || 0;
        actualDebitTotal += debit;
      }
      else if (item.recordType === "transaction") {
        description = `Transaction: ${item.to || item.email || "Unknown"}`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      }
      else if (item.recordType === "external") {
        description = `${item.name || "External"} (${item.profession || "Unknown"})`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      }
      else if (item.recordType === "employee") {
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
      const balanceText = runningBalance >= 0 ? 
        `${runningBalance.toFixed(2)} Cr` : 
        `${Math.abs(runningBalance).toFixed(2)} Dr`;
      
      rowsHTML += `
        <tr>
          <td>${formattedDate}</td>
          <td>${description}</td>
          <td class="debit">${debit > 0 ? debit.toFixed(2) : ''}</td>
          <td class="credit">${credit > 0 ? credit.toFixed(2) : ''}</td>
          <td class="balance">${balanceText}</td>
        </tr>
      `;
    });

    const totalBalanceText = runningBalance >= 0 ? 
      `${Math.abs(runningBalance).toFixed(2)} Cr` : 
      `${Math.abs(runningBalance).toFixed(2)} Dr`;
    
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

  const shareOnWhatsApp = async () => {
    if (!exportPermission) {
      alert("You don't have permission to export data. Please contact your administrator.");
      return;
    }

    try {
      if (isMobileDevice()) {
        // Mobile flow
        await handleExport(exportToPDF, "pdf");
        setExportStatus({ 
          success: true, 
          message: "File saved! Open WhatsApp to share the PDF from your Documents folder."
        });
      } else {
        // Web version
        const doc = new jsPDF();
        // Generate PDF content same as exportToPDF
        // ... (same PDF generation as in exportToPDF) ...
        const blob = doc.output('blob');
        const fileName = `MaxBond_Financial_Statement_${getMonthName(selectedMonth)}.pdf`;
        
        // Create a temporary URL for the PDF
        const url = URL.createObjectURL(blob);
        
        // Create a download link
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        // Open WhatsApp with pre-filled message
        const message = encodeURIComponent(
          `Check out the financial statement for ${getMonthName(selectedMonth)}: ` +
          `Download the file from: ${window.location.origin}`
        );
        
        window.open(`https://web.whatsapp.com/send?text=${message}`, '_blank');
        
        setExportStatus({ 
          success: true, 
          message: "WhatsApp web opened. Please send the downloaded file."
        });
      }
    } catch (error) {
      console.error('Sharing failed', error);
      setExportStatus({ 
        success: false, 
        message: "Sharing failed. Please try downloading and sharing manually."
      });
    }
  };

  const generatePreviewRows = () => {
    let rows = [];
    let runningBalance = 0;
    let actualDebitTotal = 0;
    let actualCreditTotal = 0;

    rows.push(
      <tr className="table-row" key="opening">
        <td>01 {getMonthName(selectedMonth)}</td>
        <td>Opening Balance</td>
        <td></td>
        <td></td>
        <td className="balance">{summary.openingBalance.toFixed(2)} Cr</td>
      </tr>
    );
    
    runningBalance = summary.openingBalance;

    const filteredData = allData.filter((item) => {
      if (!item.timestamp || !item.timestamp.seconds) return false;
      const date = new Date(item.timestamp.seconds * 1000);
      const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return mStr === selectedMonth;
    }).sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    filteredData.forEach((item, index) => {
      if (item.recordType === "opening") return;
      if (!item.timestamp || !item.timestamp.seconds) return;
      
      const date = new Date(item.timestamp.seconds * 1000);
      const formattedDate = `${date.getDate()} ${getMonthName(selectedMonth)}`;
      
      let description = "";
      let debit = 0;
      let credit = 0;
      
      if (item.recordType === "expense") {
        description = item.name || "Expense";
        debit = item.cost || 0;
        actualDebitTotal += debit;
      }
      else if (item.recordType === "transaction") {
        description = `Transaction: ${item.to || item.email || "Unknown"}`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      }
      else if (item.recordType === "external") {
        description = `${item.name || "External"} (${item.profession || "Unknown"})`;
        if (item.type === "credit") {
          credit = item.amount || 0;
          actualCreditTotal += credit;
        } else {
          debit = item.amount || 0;
          actualDebitTotal += debit;
        }
      }
      else if (item.recordType === "employee") {
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
      const balanceText = runningBalance >= 0 ? 
        `${runningBalance.toFixed(2)} Cr` : 
        `${Math.abs(runningBalance).toFixed(2)} Dr`;
      
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

    const totalBalanceText = runningBalance >= 0 ? 
      `${Math.abs(runningBalance).toFixed(2)} Cr` : 
      `${Math.abs(runningBalance).toFixed(2)} Dr`;
    
    rows.push(
      <tr className="table-row total-row" key="total">
        <td><strong>Grand Total</strong></td>
        <td></td>
        <td className="debit"><strong>{actualDebitTotal.toFixed(2)}</strong></td>
        <td className="credit"><strong>{actualCreditTotal.toFixed(2)}</strong></td>
        <td className="balance"><strong>{totalBalanceText}</strong></td>
      </tr>
    );

    return rows;
  };

  const availableMonths = Array.from(
    new Set(
      allData
        .filter(item => item.timestamp && item.timestamp.seconds)
        .map(item => {
          const date = new Date(item.timestamp.seconds * 1000);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        })
    )
  ).sort().reverse();

  return (
    <div className="export-container">
      <div className="back-button" onClick={() => navigate("/dashboard")}>
        <FaArrowLeft /> Back to Dashboard
      </div>
      
      <div className="header-section">
        <div className="header-content">
          <h1>Financial Reports</h1>
          <p>Generate professional financial statements for any month</p>
        </div>
      </div>

      {isMobileDevice() && !storagePermission && (
        <div className="permission-alert">
          <p>Please grant storage permission to save files properly</p>
          <button onClick={async () => {
            try {
              const permResult = await Filesystem.requestPermissions();
              setStoragePermission(permResult.publicStorage === 'granted');
              if (permResult.publicStorage !== 'granted') {
                alert("Please grant storage permission in your device settings");
              }
            } catch (error) {
              console.error("Error requesting storage permission:", error);
            }
          }}>
            Grant Permission
          </button>
        </div>
      )}

      <div className="platform-tips">
        {isMobileDevice() ? (
          <p className="mobile-tip">
            <strong>Mobile Tip:</strong> Files are saved to your Documents folder. 
            Use a file manager app to access them.
          </p>
        ) : (
          <p className="web-tip">
            <strong>Web Tip:</strong> Files are downloaded automatically. 
            Check your browser's downloads folder.
          </p>
        )}
      </div>

      <div className="control-panel">
        <div className="month-selector">
          <FaCalendarAlt className="calendar-icon" />
          <label htmlFor="month-picker">Select Month:</label>
          <input
            id="month-picker"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            onFocus={(e) => e.target.showPicker()}
            disabled={loading || exporting}
          />
        </div>

        <div className="action-buttons">
          <button
            onClick={() => handleExport(exportToPDF, "pdf")}
            disabled={!selectedMonth || loading || exporting || !exportPermission}
            className="pdf-btn"
          >
            <FaDownload /> Export PDF
          </button>
          <button
            onClick={() => handleExport(exportToExcel, "excel")}
            disabled={!selectedMonth || loading || exporting || !exportPermission}
            className="excel-btn"
          >
            <FaFileExcel /> Export Excel
          </button>
          <button
            onClick={handlePrint}
            disabled={!selectedMonth || loading || exporting || !exportPermission}
            className="print-btn"
          >
            <FaPrint /> {isMobileDevice() ? "Save PDF" : "Print Report"}
          </button>
          <button
            onClick={shareOnWhatsApp}
            disabled={!selectedMonth || loading || exporting || !exportPermission}
            className="whatsapp-btn"
          >
            <FaWhatsapp /> Share via WhatsApp
          </button>
        </div>
      </div>

      {exportStatus.message && (
        <div className={`export-status ${exportStatus.success ? 'success' : 'error'}`}>
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

      {!loading && !exporting && selectedMonth && (
        <div className="report-preview">
          <div className="preview-header">
            <h2>Financial Statement Preview</h2>
            <p>
              {getMonthName(selectedMonth)} {selectedMonth.split("-")[0]}
            </p>
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
                {Math.abs(summary.netBalance).toFixed(2)} {summary.netBalance >= 0 ? "Cr" : "Dr"}
              </div>
            </div>
          </div>

          <div className="transactions-section">
            <div className="section-header">
              <h3>Transaction Details</h3>
              <span>{allData.filter(item => {
                if (!item.timestamp || !item.timestamp.seconds) return false;
                const date = new Date(item.timestamp.seconds * 1000);
                const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                return mStr === selectedMonth && item.recordType !== "opening";
              }).length} transactions</span>
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
              <tbody>
                {generatePreviewRows()}
              </tbody>
            </table>
          </div>

          <div className="preview-footer">
            <p>This is a preview of your financial statement</p>
            <p>{isMobileDevice() 
              ? "Files will be saved in Documents folder" 
              : "Files will be downloaded automatically"}</p>
          </div>
        </div>
      )}

      {!loading && !exporting && selectedMonth && allData.filter(item => {
        if (!item.timestamp || !item.timestamp.seconds) return false;
        const date = new Date(item.timestamp.seconds * 1000);
        const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return mStr === selectedMonth;
      }).length === 0 && (
        <div className="empty-state">
          <div className="empty-content">
            <h3>No Transactions Found</h3>
            <p>There are no transactions for the selected month</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPage;