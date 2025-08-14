import React, { useEffect, useState, useCallback } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import Select from 'react-select';
import { useNavigate } from "react-router-dom"; // useNavigate ko import kiya gaya hai
import styles from "../styles/SiteInventoryPage.module.css";
import { unitConversionRates, getUnitCategory, convertUnit } from "../utils/unitConversions";
import { Button } from '@mui/material';
import FilePresentIcon from '@mui/icons-material/FilePresent';

const SiteInventoryPage = () => {
    const [allSites, setAllSites] = useState([]);
    const [selectedSite, setSelectedSite] = useState(null);
    const [usersWithItems, setUsersWithItems] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate(); // useNavigate ko initialize kiya gaya hai

    const fetchSites = useCallback(async () => {
        setIsLoading(true);
        try {
            const sitesSnapshot = await getDocs(collection(db, "sites"));
            const fetchedSites = sitesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                value: doc.id,
                label: doc.data().name
            }));
            setAllSites(fetchedSites);
        } catch (err) {
            console.error("Error fetching sites:", err);
            setError("Failed to load sites. Please check your network and permissions.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchInventoryData = useCallback(async (siteId) => {
        if (!siteId) {
            setUsersWithItems({});
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const allTransfers = [];
            const usersMap = {};

            for (const userDoc of usersSnapshot.docs) {
                const transfersQuery = query(
                    collection(db, "users", userDoc.id, "transfers"),
                    where("siteId", "==", siteId)
                );
                const transfersSnapshot = await getDocs(transfersQuery);

                if (!transfersSnapshot.empty) {
                    transfersSnapshot.docs.forEach(transferDoc => {
                        allTransfers.push({ id: transferDoc.id, ...transferDoc.data() });
                    });
                }
            }
            
            const siteTotals = {};
            allTransfers.forEach((transfer) => {
                const { userId, itemId, variantId, unit, quantity, type, userName, itemName, variantName } = transfer;
                const itemKey = `${itemId || 'unknown'}-${variantId || 'no-variant'}-${unit || 'no-unit'}`;

                if (!usersMap[userId]) {
                    usersMap[userId] = {
                        name: userName,
                        items: {}
                    };
                }

                if (!usersMap[userId].items[itemKey]) {
                    usersMap[userId].items[itemKey] = {
                        totalReceived: 0,
                        totalUsed: 0,
                        itemName: itemName,
                        variantName: variantName || "",
                        unit: unit || 'pcs'
                    };
                }

                const transferQuantityInBase = convertUnit(quantity, unit, getUnitCategory(unit) ? unitConversionRates[getUnitCategory(unit)].base : unit);

                if (type === "inward") {
                    usersMap[userId].items[itemKey].totalReceived += transferQuantityInBase;
                } else if (type === "outward") {
                    usersMap[userId].items[itemKey].totalUsed += transferQuantityInBase;
                }
            });

            const finalUsersWithItems = {};
            for (const userId in usersMap) {
                const userItems = usersMap[userId].items;
                const userSummary = [];
                for (const itemKey in userItems) {
                    const item = userItems[itemKey];
                    const currentStock = item.totalReceived - item.totalUsed;
                    userSummary.push({
                        itemName: item.itemName,
                        variantName: item.variantName,
                        currentStock: parseFloat(currentStock.toFixed(3)),
                        totalReceived: parseFloat(item.totalReceived.toFixed(3)),
                        totalUsed: parseFloat(item.totalUsed.toFixed(3)),
                        unit: item.unit
                    });
                }
                finalUsersWithItems[userId] = {
                    name: usersMap[userId].name,
                    items: userSummary
                };
            }
            setUsersWithItems(finalUsersWithItems);

        } catch (err) {
            console.error("Error fetching inventory data:", err);
            setError("Failed to load inventory data for this site.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSites();
    }, [fetchSites]);

    useEffect(() => {
        if (selectedSite) {
            fetchInventoryData(selectedSite.value);
        } else {
            setUsersWithItems({});
        }
    }, [selectedSite, fetchInventoryData]);

    // Redirekt karne ke liye naya function
    const handleExportRedirect = () => {
        navigate('/all-sites-export');
    };

    if (isLoading && allSites.length === 0) {
        return (
            <div className={styles.pageContainer}>
                <p className={styles.loadingMessage}>Loading sites...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className={styles.pageContainer}>
                <p className={styles.errorMessage}>{error}</p>
            </div>
        );
    }

    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.sectionTitle}>Site Inventory</h1>
            
            <div className={styles.siteSelectContainer}>
                <label htmlFor="site-select" className={styles.siteSelectLabel}>Select a Site:</label>
                <Select
                    id="site-select"
                    options={allSites}
                    value={selectedSite}
                    onChange={setSelectedSite}
                    classNamePrefix="react-select-site"
                    placeholder="Choose a Site"
                    isClearable
                    isDisabled={isLoading}
                />
            </div>
            
            <hr className={styles.divider} />

            {selectedSite && !isLoading && (
                <>
                    <section className={styles.cardContainer}>
                        <h2 className={styles.subSectionTitle}>Items added by Users at {selectedSite.label}</h2>
                        {Object.keys(usersWithItems).length > 0 ? (
                            <ul className={styles.userList}>
                                {Object.keys(usersWithItems).map(userId => (
                                    <li key={userId} className={styles.userCard}>
                                        <div className={styles.userCardHeader}>
                                            <span className={styles.userName}>{usersWithItems[userId].name}</span>
                                        </div>
                                        <ul className={styles.itemsAddedList}>
                                            {usersWithItems[userId].items.map((item, index) => (
                                                <li key={index} className={styles.itemRow}>
                                                    <span>{`${item.itemName}${item.variantName && ` - ${item.variantName}`}`}</span>
                                                    <span className={styles.stockInfo}>
                                                        <span className={`${styles.stockValue} ${item.currentStock < 0 ? styles.negative : ''}`}>
                                                            {item.currentStock} {item.unit}
                                                        </span>
                                                        <span className={styles.inwardOutward}>
                                                             (In: {item.totalReceived}, Out: {item.totalUsed})
                                                        </span>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className={styles.noDataMessage}>No items found for this site.</p>
                        )}
                    </section>
                    
                    <hr className={styles.divider} />
                </>
            )}

            {/* Export button yahan joda gaya hai */}
            <div className={styles.exportButtonContainer}>
                <Button
                    variant="contained"
                    onClick={handleExportRedirect}
                    startIcon={<FilePresentIcon />}
                    className={styles.exportButton}
                    disabled={isLoading}
                >
                    Go to All Sites Export Page
                </Button>
            </div>
        </div>
    );
};

export default SiteInventoryPage;