import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';

// Firebase Imports
import { db, auth } from '../firebase';
import { collection, getDocs, getDoc, doc, query } from 'firebase/firestore';
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
    TextField,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Box,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Card,
    CardContent,
    Grid,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableViewIcon from '@mui/icons-material/TableView';

// Custom Icons
import { FaWhatsapp, FaFolderOpen } from 'react-icons/fa';

// CSS Imports
import '../styles/SummaryPage.css';

// Import unit conversion helpers
import { unitConversionRates, getUnitCategory, convertUnit } from "../utils/unitConversions";


const SummaryPage = () => {
    const [userId, setUserId] = useState('');
    const [userName, setUserName] = useState('');
    const [sites, setSites] = useState([]);
    const [items, setItems] = useState([]);
    const [allTransactions, setAllTransactions] = useState([]);
    const [selectedSite, setSelectedSite] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [signatureURL, setSignatureURL] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exportStartDate, setExportStartDate] = useState(null);
    const [exportEndDate, setExportEndDate] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState({ success: false, message: '' });
    const [storagePermission, setStoragePermission] = useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const isCapacitorApp = () => {
        return typeof Capacitor !== 'undefined' && Capacitor.isNative;
    };

    const fetchSites = useCallback(async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'sites'));
            const fetchedSites = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setSites(fetchedSites);
            if (fetchedSites.length > 0 && !selectedSite) {
                setSelectedSite(fetchedSites[0].id);
            }
        } catch (error) {
            console.error('Error fetching sites:', error);
        }
    }, [db, selectedSite]);

    const fetchItems = useCallback(async () => {
        try {
            const itemsSnapshot = await getDocs(collection(db, 'items'));
            const variantsSnapshot = await getDocs(collection(db, 'itemVariants'));
            const unitsSnapshot = await getDocs(collection(db, 'itemUnits'));

            const fetchedVariants = variantsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const fetchedUnits = unitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const allItemsData = itemsSnapshot.docs.map((itemDoc) => {
                const itemData = { id: itemDoc.id, ...itemDoc.data() };
                itemData.variants = itemData.hasVariants ? fetchedVariants.filter(v => v.itemId === itemDoc.id) : [];
                itemData.itemUnits = itemData.hasMultipleUnits ? fetchedUnits.filter(u => u.itemId === itemDoc.id) : [{ name: itemData.unit || 'pcs', id: `${itemDoc.id}-${itemData.unit || 'pcs'}` }];
                return itemData;
            });
            setItems(allItemsData);
        } catch (error) {
            console.error('Error fetching items, variants, or units:', error);
        }
    }, [db]);

    const fetchAllTransactions = useCallback(async (uid) => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users', uid, 'transfers'));
            const fetchedTransactions = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(),
            }));
            setAllTransactions(fetchedTransactions);
        } catch (error) {
            console.error('Error fetching all transactions:', error);
        }
    }, [db]);

    const fetchSignature = useCallback(async (uid) => {
        try {
            const sigDocRef = doc(db, 'users', uid, 'profile', 'signature');
            const sigDocSnap = await getDoc(sigDocRef);
            if (sigDocSnap.exists()) {
                setSignatureURL(sigDocSnap.data().url);
            } else {
                setSignatureURL(null);
            }
        } catch (error) {
            console.error('Error fetching signature:', error);
            if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
                console.warn("Permission denied for signature. Ensure rules allow user read access to their own signature.");
                setSignatureURL(null);
            }
        }
    }, [db]);

    useEffect(() => {
        applyPlugin(jsPDF);
    }, []);

    useEffect(() => {
        const checkAndSetUser = async () => {
            if (isCapacitorApp()) {
                try {
                    const permResult = await Filesystem.checkPermissions();
                    if (permResult.publicStorage === 'granted') {
                        setStoragePermission(true);
                    } else {
                        const requestResult = await Filesystem.requestPermissions();
                        setStoragePermission(requestResult.publicStorage === 'granted');
                    }
                } catch (error) {
                    console.error("Error checking/requesting Capacitor storage permission:", error);
                    setStoragePermission(false);
                }
            } else {
                setStoragePermission(true);
            }

            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    try {
                        const userProfileDoc = await getDoc(doc(db, 'profiles', user.uid));
                        if (userProfileDoc.exists()) {
                            setUserName(userProfileDoc.data().name || user.displayName || 'User');
                        } else {
                            setUserName(user.displayName || 'User');
                        }
                    } catch (profileError) {
                        console.error("Error fetching user profile:", profileError);
                        setUserName(user.displayName || 'User');
                    }
                } else {
                    setUserId('');
                    setUserName('');
                    setLoading(false);
                }
            });
            return () => unsubscribe();
        };

        checkAndSetUser();
    }, []);

    useEffect(() => {
        if (userId) {
            const fetchData = async () => {
                setLoading(true);
                await fetchSites();
                await fetchItems();
                await fetchAllTransactions(userId);
                await fetchSignature(userId);
                setLoading(false);
            };
            fetchData();
        } else {
            setSites([]);
            setItems([]);
            setAllTransactions([]);
            setSelectedSite('');
            setSignatureURL(null);
        }
    }, [userId, fetchSites, fetchItems, fetchAllTransactions, fetchSignature]);

    const calculateItemSiteTotals = useCallback((transactionsToProcess, targetSiteId = null, filterStartDate = null, filterEndDate = null) => {
        const siteItemTotals = {};

        const filteredTxns = transactionsToProcess.filter(t => {
            const txnDate = new Date(t.date);
            let inDateRange = true;
            if (filterStartDate) {
                const startOfDay = filterStartDate.toDate ? filterStartDate.toDate() : new Date(filterStartDate);
                startOfDay.setHours(0, 0, 0, 0);
                inDateRange = inDateRange && (txnDate >= startOfDay);
            }
            if (filterEndDate) {
                const endOfDay = filterEndDate.toDate ? filterEndDate.toDate() : new Date(filterEndDate);
                endOfDay.setHours(23, 59, 59, 999);
                inDateRange = inDateRange && (txnDate <= endOfDay);
            }
            return inDateRange;
        });

        filteredTxns.forEach(t => {
            if (targetSiteId && t.siteId !== targetSiteId) {
                return;
            }

            const siteId = t.siteId;
            const itemKey = `${t.itemId || 'unknown'}-${t.variantId || 'no-variant'}-${t.unit || 'no-unit'}`;

            if (!siteItemTotals[siteId]) {
                siteItemTotals[siteId] = {};
            }

            if (!siteItemTotals[siteId][itemKey]) {
                siteItemTotals[siteId][itemKey] = {
                    totalReceived: 0,
                    totalUsed: 0,
                    balance: 0,
                    itemName: t.itemName || 'Unknown Item',
                    variantName: t.variantName || 'N/A',
                    unit: t.unit || 'pcs',
                    itemId: t.itemId,
                    variantId: t.variantId,
                };
            }

            const itemConfig = items.find(i => i.id === t.itemId);
            const baseUnitForCalculation = itemConfig?.unit || 'pcs';

            const quantityInBase = convertUnit(t.quantity, t.unit, baseUnitForCalculation);

            if (t.type === 'inward') {
                siteItemTotals[siteId][itemKey].totalReceived += quantityInBase;
            } else if (t.type === 'outward') {
                siteItemTotals[siteId][itemKey].totalUsed += quantityInBase;
            }
        });

        const finalSummary = [];
        for (const siteId in siteItemTotals) {
            const siteData = siteItemTotals[siteId];
            const siteName = sites.find(s => s.id === siteId)?.name || 'Unknown Site';

            for (const itemKey in siteData) {
                const itemSummary = siteData[itemKey];

                if (itemSummary.totalReceived === 0 && itemSummary.totalUsed === 0) {
                    continue;
                }

                itemSummary.balance = itemSummary.totalReceived - itemSummary.totalUsed;

                const originalUnit = itemSummary.unit;
                const itemConfig = items.find(i => i.id === itemSummary.itemId);
                const preferredDisplayUnit = itemConfig?.unit || originalUnit || 'pcs';

                const category = getUnitCategory(preferredDisplayUnit);
                if (category && unitConversionRates[category] && unitConversionRates[category].base !== preferredDisplayUnit) {
                    itemSummary.totalReceived = convertUnit(itemSummary.totalReceived, unitConversionRates[category].base, preferredDisplayUnit);
                    itemSummary.totalUsed = convertUnit(itemSummary.totalUsed, unitConversionRates[category].base, preferredDisplayUnit);
                    itemSummary.balance = convertUnit(itemSummary.balance, unitConversionRates[category].base, preferredDisplayUnit);
                }

                finalSummary.push({
                    siteId: siteId,
                    siteName: siteName,
                    itemName: itemSummary.itemName,
                    variantName: itemSummary.variantName,
                    unit: preferredDisplayUnit,
                    // Use parseFloat to remove trailing zeros if they are not significant
                    totalReceived: parseFloat(itemSummary.totalReceived.toFixed(3)),
                    totalUsed: parseFloat(itemSummary.totalUsed.toFixed(3)),
                    balance: parseFloat(itemSummary.balance.toFixed(3)),
                    itemId: itemSummary.itemId,
                    variantId: itemSummary.variantId,
                });
            }
        }
        return finalSummary;
    }, [allTransactions, items, sites]);

    const displayedSummary = useMemo(() => {
        if (sites.length === 0 || !selectedSite) return [];

        const currentSiteTotals = calculateItemSiteTotals(allTransactions, selectedSite, exportStartDate, exportEndDate);

        let filteredForSearch = currentSiteTotals;
        if (searchQuery) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            filteredForSearch = currentSiteTotals.filter(summary =>
                summary.itemName.toLowerCase().includes(lowerCaseQuery) ||
                summary.variantName.toLowerCase().includes(lowerCaseQuery)
            );
        }

        filteredForSearch.sort((a, b) => {
            if (a.itemName < b.itemName) return -1;
            if (a.itemName > b.itemName) return 1;
            if (a.variantName < b.variantName) return -1;
            if (a.variantName > b.variantName) return 1;
            return 0;
        });

        return filteredForSearch;
    }, [allTransactions, sites, selectedSite, searchQuery, exportStartDate, exportEndDate, calculateItemSiteTotals]);

    const currentSiteName = useMemo(() => {
        const site = sites.find(s => s.id === selectedSite);
        return site ? site.name : 'Select a Site';
    }, [selectedSite, sites]);

    const saveFile = async (blob, fileName) => {
        try {
            if (isCapacitorApp()) {
                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64String = reader.result.split(',')[1];
                        resolve(base64String);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Documents,
                    recursive: true
                });

                console.log(`Capacitor: File saved to app's private storage: ${Directory.Documents}/${fileName}`);

                const fileUriResult = await Filesystem.getUri({ directory: Directory.Documents, path: fileName });
                const fileUri = fileUriResult.uri;

                await Share.share({
                    title: 'Exported Report',
                    text: `Here is your report: ${fileName}`,
                    url: fileUri,
                    dialogTitle: 'Save/Share Report',
                });

                return fileName;
            } else {
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
                console.log(`Web: File downloaded as ${fileName}`);
                return fileName;
            }
        } catch (error) {
            console.error("Error saving file:", error);
            throw error;
        }
    };

    const handleExportWrapper = async (exporterFunction) => {
        if (!selectedSite) {
            alert("Please select a site first.");
            return;
        }
        if (displayedSummary.length === 0) {
            alert("No data available to export for the selected filters.");
            return;
        }

        setExporting(true);
        setExportStatus({ success: false, message: '' });

        try {
            if (isCapacitorApp()) {
                const permResult = await Filesystem.requestPermissions();
                if (permResult.publicStorage !== 'granted') {
                    alert("Storage permission is required to save and share files. Please enable it in your device settings.");
                    setExporting(false);
                    return;
                }
                setStoragePermission(true);
            }

            if (isCapacitorApp()) {
                setExportStatus({
                    success: true,
                    message: `Generating report and saving to **mobile's Documents folder**... A system share dialog will appear.`
                });
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            const fileNameResult = await exporterFunction();

            const locationMsg = isCapacitorApp()
                ? "successfully! Look for the share dialog to save it or check your device's files (e.g., Downloads, Documents)."
                : "successfully to your Downloads folder.";

            setExportStatus({
                success: true,
                message: `File "${fileNameResult}" exported ${locationMsg}`
            });
        } catch (error) {
            console.error("Export failed:", error);
            setExportStatus({
                success: false,
                message: `Export failed: ${error.message || 'Unknown error'}. Please try again.`
            });
        } finally {
            setExporting(false);
            setTimeout(() => setExportStatus({ success: false, message: '' }), 7000);
        }
    };


    const generatePDF = async () => {
        const docPdf = new jsPDF();
        docPdf.setFontSize(16);

        const actualExportStartDate = exportStartDate ? exportStartDate.toDate() : null;
        const actualExportEndDate = exportEndDate ? exportEndDate.toDate() : null;

        const formattedStartDate = actualExportStartDate ? actualExportStartDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
        const formattedEndDate = actualExportEndDate ? actualExportEndDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';

        let yOffset = 10;
        const docWidth = docPdf.internal.pageSize.getWidth();
        const leftMargin = 14;
        const rightMargin = 14;
        const bottomMargin = 20;

        docPdf.text(`${currentSiteName}`, docWidth / 2, yOffset, { align: 'center' });
        yOffset += 8;
        docPdf.setFontSize(10);
        docPdf.text(`Date: ${formattedStartDate} to ${formattedEndDate}`, docWidth / 2, yOffset, { align: 'center' });
        yOffset += 10;
        docPdf.setFontSize(12);
        docPdf.text(`Site Stock Report`, docWidth / 2, yOffset, { align: 'center' });
        yOffset += 10;

        const summaryTableColumns = ["Sr", "Item Name", "Total Received", "Total Consumed", "Balance", "Remarks"];
        const summaryTableRows = [];

        let srNo = 1;
        let grandTotalReceived = 0;
        let grandTotalConsumed = 0;
        let grandTotalBalance = 0;

        const groupedItems = displayedSummary.reduce((acc, item) => {
            if (!acc[item.itemName]) {
                acc[item.itemName] = {
                    variants: [],
                    itemTotalReceived: 0,
                    itemTotalConsumed: 0,
                    itemBalance: 0
                };
            }
            acc[item.itemName].variants.push(item);

            const itemConfig = items.find(i => i.id === item.itemId);
            const baseUnitForCalculation = itemConfig?.unit || 'pcs';

            const quantityInBase = convertUnit(item.totalReceived, item.unit, baseUnitForCalculation);
            const quantityUsedBase = convertUnit(item.totalUsed, item.unit, baseUnitForCalculation);
            const quantityBalanceBase = convertUnit(item.balance, item.unit, baseUnitForCalculation);


            acc[item.itemName].itemTotalReceived += quantityInBase;
            acc[item.itemName].itemTotalConsumed += quantityUsedBase;
            acc[item.itemName].itemBalance += quantityBalanceBase;
            return acc;
        }, {});

        for (const itemName in groupedItems) {
            const itemGroup = groupedItems[itemName];
            const itemConfig = items.find(i => i.name === itemName);
            const itemDisplayUnitForTotal = itemConfig?.unit || 'pcs';

            const hasActualVariants = itemGroup.variants.some(v => v.variantName && v.variantName !== 'N/A');

            summaryTableRows.push([
                srNo++,
                itemName,
                hasActualVariants ? '' : `${parseFloat(itemGroup.itemTotalReceived.toFixed(3))} ${itemDisplayUnitForTotal}`, // Use parseFloat
                hasActualVariants ? '' : `${parseFloat(itemGroup.itemTotalConsumed.toFixed(3))} ${itemDisplayUnitForTotal}`, // Use parseFloat
                hasActualVariants ? '' : `${parseFloat(itemGroup.itemBalance.toFixed(3))} ${itemDisplayUnitForTotal}`,       // Use parseFloat
                ''
            ]);

            if (hasActualVariants) {
                itemGroup.variants.sort((a, b) => a.variantName.localeCompare(b.variantName));

                itemGroup.variants.forEach((variant, variantIdx) => {
                    const variantPrefix = String.fromCharCode(97 + variantIdx) + ') ';
                    summaryTableRows.push([
                        '',
                        `  ${variantPrefix}${variant.variantName}`,
                        `${parseFloat(variant.totalReceived.toFixed(3))} ${variant.unit}`, // Use parseFloat
                        `${parseFloat(variant.totalUsed.toFixed(3))} ${variant.unit}`,     // Use parseFloat
                        `${parseFloat(variant.balance.toFixed(3))} ${variant.unit}`,       // Use parseFloat
                        '-'
                    ]);
                });
            }
            grandTotalReceived += itemGroup.itemTotalReceived;
            grandTotalConsumed += itemGroup.itemTotalConsumed;
            grandTotalBalance += itemGroup.itemBalance;
        }

        summaryTableRows.push([
            '', // Empty for Sr.
            'GRAND TOTAL',
            parseFloat(grandTotalReceived.toFixed(3)), // Use parseFloat
            parseFloat(grandTotalConsumed.toFixed(3)), // Use parseFloat
            parseFloat(grandTotalBalance.toFixed(3)),  // Use parseFloat
            '' // Empty for Remarks
        ]);

        docPdf.autoTable({
            head: [summaryTableColumns],
            body: summaryTableRows,
            startY: yOffset,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [20, 100, 200] },
            margin: { top: 25 },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 1 && data.cell.raw && data.cell.raw.startsWith('  ')) {
                    data.cell.styles.halign = 'left';
                }
                if (data.section === 'body' && data.row && data.row.index === summaryTableRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [230, 230, 230];
                    if (data.column.index === 1) {
                        data.cell.styles.halign = 'left';
                    } else if ([2, 3, 4].includes(data.column.index)) {
                        data.cell.styles.halign = 'right';
                    }
                } else {
                    if (data.column.index === 0) {
                        data.cell.styles.halign = 'center';
                    } else if (data.column.index === 1) {
                        data.cell.styles.halign = 'left';
                    } else if ([2, 3, 4].includes(data.column.index)) {
                        data.cell.styles.halign = 'right';
                    } else if (data.column.index === 5) {
                        data.cell.styles.halign = 'center';
                    }
                }
            },
            didDrawPage: function(data) {
                const preparedByText = `Prepared By: ${userName}`;
                docPdf.setFontSize(10);
                const textWidthPreparedBy = docPdf.getStringUnitWidth(preparedByText) * docPdf.internal.getFontSize() / docPdf.internal.scaleFactor;
                const xPreparedBy = docWidth - rightMargin - textWidthPreparedBy;
                docPdf.text(preparedByText, xPreparedBy, docPdf.internal.pageSize.height - bottomMargin - 20);

                if (signatureURL) {
                    const imgData = signatureURL;
                    const imgWidth = 50;
                    const imgHeight = 20;
                    const xSignatureImage = docWidth - rightMargin - imgWidth;
                    docPdf.addImage(imgData, 'PNG', xSignatureImage, docPdf.internal.pageSize.height - bottomMargin - 15, imgWidth, imgHeight);
                    const textWidthSignatureLabel = docPdf.getStringUnitWidth('Authorized Signature') * docPdf.internal.getFontSize() / docPdf.internal.scaleFactor;
                    const xSignatureLabel = docWidth - rightMargin - (textWidthSignatureLabel / 2);
                    docPdf.text('Authorized Signature', xSignatureLabel, docPdf.internal.pageSize.height - bottomMargin);
                }

                let str = "Page " + docPdf.internal.getNumberOfPages();
                docPdf.text(str, data.settings.margin.left, parseFloat(docPdf.internal.pageSize.height) - 10);
            }
        });

        const transactionsForExportDetailSheets = allTransactions.filter(t => {
            const txnDate = new Date(t.date);
            let inDateRange = true;
            if (actualExportStartDate) {
                const startOfDay = new Date(actualExportStartDate);
                startOfDay.setHours(0,0,0,0);
                inDateRange = inDateRange && (txnDate >= startOfDay);
            }
            if (actualExportEndDate) {
                const endOfDay = new Date(actualExportEndDate);
                endOfDay.setHours(23,59,59,999);
                inDateRange = inDateRange && (txnDate <= endOfDay);
            }
            return inDateRange;
        });

        const allUniqueItemIdsInSelectedSite = [...new Set(displayedSummary.map(s => s.itemId))];

        allUniqueItemIdsInSelectedSite.forEach(uniqueItemId => {
            const itemDetails = items.find(item => item.id === uniqueItemId);
            const itemTransactions = transactionsForExportDetailSheets.filter(t =>
                t.itemId === uniqueItemId && t.siteId === selectedSite
            ).sort((a,b) => a.date.getTime() - b.date.getTime());

            if (itemDetails && itemTransactions.length > 0) {
                docPdf.addPage();

                let itemPageYOffset = 10;
                docPdf.setFontSize(14);
                docPdf.text(`Stock Item History for: ${itemDetails.name}`, docWidth / 2, itemPageYOffset, { align: 'center' });
                itemPageYOffset += 8;
                docPdf.setFontSize(10);
                docPdf.text(`Site: ${currentSiteName}`, docWidth / 2, itemPageYOffset, { align: 'center' });
                itemPageYOffset += 8;
                docPdf.text(`Date: ${formattedStartDate} to ${formattedEndDate}`, docWidth / 2, itemPageYOffset, { align: 'center' });
                itemPageYOffset += 10;

                const itemTableColumns = ["Date", "Item & Variant", "IN", "OUT", "Remarks"];
                const itemTableRows = [];

                let totalIn = 0;
                let totalOut = 0;

                const summaryForItem = displayedSummary.find(s => s.itemId === itemDetails.id && s.siteId === selectedSite);
                const itemOverallBalance = summaryForItem ? summaryForItem.balance : 0;
                const itemDisplayUnitForTotal = summaryForItem ? summaryForItem.unit : (itemDetails.unit || 'pcs');

                itemTransactions.forEach(t => {
                    const quantityIn = t.type === 'inward' ? t.quantity : '';
                    const quantityOut = t.type === 'outward' ? t.quantity : '';

                    if (t.type === 'inward') {
                        totalIn += t.quantity;
                    } else if (t.type === 'outward') {
                        totalOut += t.quantity;
                    }

                    const variantDisplay = t.variantName && t.variantName !== 'N/A' ? `${itemDetails.name} - ${t.variantName}` : itemDetails.name;

                    itemTableRows.push([
                        new Date(t.date).toLocaleDateString('en-IN'),
                        variantDisplay,
                        quantityIn ? `${parseFloat(quantityIn.toFixed(3))} ${t.unit || ''}` : '', // Use parseFloat
                        quantityOut ? `${parseFloat(quantityOut.toFixed(3))} ${t.unit || ''}` : '', // Use parseFloat
                        t.remark || '-'
                    ]);
                });

                itemTableRows.push([
                    'TOTAL',
                    '',
                    `${parseFloat(totalIn.toFixed(3))} ${itemDisplayUnitForTotal}`, // Use parseFloat
                    `${parseFloat(totalOut.toFixed(3))} ${itemDisplayUnitForTotal}`, // Use parseFloat
                    `${parseFloat(itemOverallBalance.toFixed(3))} ${itemDisplayUnitForTotal} (Balance)` // Use parseFloat
                ]);

                docPdf.autoTable({
                    head: [itemTableColumns],
                    body: itemTableRows,
                    startY: itemPageYOffset,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [20, 100, 200] },
                    margin: { top: 25 },
                    didDrawPage: function(data) {
                        const preparedByText = `Prepared By: ${userName}`;
                        docPdf.setFontSize(10);
                        const textWidthPreparedBy = docPdf.getStringUnitWidth(preparedByText) * docPdf.internal.getFontSize() / docPdf.internal.scaleFactor;
                        const xPreparedBy = docWidth - rightMargin - textWidthPreparedBy;
                        docPdf.text(preparedByText, xPreparedBy, docPdf.internal.pageSize.height - bottomMargin - 20);

                        if (signatureURL) {
                            const imgData = signatureURL;
                            const imgWidth = 50;
                            const imgHeight = 20;
                            const xSignatureImage = docWidth - rightMargin - imgWidth;
                            docPdf.addImage(imgData, 'PNG', xSignatureImage, docPdf.internal.pageSize.height - bottomMargin - 15, imgWidth, imgHeight);
                            const textWidthSignatureLabel = docPdf.getStringUnitWidth('Authorized Signature') * docPdf.internal.getFontSize() / docPdf.internal.scaleFactor;
                            const xSignatureLabel = docWidth - rightMargin - (textWidthSignatureLabel / 2);
                            docPdf.text('Authorized Signature', xSignatureLabel, docPdf.internal.pageSize.height - bottomMargin);
                        }

                        let str = "Page " + docPdf.internal.getNumberOfPages();
                        docPdf.text(str, data.settings.margin.left, parseFloat(docPdf.internal.pageSize.height) - 10);
                    },
                    didParseCell: function(data) {
                        if (data.section === 'body' && data.row && data.row.index === itemTableRows.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [230, 230, 230];
                            if (data.column.index === 0) {
                                data.cell.styles.halign = 'left';
                            } else if (data.column.index >= 2 && data.column.index <= 4) {
                                data.cell.styles.halign = 'right';
                            }
                        } else {
                            if (data.column.index === 0) {
                                data.cell.styles.halign = 'left';
                            } else if (data.column.index === 1) {
                                data.cell.styles.halign = 'left';
                            } else if (data.column.index === 2 || data.column.index === 3) {
                                data.cell.styles.halign = 'right';
                            } else if (data.column.index === 4) {
                                data.cell.styles.halign = 'left';
                            }
                        }
                    },
                });
            }
        });

        const pdfBlob = docPdf.output('blob');
        const fileName = `${currentSiteName}_Stock_Master_Report_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.pdf`;
        return await saveFile(pdfBlob, fileName);
    };

    const exportExcel = async () => {
        const wb = XLSX.utils.book_new();

        const actualExportStartDate = exportStartDate ? exportStartDate.toDate() : null;
        const actualExportEndDate = exportEndDate ? exportEndDate.toDate() : null;

        const formattedStartDate = actualExportStartDate ? actualExportStartDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
        const formattedEndDate = actualExportEndDate ? actualExportEndDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';


        let mainSheetData = [];
        mainSheetData.push([currentSiteName]); // A1
        mainSheetData.push([`Date: ${formattedStartDate} to ${formattedEndDate}`]); // A2
        mainSheetData.push([]); // A3 empty
        mainSheetData.push([]); // A4 empty
        mainSheetData.push([]); // A5 empty
        mainSheetData.push([]); // A6 empty
        mainSheetData.push(["Sr", "Item Name", "Total Received", "Total Consumed", "Balance", "Remarks"]); // A7 - F7 Header

        let srNo = 1;
        let grandTotalReceived = 0;
        let grandTotalConsumed = 0;
        let grandTotalBalance = 0;

        const groupedItems = displayedSummary.reduce((acc, item) => {
            if (!acc[item.itemName]) {
                acc[item.itemName] = {
                    variants: [],
                    itemTotalReceived: 0,
                    itemTotalConsumed: 0,
                    itemBalance: 0
                };
            }
            acc[item.itemName].variants.push(item);

            const itemConfig = items.find(i => i.id === item.itemId);
            const itemBaseUnit = itemConfig?.unit || 'pcs';

            const convertedReceived = convertUnit(item.totalReceived, item.unit, itemBaseUnit);
            const convertedUsed = convertUnit(item.totalUsed, item.unit, itemBaseUnit);
            const convertedBalance = convertUnit(item.balance, item.unit, itemBaseUnit);

            acc[item.itemName].itemTotalReceived += convertedReceived;
            acc[item.itemName].itemTotalConsumed += convertedUsed;
            acc[item.itemName].itemBalance += convertedBalance;
            return acc;
        }, {});

        for (const itemName in groupedItems) {
            const itemGroup = groupedItems[itemName];
            const itemConfig = items.find(i => i.name === itemName);
            const itemDisplayUnitForTotal = itemConfig?.unit || 'pcs';

            const hasActualVariants = itemGroup.variants.some(v => v.variantName && v.variantName !== 'N/A');

            mainSheetData.push([
                srNo++,
                itemName,
                hasActualVariants ? '' : `${parseFloat(itemGroup.itemTotalReceived.toFixed(3))} ${itemDisplayUnitForTotal}`, // Use parseFloat
                hasActualVariants ? '' : `${parseFloat(itemGroup.itemTotalConsumed.toFixed(3))} ${itemDisplayUnitForTotal}`, // Use parseFloat
                hasActualVariants ? '' : `${parseFloat(itemGroup.itemBalance.toFixed(3))} ${itemDisplayUnitForTotal}`,       // Use parseFloat
                '-',
            ]);

            if (hasActualVariants) {
                itemGroup.variants.sort((a, b) => a.variantName.localeCompare(b.variantName));
                itemGroup.variants.forEach((variant, variantIdx) => {
                    const variantPrefix = String.fromCharCode(97 + variantIdx) + ') ';
                    mainSheetData.push([
                        '',
                        `${variantPrefix}${variant.variantName}`,
                        `${parseFloat(variant.totalReceived.toFixed(3))} ${variant.unit}`, // Use parseFloat
                        `${parseFloat(variant.totalUsed.toFixed(3))} ${variant.unit}`,     // Use parseFloat
                        `${parseFloat(variant.balance.toFixed(3))} ${variant.unit}`,       // Use parseFloat
                        '-'
                    ]);
                });
            }
            grandTotalReceived += itemGroup.itemTotalReceived;
            grandTotalConsumed += itemGroup.itemTotalConsumed;
            grandTotalBalance += itemGroup.itemBalance;
        }

        mainSheetData.push([]); // Empty row before totals
        mainSheetData.push([
            'TOTAL', // Sr. will be empty
            '', // Item Name will be empty
            parseFloat(grandTotalReceived.toFixed(3)), // Use parseFloat
            parseFloat(grandTotalConsumed.toFixed(3)), // Use parseFloat
            parseFloat(grandTotalBalance.toFixed(3)),  // Use parseFloat
            '(Balance)'
        ]);

        // Add empty rows for spacing before the signature block
        mainSheetData.push([], [], []); // 3 empty rows

        // Add 'Prepared By:' and 'Authorized Signature:' and their values
        mainSheetData.push([`Prepared By:`, userName]);
        mainSheetData.push([`Authorized Signature:`, signatureURL || "No Digital Signature Uploaded"]);


        let mainSheet = XLSX.utils.aoa_to_sheet(mainSheetData);

        // Merge cells for main titles
        if (!mainSheet['!merges']) mainSheet['!merges'] = [];
        mainSheet['!merges'].push(
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Site Name
            { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }  // Date Range
        );

        // Cell objects must exist before applying style
        if (!mainSheet['A1']) mainSheet['A1'] = { t: 's', v: mainSheetData[0][0] };
        if (!mainSheet['A2']) mainSheet['A2'] = { t: 's', v: mainSheetData[1][0] };

        // Center align main titles
        if (mainSheet['A1']) {
            if (!mainSheet['A1'].s) mainSheet['A1'].s = {};
            mainSheet['A1'].s.alignment = { horizontal: 'center', vertical: 'center' };
            mainSheet['A1'].s.font = { sz: 16, bold: true };
        }
        if (mainSheet['A2']) {
            if (!mainSheet['A2'].s) mainSheet['A2'].s = {};
            mainSheet['A2'].s.alignment = { horizontal: 'center', vertical: 'center' };
            mainSheet['A2'].s.font = { sz: 10 };
        }

        // Header row styling (row 7 in AOA, index 6)
        const headerCells = ["A7", "B7", "C7", "D7", "E7", "F7"];
        headerCells.forEach((cellRef, colIndex) => {
            const r = 6; // header row index
            const c = colIndex; // column index
            const cellAddress = XLSX.utils.encode_cell({r, c});
            if (!mainSheet[cellAddress]) mainSheet[cellAddress] = { t: 's', v: mainSheetData[r][c] }; // Ensure cell object exists
            if (!mainSheet[cellAddress].s) mainSheet[cellAddress].s = {};
            mainSheet[cellAddress].s.font = { bold: true, color: { rgb: "FFFFFFFF" } }; // White font
            mainSheet[cellAddress].s.fill = { fgColor: { rgb: "FF3366FF" } }; // Blue color like in image
            mainSheet[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
            mainSheet[cellAddress].s.border = { // Add borders to header
                top: { style: "thin" }, bottom: { style: "thin" },
                left: { style: "thin" }, right: { style: "thin" }
            };
        });


        // Apply borders and alignments for main data table
        const tableDataStartRow = 6; // Headers are at index 6, data starts at 7
        const totalRowOffset = 4; // Offset for the grand total row (total row + 3 empty rows)
        const tableDataEndRow = mainSheetData.length - totalRowOffset; // Last data row before signature block
        const numColsInTable = 6; // Sr, Item Name, Total Received, Total Consumed, Balance, Remarks

        for (let r = tableDataStartRow; r < tableDataEndRow; r++) { // Iterate through data rows (excluding header and total)
            for (let c = 0; c < numColsInTable; c++) {
                const cellAddress = XLSX.utils.encode_cell({ r: r + 1, c }); // Adjust row index for 1-based indexing in sheet
                if (!mainSheet[cellAddress]) {
                    mainSheet[cellAddress] = { t: 's', v: mainSheetData[r + 1][c] || '' }; // Ensure cell object exists and has a value
                }
                if (!mainSheet[cellAddress].s) mainSheet[cellAddress].s = {};
                mainSheet[cellAddress].s.border = {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" }
                };

                // Alignment for regular data rows
                if (c === 0) { // Sr. No.
                    mainSheet[cellAddress].s.alignment = { horizontal: 'center' };
                } else if (c === 1) { // Item Name and Variants
                    const cellContent = mainSheetData[r + 1][c];
                    if (cellContent && typeof cellContent === 'string' && cellContent.match(/^[a-z]\) /)) { // Check for "a) ", "b) " etc.
                        mainSheet[cellAddress].s.alignment = { horizontal: 'left', indent: 2 }; // Indent variants
                    } else {
                        mainSheet[cellAddress].s.alignment = { horizontal: 'left' };
                    }
                } else if ([2, 3, 4].includes(c)) { // Total Received, Total Consumed, Balance
                    mainSheet[cellAddress].s.alignment = { horizontal: 'right' };
                } else if (c === 5) { // Remarks
                    mainSheet[cellAddress].s.alignment = { horizontal: 'center' };
                }
            }
        }

        // Grand Total row styling (last populated data row before signature block)
        const grandTotalRowActualIndex = mainSheetData.length - 5; // Adjusted index due to added empty rows before signature
        for (let c = 0; c < numColsInTable; c++) {
            const cellAddress = XLSX.utils.encode_cell({ r: grandTotalRowActualIndex, c: c });
            if (!mainSheet[cellAddress]) mainSheet[cellAddress] = { t: 's', v: mainSheetData[grandTotalRowActualIndex][c] || '' };
            if (!mainSheet[cellAddress].s) mainSheet[cellAddress].s = {};
            mainSheet[cellAddress].s.font = { bold: true };
            mainSheet[cellAddress].s.fill = { fgColor: { rgb: "FFE6E6E6" } };
            mainSheet[cellAddress].s.border = {
                top: { style: "thin" }, bottom: { style: "thin" },
                left: { style: "thin" }, right: { style: "thin" }
            };
            if (c === 0) {
                mainSheet[cellAddress].s.alignment = { horizontal: 'left' };
            } else if ([2, 3, 4].includes(c)) {
                mainSheet[cellAddress].s.alignment = { horizontal: 'right' };
            } else if (c === 5) {
                mainSheet[cellAddress].s.alignment = { horizontal: 'left' };
            }
        }
        if (!mainSheet['!merges']) mainSheet['!merges'] = [];
        mainSheet['!merges'].push(
            { s: { r: grandTotalRowActualIndex, c: 0 }, e: { r: grandTotalRowActualIndex, c: 1 } }
        );


        // Signature block
        const preparedByRowIndex = mainSheetData.length - 2;
        const signatureLabelRowIndex = mainSheetData.length - 1;

        const preparedByCellRef = XLSX.utils.encode_cell({ r: preparedByRowIndex, c: 0 });
        const preparedByNameCellRef = XLSX.utils.encode_cell({ r: preparedByRowIndex, c: 1 });
        const signatureLabelCellRef = XLSX.utils.encode_cell({ r: signatureLabelRowIndex, c: 0 });
        const signatureUrlCellRef = XLSX.utils.encode_cell({ r: signatureLabelRowIndex, c: 1 });

        if (!mainSheet[preparedByCellRef]) mainSheet[preparedByCellRef] = { t: 's', v: mainSheetData[preparedByRowIndex][0] };
        if (!mainSheet[preparedByNameCellRef]) mainSheet[preparedByNameCellRef] = { t: 's', v: mainSheetData[preparedByRowIndex][1] };
        if (!mainSheet[signatureLabelCellRef]) mainSheet[signatureLabelCellRef] = { t: 's', v: mainSheetData[signatureLabelRowIndex][0] };
        if (!mainSheet[signatureUrlCellRef]) mainSheet[signatureUrlCellRef] = { t: 's', v: mainSheetData[signatureLabelRowIndex][1] };

        [preparedByCellRef, signatureLabelCellRef].forEach(cellRef => {
            if (!mainSheet[cellRef].s) mainSheet[cellRef].s = {};
            mainSheet[cellRef].s.font = { bold: true };
            mainSheet[cellRef].s.alignment = { horizontal: 'left' };
        });

        [preparedByNameCellRef, signatureUrlCellRef].forEach(cellRef => {
            if (!mainSheet[cellRef].s) mainSheet[cellRef].s = {};
            mainSheet[cellRef].s.alignment = { horizontal: 'left' };
        });

        mainSheet['!merges'].push(
            { s: { r: preparedByRowIndex, c: 1 }, e: { r: preparedByRowIndex, c: 5 } },
            { s: { r: signatureLabelRowIndex, c: 1 }, e: { r: signatureLabelRowIndex, c: 5 } }
        );

        // Column Widths for main sheet
        mainSheet['!cols'] = [
            { wch: 5 }, // Sr
            { wch: 30 }, // Item Name
            { wch: 18 }, // Total Received
            { wch: 18 }, // Total Consumed
            { wch: 15 }, // Balance
            { wch: 20 }  // Remarks
        ];

        XLSX.utils.book_append_sheet(wb, mainSheet, "Summary Report");


        // Add individual item detail sheets
        const transactionsForExportDetailSheets = allTransactions.filter(t => {
            const txnDate = new Date(t.date);
            let inDateRange = true;
            if (actualExportStartDate) {
                const startOfDay = actualExportStartDate;
                startOfDay.setHours(0,0,0,0);
                inDateRange = inDateRange && (txnDate >= startOfDay);
            }
            if (actualExportEndDate) {
                const endOfDay = actualExportEndDate;
                endOfDay.setHours(23,59,59,999);
                inDateRange = inDateRange && (txnDate <= endOfDay);
            }
            return inDateRange;
        });

        const allUniqueItemIdsInSelectedSite = [...new Set(displayedSummary.map(s => s.itemId))];

        for (const uniqueItemId of allUniqueItemIdsInSelectedSite) {
            const itemDetails = items.find(item => item.id === uniqueItemId);
            let cleanSheetName = "Item_Details";
            if (itemDetails && itemDetails.name) {
                cleanSheetName = itemDetails.name.replace(/[\\/?*[\]:]/g, '_').substring(0, 31);
            } else {
                cleanSheetName = `Item_${uniqueItemId ? uniqueItemId.substring(0, 5) : 'Unknown'}`;
            }

            const itemTransactions = transactionsForExportDetailSheets.filter(t =>
                t.itemId === uniqueItemId && t.siteId === selectedSite
            ).sort((a,b) => a.date.getTime() - b.date.getTime());

            if (itemDetails && itemTransactions.length > 0) {
                let itemSheetData = [
                    [`Stock Item History for: ${itemDetails.name}`],
                    [`Site: ${currentSiteName}`],
                    [`Date: ${formattedStartDate} to ${formattedEndDate}`],
                    [],
                    ["Date", "Item & Variant", "IN", "OUT", "Remarks"]
                ];

                let totalInItemSheet = 0;
                let totalOutItemSheet = 0;
                const summaryForItem = displayedSummary.find(s => s.itemId === itemDetails.id && s.siteId === selectedSite);
                const itemOverallBalance = summaryForItem ? summaryForItem.balance : 0;
                const itemDisplayUnitForTotal = summaryForItem ? summaryForItem.unit : (itemDetails.unit || 'pcs');

                itemTransactions.forEach(t => {
                    const quantityIn = t.type === 'inward' ? t.quantity : '';
                    const quantityOut = t.type === 'outward' ? t.quantity : '';

                    if (t.type === 'inward') {
                        totalInItemSheet += t.quantity;
                    } else if (t.type === 'outward') {
                        totalOutItemSheet += t.quantity;
                    }
                    
                    const variantDisplay = t.variantName && t.variantName !== 'N/A' ? `${itemDetails.name} - ${t.variantName}` : itemDetails.name;

                    itemSheetData.push([
                        new Date(t.date).toLocaleDateString('en-IN'),
                        variantDisplay,
                        quantityIn ? `${parseFloat(quantityIn.toFixed(3))} ${t.unit || ''}` : '', // Use parseFloat
                        quantityOut ? `${parseFloat(quantityOut.toFixed(3))} ${t.unit || ''}` : '', // Use parseFloat
                        t.remark || '-'
                    ]);
                });

                itemSheetData.push([]); // Empty row before total
                itemSheetData.push([
                    'TOTAL',
                    '',
                    `${parseFloat(totalInItemSheet.toFixed(3))} ${itemDisplayUnitForTotal}`, // Use parseFloat
                    `${parseFloat(totalOutItemSheet.toFixed(3))} ${itemDisplayUnitForTotal}`, // Use parseFloat
                    `${parseFloat(itemOverallBalance.toFixed(3))} ${itemDisplayUnitForTotal} (Balance)` // Use parseFloat
                ]);

                itemSheetData.push([], [], []); // 3 empty rows for spacing

                itemSheetData.push(["Prepared By:", userName]);
                itemSheetData.push(["Authorized Signature:", signatureURL || "No Digital Signature Uploaded"]);


                let itemSheet = XLSX.utils.aoa_to_sheet(itemSheetData);

                if (!itemSheet['!merges']) itemSheet['!merges'] = [];
                itemSheet['!merges'].push(
                    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
                    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
                    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }
                );

                if (!itemSheet['A1']) itemSheet['A1'] = { t: 's', v: itemSheetData[0][0] };
                if (!itemSheet['A2']) itemSheet['A2'] = { t: 's', v: itemSheetData[1][0] };
                if (!itemSheet['A3']) itemSheet['A3'] = { t: 's', v: itemSheetData[2][0] };

                if (itemSheet['A1']) {
                    if (!itemSheet['A1'].s) itemSheet['A1'].s = {};
                    itemSheet['A1'].s.alignment = { horizontal: 'center', vertical: 'center' };
                    itemSheet['A1'].s.font = { sz: 14, bold: true };
                }
                if (itemSheet['A2']) {
                    if (!itemSheet['A2'].s) itemSheet['A2'].s = {};
                    itemSheet['A2'].s.alignment = { horizontal: 'center', vertical: 'center' };
                    itemSheet['A2'].s.font = { sz: 10 };
                }
                if (itemSheet['A3']) {
                    if (!itemSheet['A3'].s) itemSheet['A3'].s = {};
                    itemSheet['A3'].s.alignment = { horizontal: 'center', vertical: 'center' };
                    itemSheet['A3'].s.font = { sz: 10 };
                }

                const itemHeaderCells = ["A5", "B5", "C5", "D5", "E5"];
                itemHeaderCells.forEach((cellRef, colIndex) => {
                    const r = 4;
                    const c = colIndex;
                    const cellAddress = XLSX.utils.encode_cell({r, c});
                    if (!itemSheet[cellAddress]) itemSheet[cellAddress] = { t: 's', v: itemSheetData[r][c] };
                    if (!itemSheet[cellAddress].s) itemSheet[cellAddress].s = {};
                    itemSheet[cellAddress].s.font = { bold: true, color: { rgb: "FFFFFFFF" } };
                    itemSheet[cellAddress].s.fill = { fgColor: { rgb: "FF3366FF" } };
                    itemSheet[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
                    itemSheet[cellAddress].s.border = {
                        top: { style: "thin" }, bottom: { style: "thin" },
                        left: { style: "thin" }, right: { style: "thin" }
                    };
                });


                const itemTableDataStartRow = 5;
                const itemTotalRowOffset = 4;
                const itemTableDataEndRow = itemSheetData.length - itemTotalRowOffset;
                const itemNumCols = 5;

                for (let r = itemTableDataStartRow; r < itemTableDataEndRow; r++) {
                    for (let c = 0; c < itemNumCols; c++) {
                        const cellAddress = XLSX.utils.encode_cell({ r, c });
                        if (!itemSheet[cellAddress]) {
                            itemSheet[cellAddress] = { t: 's', v: itemSheetData[r][c] || '' };
                        }
                        if (!itemSheet[cellAddress].s) itemSheet[cellAddress].s = {};
                        itemSheet[cellAddress].s.border = {
                            top: { style: "thin" },
                            bottom: { style: "thin" },
                            left: { style: "thin" },
                            right: { style: "thin" }
                        };
                        if (c === 0 || c === 1 || c === 4) {
                            itemSheet[cellAddress].s.alignment = { horizontal: 'left' };
                        } else if (c === 2 || c === 3) {
                            itemSheet[cellAddress].s.alignment = { horizontal: 'right' };
                        }
                    }
                }

                const itemTotalRowActualIndex = itemSheetData.length - 4;
                for (let c = 0; c < itemNumCols; c++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: itemTotalRowActualIndex, c: c });
                    if (!itemSheet[cellAddress]) itemSheet[cellAddress] = { t: 's', v: itemSheetData[itemTotalRowActualIndex][c] || '' };
                    if (!itemSheet[cellAddress].s) itemSheet[cellAddress].s = {};
                    itemSheet[cellAddress].s.font = { bold: true };
                    itemSheet[cellAddress].s.fill = { fgColor: { rgb: "FFE6E6E6" } };
                    itemSheet[cellAddress].s.border = {
                        top: { style: "thin" }, bottom: { style: "thin" },
                        left: { style: "thin" }, right: { style: "thin" }
                    };
                    if (c === 0) {
                        itemSheet[cellAddress].s.alignment = { horizontal: 'left' };
                    } else if (c >= 2 && c <= 4) {
                        itemSheet[cellAddress].s.alignment = { horizontal: 'right' };
                    }
                }
                if (!itemSheet['!merges']) itemSheet['!merges'] = [];
                itemSheet['!merges'].push(
                    { s: { r: itemTotalRowActualIndex, c: 0 }, e: { r: itemTotalRowActualIndex, c: 1 } }
                );


                const itemPreparedByRowIndex = itemSheetData.length - 2;
                const itemSignatureLabelRowIndex = itemSheetData.length - 1;

                const itemPreparedByCellRef = XLSX.utils.encode_cell({ r: itemPreparedByRowIndex, c: 0 });
                const itemPreparedByNameCellRef = XLSX.utils.encode_cell({ r: itemPreparedByRowIndex, c: 1 });
                const itemSignatureLabelCellRef = XLSX.utils.encode_cell({ r: itemSignatureLabelRowIndex, c: 0 });
                const itemSignatureUrlCellRef = XLSX.utils.encode_cell({ r: itemSignatureLabelRowIndex, c: 1 });

                if (!itemSheet[itemPreparedByCellRef]) itemSheet[itemPreparedByCellRef] = { t: 's', v: itemSheetData[itemPreparedByRowIndex][0] };
                if (!itemSheet[itemPreparedByNameCellRef]) itemSheet[itemPreparedByNameCellRef] = { t: 's', v: itemSheetData[itemPreparedByRowIndex][1] };
                if (!itemSheet[itemSignatureLabelCellRef]) itemSheet[itemSignatureLabelCellRef] = { t: 's', v: itemSheetData[itemSignatureLabelRowIndex][0] };
                if (!itemSheet[itemSignatureUrlCellRef]) itemSheet[itemSignatureUrlCellRef] = { t: 's', v: itemSheetData[itemSignatureLabelRowIndex][1] };


                [itemPreparedByCellRef, itemSignatureLabelCellRef].forEach(cellRef => {
                    if (!itemSheet[cellRef].s) itemSheet[cellRef].s = {};
                    itemSheet[cellRef].s.font = { bold: true };
                    itemSheet[cellRef].s.alignment = { horizontal: 'left' };
                });

                [itemPreparedByNameCellRef, itemSignatureUrlCellRef].forEach(cellRef => {
                    if (!itemSheet[cellRef].s) itemSheet[cellRef].s = {};
                    itemSheet[cellRef].s.alignment = { horizontal: 'left' };
                });


                itemSheet['!merges'].push(
                    { s: { r: itemPreparedByRowIndex, c: 1 }, e: { r: itemPreparedByRowIndex, c: 4 } },
                    { s: { r: itemSignatureLabelRowIndex, c: 1 }, e: { r: itemSignatureLabelRowIndex, c: 4 } }
                );


                itemSheet['!cols'] = [
                    { wch: 15 }, // Date
                    { wch: 20 }, // Item & Variant
                    { wch: 15 }, // IN
                    { wch: 15 }, // OUT
                    { wch: 30 }  // Remarks
                ];

                XLSX.utils.book_append_sheet(wb, itemSheet, cleanSheetName);
            }
        }

        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
        const s2ab = (s) => {
            const buf = new ArrayBuffer(s.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
            return buf;
        };
        const blob = new Blob([s2ab(excelBuffer)], {type: 'application/octet-stream'});
        const fileName = `${currentSiteName}_Stock_Master_Report_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`;
        return await saveFile(blob, fileName);
    };

    const shareOnWhatsApp = async () => {
        if (!selectedSite || displayedSummary.length === 0) {
            alert("Please select a site and ensure there is data to share.");
            return;
        }

        setExporting(true);
        setExportStatus({ success: false, message: '' });

        try {
            const fileNameResult = await generatePDF();

            if (isCapacitorApp()) {
                setExportStatus({
                    success: true,
                    message: `PDF generated. A share dialog will open. Please select WhatsApp to share "${fileNameResult}".`
                });
            } else {
                const actualExportStartDate = exportStartDate ? exportStartDate.toDate() : null;
                const actualExportEndDate = exportEndDate ? exportEndDate.toDate() : null;

                const message = encodeURIComponent(
                    `Check out the stock report for ${currentSiteName} from ${actualExportStartDate ? actualExportStartDate.toLocaleDateString('en-IN') : 'start'} to ${actualExportEndDate ? actualExportEndDate.toLocaleDateString('en-IN') : 'today'}.` +
                    ` You can find the downloaded PDF file in your browser's downloads folder.`
                );
                window.open(`https://web.whatsapp.com/send?text=${message}`, '_blank');
                setExportStatus({
                    success: true,
                    message: "PDF downloaded. WhatsApp web opened. Please send the downloaded file manually."
                });
            }
        } catch (error) {
            console.error('WhatsApp sharing failed:', error);
            setExportStatus({
                success: false,
                message: `WhatsApp sharing failed: ${error.message || 'Unknown error'}. Please try downloading and sharing manually.`
            });
        } finally {
            setExporting(false);
            setTimeout(() => setExportStatus({ success: false, message: '' }), 7000);
        }
    };

    const openExportedFolder = async () => {
        if (isCapacitorApp()) {
            try {
                await Share.share({
                    title: 'Locate Exported Files',
                    text: 'To find your reports, please use your device’s File Manager app. Look in your "Downloads" folder (if you saved via the share dialog) OR in "Internal Storage > Android > data > YOUR_APP_ID > files > Documents".',
                    dialogTitle: 'Open File Manager / Share',
                });

                setExportStatus({ success: true, message: "Attempting to open file manager. Please follow instructions in the dialog." });

            } catch (error) {
                console.error("Error opening exported folder:", error);
                setExportStatus({ success: false, message: "Could not open folder directly. Please use your device's file manager and navigate to 'Internal Storage > Android > data > YOUR_APP_ID > files > Documents' or check 'Downloads' after a recent export." });
            }
        } else {
            alert("For web, files are saved in your browser's default downloads folder. Please check there.");
        }
    };


    if (loading) {
        return (
            <Container maxWidth="md" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
                <CircularProgress />
                <Typography variant="h6" sx={{ ml: 2 }}>Loading data for master report...</Typography>
            </Container>
        );
    }

    if (!userId) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="h5" color="error">Please log in to view the summary page.</Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" className="summary-page-container">
            <Typography variant="h4" gutterBottom component="h1">
                Site Stock Summary
            </Typography>

            {/* Storage permission warning for Capacitor apps */}
            {isCapacitorApp() && !storagePermission && (
                <Box sx={{ p: 2, mb: 3, backgroundColor: 'warning.light', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="warning.contrastText">
                        Storage permission is required to save and share files on your device.
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        sx={{ color: 'warning.contrastText', borderColor: 'warning.contrastText' }}
                        onClick={async () => {
                            try {
                                const permResult = await Filesystem.requestPermissions();
                                if (permResult.publicStorage === 'granted') {
                                    setStoragePermission(true);
                                    setExportStatus({ success: true, message: "Storage permission granted!" });
                                } else {
                                    alert("Permission denied. Please enable storage permission in your app settings to export files.");
                                    setExportStatus({ success: false, message: "Storage permission denied." });
                                }
                            } catch (error) {
                                console.error("Error requesting storage permission:", error);
                                setExportStatus({ success: false, message: "Failed to request storage permission. Check device settings." });
                            }
                        }}
                    >
                        Grant Permission
                    </Button>
                </Box>
            )}
            {/* End Storage permission warning */}

            <Grid container spacing={3} alignItems="center" sx={{ mb: 4}}>
                <Grid item xs={12} md={6}>
                    <Card variant="outlined" className="signature-upload-section">
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Digital Signature</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                {signatureURL ? (
                                    <img src={signatureURL} alt="Signature Preview" className="signature-preview" />
                                ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>No signature uploaded.</Typography>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Report Filters</Typography>
                            <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                                <InputLabel id="site-select-label">Site</InputLabel>
                                <Select
                                    labelId="site-select-label"
                                    value={selectedSite}
                                    onChange={(e) => setSelectedSite(e.target.value)}
                                    label="Site"
                                    disabled={loading || exporting}
                                >
                                    {sites.map((site) => (
                                        <MenuItem key={site.id} value={site.id}>
                                            {site.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                fullWidth
                                label="Search Item or Variant"
                                variant="outlined"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                                sx={{ mb: 2 }}
                                disabled={loading || exporting}
                            />
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                <DatePicker
                                    label="Start Date (for Export)"
                                    value={exportStartDate}
                                    onChange={(newValue) => setExportStartDate(newValue)}
                                    enableAccessibleFieldDOMStructure={false}
                                    slots={{ textField: TextField }}
                                    slotProps={{ textField: { size: 'small' } }}
                                    disabled={loading || exporting}
                                />
                                <DatePicker
                                    label="End Date (for Export)"
                                    value={exportEndDate}
                                    onChange={(newValue) => setExportEndDate(newValue)}
                                    enableAccessibleFieldDOMStructure={false}
                                    slots={{ textField: TextField }}
                                    slotProps={{ textField: { size: 'small' } }}
                                    disabled={loading || exporting}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Export Status Message */}
            {exportStatus.message && (
                <Box
                    sx={{
                        mt: 2,
                        p: 1.5,
                        borderRadius: 1,
                        backgroundColor: exportStatus.success ? 'success.main' : 'error.main',
                        color: 'white',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        animation: 'fadeInOut 4s forwards',
                        '@keyframes fadeInOut': {
                            '0%': { opacity: 0 },
                            '10%': { opacity: 1 },
                            '90%': { opacity: 1 },
                            '100%': { opacity: 0 }
                        }
                    }}
                >
                    {exportStatus.message}
                </Box>
            )}
            {/* End Storage permission warning */}

            <Paper elevation={3} sx={{ p: 3, mb: 4 }} className="site-report-container">
                <Typography variant="h5" gutterBottom>
                    Stock Details for {currentSiteName}
                </Typography>

                <TableContainer component={Paper} sx={{ mb: 3, maxHeight: 600, overflow: 'auto' }}>
                    <Table stickyHeader aria-label="site stock table" className="stock-table">
                        <TableHead>
                            <TableRow>
                                <TableCell>Sr. No.</TableCell>
                                <TableCell>Item Name</TableCell>
                                <TableCell>Units</TableCell>
                                <TableCell>Total Received</TableCell>
                                <TableCell>Total Consumed</TableCell>
                                <TableCell>Balance</TableCell>
                                <TableCell>Details</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {displayedSummary.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center">
                                        No items found for this site or matching your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                displayedSummary.map((summary, idx) => (
                                    <TableRow key={`${summary.siteId}-${summary.itemName}-${summary.variantName}-${summary.unit}`}>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell>
                                            {summary.itemName} {summary.variantName !== 'N/A' && `(${summary.variantName})`}
                                        </TableCell>
                                        <TableCell>{summary.unit}</TableCell>
                                        <TableCell>{summary.totalReceived}</TableCell>
                                        <TableCell>{summary.totalUsed}</TableCell>
                                        <TableCell>{summary.balance}</TableCell>
                                        <TableCell>
                                            <Button
                                                component={Link}
                                                to={`/details/${summary.itemId}?siteId=${summary.siteId}`}
                                                variant="outlined"
                                                size="small"
                                                disabled={!summary.itemId || !summary.siteId || exporting}
                                            >
                                                View History
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: isMobile ? 'center' : 'flex-end', flexWrap: 'wrap' }} className="export-buttons-group">
                    <Button
                        variant="contained"
                        onClick={() => handleExportWrapper(generatePDF)}
                        startIcon={<PictureAsPdfIcon />}
                        disabled={displayedSummary.length === 0 || exporting || !storagePermission}
                    >
                        {exporting ? <CircularProgress size={24} color="inherit" /> : 'Export as PDF'}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => handleExportWrapper(exportExcel)}
                        startIcon={<TableViewIcon />}
                        disabled={displayedSummary.length === 0 || !selectedSite || exporting || !storagePermission}
                    >
                        {exporting ? <CircularProgress size={24} color="inherit" /> : 'Export Master Excel Report'}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={shareOnWhatsApp}
                        startIcon={<FaWhatsapp />}
                        disabled={displayedSummary.length === 0 || !selectedSite || exporting || !storagePermission}
                    >
                        {exporting ? <CircularProgress size={24} color="inherit" /> : 'Share via WhatsApp'}
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={openExportedFolder}
                        startIcon={<FaFolderOpen />}
                        disabled={exporting || !storagePermission}
                    >
                        Open Exported Folder
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
};

export default SummaryPage;