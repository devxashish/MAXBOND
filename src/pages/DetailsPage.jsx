import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// No jspdf or xlsx imports needed as exports are handled by SummaryPage
// import jsPDF from 'jspdf';
// import { applyPlugin } from 'jspdf-autotable';
// import * as XLSX from 'xlsx';
// import { saveAs } = 'file-saver';

// Material-UI Components
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  TablePagination,
  TextField,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// Import the CSS file
import '../styles/DetailsPage.css';

// Import unit conversion helpers from the new utility file
import { getUnitCategory, convertUnit } from "../utils/unitConversions";


const DetailsPage = () => {
  const { itemId } = useParams();
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const siteId = queryParams.get('siteId'); // Get siteId from URL query parameter

  const [transactions, setTransactions] = useState([]);
  const [itemName, setItemName] = useState('Item Details');
  const [siteName, setSiteName] = useState('Loading Site...');
  const [itemDisplayUnit, setItemDisplayUnit] = useState('pcs'); // Preferred unit for displaying totals
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Authenticate user and set userId
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId('');
        setLoading(false); // Stop loading if no user is authenticated
      }
    });
    return () => unsubscribe(); // Cleanup on component unmount
  }, []);

  // Fetch data (item details, site details, and transactions)
  useEffect(() => {
    // Only proceed if userId and itemId are available
    if (userId && itemId) {
      const fetchData = async () => {
        setLoading(true);
        // Fetch item and site details first, as item details determine `itemDisplayUnit`
        await fetchItemAndSiteDetails(userId); 
        await fetchTransactions(userId);
        setLoading(false);
      };
      fetchData();
    } else if (!userId) { // If user not logged in, stop loading
        setLoading(false);
    } else if (!itemId) { // If itemId is missing, stop loading and log error
        setLoading(false);
        console.error("No Item ID found in URL. Cannot fetch details.");
    }
  }, [userId, itemId, siteId]); // Re-run this effect if userId, itemId, or siteId changes

  // Fetches item name and its default unit, and site name if `siteId` is provided
  const fetchItemAndSiteDetails = async (uid) => {
    try {
      // Fetch the specific item document by its ID
      const itemDocRef = doc(db, 'users', uid, 'items', itemId);
      const itemDocSnap = await getDoc(itemDocRef);

      if (itemDocSnap.exists()) {
        const itemData = itemDocSnap.data();
        setItemName(itemData.name);
        setItemDisplayUnit(itemData.unit || 'pcs'); // Use item's primary unit for display
      } else {
        setItemName('Item Details (Not Found)');
        setItemDisplayUnit('pcs'); // Fallback default unit
        console.warn(`Item with ID ${itemId} not found.`);
      }

      // Fetch the site name if a siteId is provided in the URL
      if (siteId) {
        const siteDocRef = doc(db, 'users', uid, 'sites', siteId);
        const siteDocSnap = await getDoc(siteDocRef);
        if (siteDocSnap.exists()) {
          setSiteName(siteDocSnap.data().name);
        } else {
          setSiteName('Unknown Site');
          console.warn(`Site with ID ${siteId} not found.`);
        }
      } else {
        setSiteName('All Sites'); // Default when no specific site context was passed
        console.log("No siteId provided in URL. Displaying transactions across all sites for this item.");
      }
    } catch (error) {
      console.error('Error fetching item or site details:', error);
      setItemName('Error fetching item');
      setSiteName('Error fetching site');
      setItemDisplayUnit('pcs');
    }
  };

  // Fetches transaction records for the specific item (and optionally site)
  const fetchTransactions = async (uid) => {
    try {
      let transQueryRef;
      if (siteId) {
        // Query for specific item AND specific site.
        // This query REQUIRES a compound index in Firebase Firestore:
        // Collection: 'transfers', Fields: (itemId ASC, siteId ASC, timestamp DESC)
        transQueryRef = query(
          collection(db, 'users', uid, 'transfers'),
          where('itemId', '==', itemId),
          where('siteId', '==', siteId),
          orderBy('timestamp', 'desc')
        );
      } else {
        // Query for specific item across all sites if siteId is not provided.
        // This query might require an index on (itemId ASC, timestamp DESC)
        transQueryRef = query(
          collection(db, 'users', uid, 'transfers'),
          where('itemId', '==', itemId),
          orderBy('timestamp', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(transQueryRef);
      const transData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firebase Timestamp to a JavaScript Date object for consistency
        date: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp),
      }));
      setTransactions(transData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      // IMPORTANT: If you see "The query requires an index" in your browser console,
      // it means you MUST create the compound index in Firebase Firestore.
      // (Collection: "transfers", Fields: (itemId ASC, siteId ASC, timestamp DESC)).
      setTransactions([]);
    }
  };

  // Memoized filtered transactions based on date range and sorted by date
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const transactionDate = new Date(t.date);
      let isWithinRange = true;

      // Filter by start date (inclusive: from 00:00:00 of start date)
      if (startDate) {
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        isWithinRange = isWithinRange && transactionDate >= startOfDay;
      }
      // Filter by end date (inclusive: up to 23:59:59.999 of end date)
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        isWithinRange = isWithinRange && transactionDate <= endOfDay;
      }
      return isWithinRange;
    }).sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by date descending (most recent first)
  }, [transactions, startDate, endDate]);

  // Memoized total calculations (Total Received, Total Consumed, Current Balance)
  const totals = useMemo(() => {
    let received = 0;
    let used = 0;

    filteredTransactions.forEach((t) => {
      // Convert transaction quantity to the item's preferred `itemDisplayUnit` before summing.
      // This ensures consistency in total values across different transaction units.
      const convertedQuantity = convertUnit(t.quantity, t.unit, itemDisplayUnit);

      if (t.type === 'inward') {
        received += convertedQuantity;
      } else if (t.type === 'outward') {
        used += convertedQuantity;
      }
    });

    return {
      received: parseFloat(received.toFixed(3)), // Round to 3 decimal places for display
      used: parseFloat(used.toFixed(3)),
      balance: parseFloat((received - used).toFixed(3)),
    };
  }, [filteredTransactions, itemDisplayUnit]); // Re-calculate if filtered transactions or display unit changes

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset page to 0 when rows per page changes
  };

  // Slice transactions for current page display based on pagination
  const currentTransactions = useMemo(() => {
    return filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredTransactions, page, rowsPerPage]);

  // --- Render Logic ---
  // Show loading indicator
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading item and site details...</Typography>
      </Container>
    );
  }

  // Show login prompt if user is not authenticated
  if (!userId) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="error">Please log in to view transaction details.</Typography>
        {/* You might want to add a login link/button here */}
      </Container>
    );
  }

  // Show error if Item ID is missing from the URL (critical for this page's function)
  if (!itemId) {
    return (
        <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="h5" color="error">No Item ID provided in URL. Cannot display details.</Typography>
        </Container>
    );
  }

  // Main content display
  return (
    <Container maxWidth="lg" className="details-page-container">
      <Typography variant="h4" gutterBottom component="h1">
        Transaction Details for {itemName} at {siteName}
      </Typography>

      {/* Summary Cards: Total Received, Total Consumed, Current Balance */}
      <Grid container spacing={3} sx={{ mb: 4 }} className="summary-cards-grid">
        {/* FIX: Removed `item`, `xs`, `md` props as per MUI Grid v2 migration. */}
        {/* These props are now handled by the parent Grid container or by `sx` prop for flexible sizing */}
        <Grid xs={12} md={4}> 
          <Card variant="outlined" className="summary-card">
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Total Received ({itemDisplayUnit})
              </Typography>
              <Typography variant="h5" component="div" color="primary" className="summary-card-received">
                {totals.received}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} md={4}>
          <Card variant="outlined" className="summary-card">
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Total Consumed ({itemDisplayUnit})
              </Typography>
              <Typography variant="h5" component="div" color="secondary" className="summary-card-consumed">
                {totals.used}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} md={4}>
          <Card variant="outlined" className="summary-card">
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Current Balance ({itemDisplayUnit})
              </Typography>
              <Typography variant="h5" component="div" color={totals.balance >= 0 ? 'success.main' : 'error.main'} className="summary-card-balance">
                {totals.balance}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Transaction History Section */}
      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Transaction History
        </Typography>

        {/* Date Filters (Export buttons removed from DetailsPage as per new requirement) */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }} className="filter-export-section">
          <DatePicker
            label="Start Date"
            value={startDate}
            onChange={(newValue) => setStartDate(newValue)}
            // FIX: Added enableAccessibleFieldDOMStructure={false} for MUI X v6 compatibility
            enableAccessibleFieldDOMStructure={false}
            slots={{ textField: TextField }}
            slotProps={{ textField: { size: 'small' } }}
          />
          <DatePicker
            label="End Date"
            value={endDate}
            onChange={(newValue) => setEndDate(newValue)}
            // FIX: Added enableAccessibleFieldDOMStructure={false} for MUI X v6 compatibility
            enableAccessibleFieldDOMStructure={false}
            slots={{ textField: TextField }}
            slotProps={{ textField: { size: 'small' } }}
          />
        </Box>

        {/* Transaction History Table */}
        <TableContainer component={Paper} sx={{ maxHeight: 600, overflow: 'auto' }}>
          <Table stickyHeader aria-label="transaction history table" className="transactions-table">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Variant</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell>Remarks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No transactions found for this item at this site in the selected date range.
                  </TableCell>
                </TableRow>
              ) : (
                currentTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                    <TableCell>{t.type.charAt(0).toUpperCase() + t.type.slice(1)}</TableCell>
                    <TableCell>{t.variantName || '-'}</TableCell>
                    <TableCell align="right">{t.quantity}</TableCell>
                    <TableCell>{t.unit || '-'}</TableCell>
                    <TableCell>{t.remark || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {/* Pagination controls */}
        {filteredTransactions.length > rowsPerPage && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, { label: 'All', value: filteredTransactions.length }]}
            component="div"
            count={filteredTransactions.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            className="pagination-container"
          />
        )}
      </Paper>
    </Container>
  );
};

export default DetailsPage;