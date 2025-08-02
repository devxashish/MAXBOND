import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import {
    collection,
    addDoc,
    query,
    getDocs,
    orderBy,
    serverTimestamp,
    where,
    doc,
    updateDoc,
    deleteDoc,
    arrayUnion,
    arrayRemove,
    Timestamp,
    getDoc,
    writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from '../components/Toast';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './FuelEntryPage.css';
import { format } from 'date-fns';

import * as XLSX from "xlsx-js-style";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// --- SearchableDropdown Component (No changes, assuming it's correct) ---
const SearchableDropdown = ({ value, options, onChange, placeholder, disabled, id }) => {
    const [inputValue, setInputValue] = useState(value);
    const [filteredOptions, setFilteredOptions] = useState([]);
    const [showOptions, setShowOptions] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowOptions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        const lowerCaseNewValue = newValue.toLowerCase();

        const filtered = options.filter(
            (option) => typeof option === 'string' && option.toLowerCase().includes(lowerCaseNewValue)
        );
        setFilteredOptions(filtered);
        setShowOptions(true);
    };

    const handleOptionClick = (option) => {
        setInputValue(option);
        onChange(option);
        setShowOptions(false);
    };

    const handleFocus = () => {
        setFilteredOptions(options);
        setShowOptions(true);
    };

    const handleInputBlur = () => {
        setTimeout(() => setShowOptions(false), 100);
    };

    return (
        <div className="searchable-dropdown-wrapper" ref={wrapperRef}>
            <input
                type="text"
                id={id}
                className="input-field select-field"
                placeholder={placeholder}
                value={inputValue}
                onChange={handleInputChange}
                onFocus={handleFocus}
                onBlur={handleInputBlur}
                disabled={disabled}
                autoComplete="off"
            />
            {showOptions && filteredOptions.length > 0 && (
                <ul className="searchable-dropdown-options">
                    {filteredOptions.map((option, index) => (
                        <li
                            key={index}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleOptionClick(option)}
                            className="searchable-dropdown-option-item"
                        >
                            {option}
                        </li>
                    ))}
                </ul>
            )}
            {showOptions && filteredOptions.length === 0 && inputValue && (
                <p className="no-matches-message">No matching options found.</p>
            )}
            {inputValue && !disabled && (
                <button
                    className="clear-search-button"
                    onClick={() => {
                        setInputValue("");
                        onChange("");
                        setFilteredOptions(options);
                        setShowOptions(false);
                    }}
                >
                    ✕
                </button>
            )}
        </div>
    );
};
// --- End SearchableDropdown ---


const FuelEntryPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [currentTheme, setCurrentTheme] = useState(() => {
        const savedTheme = localStorage.getItem('appTheme');
        return savedTheme || 'light-theme';
    });
    const [showThemeListModal, setShowThemeListModal] = useState(false);

    const availableThemes = [
        { key: "light-theme", name: "Light", icon: "fa-sun" },
        { key: "dark-theme", name: "Dark", icon: "fa-moon" },
        { key: "ios-theme", name: "iOS", icon: "fa-mobile-alt" },
        { key: "pink-gradient-theme", name: "Pink Gradient", icon: "fa-heart" },
        { key: "emerald-zen-theme", name: "Emerald Zen", icon: "fa-leaf" },
        { key: "ocean-breeze-theme", name: "Ocean Breeze", icon: "fa-water" },
        { key: "sunset-glow-theme", name: "Sunset Glow", icon: "fa-fire" },
        { key: "rgb-theme", name: "RGB Flow", icon: "fa-rainbow" },
        { key: "forest-glow-theme", name: "Forest Glow", icon: "fa-tree" },
        { key: "mountain-mist-theme", name: "Mountain Mist", icon: "fa-cloud-meatball" },
        { key: "desert-oasis-theme", name: "Desert Oasis", icon: "fa-cactus" },
        { key: "aurora-borealis-theme", name: "Aurora Borealis", icon: "fa-star" },
        { key: "tropical-rainforest-theme", name: "Tropical Rainforest", icon: "fa-cloud-showers-heavy" },
        { key: "deep-ocean-theme", name: "Deep Ocean", icon: "fa-water" },
        { key: "volcanic-lava-theme", name: "Volcanic Lava", icon: "fa-fire-alt" },
        { key: "starlight-night-theme", name: "Starlight Night", icon: "fa-moon" },
        { key: "golden-harvest-theme", name: "Golden Harvest", icon: "fa-wheat-alt" },
        { key: "arctic-bliss-theme", name: "Arctic Bliss", icon: "fa-snowflake" },
        { key: "autumn-leaves-theme", name: "Autumn Leaves", icon: "fa-leaf" },
        { key: "spring-blossom-theme", name: "Spring Blossom", icon: "fa-flower" },
        { key: "summer-sunset-theme", name: "Summer Sunset", icon: "fa-sun" },
        { key: "winter-wonderland-theme", name: "Winter Wonderland", icon: "fa-snowflake" },
        { key: "tropical-night-theme", name: "Tropical Night", icon: "fa-moon" },
        { key: "lavender-field-theme", name: "Lavender Field", icon: "fa-spa" },
        { key: "green-meadow-theme", name: "Green Meadow", icon: "fa-tree" },
        { key: "cosmic-dust-theme", name: "Cosmic Dust", icon: "fa-galaxy" },
    ];

    const selectTheme = (themeKey) => {
        setCurrentTheme(themeKey);
        localStorage.setItem('appTheme', themeKey);
        setShowThemeListModal(false);
    };

    const [activeTab, setActiveTab] = useState('entry');

    // --- State for "Entry" Tab Form ---
    const [entryDate, setEntryDate] = useState(new Date());
    const [selectedVehicleName, setSelectedVehicleName] = useState('');
    const [selectedVehicleVariant, setSelectedVehicleVariant] = useState('');
    const [selectedVehicleNumber, setSelectedVehicleNumber] = useState('');
    const [fuelQuantity, setFuelQuantity] = useState('');
    const [fuelType, setFuelType] = useState('');
    const [unit, setUnit] = useState('Liters');
    const [selectedSiteForEntry, setSelectedSiteForEntry] = useState(''); // Site for Fuel Entry

    // --- States for "Vehicles" Tab Forms ---
    const [addVehicleName, setAddVehicleName] = useState('');
    const [addVehicleVariant, setAddVehicleVariant] = useState('');
    const [addVehicleNumber, setAddVehicleNumber] = useState('');
    const [selectedSiteForVehicleAdd, setSelectedSiteForVehicleAdd] = useState(''); // Site for adding/managing vehicles

    const [bulkVehicleNamesInput, setBulkVehicleNamesInput] = useState('');
    const [selectedVehicleForVariantAdd, setSelectedVehicleForVariantAdd] = useState(''); // Vehicle ID
    const [bulkVariantNamesInput, setBulkVariantNamesInput] = useState('');

    const [selectedVariantForNumbers, setSelectedVariantForNumbers] = useState(''); // Variant ID
    const [bulkVehicleNumbersInput, setBulkVehicleNumbersInput] = useState('');

    // --- Common States for Firebase Operations ---
    const [loadingOperation, setLoadingOperation] = useState(false);
    const [error, setError] = useState(null);

    // --- States for Vehicle Data Management ---
    // allVehiclesData will now contain vehicles structured with their siteName
    const [allVehiclesData, setAllVehiclesData] = useState([]);
    // Helper states for filtered options based on selected site in Entry tab
    const [filteredVehicleNamesBySite, setFilteredVehicleNamesBySite] = useState([]);
    const [filteredVariantsForSelectedVehicleBySite, setFilteredVariantsForSelectedVehicleBySite] = useState([]);
    const [filteredNumbersForSelectedVehicleBySite, setFilteredNumbersForSelectedVehicleBySite] = useState([]);


    const [loadingVehiclesData, setLoadingVehiclesData] = useState(true);
    const [userId, setUserId] = useState("");
    const [userName, setUserName] = useState(""); // This is used for "Submitter Name" now
    const [userLinkedSites, setUserLinkedSites] = useState([]); // Sites linked to the current user's profile

    // For editing existing vehicles/numbers/variants
    const [editingVehicleName, setEditingVehicleName] = useState(null);
    const [editingVariant, setEditingVariant] = useState(null);
    const [editingVehicleNumber, setEditingVehicleNumber] = useState(null);

    // --- States for View Fuel Entries Tab ---
    const [fuelEntries, setFuelEntries] = useState([]);
    const [loadingFuelEntries, setLoadingFuelEntries] = useState(true);
    const [selectedFuelEntryDetail, setSelectedFuelEntryDetail] = useState(null);
    const [editingFuelEntry, setEditingFuelEntry] = useState(null);

    // viewMode for Fuel Entries tab: 'initial', 'list', 'details', 'edit'
    const [viewMode, setViewMode] = useState('initial');

    // --- State for Export Filters (within 'View' tab) ---
    const [exportStartDate, setExportStartDate] = useState(null);
    const [exportEndDate, setExportEndDate] = useState(null);
    const [exportSelectedSite, setExportSelectedSite] = useState('');


    // --- Auth state listener and initial data fetch ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setUserName(user.displayName || user.email || "Unknown User");
                const sites = await fetchUserLinkedSites(user.uid); // Ensure fetchUserLinkedSites returns the sites
                // Pass the fetched sites to fetchAllVehicles
                if (sites && sites.length > 0) {
                    await fetchAllVehicles(sites); // Pass linked sites here
                } else {
                    setLoadingVehiclesData(false); // If no sites, no vehicles to load
                    setAllVehiclesData([]);
                }
            } else {
                setUserId("");
                setUserName("");
                navigate("/login");
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    // --- Fetch User Linked Sites from Profile ---
    // Modified to return the sites array
    const fetchUserLinkedSites = async (uid) => {
        try {
            const profileRef = doc(db, 'profiles', uid);
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
                const sites = profileSnap.data().linkedSites || [];
                setUserLinkedSites(sites);
                // Set a default site if available for entry and vehicle management
                if (sites.length > 0) {
                    setSelectedSiteForEntry(sites[0]);
                    setSelectedSiteForVehicleAdd(sites[0]);
                    setExportSelectedSite(sites[0]);
                }
                return sites; // Return sites for immediate use by fetchAllVehicles
            } else {
                setUserLinkedSites([]);
                showToast('info', 'No sites linked to your profile. Please contact admin to link sites.');
                return [];
            }
        } catch (err) {
            console.error("Error fetching user linked sites:", err);
            showToast('error', 'Failed to load user sites.');
            return [];
        }
    };


    // --- Fetch All Vehicle Data from Firestore (updated to filter by user's linked sites) ---
    // This now fetches ONLY vehicles that the current user is authorized to see.
    const fetchAllVehicles = async (linkedSites) => { // Accept linkedSites as argument
        if (!linkedSites || linkedSites.length === 0) {
            setAllVehiclesData([]);
            setLoadingVehiclesData(false);
            return;
        }

        setLoadingVehiclesData(true);
        setError(null);
        try {
            // Firestore 'in' query supports up to 10 items. If more, you'll need multiple queries.
            // For simplicity, assuming less than or equal to 10 linked sites.
            // If you have more than 10 linked sites, you'll need to split this into multiple queries
            // and combine the results.
            const vehicleQuery = query(
                collection(db, 'vehicles'),
                where('siteName', 'in', linkedSites), // Filter by linked sites
                orderBy('siteName'), // Order by siteName first for better grouping
                orderBy('vehicleName')
            );
            const vehicleSnapshot = await getDocs(vehicleQuery);

            const fetchedVehicles = await Promise.all(
                vehicleSnapshot.docs.map(async (vehicleDoc) => {
                    const vehicleData = {
                        id: vehicleDoc.id,
                        // Ensure siteName is present from Firestore data
                        siteName: vehicleDoc.data().siteName,
                        ...vehicleDoc.data(),
                        variants: []
                    };

                    // Fetch variants for this vehicle.
                    // The security rules for variants ensure that if the parent vehicle's siteName
                    // is accessible, then its variants are also accessible.
                    const variantQuery = query(collection(db, 'vehicleVariants'), where('vehicleId', '==', vehicleDoc.id), orderBy('variantName'));
                    const variantSnapshot = await getDocs(variantQuery);

                    vehicleData.variants = variantSnapshot.docs.map(variantDoc => ({
                        id: variantDoc.id,
                        ...variantDoc.data(),
                        numbers: variantDoc.data().numbers || []
                    }));

                    return vehicleData;
                })
            );
            setAllVehiclesData(fetchedVehicles);
        } catch (err) {
            console.error("Error fetching vehicles:", err);
            setError("Failed to load vehicle data. Please ensure you have linked sites and correct Firestore rules.");
            showToast('error', 'Failed to load vehicle data.');
        } finally {
            setLoadingVehiclesData(false);
        }
    };

    // --- Fetch Fuel Entries based on user and site filters ---
    const fetchFuelEntries = async (filters = {}) => {
        setLoadingFuelEntries(true);
        setError(null);
        try {
            let qRef = collection(db, 'fuelEntries');
            let constraints = [where('userId', '==', userId)]; // Filter by current user's entries

            if (filters.startDate) {
                constraints.push(where('date', '>=', filters.startDate));
            }
            if (filters.endDate) {
                const endOfDay = new Date(filters.endDate);
                endOfDay.setHours(23, 59, 59, 999);
                constraints.push(where('date', '<=', endOfDay));
            }

            // Apply site filtering: if a specific site is chosen AND the user has access to it.
            // OR if no specific site is chosen, apply 'in' filter for all user's linked sites.
            if (filters.siteName) {
                if (!userLinkedSites.includes(filters.siteName)) {
                    showToast('error', 'You do not have access to entries for this site.');
                    setFuelEntries([]);
                    setLoadingFuelEntries(false);
                    return;
                }
                constraints.push(where('siteName', '==', filters.siteName));
            } else if (userLinkedSites.length > 0) {
                 // Use 'in' query if multiple sites are linked and no specific site filter is applied
                 // Important: Firestore 'in' query has a limit of 10 items.
                 // If userLinkedSites can exceed 10, you'll need to break this into multiple queries.
                 if (userLinkedSites.length <= 10) {
                    constraints.push(where('siteName', 'in', userLinkedSites));
                 } else {
                    // Handle more than 10 linked sites: fetch individually or warn
                    // For now, let's just warn and show no data to avoid query failure
                    showToast('info', 'Too many linked sites to display all entries at once. Please filter by a specific site.');
                    setFuelEntries([]);
                    setLoadingFuelEntries(false);
                    return;
                 }
            } else {
                // No linked sites, so no entries to show for this user.
                setFuelEntries([]);
                setLoadingFuelEntries(false);
                return;
            }

            const finalQuery = query(qRef, ...constraints, orderBy('date', 'desc'));
            const querySnapshot = await getDocs(finalQuery);

            const fetchedEntries = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date instanceof Timestamp ? doc.data().date.toDate() : new Date()
            }));
            setFuelEntries(fetchedEntries);
        } catch (err) {
            console.error("Error fetching fuel entries:", err);
            setError("Failed to load fuel entries.");
            showToast('error', 'Failed to load fuel entries.');
        } finally {
            setLoadingFuelEntries(false);
        }
    };

    useEffect(() => {
        // Trigger fetch fuel entries when view tab is active or filters change
        // Ensure userId and userLinkedSites are populated before fetching
        if (activeTab === 'view' && viewMode === 'list' && userId && userLinkedSites.length > 0) {
            fetchFuelEntries({
                startDate: exportStartDate,
                endDate: exportEndDate,
                siteName: exportSelectedSite,
            });
        } else if (activeTab === 'view' && viewMode === 'list' && userId && userLinkedSites.length === 0) {
             // If user is logged in but has no linked sites, explicitly show no data
            setFuelEntries([]);
            setLoadingFuelEntries(false);
        }
    }, [activeTab, viewMode, userId, exportStartDate, exportEndDate, exportSelectedSite, userLinkedSites]);


    // --- Dynamic filtering for Vehicle Entry Tab dropdowns ---
    useEffect(() => {
        // Update filteredVehicleNames when allVehiclesData or selectedSiteForEntry changes
        if (selectedSiteForEntry) {
            const vehiclesForSite = allVehiclesData.filter(v => v.siteName === selectedSiteForEntry);
            // Ensure unique vehicle names, as multiple vehicles might have same name but different IDs
            const uniqueVehicleNames = [...new Set(vehiclesForSite.map(v => v.vehicleName))];
            setFilteredVehicleNamesBySite(uniqueVehicleNames);
        } else {
            setFilteredVehicleNamesBySite([]);
        }
        // Reset dependent dropdowns if site changes
        setSelectedVehicleName('');
        setSelectedVehicleVariant('');
        setSelectedVehicleNumber('');
    }, [selectedSiteForEntry, allVehiclesData]);


    const handleVehicleNameChange = (selectedName) => {
        setSelectedVehicleName(selectedName);
        setSelectedVehicleVariant(''); // Reset variant when vehicle name changes
        setSelectedVehicleNumber(''); // Reset number when vehicle name changes

        // Find vehicles matching selected name and selected site
        const selectedVehicle = allVehiclesData.find(
            v => v.vehicleName === selectedName && v.siteName === selectedSiteForEntry
        );
        setFilteredVariantsForSelectedVehicleBySite(selectedVehicle?.variants.map(v => v.variantName) || []);
        setFilteredNumbersForSelectedVehicleBySite([]);
    };

    const handleVehicleVariantChange = (selectedVariant) => {
        setSelectedVehicleVariant(selectedVariant);
        setSelectedVehicleNumber(''); // Reset number when variant changes

        // Find variants matching selected vehicle name, variant name and selected site
        const selectedVehicle = allVehiclesData.find(
            v => v.vehicleName === selectedVehicleName && v.siteName === selectedSiteForEntry
        );
        const selectedVariantData = selectedVehicle?.variants.find(v => v.variantName === selectedVariant);
        setFilteredNumbersForSelectedVehicleBySite(selectedVariantData?.numbers || []);
    };

    const handleVehicleNumberChange = (selectedNumber) => {
        setSelectedVehicleNumber(selectedNumber);
    };

    // Helper to get vehicle names for searchable dropdowns (for selected site in Entry tab)
    const getVehicleNameOptionsBySite = () => {
        return filteredVehicleNamesBySite;
    };

    // Helper to get variant names for searchable dropdowns (for selected vehicle and site in Entry tab)
    const getVariantNameOptionsForVehicleBySite = () => {
        return filteredVariantsForSelectedVehicleBySite;
    };

    // Helper to get numbers for searchable dropdowns (for selected variant and site in Entry tab)
    const getNumberOptionsForVariantBySite = () => {
        return filteredNumbersForSelectedVehicleBySite;
    };


    // --- Form Submission Handlers (Fuel Entry) ---
    const handleAddFuelEntry = async (e) => {
        e.preventDefault();
        setLoadingOperation(true);
        setError(null);

        if (!entryDate || !selectedVehicleName || !selectedVehicleVariant || !selectedVehicleNumber || !fuelType || !unit || !fuelQuantity || !selectedSiteForEntry) {
            setError('All entry fields (including Site) are required.');
            showToast('error', 'All entry fields are required.');
            setLoadingOperation(false);
            return;
        }

        // Validate selected site against user's linked sites
        if (!userLinkedSites.includes(selectedSiteForEntry)) {
            setError('Selected Site is not linked to your profile. Please select a valid site.');
            showToast('error', 'Selected Site not linked to profile.');
            setLoadingOperation(false);
            return;
        }

        // Validate vehicle/variant/number against the selected site's data from `allVehiclesData`
        const selectedVehicle = allVehiclesData.find(
            v => v.vehicleName === selectedVehicleName && v.siteName === selectedSiteForEntry
        );
        if (!selectedVehicle) {
            setError('Selected Vehicle Name is not valid for the chosen site. Please choose from suggestions or add it first.');
            showToast('error', 'Selected Vehicle Name is not valid for site.');
            setLoadingOperation(false);
            return;
        }

        const variantData = selectedVehicle.variants.find(v => v.variantName === selectedVehicleVariant);
        if (!variantData) {
            setError('Selected Vehicle Variant is not valid for this vehicle/site. Please choose from suggestions or add it first.');
            showToast('error', 'Selected Vehicle Variant is not valid.');
            setLoadingOperation(false);
            return;
        }

        const numberExists = variantData.numbers.includes(selectedVehicleNumber);
        if (!numberExists) {
            setError(`Selected Vehicle Number '${selectedVehicleNumber}' is not valid for '${selectedVehicleVariant}' at this site. Please choose from suggestions or add it first.`);
            showToast('error', `Selected Vehicle Number '${selectedVehicleNumber}' is not valid.`);
            setLoadingOperation(false);
            return;
        }


        try {
            await addDoc(collection(db, 'fuelEntries'), {
                userId: userId, // Store the user ID with the entry for user-specific data
                date: entryDate,
                vehicleName: selectedVehicleName,
                vehicleVariant: selectedVehicleVariant,
                vehicleNumber: selectedVehicleNumber,
                fuelType: fuelType,
                unit: unit,
                fuelQuantity: parseFloat(fuelQuantity),
                siteName: selectedSiteForEntry,
                timestamp: serverTimestamp()
            });

            showToast('success', 'Fuel entry saved successfully!', null, 3000);
            setEntryDate(new Date());
            setSelectedVehicleName('');
            setSelectedVehicleVariant('');
            setSelectedVehicleNumber('');
            setFuelQuantity('');
            setFuelType('');
            setUnit('Liters');
            // Keep selectedSiteForEntry as it was, assuming user might enter more for same site
            // setSelectedSiteForEntry('');
        } catch (e) {
            console.error("Error adding fuel entry: ", e);
            showToast('error', 'Failed to save fuel entry. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    // --- Fuel Entry Edit/Delete Handlers (for 'view' tab) ---

    const handleInitialReviewClick = () => {
        setViewMode('list');
    };

    const handleViewFuelEntryDetails = (entry) => {
        setSelectedFuelEntryDetail(entry);
        setViewMode('details');
    };

    const handleEditFuelEntry = (entry) => {
        setEditingFuelEntry({
            ...entry,
            date: entry.date instanceof Timestamp ? entry.date.toDate() : entry.date
        });
        setViewMode('edit');
    };

    const handleUpdateFuelEntry = async (e) => {
        e.preventDefault();
        setLoadingOperation(true);
        setError(null);

        if (!editingFuelEntry.date || !editingFuelEntry.vehicleName || !editingFuelEntry.vehicleVariant || !editingFuelEntry.vehicleNumber || !editingFuelEntry.fuelType || !editingFuelEntry.unit || !editingFuelEntry.fuelQuantity || !editingFuelEntry.siteName) {
            setError('All fields are required for update.');
            showToast('error', 'All fields are required for update.');
            setLoadingOperation(false);
            return;
        }

        // Security check: Ensure the user is allowed to edit this entry (their own) and its site
        if (editingFuelEntry.userId !== userId || !userLinkedSites.includes(editingFuelEntry.siteName)) {
            setError('You do not have permission to update this entry or its site.');
            showToast('error', 'Permission denied.');
            setLoadingOperation(false);
            return;
        }

        // Re-validate vehicle/variant/number for the selected site
        const selectedVehicle = allVehiclesData.find(
            v => v.vehicleName === editingFuelEntry.vehicleName && v.siteName === editingFuelEntry.siteName
        );
        if (!selectedVehicle) {
            setError('Selected Vehicle Name is not valid for the chosen site. Please choose from suggestions or add it first.');
            showToast('error', 'Selected Vehicle Name is not valid for site.');
            setLoadingOperation(false);
            return;
        }

        const variantData = selectedVehicle.variants.find(v => v.variantName === editingFuelEntry.vehicleVariant);
        if (!variantData) {
            setError('Selected Vehicle Variant is not valid for this vehicle/site. Please choose from suggestions or add it first.');
            showToast('error', 'Selected Vehicle Variant is not valid.');
            setLoadingOperation(false);
            return;
        }

        const numberExists = variantData.numbers.includes(editingFuelEntry.vehicleNumber);
        if (!numberExists) {
            setError(`Selected Vehicle Number '${editingFuelEntry.vehicleNumber}' is not valid for '${editingFuelEntry.vehicleVariant}' at this site. Please choose from suggestions or add it first.`);
            showToast('error', `Selected Vehicle Number '${editingFuelEntry.vehicleNumber}' is not valid.`);
            setLoadingOperation(false);
            return;
        }


        try {
            const entryRef = doc(db, 'fuelEntries', editingFuelEntry.id);
            await updateDoc(entryRef, {
                date: editingFuelEntry.date,
                vehicleName: editingFuelEntry.vehicleName,
                vehicleVariant: editingFuelEntry.vehicleVariant,
                vehicleNumber: editingFuelEntry.vehicleNumber,
                fuelType: editingFuelEntry.fuelType,
                unit: editingFuelEntry.unit,
                fuelQuantity: parseFloat(editingFuelEntry.fuelQuantity),
                siteName: editingFuelEntry.siteName,
            });
            showToast('success', 'Fuel entry updated successfully!', null, 3000);
            setEditingFuelEntry(null);
            setSelectedFuelEntryDetail(null);
            setViewMode('list');
            await fetchFuelEntries({ // Refresh list with current simplified filters
                startDate: exportStartDate,
                endDate: exportEndDate,
                siteName: exportSelectedSite,
            });
        } catch (err) {
            console.error("Error updating fuel entry:", err);
            showToast('error', 'Failed to update fuel entry. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    const handleDeleteFuelEntry = async (entryId, entryInfo) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete this fuel entry: ${entryInfo}? This cannot be undone.`);
        if (!confirmDelete) {
            return;
        }
        setLoadingOperation(true);
        setError(null);
        try {
            const entryRef = doc(db, 'fuelEntries', entryId);
            // Before deleting, verify this entry belongs to the current user (security)
            const entrySnap = await getDoc(entryRef);
            if (!entrySnap.exists() || entrySnap.data().userId !== userId) {
                showToast('error', 'You do not have permission to delete this entry.');
                setLoadingOperation(false);
                return;
            }
            if (!userLinkedSites.includes(entrySnap.data().siteName)) {
                 showToast('error', 'You do not have permission to delete entries from this site.');
                 setLoadingOperation(false);
                 return;
            }

            await deleteDoc(entryRef);
            showToast('success', 'Fuel entry deleted successfully!', null, 3000);
            setSelectedFuelEntryDetail(null);
            setViewMode('list');
            await fetchFuelEntries({ // Refresh list with current simplified filters
                startDate: exportStartDate,
                endDate: exportEndDate,
                siteName: exportSelectedSite,
            });
        } catch (err) {
            console.error("Error deleting fuel entry:", err);
            showToast('error', 'Failed to delete fuel entry. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };


    // --- Vehicle Management Handlers (Now site-specific) ---

    const handleAddSingleVehicle = async (e) => {
        e.preventDefault();
        setLoadingOperation(true);
        setError(null);

        if (!addVehicleName.trim() || !addVehicleVariant.trim() || !addVehicleNumber.trim() || !selectedSiteForVehicleAdd) {
            setError('All fields (Vehicle Name, Variant, Number, and Site) are required.');
            showToast('error', 'All fields are required.');
            setLoadingOperation(false);
            return;
        }

        // Validate selected site for vehicle add against user's linked sites
        if (!userLinkedSites.includes(selectedSiteForVehicleAdd)) {
            setError('Selected Site for vehicle is not linked to your profile. Please select a valid site.');
            showToast('error', 'Selected Site not linked to profile.');
            setLoadingOperation(false);
            return;
        }

        try {
            let vehicleDocId = null;
            let variantDocId = null;
            let isNewVehicle = false;
            let isNewVariant = false;

            const vehiclesCollectionRef = collection(db, 'vehicles');
            const variantsCollectionRef = collection(db, 'vehicleVariants');

            // Check if vehicle exists for this specific site
            const vehicleQuery = query(vehiclesCollectionRef,
                where('vehicleName', '==', addVehicleName.trim()),
                where('siteName', '==', selectedSiteForVehicleAdd) // Filter by site
            );
            const vehicleSnapshot = await getDocs(vehicleQuery);

            if (!vehicleSnapshot.empty) {
                vehicleDocId = vehicleSnapshot.docs[0].id;
            } else {
                const newVehicleRef = await addDoc(vehiclesCollectionRef, {
                    vehicleName: addVehicleName.trim(),
                    siteName: selectedSiteForVehicleAdd, // Store siteName with the vehicle
                    createdAt: serverTimestamp()
                });
                vehicleDocId = newVehicleRef.id;
                isNewVehicle = true;
            }

            // Check if variant exists for this specific vehicle and site
            const variantQuery = query(variantsCollectionRef,
                where('vehicleId', '==', vehicleDocId),
                where('variantName', '==', addVehicleVariant.trim())
            );
            const variantSnapshot = await getDocs(variantQuery);

            if (!variantSnapshot.empty) {
                variantDocId = variantSnapshot.docs[0].id;
                const existingNumbers = variantSnapshot.docs[0].data().numbers || [];
                if (existingNumbers.includes(addVehicleNumber.trim())) {
                    setError('This vehicle number already exists for this variant and site.');
                    showToast('error', 'This vehicle number already exists.');
                    setLoadingOperation(false);
                    return;
                }
                await updateDoc(doc(db, 'vehicleVariants', variantDocId), {
                    numbers: arrayUnion(addVehicleNumber.trim())
                });
            } else {
                const newVariantRef = await addDoc(variantsCollectionRef, {
                    vehicleId: vehicleDocId,
                    variantName: addVehicleVariant.trim(),
                    numbers: [addVehicleNumber.trim()],
                    createdAt: serverTimestamp()
                });
                variantDocId = newVariantRef.id;
                isNewVariant = true;
            }

            let message = '';
            if (isNewVehicle && isNewVariant) {
                message = `New Vehicle "${addVehicleName.trim()}" (Site: ${selectedSiteForVehicleAdd}) with Variant "${addVehicleVariant.trim()}" and Number "${addVehicleNumber.trim()}" added.`;
            } else if (!isNewVehicle && isNewVariant) {
                message = `New Variant "${addVehicleVariant.trim()}" and Number "${addVehicleNumber.trim()}" added to existing Vehicle "${addVehicleName.trim()}" (Site: ${selectedSiteForVehicleAdd}).`;
            } else {
                message = `New Number "${addVehicleNumber.trim()}" added to existing Vehicle "${addVehicleName.trim()}" Variant "${addVehicleVariant.trim()}" (Site: ${selectedSiteForVehicleAdd}).`;
            }

            showToast('success', message, null, 4000);
            setAddVehicleName('');
            setAddVehicleVariant('');
            setAddVehicleNumber('');
            // After adding, re-fetch all vehicles but ensure they are filtered by current linked sites
            // No need to pass sites here as fetchAllVehicles will use the updated userLinkedSites state
            await fetchAllVehicles(userLinkedSites);
        } catch (e) {
            console.error("Error adding vehicle/variant/number: ", e);
            showToast('error', 'Failed to add vehicle data. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    const handleBulkAddVehicleNames = async () => {
        if (!selectedSiteForVehicleAdd) {
            setError("Please select a site to add vehicle names for.");
            showToast('error', 'Select site for vehicle names.');
            return;
        }
        // Validate selected site for vehicle add against user's linked sites
        if (!userLinkedSites.includes(selectedSiteForVehicleAdd)) {
            setError('Selected Site for vehicle is not linked to your profile.');
            showToast('error', 'Selected Site not linked to profile.');
            return;
        }

        const names = bulkVehicleNamesInput
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean);

        if (names.length === 0) {
            setError("Please enter vehicle names (comma-separated).");
            showToast('error', 'Please enter vehicle names.');
            return;
        }

        setLoadingOperation(true);
        setError(null);
        try {
            const batch = writeBatch(db);
            // Get existing vehicle names for the selected site
            const existingVehiclesForSite = allVehiclesData.filter(v => v.siteName === selectedSiteForVehicleAdd);
            const existingVehicleNamesSet = new Set(existingVehiclesForSite.map(v => v.vehicleName.toLowerCase()));

            for (const name of names) {
                const trimmedName = name.trim();
                if (trimmedName && !existingVehicleNamesSet.has(trimmedName.toLowerCase())) {
                    batch.set(doc(collection(db, "vehicles")), {
                        vehicleName: trimmedName,
                        siteName: selectedSiteForVehicleAdd, // Associate with site
                        createdAt: serverTimestamp(),
                    });
                    existingVehicleNamesSet.add(trimmedName.toLowerCase());
                } else if (trimmedName) {
                    console.warn(`Vehicle name "${trimmedName}" already exists for site "${selectedSiteForVehicleAdd}". Skipping.`);
                }
            }
            await batch.commit();
            setBulkVehicleNamesInput("");
            await fetchAllVehicles(userLinkedSites); // Refresh all vehicles data
            showToast('success', `Vehicle Names added to ${selectedSiteForVehicleAdd} Successfully!`, null, 3000);
        } catch (err) {
            console.error("Error bulk adding vehicle names:", err);
            showToast('error', 'Failed to bulk add vehicle names. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    const handleBulkAddVariantsToExistingVehicle = async () => {
        // We need to know which site the selected vehicle belongs to
        const selectedVehicleData = allVehiclesData.find(v => v.id === selectedVehicleForVariantAdd);

        if (!selectedVehicleData) {
            setError("Please select a vehicle first.");
            showToast('error', 'Please select a vehicle first.');
            return;
        }
        // Validate selected site for vehicle add against user's linked sites
        if (!userLinkedSites.includes(selectedVehicleData.siteName)) {
            setError('The selected vehicle belongs to a site not linked to your profile.');
            showToast('error', 'Vehicle site not linked to profile.');
            return;
        }

        const variantNames = bulkVariantNamesInput
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean);

        if (variantNames.length === 0) {
            setError("Please enter variant names (comma-separated).");
            showToast('error', 'Please enter variant names.');
            return;
        }

        setLoadingOperation(true);
        setError(null);
        try {
            const batch = writeBatch(db);
            const existingVariantNames = new Set(selectedVehicleData.variants.map(v => v.variantName.toLowerCase()));

            for (const variantName of variantNames) {
                const trimmedVariantName = variantName.trim();
                if (trimmedVariantName && !existingVariantNames.has(trimmedVariantName.toLowerCase())) {
                    batch.set(doc(collection(db, "vehicleVariants")), {
                        vehicleId: selectedVehicleForVariantAdd,
                        variantName: trimmedVariantName,
                        numbers: [],
                        createdAt: serverTimestamp(),
                    });
                    existingVariantNames.add(trimmedVariantName.toLowerCase());
                } else if (trimmedVariantName) {
                    console.warn(`Variant "${trimmedVariantName}" already exists for this vehicle. Skipping.`);
                }
            }
            await batch.commit();
            setBulkVariantNamesInput("");
            setSelectedVehicleForVariantAdd("");
            await fetchAllVehicles(userLinkedSites); // Refresh all vehicles data
            showToast('success', `Variants Added to ${selectedVehicleData.vehicleName} (Site: ${selectedVehicleData.siteName}) Successfully!`, null, 3000);
        } catch (err) {
            console.error("Error bulk adding variants:", err);
            showToast('error', 'Failed to bulk add variants. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    const handleBulkAddNumbersToExistingVariant = async () => {
        // We need to find the variant and its associated vehicle/site
        let vehicleIdForVariant = null;
        let selectedVariantData = null;
        let vehicleNameForVariant = '';
        let siteNameForVariant = '';

        for (const vehicle of allVehiclesData) {
            const variantFound = vehicle.variants.find(varr => varr.id === selectedVariantForNumbers);
            if (variantFound) {
                selectedVariantData = variantFound;
                vehicleIdForVariant = vehicle.id;
                vehicleNameForVariant = vehicle.vehicleName;
                siteNameForVariant = vehicle.siteName;
                break;
            }
        }

        if (!selectedVariantData) {
            setError("Please select a vehicle variant first.");
            showToast('error', 'Please select a vehicle variant first.');
            return;
        }

        // Validate selected site against user's linked sites
        if (!userLinkedSites.includes(siteNameForVariant)) {
            setError('The selected variant belongs to a site not linked to your profile.');
            showToast('error', 'Variant site not linked to profile.');
            return;
        }

        const numbers = bulkVehicleNumbersInput
            .split(",")
            .map((num) => num.trim())
            .filter(Boolean);

        if (numbers.length === 0) {
            setError("Please enter vehicle numbers (comma-separated).");
            showToast('error', 'Please enter vehicle numbers.');
            return;
        }

        setLoadingOperation(true);
        setError(null);
        try {
            const variantRef = doc(db, 'vehicleVariants', selectedVariantForNumbers);
            const numbersToAdd = [];
            const existingNumbersSet = new Set(selectedVariantData.numbers.map(n => n.toLowerCase()));

            for (const num of numbers) {
                if (num && !existingNumbersSet.has(num.toLowerCase())) {
                    numbersToAdd.push(num);
                    existingNumbersSet.add(num.toLowerCase());
                } else if (num) {
                    console.warn(`Vehicle number "${num}" already exists for this variant. Skipping.`);
                }
            }

            if (numbersToAdd.length > 0) {
                await updateDoc(variantRef, {
                    numbers: arrayUnion(...numbersToAdd)
                });
                showToast('success', `${numbersToAdd.length} numbers added to '${vehicleNameForVariant} - ${selectedVariantData.variantName}' (Site: ${siteNameForVariant}).`, null, 3000);
            } else {
                showToast('info', "No new numbers to add, all entered numbers already exist.", null, 3000);
            }

            setBulkVehicleNumbersInput("");
            setSelectedVariantForNumbers("");
            await fetchAllVehicles(userLinkedSites); // Refresh all vehicles data
        } catch (err) {
            console.error("Error bulk adding numbers:", err);
            showToast('error', 'Failed to bulk add numbers. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    // Helper to get vehicle names for SearchableDropdown in Vehicle tab (filtering by selectedSiteForVehicleAdd)
    const getVehicleNameOptionsForManage = () => {
        return allVehiclesData
            .filter(v => v.siteName === selectedSiteForVehicleAdd)
            .map(v => v.vehicleName);
    };

    // Helper to get vehicle-variant combinations for SearchableDropdown in Vehicle tab
    const getVehicleVariantOptionsForManage = () => {
        // Only show vehicle-variant combinations from sites the user has linked
        return allVehiclesData
            .filter(v => userLinkedSites.includes(v.siteName))
            .flatMap(v => v.variants.map(varr => ({
                id: varr.id,
                fullName: `${v.vehicleName} - ${varr.variantName} (Site: ${v.siteName})`
            })))
            .map(item => item.fullName); // Return just the full name strings for options
    };

    const handleEditVehicleName = (vehicle) => {
        // Ensure user has access to this vehicle's site BEFORE setting to edit
        if (!userLinkedSites.includes(vehicle.siteName)) {
            showToast('error', 'You do not have permission to edit vehicles from this site.');
            return;
        }
        setEditingVehicleName({ ...vehicle });
    };

    const handleUpdateVehicleName = async () => {
        if (!editingVehicleName || !editingVehicleName.vehicleName.trim()) {
            setError("Vehicle name is required for update.");
            showToast('error', 'Vehicle name is required for update.');
            return;
        }

        // Security check: Ensure the user has access to this site
        if (!userLinkedSites.includes(editingVehicleName.siteName)) {
            setError('You do not have permission to update vehicles from this site.');
            showToast('error', 'Permission denied.');
            setLoadingOperation(false);
            return;
        }

        setLoadingOperation(true);
        setError(null);
        try {
            const vehicleRef = doc(db, "vehicles", editingVehicleName.id);
            await updateDoc(vehicleRef, {
                vehicleName: editingVehicleName.vehicleName.trim(),
            });
            setEditingVehicleName(null);
            await fetchAllVehicles(userLinkedSites); // Refresh all vehicles data
            showToast('success', 'Vehicle Name Updated Successfully!', null, 3000);
        } catch (err) {
            console.error("Error updating vehicle name:", err);
            showToast('error', 'Failed to update vehicle name. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    const handleDeleteVehicleName = async (vehicleId, vehicleName, siteName) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete the vehicle "${vehicleName}" and ALL its variants and numbers from site "${siteName}"? This cannot be undone.`);
        if (!confirmDelete) {
            return;
        }

        // Security check: Ensure the user has access to this site
        if (!userLinkedSites.includes(siteName)) {
            showToast('error', 'You do not have permission to delete vehicles from this site.');
            return;
        }

        setLoadingOperation(true);
        setError(null);
        try {
            const batch = writeBatch(db);

            // Fetch variants related to this vehicle to delete them
            const variantQuerySnapshot = await getDocs(query(collection(db, "vehicleVariants"), where("vehicleId", "==", vehicleId)));
            variantQuerySnapshot.docs.forEach(variantDoc => {
                batch.delete(doc(db, "vehicleVariants", variantDoc.id));
            });

            const vehicleRef = doc(db, "vehicles", vehicleId);
            batch.delete(vehicleRef);

            await batch.commit();
            await fetchAllVehicles(userLinkedSites); // Refresh all vehicles data
            showToast('success', `Vehicle and all associated data from ${siteName} deleted successfully!`, null, 3000);
        } catch (err) {
            console.error("Error deleting vehicle:", err);
            showToast('error', 'Failed to delete vehicle. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    const handleEditVariant = (vehicleId, siteName, variant) => {
        // Ensure user has access to this variant's site BEFORE setting to edit
        if (!userLinkedSites.includes(siteName)) {
            showToast('error', 'You do not have permission to edit variants from this site.');
            return;
        }
        setEditingVariant({ vehicleId, siteName, ...variant });
    };

    const handleUpdateVariant = async () => {
        if (!editingVariant || !editingVariant.variantName.trim()) {
            setError("Variant name is required for update.");
            showToast('error', 'Variant name is required for update.');
            return;
        }

        // Security check: Ensure the user has access to this site
        if (!userLinkedSites.includes(editingVariant.siteName)) {
            setError('You do not have permission to update variants from this site.');
            showToast('error', 'Permission denied.');
            setLoadingOperation(false);
            return;
        }

        setLoadingOperation(true);
        setError(null);
        try {
            const variantRef = doc(db, "vehicleVariants", editingVariant.id);
            await updateDoc(variantRef, {
                variantName: editingVariant.variantName.trim(),
            });
            setEditingVariant(null);
            await fetchAllVehicles(userLinkedSites); // Refresh all vehicles data
            showToast('success', 'Vehicle Variant Updated Successfully!', null, 3000);
        } catch (err) {
            console.error("Error updating variant:", err);
            showToast('error', 'Failed to update variant. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    const handleDeleteVariant = async (vehicleId, variantId, variantName, siteName) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete the variant "${variantName}" and all its associated numbers from site "${siteName}"? This cannot be undone.`);
        if (!confirmDelete) {
            return;
        }
        // Security check: Ensure the user has access to this site
        if (!userLinkedSites.includes(siteName)) {
            showToast('error', 'You do not have permission to delete variants from this site.');
            return;
        }

        setLoadingOperation(true);
        setError(null);
        try {
            await deleteDoc(doc(db, "vehicleVariants", variantId));

            await fetchAllVehicles(userLinkedSites); // Refresh all vehicles data
            showToast('success', `Vehicle Variant and numbers from ${siteName} deleted successfully!`, null, 3000);
        } catch (err) {
            console.error("Error deleting variant:", err);
            showToast('error', 'Failed to delete variant. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    const handleEditVehicleNumber = (vehicleId, variantId, number, siteName) => {
        // Ensure user has access to this number's site BEFORE setting to edit
        if (!userLinkedSites.includes(siteName)) {
            showToast('error', 'You do not have permission to edit numbers from this site.');
            return;
        }
        setEditingVehicleNumber({ vehicleId, variantId, numberValue: number, originalNumber: number, siteName });
    };

    const handleUpdateVehicleNumber = async () => {
        if (!editingVehicleNumber || !editingVehicleNumber.numberValue.trim()) {
            setError("Vehicle number cannot be empty for update.");
            showToast('error', 'Vehicle number cannot be empty for update.');
            return;
        }

        // Security check: Ensure the user has access to this site
        if (!userLinkedSites.includes(editingVehicleNumber.siteName)) {
            setError('You do not have permission to update numbers from this site.');
            showToast('error', 'Permission denied.');
            setLoadingOperation(false);
            return;
        }

        setLoadingOperation(true);
        setError(null);
        try {
            const variantRef = doc(db, 'vehicleVariants', editingVehicleNumber.variantId);

            await updateDoc(variantRef, {
                numbers: arrayRemove(editingVehicleNumber.originalNumber)
            });
            await updateDoc(variantRef, {
                numbers: arrayUnion(editingVehicleNumber.numberValue.trim())
            });

            setEditingVehicleNumber(null);
            await fetchAllVehicles(userLinkedSites); // Refresh all vehicles data
            showToast('success', 'Vehicle Number Updated Successfully!', null, 3000);
        } catch (err) {
            console.error("Error updating vehicle number:", err);
            showToast('error', 'Failed to update vehicle number. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    const handleDeleteVehicleNumber = async (vehicleId, variantId, numberToDelete, variantName, siteName) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete the vehicle number "${numberToDelete}" from variant "${variantName}" at site "${siteName}"? This cannot be undone.`);
        if (!confirmDelete) {
            return;
        }

        // Security check: Ensure the user has access to this site
        if (!userLinkedSites.includes(siteName)) {
            showToast('error', 'You do not have permission to delete numbers from this site.');
            return;
        }

        setLoadingOperation(true);
        setError(null);
        try {
            const variantRef = doc(db, 'vehicleVariants', variantId);
            await updateDoc(variantRef, {
                numbers: arrayRemove(numberToDelete)
            });
            await fetchAllVehicles(userLinkedSites); // Refresh all vehicles data
            showToast('success', `Vehicle Number Deleted from ${siteName} Successfully!`, null, 3000);
        } catch (err) {
            console.error("Error deleting vehicle number:", err);
            showToast('error', 'Failed to delete vehicle number. Please try again.');
        } finally {
            setLoadingOperation(false);
        }
    };

    // --- EXPORT FUNCTIONALITY (now user-specific entries and filtered by site access) ---
    const getExportableData = (rawEntries) => {
        return rawEntries.map(entry => ({
            Date: format(entry.date, 'dd/MM/yyyy'),
            'Vehicle Name': entry.vehicleName,
            'Vehicle Variant': entry.vehicleVariant,
            'Vehicle Number': entry.vehicleNumber,
            'Fuel Type': entry.fuelType,
            Quantity: entry.fuelQuantity,
            Unit: entry.unit,
            'Site Name': entry.siteName || '',
        }));
    };

    const getReportHeaderDataForExcel = (userName, exportStartDate, exportEndDate, exportSelectedSite, numberOfDataColumns) => {
        const defaultBorder = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        const lightGreyFill = { fgColor: { rgb: "FFEEEEEE" } };
        const whiteFill = { fgColor: { rgb: "FFFFFFFF" } };
        const lightBlueFill = { fgColor: { rgb: "FFCCEEFF" } };
        const mediumDarkGreyFill = { fgColor: { rgb: "FFBFBFBF" } };

        return [
            {
                cells: [{
                    v: "MAXBOND IFRA LTD - Fuel Entries Report",
                    s: {
                        font: { sz: 18, bold: true, color: { rgb: "FF000000" } },
                        fill: lightBlueFill,
                        alignment: { horizontal: "center", vertical: "center" },
                        border: defaultBorder
                    }
                }],
                mergeInfo: { s: { r: 0, c: 0 }, e: { r: 0, c: numberOfDataColumns - 1 } }
            },
            { cells: [] },
            { cells: [
                { v: "Submitter Name", s: { font: { sz: 12, bold: true }, fill: lightGreyFill, border: defaultBorder } },
                { v: userName, s: { font: { sz: 12 }, fill: whiteFill, border: defaultBorder } }
            ]},
            { cells: [
                { v: "Site(s) Filtered", s: { font: { sz: 12, bold: true }, fill: lightGreyFill, border: defaultBorder } },
                { v: exportSelectedSite || 'All Linked Sites', s: { font: { sz: 12 }, fill: whiteFill, border: defaultBorder } }
            ]},
            { cells: [
                { v: "Date Range:", s: { font: { sz: 12, bold: true }, fill: mediumDarkGreyFill, border: defaultBorder } },
                { v: `${exportStartDate ? format(exportStartDate, 'dd/MM/yyyy') : 'N/A'} to ${exportEndDate ? format(exportEndDate, 'dd/MM/yyyy') : 'N/A'}`, s: { font: { sz: 12 }, fill: whiteFill, border: defaultBorder } }
            ]},
            { cells: [] },
            {
                cells: [{
                    v: "Fuel Entries Data",
                    s: {
                        font: { sz: 14, bold: true, color: { rgb: "FF000000" } },
                        fill: lightBlueFill,
                        alignment: { horizontal: "center", vertical: "center" },
                        border: defaultBorder
                    }
                }],
                mergeInfo: { s: { r: 0, c: 0 }, e: { r: 0, c: numberOfDataColumns - 1 } }
            },
            { cells: [] },
        ];
    };


    const handleExportExcel = async () => {
        setLoadingOperation(true);
        setError(null);
        try {
            let qRef = collection(db, 'fuelEntries');
            let constraints = [where('userId', '==', userId)];

            if (exportStartDate) {
                constraints.push(where('date', '>=', exportStartDate));
            }
            if (exportEndDate) {
                const endOfDay = new Date(exportEndDate);
                endOfDay.setHours(23, 59, 59, 999);
                constraints.push(where('date', '<=', endOfDay));
            }

            // Apply site filtering based on user's linked sites
            if (exportSelectedSite) {
                if (!userLinkedSites.includes(exportSelectedSite)) {
                    showToast('error', 'You do not have access to export entries for this site.');
                    setLoadingOperation(false);
                    return;
                }
                constraints.push(where('siteName', '==', exportSelectedSite));
            } else if (userLinkedSites.length > 0) {
                 if (userLinkedSites.length <= 10) {
                    constraints.push(where('siteName', 'in', userLinkedSites));
                 } else {
                    showToast('info', 'Too many linked sites to export all entries at once. Please filter by a specific site.');
                    setLoadingOperation(false);
                    return;
                 }
            } else {
                showToast('info', 'No linked sites available to export data from.');
                setLoadingOperation(false);
                return;
            }

            const finalQuery = query(qRef, ...constraints, orderBy('date', 'desc'));
            const querySnapshot = await getDocs(finalQuery);

            const fetchedRawEntries = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date instanceof Timestamp ? doc.data().date.toDate() : new Date()
            }));

            const dataToExport = getExportableData(fetchedRawEntries);

            if (dataToExport.length === 0) {
                showToast('info', 'No data found for the current filters to export to Excel.');
                setLoadingOperation(false);
                return;
            }

            const columnHeaders = dataToExport.length > 0 ? Object.keys(dataToExport[0]) : [];
            const numberOfDataColumns = columnHeaders.length;

            const ws = XLSX.utils.aoa_to_sheet([]);
            const merges = [];

            const headerDataFormatted = getReportHeaderDataForExcel(userName, exportStartDate, exportEndDate, exportSelectedSite, numberOfDataColumns);
            let currentRowIndex = 0;

            headerDataFormatted.forEach((rowInfo) => {
                const rowValues = rowInfo.cells.map(cell => cell.v);
                XLSX.utils.sheet_add_aoa(ws, [rowValues], { origin: `A${currentRowIndex + 1}` });

                rowInfo.cells.forEach((cell, cellIndex) => {
                    const cellRef = XLSX.utils.encode_cell({ r: currentRowIndex, c: cellIndex });
                    if (!ws[cellRef]) ws[cellRef] = {};
                    ws[cellRef].s = cell.s;
                });

                if (rowInfo.mergeInfo) {
                    merges.push({
                        s: { r: currentRowIndex, c: rowInfo.mergeInfo.s.c },
                        e: { r: currentRowIndex, c: rowInfo.mergeInfo.e.c }
                    });
                }
                currentRowIndex++;
            });

            XLSX.utils.sheet_add_aoa(ws, [columnHeaders], { origin: `A${currentRowIndex + 1}` });
            const dataHeaderRowIndex = currentRowIndex;
            currentRowIndex++;

            for (let C = 0; C < numberOfDataColumns; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: dataHeaderRowIndex, c: C });
                if (!ws[cellRef]) ws[cellRef] = {};
                ws[cellRef].s = {
                    font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFFFF" } },
                    fill: { fgColor: { rgb: "FF007AFF" } },
                    border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }

            const dataRows = dataToExport.map(obj => Object.values(obj));
            XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: `A${currentRowIndex + 1}` });

            dataRows.forEach((row, rIdx) => {
                for (let C = 0; C < numberOfDataColumns; ++C) {
                    const cellRef = XLSX.utils.encode_cell({ r: currentRowIndex + rIdx, c: C });
                    if (!ws[cellRef]) ws[cellRef] = {};
                    ws[cellRef].s = {
                        font: { name: "Arial", sz: 9 },
                        fill: { fgColor: { rgb: (rIdx % 2 === 0 ? "FFF8F8F8" : "FFFAFAFA") } },
                        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
                        alignment: { horizontal: (typeof row[C] === 'number' ? "right" : "left"), vertical: "center" }
                    };
                }
            });

            currentRowIndex += dataRows.length;

            if (merges.length > 0) {
                ws['!merges'] = merges;
            }

            const calculatedMaxWidths = columnHeaders.map((header, colIndex) => {
                const headerWidth = String(header).length;
                const dataWidth = Math.max(0, ...dataToExport.map(row => String(Object.values(row)[colIndex] || '').length));
                return Math.max(headerWidth, dataWidth) + 2;
            });
            ws['!cols'] = calculatedMaxWidths.map(w => ({ wch: w }));

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Fuel Entries");
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });


            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                const filename = `FuelEntriesReport_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
                const directory = Directory.Documents;

                try {
                    const base64data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            if (reader.result && typeof reader.result === 'string') {
                                resolve(reader.result.split(',')[1]); // Get base64 data
                            } else {
                                reject(new Error('FileReader failed to produce data URL or result is not a string.'));
                            }
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });

                    const result = await Filesystem.writeFile({
                        path: filename,
                        data: base64data,
                        directory: directory,
                        recursive: true
                    });

                    let fileUriToShare;
                    if (result.uri) {
                        fileUriToShare = result.uri;
                    } else {
                        const uriResult = await Filesystem.getUri({ path: filename, directory: directory });
                        fileUriToShare = uriResult.uri;
                    }

                    await Share.share({
                        title: 'Fuel Entries Report (Excel)',
                        text: 'Here is your fuel entries data in Excel format.',
                        url: fileUriToShare,
                        dialogTitle: 'Share Fuel Entries XLSX',
                        filename: filename
                    });
                    showToast('success', 'Excel saved to Documents and shared successfully!');

                } catch (writeShareError) {
                    console.error('Error saving or sharing Excel via Capacitor:', writeShareError);
                    showToast('error', `Failed to save or share Excel: ${writeShareError.message || 'Unknown error'}.`);
                } finally {
                    setLoadingOperation(false);
                }
            } else {
                const fileName = 'fuel_entries.xlsx';
                const link = document.createElement('a');
                if (link.download !== undefined) {
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    link.setAttribute('download', fileName);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast('success', 'Data exported to Excel (XLSX) successfully!');
                }
                setLoadingOperation(false);
            }
        } catch (err) {
            console.error("Error exporting to Excel:", err);
            showToast('error', `Failed to export to Excel: ${err.message || err}. Please try again.`);
            setLoadingOperation(false);
        }
    };

    const handleExportPdf = async () => {
        setLoadingOperation(true);
        setError(null);
        try {
            let qRef = collection(db, 'fuelEntries');
            let constraints = [where('userId', '==', userId)];

            if (exportStartDate) {
                constraints.push(where('date', '>=', exportStartDate));
            }
            if (exportEndDate) {
                const endOfDay = new Date(exportEndDate);
                endOfDay.setHours(23, 59, 59, 999);
                constraints.push(where('date', '<=', endOfDay));
            }

            // Apply site filtering based on user's linked sites
            if (exportSelectedSite) {
                if (!userLinkedSites.includes(exportSelectedSite)) {
                    showToast('error', 'You do not have access to export entries for this site.');
                    setLoadingOperation(false);
                    return;
                }
                constraints.push(where('siteName', '==', exportSelectedSite));
            } else if (userLinkedSites.length > 0) {
                 if (userLinkedSites.length <= 10) {
                    constraints.push(where('siteName', 'in', userLinkedSites));
                 } else {
                    showToast('info', 'Too many linked sites to export all entries at once. Please filter by a specific site.');
                    setLoadingOperation(false);
                    return;
                 }
            } else {
                showToast('info', 'No linked sites available to export data from.');
                setLoadingOperation(false);
                return;
            }

            const finalQuery = query(qRef, ...constraints, orderBy('date', 'desc'));
            const querySnapshot = await getDocs(finalQuery);

            const fetchedRawEntries = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date instanceof Timestamp ? doc.data().toDate() : new Date()
            }));

            const dataToExport = getExportableData(fetchedRawEntries);

            if (dataToExport.length === 0) {
                showToast('info', 'No data found for the current filters to export to PDF.');
                setLoadingOperation(false);
                return;
            }

            const doc = new jsPDF();

            const reportTitle = "MAXBOND IFRA LTD - Fuel Entries Report";
            doc.setFontSize(18);
            doc.setTextColor(50, 50, 50);
            doc.text(reportTitle, 105, 20, null, null, "center");

            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            doc.text(`Submitter Name: ${userName}`, 14, 30);
            doc.text(`Site(s) Filtered: ${exportSelectedSite || 'All Linked Sites'}`, 14, 35);
            doc.text(`Date Range: ${exportStartDate ? format(exportStartDate, 'dd/MM/yyyy') : 'N/A'} to ${exportEndDate ? format(exportEndDate, 'dd/MM/yyyy') : 'N/A'}`, 14, 40);

            doc.setFontSize(14);
            doc.setTextColor(50, 50, 50);
            doc.text("Fuel Entries Data", 14, 55);

            autoTable(doc, {
                startY: 60,
                head: [Object.keys(dataToExport[0])],
                body: dataToExport.map(row => Object.values(row)),
                theme: 'striped',
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                    valign: 'middle',
                    overflow: 'linebreak',
                    textColor: [50, 50, 50],
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1
                },
                headStyles: {
                    fillColor: [0, 122, 255],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center'
                },
                alternateRowStyles: {
                    fillColor: [248, 248, 248],
                },
                margin: { top: 10, right: 10, bottom: 10, left: 10 },
            });

            const pdfOutput = doc.output('blob');

            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                const filename = `FuelEntriesReport_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
                const directory = Directory.Documents;

                try {
                    const base64data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            if (reader.result && typeof reader.result === 'string') {
                                resolve(reader.result.split(',')[1]);
                            } else {
                                reject(new Error('FileReader failed to produce data URL or result is not a string.'));
                            }
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(pdfOutput);
                    });

                    const result = await Filesystem.writeFile({
                        path: filename,
                        data: base64data,
                        directory: directory,
                        recursive: true
                    });

                    let fileUriToShare;
                    if (result.uri) {
                        fileUriToShare = result.uri;
                    } else {
                        const uriResult = await Filesystem.getUri({ path: filename, directory: directory });
                        fileUriToShare = uriResult.uri;
                    }

                    await Share.share({
                        title: 'Fuel Entries Report (PDF)',
                        text: 'Here is your fuel entries data in PDF format.',
                        url: fileUriToShare,
                        dialogTitle: 'Share Fuel Entries PDF',
                        filename: filename
                    });
                    showToast('success', 'PDF saved to Documents and shared successfully!');

                } catch (writeShareError) {
                    console.error('Error saving or sharing PDF via Capacitor:', writeShareError);
                    showToast('error', `Failed to save or share PDF: ${writeShareError.message || 'Unknown error'}.`);
                } finally {
                    setLoadingOperation(false);
                }
            } else {
                doc.save('fuel_entries.pdf');
                showToast('success', 'Data exported to PDF successfully!');
                setLoadingOperation(false);
            }
        } catch (err) {
            console.error("Error exporting to PDF:", err);
            showToast('error', `Failed to export to PDF: ${err.message || err}. Please try again.`);
            setLoadingOperation(false);
        }
    };


    if (!userId) {
        return (
            <div className="fuel-entry-page-container">
                <p className="no-data-message">Please log in to use the Fuel Entry system.</p>
            </div>
        );
    }

    return (
        <div className={`financial-dashboard-wrapper ${currentTheme}`}>
            <header className="ios-header">
                <div className="header-content">
                    <button className="back-button" onClick={() => navigate(-1)}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h1 className="header-title">Fuel Entry</h1>
                </div>
                <div className="header-icon">
                    <i className="fas fa-gas-pump"></i>
                </div>
                {/* Export Data Button (Always visible in header, direct to view tab) */}
                <div className="export-button-container">
                    <button
                        className="theme-switch-button"
                        onClick={() => setActiveTab('view')}
                        title="View & Export Data"
                    >
                        <i className="fas fa-file-export"></i>
                    </button>
                </div>
                {/* Existing Theme Switch Button for App Themes */}
                <div className="theme-switch-container">
                    <button className="theme-switch-button" onClick={() => setShowThemeListModal(true)}>
                        <i className="fas fa-palette"></i>
                    </button>
                </div>
            </header>

            <div className="tabs-container">
                <button
                    className={`tab-button ${activeTab === 'entry' ? 'active' : ''}`}
                    onClick={() => setActiveTab('entry')}
                >
                    <i className="fas fa-file-alt"></i> Entry
                </button>
                <button
                    className={`tab-button ${activeTab === 'view' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('view');
                        setViewMode('initial');
                        setSelectedFuelEntryDetail(null);
                        setEditingFuelEntry(null);
                    }}
                >
                    <i className="fas fa-list"></i> View
                </button>
                <button
                    className={`tab-button ${activeTab === 'vehicles' ? 'active' : ''}`}
                    onClick={() => setActiveTab('vehicles')}
                >
                    <i className="fas fa-car"></i> Vehicles
                </button>
            </div>

            <div className="tab-content">
                {error && <div className="error-message">{error}</div>}

                {activeTab === 'entry' && (
                    <div className="fuel-entry-tab">
                        <h2>New Fuel Entry</h2>
                        {loadingVehiclesData || userLinkedSites.length === 0 ? (
                            <p className="loading-message">
                                {loadingVehiclesData ? 'Loading vehicle data...' : 'Please link sites to your profile in the Profile Page to add entries.'}
                            </p>
                        ) : (
                            <form onSubmit={handleAddFuelEntry} className="fuel-entry-form">
                                <div className="form-group">
                                    <label htmlFor="entryDate">Date:</label>
                                    <DatePicker
                                        id="entryDate"
                                        selected={entryDate}
                                        onChange={(date) => setEntryDate(date)}
                                        dateFormat="dd/MM/yyyy"
                                        className="input-field"
                                        disabled={loadingOperation}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="selectedSiteForEntry">Site Name:</label>
                                    <SearchableDropdown
                                        id="selectedSiteForEntry"
                                        value={selectedSiteForEntry}
                                        options={userLinkedSites} // Only show sites linked to user
                                        onChange={setSelectedSiteForEntry}
                                        placeholder="Select Site"
                                        disabled={loadingOperation || userLinkedSites.length === 0}
                                    />
                                </div>


                                <div className="form-group">
                                    <label htmlFor="vehicleNameSelect">Vehicle Name:</label>
                                    <SearchableDropdown
                                        id="vehicleNameSelect"
                                        value={selectedVehicleName}
                                        options={getVehicleNameOptionsBySite()} // Filtered by selected site
                                        onChange={handleVehicleNameChange}
                                        placeholder="Type or select vehicle name"
                                        disabled={loadingOperation || !selectedSiteForEntry || filteredVehicleNamesBySite.length === 0}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="vehicleVariantSelect">Vehicle Variant:</label>
                                    <SearchableDropdown
                                        id="vehicleVariantSelect"
                                        value={selectedVehicleVariant}
                                        options={getVariantNameOptionsForVehicleBySite()} // Filtered by selected vehicle and site
                                        onChange={handleVehicleVariantChange}
                                        placeholder="Type or select variant"
                                        disabled={loadingOperation || !selectedVehicleName || filteredVariantsForSelectedVehicleBySite.length === 0}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="vehicleNumberSelect">Vehicle Number:</label>
                                    <SearchableDropdown
                                        id="vehicleNumberSelect"
                                        value={selectedVehicleNumber}
                                        options={getNumberOptionsForVariantBySite()} // Filtered by selected variant and site
                                        onChange={handleVehicleNumberChange}
                                        placeholder="Type or select number"
                                        disabled={loadingOperation || !selectedVehicleVariant || filteredNumbersForSelectedVehicleBySite.length === 0}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="fuelType">Fuel Type:</label>
                                    <select
                                        id="fuelType"
                                        value={fuelType}
                                        onChange={(e) => setFuelType(e.target.value)}
                                        required
                                        disabled={loadingOperation}
                                    >
                                        <option value="">Select Fuel Type</option>
                                        <option value="Petrol">Petrol</option>
                                        <option value="Diesel">Diesel</option>
                                        <option value="CNG">CNG</option>
                                        <option value="Electric">Electric</option>
                                        <option value="LPG">LPG</option>
                                    </select>
                                </div>

                                <div className="input-field">
                                    <label htmlFor="fuelQuantity">Quantity (Liters/Hours):</label>
                                    <input
                                        type="number"
                                        id="fuelQuantity"
                                        value={fuelQuantity}
                                        onChange={(e) => setFuelQuantity(e.target.value)}
                                        placeholder="e.g., 20.5"
                                        step="0.01"
                                        required
                                        disabled={loadingOperation}
                                        className="input-field"
                                    />
                                </div>

                                <div className="input-field">
                                    <label htmlFor="unit">Unit:</label>
                                    <select
                                        id="unit"
                                        value={unit}
                                        onChange={(e) => setUnit(e.target.value)}
                                        required
                                        disabled={loadingOperation}
                                        className="input-field"
                                    >
                                        <option value="Liters">Liters</option>
                                        <option value="Gallons">Gallons</option>
                                        <option value="Hours">Hours (for machinery)</option>
                                        <option value="KWH">KWH (for Electric)</option>
                                    </select>
                                </div>

                                <button type="submit" className="primary-button" disabled={loadingOperation}>
                                    {loadingOperation ? 'Saving...' : 'Save Fuel Entry'}
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {activeTab === 'view' && (
                    <div className="view-fuel-tab">
                        <h2>All Fuel Entries</h2>

                        {/* Filter & Export Data Section */}
                        <div className="filter-section export-filters">
                            <h3>Filter & Export Data</h3>
                            <div className="form-group">
                                <label htmlFor="exportStartDate">From Date:</label>
                                <DatePicker
                                    id="exportStartDate"
                                    selected={exportStartDate}
                                    onChange={(date) => setExportStartDate(date)}
                                    dateFormat="dd/MM/yyyy"
                                    className="input-field"
                                    isClearable
                                    placeholderText="Select start date"
                                    disabled={loadingOperation}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="exportEndDate">To Date:</label>
                                <DatePicker
                                    id="exportEndDate"
                                    selected={exportEndDate}
                                    onChange={(date) => setExportEndDate(date)}
                                    dateFormat="dd/MM/yyyy"
                                    className="input-field"
                                    isClearable
                                    placeholderText="Select end date"
                                    disabled={loadingOperation}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="exportSiteSelect">Site Name:</label>
                                <SearchableDropdown
                                    id="exportSiteSelect"
                                    value={exportSelectedSite}
                                    options={userLinkedSites} // Only show sites linked to user
                                    onChange={setExportSelectedSite}
                                    placeholder="Select Site (Optional)"
                                    disabled={loadingOperation || userLinkedSites.length === 0}
                                />
                            </div>

                            <div className="export-buttons-group">
                                <button
                                    className="primary-button"
                                    onClick={handleExportExcel}
                                    disabled={loadingOperation || userLinkedSites.length === 0}
                                >
                                    {loadingOperation ? 'Exporting...' : 'Export to Excel'}
                                    <i className="fas fa-file-excel" style={{ marginLeft: '10px' }}></i>
                                </button>
                                <button
                                    className="secondary-button"
                                    onClick={handleExportPdf}
                                    disabled={loadingOperation || userLinkedSites.length === 0}
                                >
                                    {loadingOperation ? 'Exporting...' : 'Export to PDF'}
                                    <i className="fas fa-file-pdf" style={{ marginLeft: '10px' }}></i>
                                </button>
                            </div>
                        </div>

                        {/* Fuel Entries List/Details/Edit View */}
                        {loadingFuelEntries && viewMode === 'list' ? (
                            <p className="loading-message">Loading fuel entries...</p>
                        ) : fuelEntries.length === 0 && viewMode === 'list' ? (
                            <p className="no-data-message">No fuel entries found for your linked sites with current filters.</p>
                        ) : viewMode === 'initial' ? (
                            <div className="initial-view-prompt">
                                <p>Click 'Review All Entries' to see the list.</p>
                                <button
                                    className="primary-button"
                                    onClick={handleInitialReviewClick}
                                    disabled={loadingOperation}
                                >
                                    Review All Entries
                                </button>
                            </div>
                        ) : viewMode === 'list' ? (
                            <ul className="fuel-entry-list">
                                {fuelEntries.map((entry) => (
                                    <li key={entry.id} className="fuel-entry-list-item" onClick={() => handleViewFuelEntryDetails(entry)}>
                                        <div className="entry-summary">
                                            <strong>{format(entry.date, 'dd/MM/yyyy')}</strong> - {entry.vehicleName} ({entry.vehicleVariant}) - {entry.vehicleNumber}
                                            <p className="fuel-quantity-display">{entry.fuelQuantity} {entry.unit} of {entry.fuelType} (Site: {entry.siteName || 'N/A'})</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : viewMode === 'details' && selectedFuelEntryDetail ? (
                            <div className="fuel-entry-detail-card">
                                <h3>Entry Details</h3>
                                <p><strong>Date:</strong> {format(selectedFuelEntryDetail.date, 'dd/MM/yyyy')}</p>
                                <p><strong>Site Name:</strong> {selectedFuelEntryDetail.siteName || 'N/A'}</p>
                                <p><strong>Vehicle Name:</strong> {selectedFuelEntryDetail.vehicleName}</p>
                                <p><strong>Vehicle Variant:</strong> {selectedFuelEntryDetail.vehicleVariant}</p>
                                <p><strong>Vehicle Number:</strong> {selectedFuelEntryDetail.vehicleNumber}</p>
                                <p><strong>Fuel Type:</strong> {selectedFuelEntryDetail.fuelType}</p>
                                <p><strong>Quantity:</strong> {selectedFuelEntryDetail.fuelQuantity} {selectedFuelEntryDetail.unit}</p>
                                <p><strong>Recorded At:</strong> {selectedFuelEntryDetail.timestamp?.toDate().toLocaleString()}</p>
                                <div className="detail-action-buttons">
                                    <button
                                        className="secondary-button"
                                        onClick={() => setViewMode('list')}
                                        disabled={loadingOperation}
                                    >
                                        Back to List
                                    </button>
                                    <button
                                        className="primary-button"
                                        onClick={() => handleEditFuelEntry(selectedFuelEntryDetail)}
                                        disabled={loadingOperation}
                                    >
                                        Edit Entry
                                    </button>
                                    <button
                                        className="action-button delete-button"
                                        onClick={() => handleDeleteFuelEntry(selectedFuelEntryDetail.id, `${selectedFuelEntryDetail.vehicleName} ${selectedFuelEntryDetail.vehicleNumber}`)}
                                        disabled={loadingOperation}
                                    >
                                        <i className="fas fa-trash"></i> Delete Entry
                                    </button>
                                </div>
                            </div>
                        ) : viewMode === 'edit' && editingFuelEntry ? (
                            <div className="edit-fuel-entry-form-container">
                                <h3>Edit Fuel Entry</h3>
                                <form onSubmit={handleUpdateFuelEntry} className="fuel-entry-form">
                                    <div className="form-group">
                                        <label htmlFor="editEntryDate">Date:</label>
                                        <DatePicker
                                            id="editEntryDate"
                                            selected={editingFuelEntry.date}
                                            onChange={(date) => setEditingFuelEntry({ ...editingFuelEntry, date: date })}
                                            dateFormat="dd/MM/yyyy"
                                            className="input-field"
                                            disabled={loadingOperation}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="editSiteName">Site Name:</label>
                                        <SearchableDropdown
                                            id="editSiteName"
                                            value={editingFuelEntry.siteName || ''}
                                            options={userLinkedSites}
                                            onChange={(val) => setEditingFuelEntry({ ...editingFuelEntry, siteName: val })}
                                            placeholder="Select Site"
                                            disabled={loadingOperation || userLinkedSites.length === 0}
                                        />
                                    </div>


                                    <div className="form-group">
                                        <label htmlFor="editVehicleName">Vehicle Name:</label>
                                        <SearchableDropdown
                                            id="editVehicleName"
                                            value={editingFuelEntry.vehicleName}
                                            options={allVehiclesData.filter(v => v.siteName === editingFuelEntry.siteName).map(v => v.vehicleName)}
                                            onChange={(val) => setEditingFuelEntry({ ...editingFuelEntry, vehicleName: val, vehicleVariant: '', vehicleNumber: '' })}
                                            placeholder="Edit vehicle name"
                                            disabled={loadingOperation || !editingFuelEntry.siteName}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="editVehicleVariant">Vehicle Variant:</label>
                                        <SearchableDropdown
                                            id="editVehicleVariant"
                                            value={editingFuelEntry.vehicleVariant}
                                            options={allVehiclesData.find(v => v.vehicleName === editingFuelEntry.vehicleName && v.siteName === editingFuelEntry.siteName)?.variants.map(v => v.variantName) || []}
                                            onChange={(val) => setEditingFuelEntry({ ...editingFuelEntry, vehicleVariant: val, vehicleNumber: '' })}
                                            placeholder="Edit vehicle variant"
                                            disabled={loadingOperation || !editingFuelEntry.vehicleName}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="editVehicleNumber">Vehicle Number:</label>
                                        <SearchableDropdown
                                            id="editVehicleNumber"
                                            value={editingFuelEntry.vehicleNumber}
                                            options={allVehiclesData.find(v => v.vehicleName === editingFuelEntry.vehicleName && v.siteName === editingFuelEntry.siteName)?.variants.find(v => v.variantName === editingFuelEntry.vehicleVariant)?.numbers || []}
                                            onChange={(val) => setEditingFuelEntry({ ...editingFuelEntry, vehicleNumber: val })}
                                            placeholder="Edit vehicle number"
                                            disabled={loadingOperation || !editingFuelEntry.vehicleVariant}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="editFuelType">Fuel Type:</label>
                                        <select
                                            id="editFuelType"
                                            value={editingFuelEntry.fuelType}
                                            onChange={(e) => setEditingFuelEntry({ ...editingFuelEntry, fuelType: e.target.value })}
                                            required
                                            disabled={loadingOperation}
                                        >
                                            <option value="">Select Fuel Type</option>
                                            <option value="Petrol">Petrol</option>
                                            <option value="Diesel">Diesel</option>
                                            <option value="CNG">CNG</option>
                                            <option value="Electric">Electric</option>
                                            <option value="LPG">LPG</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="editFuelQuantity">Quantity (Liters/Hours):</label>
                                        <input
                                            type="number"
                                            id="editFuelQuantity"
                                            value={editingFuelEntry.fuelQuantity}
                                            onChange={(e) => setEditingFuelEntry({ ...editingFuelEntry, fuelQuantity: e.target.value })}
                                            placeholder="e.g., 20.5"
                                            step="0.01"
                                            required
                                            disabled={loadingOperation}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="editUnit">Unit:</label>
                                        <select
                                            id="editUnit"
                                            value={editingFuelEntry.unit}
                                            onChange={(e) => setEditingFuelEntry({ ...editingFuelEntry, unit: e.target.value })}
                                            required
                                            disabled={loadingOperation}
                                        >
                                            <option value="Liters">Liters</option>
                                            <option value="Gallons">Gallons</option>
                                            <option value="Hours">Hours (for machinery)</option>
                                            <option value="KWH">KWH (for Electric)</option>
                                        </select>
                                    </div>

                                    <div className="edit-form-actions">
                                        <button type="submit" className="primary-button" disabled={loadingOperation}>
                                            {loadingOperation ? 'Updating...' : 'Update Entry'}
                                        </button>
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            onClick={() => { setEditingFuelEntry(null); setViewMode('list'); }}
                                            disabled={loadingOperation}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : null}
                    </div>
                )}

                {activeTab === 'vehicles' && (
                    <div className="manage-vehicles-tab">
                             {/* Site Selection for Vehicle Management */}
                             <div className="form-group site-selector-for-vehicles">
                                 <label htmlFor="selectedSiteForVehicleAdd">Manage Vehicles for Site:</label>
                                 <SearchableDropdown
                                     id="selectedSiteForVehicleAdd"
                                     value={selectedSiteForVehicleAdd}
                                     options={userLinkedSites} // Only show sites linked to user
                                     onChange={setSelectedSiteForVehicleAdd}
                                     placeholder="Select Site to Manage Vehicles"
                                     disabled={loadingOperation || userLinkedSites.length === 0}
                                 />
                             </div>
                             {userLinkedSites.length === 0 && (
                                 <p className="no-data-message">
                                     Please link sites to your profile in the Profile Page to manage vehicles.
                                 </p>
                             )}


                             {selectedSiteForVehicleAdd && (
                                 <>
                                     {/* --- Add Single Vehicle Name, Variant, and Number Section --- */}
                                     <section className="add-section">
                                         <h2 className="section-title">Add Vehicle (Single) for "{selectedSiteForVehicleAdd}"</h2>
                                         <form onSubmit={handleAddSingleVehicle} className="form-group column-layout">
                                             <label htmlFor="addVehicleName">Vehicle Name:</label>
                                             <input
                                                 type="text"
                                                 id="addVehicleName"
                                                 className="input-field"
                                                 value={addVehicleName}
                                                 onChange={(e) => setAddVehicleName(e.target.value)}
                                                 placeholder="e.g., Truck"
                                                 disabled={loadingOperation}
                                                 required
                                             />
                                             <label htmlFor="addVehicleVariant">Vehicle Variant:</label>
                                             <input
                                                 type="text"
                                                 id="addVehicleVariant"
                                                 className="input-field"
                                                 value={addVehicleVariant}
                                                 onChange={(e) => setAddVehicleVariant(e.target.value)}
                                                 placeholder="e.g., Heavy Duty"
                                                 disabled={loadingOperation}
                                                 required
                                             />
                                             <label htmlFor="addVehicleNumber">Vehicle Number:</label>
                                             <input
                                                 type="text"
                                                 id="addVehicleNumber"
                                                 className="input-field"
                                                 value={addVehicleNumber}
                                                 onChange={(e) => setAddVehicleNumber(e.target.value)}
                                                 placeholder="e.g., HR01AB1234"
                                                 disabled={loadingOperation}
                                                 required
                                             />
                                             <button type="submit" className="primary-button" disabled={loadingOperation}>
                                                 {loadingOperation ? 'Adding...' : 'Add Vehicle Data'}
                                             </button>
                                         </form>
                                     </section>

                                     <hr className="divider" />

                                     {/* --- Bulk Add Vehicle Names Section --- */}
                                     <section className="add-section">
                                         <h2 className="section-title">Bulk Add Vehicle Names for "{selectedSiteForVehicleAdd}"</h2>
                                         <p className="instructions">
                                             Enter vehicle names, comma-separated (e.g., Car, Truck, Bike). Variants and numbers can be added later.
                                         </p>
                                         <div className="form-group column-layout">
                                             <textarea
                                                 className="input-field textarea-field"
                                                 placeholder="Enter vehicle names, comma-separated"
                                                 value={bulkVehicleNamesInput}
                                                 onChange={(e) => setBulkVehicleNamesInput(e.target.value)}
                                                 disabled={loadingOperation}
                                                 rows="3"
                                             ></textarea>
                                             <button
                                                 className="primary-button"
                                                 onClick={handleBulkAddVehicleNames}
                                                 disabled={loadingOperation}
                                             >
                                                 {loadingOperation ? "Adding..." : "Bulk Add Vehicle Names"}
                                             </button>
                                         </div>
                                     </section>

                                     <hr className="divider" />

                                     {/* --- Bulk Add Variants to Existing Vehicle Name Section --- */}
                                     <section className="add-section">
                                         <h2 className="section-title">Bulk Add Variants to Existing Vehicle in "{selectedSiteForVehicleAdd}"</h2>
                                         <p className="instructions">
                                             Select an existing vehicle name (from "{selectedSiteForVehicleAdd}") and then enter multiple variant names, comma-separated. Numbers can be added later.
                                         </p>
                                         <div className="form-group column-layout">
                                             <label htmlFor="selectedVehicleForVariantAdd">Select Vehicle Name:</label>
                                             <SearchableDropdown
                                                 id="selectedVehicleForVariantAdd"
                                                 value={allVehiclesData.find(v => v.id === selectedVehicleForVariantAdd)?.vehicleName || ""}
                                                 options={allVehiclesData.filter(v => v.siteName === selectedSiteForVehicleAdd).map(v => v.vehicleName)}
                                                 onChange={(selectedName) => {
                                                     const selectedVehicle = allVehiclesData.find(v => v.vehicleName === selectedName && v.siteName === selectedSiteForVehicleAdd);
                                                     setSelectedVehicleForVariantAdd(selectedVehicle ? selectedVehicle.id : "");
                                                     setBulkVariantNamesInput("");
                                                 }}
                                                 placeholder="-- Select a Vehicle Name --"
                                                 disabled={loadingOperation || !selectedSiteForVehicleAdd}
                                             />

                                             <label htmlFor="bulkVariantNamesInput">Variant Names:</label>
                                             <textarea
                                                 id="bulkVariantNamesInput"
                                                 className="input-field textarea-field"
                                                 placeholder="Enter variant names, comma-separated (e.g., Sedan, SUV, Hatchback)"
                                                 value={bulkVariantNamesInput}
                                                 onChange={(e) => setBulkVariantNamesInput(e.target.value)}
                                                 disabled={loadingOperation || !selectedVehicleForVariantAdd}
                                                 rows="3"
                                             ></textarea>
                                             <button
                                                 className="primary-button"
                                                 onClick={handleBulkAddVariantsToExistingVehicle}
                                                 disabled={loadingOperation}
                                             >
                                                 {loadingOperation ? "Adding..." : "Add Variants to Selected Vehicle"}
                                             </button>
                                         </div>
                                     </section>

                                     <hr className="divider" />

                                     {/* --- Bulk Add Numbers to Existing Vehicle Variant Section --- */}
                                     <section className="add-section">
                                         <h2 className="section-title">Bulk Add Numbers to Existing Variant in "{selectedSiteForVehicleAdd}"</h2>
                                         <p className="instructions">
                                             Select an existing vehicle variant (from "{selectedSiteForVehicleAdd}") and then enter multiple numbers, comma-separated.
                                         </p>
                                         <div className="form-group column-layout">
                                             <label htmlFor="selectedVariantForNumbers">Select Vehicle Variant:</label>
                                             <SearchableDropdown
                                                 id="selectedVariantForNumbers"
                                                 value={(() => {
                                                     // Find the vehicle-variant combo that matches the selectedVariantForNumbers ID AND the currently selected site
                                                     const vehicle = allVehiclesData
                                                         .filter(v => v.siteName === selectedSiteForVehicleAdd)
                                                         .find(v => v.variants.some(varr => varr.id === selectedVariantForNumbers));
                                                     const variant = vehicle?.variants.find(varr => varr.id === selectedVariantForNumbers);
                                                     return variant ? `${vehicle.vehicleName} - ${variant.variantName}` : "";
                                                 })()}
                                                 options={allVehiclesData
                                                     .filter(v => v.siteName === selectedSiteForVehicleAdd) // Filter by currently selected vehicle management site
                                                     .flatMap(v => v.variants.map(varr => ({
                                                         id: varr.id,
                                                         fullName: `${v.vehicleName} - ${varr.variantName}`
                                                     })))
                                                     .map(item => item.fullName) // Only show the name for display
                                                 }
                                                 onChange={(selectedFullName) => {
                                                     // Parse selectedFullName to find the corresponding variant ID for the current site
                                                     const [vehicleName, variantName] = selectedFullName.split(' - ');
                                                     const vehicle = allVehiclesData.find(v => v.vehicleName === vehicleName && v.siteName === selectedSiteForVehicleAdd);
                                                     const variant = vehicle?.variants.find(v => v.variantName === variantName);
                                                     setSelectedVariantForNumbers(variant ? variant.id : "");
                                                     setBulkVehicleNumbersInput("");
                                                 }}
                                                 placeholder="-- Select a Vehicle Variant --"
                                                 disabled={loadingOperation || !selectedSiteForVehicleAdd}
                                             />

                                             <label htmlFor="bulkVehicleNumbersInput">Vehicle Numbers:</label>
                                             <textarea
                                                 id="bulkVehicleNumbersInput"
                                                 className="input-field textarea-field"
                                                 placeholder="Enter numbers, comma-separated (e.g., DL1C2345, MH01AB6789)"
                                                 value={bulkVehicleNumbersInput}
                                                 onChange={(e) => setBulkVehicleNumbersInput(e.target.value)}
                                                 disabled={loadingOperation || !selectedVariantForNumbers}
                                                 rows="3"
                                             ></textarea>
                                             <button
                                                 className="primary-button"
                                                 onClick={handleBulkAddNumbersToExistingVariant}
                                                 disabled={loadingOperation}
                                             >
                                                 {loadingOperation ? "Adding..." : "Add Numbers to Selected Variant"}
                                             </button>
                                         </div>
                                     </section>

                                     <hr className="divider" />

                                     {/* --- Manage Existing Vehicles Section --- */}
                                     <section className="edit-section">
                                         <h2 className="section-title">Manage Existing Vehicles in "{selectedSiteForVehicleAdd}"</h2>
                                         {loadingVehiclesData ? (
                                             <p className="loading-message">Loading existing vehicles...</p>
                                         ) : allVehiclesData.filter(v => v.siteName === selectedSiteForVehicleAdd).length === 0 ? (
                                             <p className="no-data-message">No vehicles added yet for this site. Add one above!</p>
                                         ) : (
                                             <ul className="edit-list">
                                                 {allVehiclesData.filter(v => v.siteName === selectedSiteForVehicleAdd).map(vehicle => (
                                                     <li key={vehicle.id} className="edit-list-item vehicle-variant-item-manage">
                                                         {editingVehicleName && editingVehicleName.id === vehicle.id ? (
                                                             <div className="edit-input-group">
                                                                 <input
                                                                     type="text"
                                                                     className="input-field"
                                                                     value={editingVehicleName?.vehicleName || ""}
                                                                     onChange={(e) =>
                                                                         setEditingVehicleName({ ...editingVehicleName, vehicleName: e.target.value })
                                                                     }
                                                                     disabled={loadingOperation}
                                                                 />
                                                                 <button
                                                                     className="action-button save-button"
                                                                     onClick={handleUpdateVehicleName}
                                                                     disabled={loadingOperation}
                                                                 >
                                                                     Save
                                                                 </button>
                                                                 <button
                                                                     className="action-button cancel-button"
                                                                     onClick={() => setEditingVehicleName(null)}
                                                                     disabled={loadingOperation}
                                                                 >
                                                                     Cancel
                                                                 </button>
                                                             </div>
                                                         ) : (
                                                             <>
                                                                 <span className="item-name">
                                                                     <strong>Vehicle Name:</strong> {vehicle.vehicleName}
                                                                 </span>
                                                                 <div className="action-buttons-group">
                                                                     <button
                                                                         className="action-button edit-button"
                                                                         onClick={() => handleEditVehicleName(vehicle)}
                                                                         disabled={loadingOperation}
                                                                     >
                                                                         <i className="fas fa-edit"></i> Edit Name
                                                                     </button>
                                                                     <button
                                                                         className="action-button delete-button"
                                                                         onClick={() => handleDeleteVehicleName(vehicle.id, vehicle.vehicleName, vehicle.siteName)}
                                                                         disabled={loadingOperation}
                                                                     >
                                                                         <i className="fas fa-trash"></i> Delete Vehicle
                                                                     </button>
                                                                 </div>
                                                             </>
                                                         )}

                                                         <ul className="vehicle-variants-list nested-list">
                                                             {vehicle.variants && vehicle.variants.length > 0 ? (
                                                                 vehicle.variants.map((variant, varIndex) => (
                                                                     <li key={variant.id} className="edit-list-item nested-list-item">
                                                                         {editingVariant && editingVariant.id === variant.id ? (
                                                                             <div className="edit-input-group">
                                                                                 <input
                                                                                     type="text"
                                                                                     className="input-field"
                                                                                     value={editingVariant?.variantName || ""}
                                                                                     onChange={(e) =>
                                                                                         setEditingVariant({ ...editingVariant, variantName: e.target.value })
                                                                                     }
                                                                                     disabled={loadingOperation}
                                                                                 />
                                                                                 <button
                                                                                     className="action-button save-button"
                                                                                     onClick={handleUpdateVariant}
                                                                                     disabled={loadingOperation}
                                                                                 >
                                                                                     Save
                                                                                 </button>
                                                                                 <button
                                                                                     className="action-button cancel-button"
                                                                                     onClick={() => setEditingVariant(null)}
                                                                                     disabled={loadingOperation}
                                                                                 >
                                                                                     Cancel
                                                                                 </button>
                                                                             </div>
                                                                         ) : (
                                                                             <>
                                                                                 <span>Variant: {variant.variantName}</span>
                                                                                 <div className="action-buttons-group">
                                                                                     <button
                                                                                         className="action-button edit-button"
                                                                                         onClick={() => handleEditVariant(vehicle.id, vehicle.siteName, variant)}
                                                                                         disabled={loadingOperation}
                                                                                     >
                                                                                         <i className="fas fa-edit"></i> Edit Variant
                                                                                     </button>
                                                                                     <button
                                                                                         className="action-button delete-button"
                                                                                         onClick={() => handleDeleteVariant(vehicle.id, variant.id, variant.variantName, vehicle.siteName)}
                                                                                         disabled={loadingOperation}
                                                                                     >
                                                                                         <i className="fas fa-trash"></i> Delete Variant
                                                                                     </button>
                                                                                 </div>
                                                                             </>
                                                                         )}

                                                                         <ul className="vehicle-numbers-list nested-nested-list">
                                                                             {variant.numbers && variant.numbers.length > 0 ? (
                                                                                 variant.numbers.map((number, numIndex) => (
                                                                                     <li key={numIndex} className="edit-list-item nested-nested-list-item">
                                                                                         {editingVehicleNumber && editingVehicleNumber.variantId === variant.id && editingVehicleNumber.originalNumber === number ? (
                                                                                             <div className="edit-input-group">
                                                                                                 <input
                                                                                                     type="text"
                                                                                                     className="input-field"
                                                                                                     value={editingVehicleNumber?.numberValue || ""}
                                                                                                     onChange={(e) =>
                                                                                                         setEditingVehicleNumber({ ...editingVehicleNumber, numberValue: e.target.value })
                                                                                                     }
                                                                                                     disabled={loadingOperation}
                                                                                                 />
                                                                                                 <button
                                                                                                     className="action-button save-button"
                                                                                                     onClick={handleUpdateVehicleNumber}
                                                                                                     disabled={loadingOperation}
                                                                                                 >
                                                                                                     Save
                                                                                                 </button>
                                                                                                 <button
                                                                                                     className="action-button cancel-button"
                                                                                                     onClick={() => setEditingVehicleNumber(null)}
                                                                                                     disabled={loadingOperation}
                                                                                                 >
                                                                                                     Cancel
                                                                                                 </button>
                                                                                             </div>
                                                                                         ) : (
                                                                                             <>
                                                                                                 <span>Number: {number}</span>
                                                                                                 <div className="action-buttons-group">
                                                                                                     <button
                                                                                                         className="action-button edit-button"
                                                                                                         onClick={() => handleEditVehicleNumber(vehicle.id, variant.id, number, vehicle.siteName)}
                                                                                                         disabled={loadingOperation}
                                                                                                     >
                                                                                                         <i className="fas fa-edit"></i> Edit
                                                                                                     </button>
                                                                                                     <button
                                                                                                         className="action-button delete-button"
                                                                                                         onClick={() => handleDeleteVehicleNumber(vehicle.id, variant.id, number, variant.variantName, vehicle.siteName)}
                                                                                                         disabled={loadingOperation}
                                                                                                     >
                                                                                                         <i className="fas fa-trash"></i> Delete
                                                                                                     </button>
                                                                                                 </div>
                                                                                             </>
                                                                                         )}
                                                                                     </li>
                                                                                 ))
                                                                             ) : (
                                                                                 <li className="no-data-message">No numbers added for this variant.</li>
                                                                             )}
                                                                         </ul>
                                                                     </li>
                                                                 ))
                                                             ) : (
                                                                 <li className="no-data-message">No variants added for this vehicle.</li>
                                                             )}
                                                         </ul>
                                                     </li>
                                                 ))}
                                             </ul>
                                         )}
                                     </section>
                                 </>
                             )} {/* End of selectedSiteForVehicleAdd conditional rendering */}
                    </div>
                )}
            </div>

            {/* Theme List Modal */}
            {showThemeListModal && (
                <div className="theme-list-modal-overlay">
                    <div className="theme-list-modal-content">
                        <button className="theme-list-close-btn" onClick={() => setShowThemeListModal(false)}>
                            <i className="fas fa-times"></i>
                        </button>
                        <h3>Choose Theme</h3>
                        <div className="theme-list-grid">
                            {availableThemes.map((theme) => (
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
        </div>
    );
};

export default FuelEntryPage;