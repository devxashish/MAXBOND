import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Firebase Imports
import { db, auth } from '../firebase';
import {
    collection,
    getDocs,
    getDoc,
    doc,
    query
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import { Capacitor } from '@capacitor/core';

// PDF/Excel Export Libraries
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx-js-style';
import { applyPlugin } from 'jspdf-autotable';

// Capacitor Filesystem and Share for mobile exports
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Material-UI Components
import {
    Container,
    Typography,
    Button,
    CircularProgress,
    Box,
    Card,
    CardContent,
    Grid,
    useMediaQuery,
    useTheme,
    IconButton,
    TextField,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Checkbox,
    Switch,
    FormControlLabel,
    Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableViewIcon from '@mui/icons-material/TableView';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FilePresentIcon from '@mui/icons-material/FilePresent';
import DoneAllIcon from '@mui/icons-material/DoneAll';

// CSS Imports
import '../styles/AllSitesExportPage.css';

// Import unit conversion helpers
import { unitConversionRates, getUnitCategory, convertUnit } from "../utils/unitConversions";

// Apply jspdf-autotable plugin for creating tables in PDF
applyPlugin(jsPDF);

const AllSitesExportPage = () => {
    const [userId, setUserId] = useState('');
    const [userName, setUserName] = useState('');
    const [userRoles, setUserRoles] = useState([]);
    const [sites, setSites] = useState([]);
    const [items, setItems] = useState([]);
    const [allTransactions, setAllTransactions] = useState([]);
    const [signatureURL, setSignatureURL] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exportStartDate, setExportStartDate] = useState(null);
    const [exportEndDate, setExportEndDate] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [storagePermission, setStoragePermission] = useState(false);

    const [selectedSites, setSelectedSites] = useState([]);
    const [isAllSitesMode, setIsAllSitesMode] = useState(true);
    const [isSiteSelectionDialogOpen, setIsSiteSelectionDialogOpen] = useState(false);

    const isCapacitorApp = () => Capacitor.isNativePlatform();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();

    const isItemManager = userRoles.includes('Item Manager');

    const handleSnackbarClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar({ ...snackbar, open: false });
    };

    const fetchAllData = useCallback(async (uid) => {
        setLoading(true);
        try {
            const [sitesSnapshot, itemsSnapshot, variantsSnapshot, unitsSnapshot] = await Promise.all([
                getDocs(collection(db, 'sites')),
                getDocs(collection(db, 'items')),
                getDocs(collection(db, 'itemVariants')),
                getDocs(collection(db, 'itemUnits')),
            ]);

            // Fetch all transfers for all users only if the user is an Item Manager
            const allTransfers = [];
            if (isItemManager) {
                const usersSnapshot = await getDocs(collection(db, 'users'));
                const transferPromises = usersSnapshot.docs.map(userDoc =>
                    getDocs(collection(db, 'users', userDoc.id, 'transfers'))
                );
                const allTransfersSnapshots = await Promise.all(transferPromises);
                allTransfersSnapshots.forEach(snapshot => {
                    snapshot.docs.forEach(doc => {
                        allTransfers.push({
                            id: doc.id,
                            ...doc.data(),
                            date: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(),
                        });
                    });
                });
            } else {
                setSnackbar({ open: true, message: 'Access denied. You do not have the required role to view this page.', severity: 'error' });
                setLoading(false);
                return;
            }

            const sigDoc = await getDoc(doc(db, 'users', uid, 'profile', 'signature'));

            const fetchedSites = sitesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const fetchedItems = itemsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const fetchedVariants = variantsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const fetchedUnits = unitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const allItemsData = fetchedItems.map((item) => {
                const itemData = { id: item.id, ...item };
                itemData.variants = itemData.hasVariants ? fetchedVariants.filter(v => v.itemId === item.id) : [];
                itemData.itemUnits = itemData.hasMultipleUnits ? fetchedUnits.filter(u => u.itemId === item.id) : [{ name: itemData.unit || 'pcs', id: `${item.id}-${itemData.unit || 'pcs'}` }];
                return itemData;
            });

            setSites(fetchedSites);
            setItems(allItemsData);
            setAllTransactions(allTransfers);
            setSignatureURL(sigDoc.exists() ? sigDoc.data().url : null);

        } catch (error) {
            console.error('Error fetching all data:', error);
            setSnackbar({ open: true, message: 'Failed to load data. Check permissions.', severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, [db, isItemManager]);


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                try {
                    const userProfileDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userProfileDoc.exists()) {
                        const userData = userProfileDoc.data();
                        setUserName(userData.name || user.displayName || 'User');
                        setUserRoles(userData.roles || []);
                    } else {
                        setUserName(user.displayName || 'User');
                        setUserRoles([]);
                    }
                } catch (profileError) {
                    console.error("Error fetching user profile:", profileError);
                    setUserName(user.displayName || 'User');
                    setUserRoles([]);
                }
            } else {
                setUserId('');
                setUserName('');
                setLoading(false);
                navigate('/login');
            }
        });
        return () => unsubscribe();
    }, [navigate, db]);

    useEffect(() => {
        const setupPermissionsAndFetchData = async () => {
            if (isCapacitorApp()) {
                try {
                    const permResult = await Filesystem.checkPermissions();
                    if (permResult.publicStorage !== 'granted') {
                        const requestResult = await Filesystem.requestPermissions();
                        setStoragePermission(requestResult.publicStorage === 'granted');
                    } else {
                        setStoragePermission(true);
                    }
                } catch (error) {
                    console.error("Error checking/requesting Capacitor storage permission:", error);
                    setStoragePermission(false);
                }
            }

            if (userId && userRoles.length > 0) {
                if (isItemManager) {
                    fetchAllData(userId);
                } else {
                    setLoading(false);
                    setSnackbar({ open: true, message: 'Access denied. You do not have the required role to view this page.', severity: 'error' });
                }
            } else if (userId) {
                setLoading(false); // User logged in but roles not loaded yet.
            } else {
                setLoading(false);
            }
        };

        setupPermissionsAndFetchData();
    }, [userId, userRoles, isItemManager, fetchAllData]);

    const handleSiteToggle = (siteId) => {
        setSelectedSites(prevSelected => {
            const currentIndex = prevSelected.indexOf(siteId);
            const newSelected = [...prevSelected];

            if (currentIndex === -1) {
                newSelected.push(siteId);
            } else {
                newSelected.splice(currentIndex, 1);
            }

            return newSelected;
        });
    };

    const calculateAllSitesTotals = useCallback((transactionsToProcess, filterStartDate = null, filterEndDate = null) => {
        const siteItemTotals = {};
        const filteredTxns = transactionsToProcess.filter(t => {
            const txnDate = t.date;
            let inDateRange = true;
            if (filterStartDate) { const startOfDay = filterStartDate.toDate(); startOfDay.setHours(0, 0, 0, 0); inDateRange = inDateRange && (txnDate >= startOfDay); }
            if (filterEndDate) { const endOfDay = filterEndDate.toDate(); endOfDay.setHours(23, 59, 59, 999); inDateRange = inDateRange && (txnDate <= endOfDay); }
            return inDateRange;
        });

        const tempSiteData = {};
        sites.forEach(site => {
            tempSiteData[site.id] = {
                siteName: site.name,
                isTransferSite: false,
                items: {}
            };
        });

        filteredTxns.forEach(t => {
            const siteId = t.siteId;
            if (!siteId || !tempSiteData[siteId]) return;

            const itemKey = `${t.itemId || 'unknown'}-${t.variantId || 'no-variant'}-${t.unit || 'no-unit'}`;

            if (!tempSiteData[siteId].items[itemKey]) {
                const itemConfig = items.find(i => i.id === t.itemId);
                const itemDisplayUnit = itemConfig?.unit || t.unit || 'pcs';

                tempSiteData[siteId].items[itemKey] = {
                    itemName: t.itemName || 'Unknown Item',
                    variantName: t.variantName || 'N/A',
                    unit: itemDisplayUnit,
                    totalQty: 0,
                    availableQty: 0,
                    sendQty: 0,
                    remarks: []
                };
            }

            const itemConfig = items.find(i => i.id === t.itemId);
            const baseUnitForCalculation = itemConfig?.unit || 'pcs';
            const quantityInBase = convertUnit(t.quantity, t.unit, baseUnitForCalculation);

            if (t.type === 'inward') {
                tempSiteData[siteId].items[itemKey].totalQty += quantityInBase;
                tempSiteData[siteId].items[itemKey].availableQty += quantityInBase;
            } else if (t.type === 'outward') {
                tempSiteData[siteId].items[itemKey].totalQty += quantityInBase;
                tempSiteData[siteId].items[itemKey].availableQty -= quantityInBase;
                tempSiteData[siteId].items[itemKey].sendQty += quantityInBase;
                tempSiteData[siteId].isTransferSite = true;
                const destinationSiteName = sites.find(s => s.id === t.siteTo)?.name || 'Unknown Site';
                tempSiteData[siteId].items[itemKey].remarks.push(`Sent to: ${destinationSiteName}`);
            }
        });

        const finalSummary = {};
        for (const siteId in tempSiteData) {
            const siteData = tempSiteData[siteId];
            if (Object.keys(siteData.items).length > 0) {
                finalSummary[siteId] = {
                    siteName: siteData.siteName,
                    isTransferSite: siteData.isTransferSite,
                    items: []
                };
                for (const itemKey in siteData.items) {
                    const itemSummary = siteData.items[itemKey];
                    const itemConfig = items.find(i => i.id === itemKey.split('-')[0]);
                    const itemDisplayUnit = itemConfig?.unit || 'pcs';
                    const category = getUnitCategory(itemDisplayUnit);
                    const baseUnit = category ? unitConversionRates[category].base : itemDisplayUnit;
                    if (baseUnit !== itemDisplayUnit) {
                        itemSummary.totalQty = convertUnit(itemSummary.totalQty, baseUnit, itemDisplayUnit);
                        itemSummary.availableQty = convertUnit(itemSummary.availableQty, baseUnit, itemDisplayUnit);
                        itemSummary.sendQty = convertUnit(itemSummary.sendQty, baseUnit, itemDisplayUnit);
                    }

                    finalSummary[siteId].items.push({
                        itemName: itemSummary.itemName,
                        variantName: itemSummary.variantName,
                        unit: itemDisplayUnit,
                        totalQty: parseFloat(itemSummary.totalQty.toFixed(3)),
                        availableQty: parseFloat(itemSummary.availableQty.toFixed(3)),
                        sendQty: parseFloat(itemSummary.sendQty.toFixed(3)),
                        remarks: itemSummary.remarks.join(', ')
                    });
                }
            }
        }
        return finalSummary;
    }, [items, sites]);


    const allSitesSummary = useMemo(() => {
        if (sites.length === 0) return {};
        const siteIdsToExport = isAllSitesMode ? sites.map(site => site.id) : selectedSites;
        if (siteIdsToExport.length === 0) return {};
        
        const summary = calculateAllSitesTotals(allTransactions, exportStartDate, exportEndDate);
        
        const filteredSummary = {};
        siteIdsToExport.forEach(siteId => {
            if(summary[siteId]) {
                filteredSummary[siteId] = summary[siteId];
            }
        });
        
        return filteredSummary;
    }, [allTransactions, sites, exportStartDate, exportEndDate, calculateAllSitesTotals, isAllSitesMode, selectedSites]);

    const saveFile = async (blob, fileName) => {
        if (!isCapacitorApp()) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            return fileName;
        }
        try {
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Documents,
                recursive: true
            });
            const fileUriResult = await Filesystem.getUri({ directory: Directory.Documents, path: fileName });
            const fileUri = fileUriResult.uri;
            await Share.share({
                title: 'Exported Report',
                text: `Here is your report: ${fileName}`,
                url: fileUri,
                dialogTitle: 'Save/Share Report',
            });
            return fileName;
        } catch (error) {
            console.error("Error saving file via Capacitor Filesystem:", error);
            throw error;
        }
    };

    const handleExportWrapper = async (exporterFunction) => {
        if (Object.keys(allSitesSummary).length === 0 || !Object.values(allSitesSummary).some(site => site.items.length > 0)) {
            setSnackbar({ open: true, message: "No data available to export for the selected filters.", severity: 'warning' });
            return;
        }

        setExporting(true);
        setSnackbar({ open: true, message: "Generating report...", severity: 'info' });

        try {
            if (isCapacitorApp() && !storagePermission) {
                const permResult = await Filesystem.requestPermissions();
                if (permResult.publicStorage !== 'granted') {
                    setSnackbar({ open: true, message: "Storage permission is required to save and share files.", severity: 'error' });
                    setExporting(false);
                    return;
                }
                setStoragePermission(true);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            const fileNameResult = await exporterFunction();
            setSnackbar({
                open: true,
                message: isCapacitorApp()
                    ? `File "${fileNameResult}" exported successfully! A share dialog has appeared.`
                    : `File "${fileNameResult}" downloaded successfully!`,
                severity: 'success'
            });
        } catch (error) {
            console.error("Export failed:", error);
            setSnackbar({
                open: true,
                message: `Export failed: ${error.message || 'Unknown error'}. Please try again.`,
                severity: 'error'
            });
        } finally {
            setExporting(false);
        }
    };

    const generatePDFForAllSites = async () => {
        const docPdf = new jsPDF();
        docPdf.setFontSize(16);
        const actualExportStartDate = exportStartDate ? exportStartDate.toDate() : null;
        const actualExportEndDate = exportEndDate ? exportEndDate.toDate() : null;
        const formattedStartDate = actualExportStartDate ? actualExportStartDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
        const formattedEndDate = actualExportEndDate ? actualExportEndDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
        const docWidth = docPdf.internal.pageSize.getWidth();
        const bottomMargin = 20;
        const siteIds = Object.keys(allSitesSummary);
        if (siteIds.length === 0) {
            throw new Error("No data available to export.");
        }
        siteIds.forEach((siteId, index) => {
            if (index > 0) {
                docPdf.addPage();
            }
            const siteData = allSitesSummary[siteId];
            const siteName = siteData.siteName;
            let yOffset = 10;
            docPdf.text(siteName, docWidth / 2, yOffset, { align: 'center' });
            yOffset += 8;
            docPdf.setFontSize(10);
            docPdf.text(`Date: ${formattedStartDate} to ${formattedEndDate}`, docWidth / 2, yOffset, { align: 'center' });
            yOffset += 10;
            docPdf.setFontSize(12);
            docPdf.text(`Site Stock Report`, docWidth / 2, yOffset, { align: 'center' });
            yOffset += 10;

            let summaryTableColumns = [];
            let summaryTableRows = [];
            let qtyColumnIndex;
            if (siteData.isTransferSite) {
                summaryTableColumns = ["Sr. No.", "Item Name", "Available Qty", "Sent Qty", "Remarks"];
                qtyColumnIndex = 2;
                let srNo = 1;
                siteData.items.forEach(item => {
                    summaryTableRows.push([
                        srNo++,
                        `${item.itemName}${item.variantName && item.variantName !== 'N/A' ? ` (${item.variantName})` : ''}`,
                        `${parseFloat(item.availableQty.toFixed(3))} ${item.unit}`,
                        `${parseFloat(item.sendQty.toFixed(3))} ${item.unit}`,
                        item.remarks
                    ]);
                });
            } else {
                summaryTableColumns = ["Sr. No.", "Item Name", "Total Qty", "Remarks"];
                qtyColumnIndex = 2;
                let srNo = 1;
                siteData.items.forEach(item => {
                    summaryTableRows.push([
                        srNo++,
                        `${item.itemName}${item.variantName && item.variantName !== 'N/A' ? ` (${item.variantName})` : ''}`,
                        `${parseFloat(item.totalQty.toFixed(3))} ${item.unit}`,
                        item.remarks
                    ]);
                });
            }
            docPdf.autoTable({
                head: [summaryTableColumns],
                body: summaryTableRows,
                startY: yOffset,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [20, 100, 200] },
                columnStyles: {
                    0: { cellWidth: 15, halign: 'center' },
                    1: { cellWidth: 60, halign: 'left' },
                    [qtyColumnIndex]: { cellWidth: 30, halign: 'center' },
                    3: { cellWidth: siteData.isTransferSite ? 30 : 50, halign: 'left' },
                    4: { cellWidth: 50, halign: 'left' },
                },
                didParseCell: function(data) {
                    if (data.section === 'body') {
                        if (data.column.index === 0) {
                            data.cell.styles.halign = 'center';
                        } else if (data.column.index === qtyColumnIndex) {
                            data.cell.styles.halign = 'center';
                        }
                    }
                },
                didDrawPage: function(data) {
                    const preparedByText = `Prepared By: ${userName}`;
                    docPdf.setFontSize(10);
                    const textWidthPreparedBy = docPdf.getStringUnitWidth(preparedByText) * docPdf.internal.getFontSize() / docPdf.internal.scaleFactor;
                    const xPreparedBy = docWidth - 14 - textWidthPreparedBy;
                    docPdf.text(preparedByText, xPreparedBy, docPdf.internal.pageSize.height - bottomMargin - 20);
                    if (signatureURL) {
                        const imgData = signatureURL;
                        const imgWidth = 50;
                        const imgHeight = 20;
                        const xSignatureImage = docWidth - 14 - imgWidth;
                        docPdf.addImage(imgData, 'PNG', xSignatureImage, docPdf.internal.pageSize.height - bottomMargin - 15, imgWidth, imgHeight);
                        const textWidthSignatureLabel = docPdf.getStringUnitWidth('Authorized Signature') * docPdf.internal.getFontSize() / docPdf.internal.scaleFactor;
                        const xSignatureLabel = docWidth - 14 - (textWidthSignatureLabel / 2);
                        docPdf.text('Authorized Signature', xSignatureLabel, docPdf.internal.pageSize.height - bottomMargin);
                    }
                    let str = "Page " + docPdf.internal.getNumberOfPages();
                    docPdf.text(str, data.settings.margin.left, parseFloat(docPdf.internal.pageSize.height) - 10);
                }
            });
        });
        const pdfBlob = docPdf.output('blob');
        const fileName = `All_Sites_Stock_Master_Report_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.pdf`;
        return await saveFile(pdfBlob, fileName);
    };

    const exportExcelForAllSites = async () => {
        const wb = XLSX.utils.book_new();
        const actualExportStartDate = exportStartDate ? exportStartDate.toDate() : null;
        const actualExportEndDate = exportEndDate ? exportEndDate.toDate() : null;
        const formattedStartDate = actualExportStartDate ? actualExportStartDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
        const formattedEndDate = actualExportEndDate ? actualExportEndDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
        const siteIds = Object.keys(allSitesSummary);
        if (siteIds.length === 0) {
            throw new Error("No data available to export.");
        }
        for (const siteId of siteIds) {
            const siteData = allSitesSummary[siteId];
            const siteName = siteData.siteName;
            const cleanSheetName = siteName.replace(/[\\/?*[\]:]/g, '_').substring(0, 31);
            let siteSheetData = [
                [siteName],
                [`Date: ${formattedStartDate} to ${formattedEndDate}`],
                [],
                [],
            ];
            let srNo = 1;
            if (siteData.isTransferSite) {
                siteSheetData[3] = ["Sr. No.", "Item Name", "Available Qty", "Sent Qty", "Remarks"];
                siteData.items.forEach(item => {
                    siteSheetData.push([
                        srNo++,
                        `${item.itemName}${item.variantName && item.variantName !== 'N/A' ? ` (${item.variantName})` : ''}`,
                        `${parseFloat(item.availableQty.toFixed(3))} ${item.unit}`,
                        `${parseFloat(item.sendQty.toFixed(3))} ${item.unit}`,
                        item.remarks
                    ]);
                });
            } else {
                siteSheetData[3] = ["Sr. No.", "Item Name", "Total Qty", "Remarks"];
                siteData.items.forEach(item => {
                    siteSheetData.push([
                        srNo++,
                        `${item.itemName}${item.variantName && item.variantName !== 'N/A' ? ` (${item.variantName})` : ''}`,
                        `${parseFloat(item.totalQty.toFixed(3))} ${item.unit}`,
                        item.remarks
                    ]);
                });
            }
            siteSheetData.push([], [], []);
            siteSheetData.push([`Prepared By:`, userName]);
            siteSheetData.push([`Authorized Signature:`, signatureURL || "No Digital Signature Uploaded"]);
            let siteSheet = XLSX.utils.aoa_to_sheet(siteSheetData);
            if (!siteSheet['!merges']) siteSheet['!merges'] = [];
            const numCols = siteData.isTransferSite ? 5 : 4;
            siteSheet['!merges'].push(
                { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
                { s: { r: siteSheetData.length - 2, c: 1 }, e: { r: siteSheetData.length - 2, c: numCols - 1 } },
                { s: { r: siteSheetData.length - 1, c: 1 }, e: { r: siteSheetData.length - 1, c: numCols - 1 } }
            );
            const styleHeaderRow = (sheet, rowIdx) => {
                const headerCells = siteData.isTransferSite ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];
                headerCells.forEach((col, colIndex) => {
                    const cellAddress = col + (rowIdx + 1);
                    if (!sheet[cellAddress]) sheet[cellAddress] = { t: 's', v: siteSheetData[rowIdx][colIndex] };
                    if (!sheet[cellAddress].s) sheet[cellAddress].s = {};
                    sheet[cellAddress].s.font = { bold: true, color: { rgb: "FFFFFFFF" } };
                    sheet[cellAddress].s.fill = { fgColor: { rgb: "FF3366FF" } };
                    sheet[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
                    sheet[cellAddress].s.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
                });
            };
            styleHeaderRow(siteSheet, 3);
            siteSheet['!cols'] = siteData.isTransferSite ?
                [{ wch: 5 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 20 }] :
                [{ wch: 5 }, { wch: 40 }, { wch: 25 }, { wch: 30 }];
            XLSX.utils.book_append_sheet(wb, siteSheet, cleanSheetName);
        }
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
        const s2ab = (s) => {
            const buf = new ArrayBuffer(s.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
            return buf;
        };
        const blob = new Blob([s2ab(excelBuffer)], {type: 'application/octet-stream'});
        const fileName = `All_Sites_Stock_Master_Report_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`;
        return await saveFile(blob, fileName);
    };

    const openExportedFolder = async () => {
        if (isCapacitorApp()) {
            try {
                await Share.share({
                    title: 'Find Exported Files',
                    text: 'Your reports are saved in your app’s Documents folder. Please use your device’s File Manager app to find them: look in "Internal Storage > Android > data > YOUR_APP_ID / files / Documents".',
                    dialogTitle: 'Open File Manager',
                });
                setSnackbar({ open: true, message: "Instructions provided to locate files.", severity: 'info' });
            } catch (error) {
                console.error("Error attempting to open file manager:", error);
                setSnackbar({ open: true, message: "Could not open file manager directly. Please navigate to app's Documents folder manually.", severity: 'error' });
            }
        } else {
            setSnackbar({ open: true, message: "This feature is for mobile devices. On web, files are saved in your browser's default downloads folder.", severity: 'info' });
        }
    };
    
    const hasData = useMemo(() => {
        return Object.values(allSitesSummary).some(site => site.items.length > 0);
    }, [allSitesSummary]);

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
                <CircularProgress />
                <Typography variant="h6" sx={{ ml: 2 }}>Loading all site data for export...</Typography>
            </Container>
        );
    }
    
    if (!userId) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="h5" color="error">Please log in to export reports.</Typography>
            </Container>
        );
    }
    
    // Yahan hum role check karte hain
    if (!isItemManager) {
      return (
        <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="h5" color="error">
                Access Denied: You must be an Item Manager to view this page.
            </Typography>
        </Container>
      );
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Container maxWidth="lg" className="all-sites-export-container">
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }} className="ios-back-button">
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4" component="h1" gutterBottom sx={{ flexGrow: 1 }} className="ios-header-text">
                        Export All Sites Report
                    </Typography>
                </Box>

                {isCapacitorApp() && !storagePermission && (
                    <Alert severity="warning" sx={{ mb: 3 }} className="ios-alert">
                        Storage permission is required to save and share files.
                        <Button
                            variant="outlined"
                            size="small"
                            sx={{ ml: 2 }}
                            onClick={async () => {
                                try {
                                    const permResult = await Filesystem.requestPermissions();
                                    if (permResult.publicStorage === 'granted') {
                                        setStoragePermission(true);
                                        setSnackbar({ open: true, message: "Storage permission granted!", severity: 'success' });
                                    } else {
                                        setSnackbar({ open: true, message: "Permission denied. Please enable storage permission in your app settings.", severity: 'error' });
                                    }
                                } catch (error) {
                                    console.error("Error requesting storage permission:", error);
                                    setSnackbar({ open: true, message: "Permission request failed. Check device settings.", severity: 'error' });
                                }
                            }}
                        >
                            Grant Permission
                        </Button>
                    </Alert>
                )}

                <Grid container spacing={3} sx={{ mb: 4}}>
                    <Grid item xs={12}>
                        <Card variant="outlined" className="ios-card">
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Report Filters</Typography>
                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                                    <DatePicker
                                        label="Start Date"
                                        value={exportStartDate}
                                        onChange={(newValue) => setExportStartDate(newValue)}
                                        slots={{ textField: TextField }}
                                        slotProps={{ textField: { size: 'small' } }}
                                        disabled={loading || exporting}
                                        enableAccessibleFieldDOMStructure={false}
                                    />
                                    <DatePicker
                                        label="End Date"
                                        value={exportEndDate}
                                        onChange={(newValue) => setExportEndDate(newValue)}
                                        slots={{ textField: TextField }}
                                        slotProps={{ textField: { size: 'small' } }}
                                        disabled={loading || exporting}
                                        enableAccessibleFieldDOMStructure={false}
                                    />
                                </Box>
                                <Divider sx={{ my: 2 }} />
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={isAllSitesMode}
                                                onChange={(e) => {
                                                    setIsAllSitesMode(e.target.checked);
                                                    if (!e.target.checked) {
                                                        setSelectedSites([]);
                                                    }
                                                }}
                                                disabled={loading || exporting}
                                            />
                                        }
                                        label={isAllSitesMode ? "Export All Sites" : "Select Specific Sites"}
                                        labelPlacement="start"
                                    />
                                    {!isAllSitesMode && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => setIsSiteSelectionDialogOpen(true)}
                                            disabled={loading || exporting}
                                            startIcon={<DoneAllIcon />}
                                        >
                                            Select Sites
                                        </Button>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <Button
                        variant="contained"
                        fullWidth={isMobile}
                        onClick={() => handleExportWrapper(generatePDFForAllSites)}
                        startIcon={<PictureAsPdfIcon />}
                        disabled={!hasData || exporting || (isCapacitorApp() && !storagePermission)}
                        sx={{ py: 1.5 }}
                        className="ios-button"
                    >
                        {exporting ? <CircularProgress size={24} color="inherit" /> : 'Generate & Share All Sites PDF'}
                    </Button>
                    <Button
                        variant="contained"
                        fullWidth={isMobile}
                        onClick={() => handleExportWrapper(exportExcelForAllSites)}
                        startIcon={<TableViewIcon />}
                        disabled={!hasData || exporting || (isCapacitorApp() && !storagePermission)}
                        sx={{ py: 1.5 }}
                        className="ios-button"
                    >
                        {exporting ? <CircularProgress size={24} color="inherit" /> : 'Generate & Share All Sites Excel'}
                    </Button>
                    <Button
                        variant="outlined"
                        fullWidth={isMobile}
                        onClick={openExportedFolder}
                        startIcon={<FilePresentIcon />}
                        disabled={exporting || (isCapacitorApp() && !storagePermission)}
                        sx={{ py: 1.5 }}
                        className="ios-button-outline"
                    >
                        Locate Reports on Device
                    </Button>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }} className="ios-note-text">
                    **Note:** Reports are saved to your app's Documents folder. Use your device's File Manager to access them.
                </Typography>
                
                <Dialog onClose={() => setIsSiteSelectionDialogOpen(false)} open={isSiteSelectionDialogOpen}>
                    <DialogTitle>Select Sites to Export</DialogTitle>
                    <DialogContent>
                        <List dense>
                            {sites.map(site => (
                                <ListItem
                                    key={site.id}
                                    onClick={() => handleSiteToggle(site.id)}
                                >
                                    <ListItemIcon>
                                        <Checkbox
                                            edge="start"
                                            checked={selectedSites.indexOf(site.id) !== -1}
                                            tabIndex={-1}
                                            disableRipple
                                        />
                                    </ListItemIcon>
                                    <ListItemText primary={site.name} />
                                </ListItem>
                            ))}
                        </List>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setIsSiteSelectionDialogOpen(false)}>Close</Button>
                    </DialogActions>
                </Dialog>

                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={handleSnackbarClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Container>
        </LocalizationProvider>
    );
};

export default AllSitesExportPage;