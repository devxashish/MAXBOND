import React, { useEffect, useState, useCallback, useReducer, useRef } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  setDoc,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from 'react-select';
import "../styles/received-used.css";
import "../styles/Addpage.css"; // Keep this for shared styles

// Import unit conversion helpers from the new utility file
import { unitConversionRates, getUnitCategory, convertUnit } from "../utils/unitConversions";


// --- Reducer for complex item state (Copied from AddPage) ---
const itemReducer = (state, action) => {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "ADD_VARIANT":
      return { ...state, variants: [...state.variants, { name: "" }] };
    case "UPDATE_VARIANT":
      const updatedVariants = state.variants.map((variant, index) =>
        index === action.index ? { ...variant, name: action.value } : variant
      );
      return { ...state, variants: updatedVariants };
    case "REMOVE_VARIANT":
      return {
        ...state,
        variants: state.variants.filter((_, index) => index !== action.index),
      };
    case "ADD_ITEM_UNIT":
      return { ...state, itemUnits: [...state.itemUnits, { name: "" }] };
    case "UPDATE_ITEM_UNIT":
      const updatedItemUnits = state.itemUnits.map((unit, index) =>
        index === action.index ? { ...unit, name: action.value } : unit
      );
      return { ...state, itemUnits: updatedItemUnits };
    case "REMOVE_ITEM_UNIT":
      return {
        ...state,
        itemUnits: state.itemUnits.filter((_, index) => index !== action.index),
      };
    case "RESET_ITEM":
      return {
        name: "",
        hasVariants: false,
        variants: [{ name: "" }],
        hasMultipleUnits: false,
        itemUnits: [{ name: "" }], // Default to an empty unit or 'No Unit' for single
      };
    case "SET_ITEM_STATE": // New action to set state directly for editing
      return action.value;
    default:
      return state;
  }
};

// --- Base Unit Suggestions (initial client-side defaults, will be loaded from Firestore) ---
const baseUnitsSuggestions = [
  "kg", "pcs", "litre", "meter", "box", "crate", "packet"
];

// --- SearchableDropdown Component (Moved from AddPage for reuse) ---
const SearchableDropdown = ({ value, options, onChange, placeholder, disabled, id, className = "" }) => {
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
    onChange(newValue); // Pass the current input value immediately for direct text entry
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

  return (
    <div className={`searchable-dropdown-wrapper ${className}`} ref={wrapperRef}>
      <input
        type="text"
        id={id}
        className="input-field select-field"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        disabled={disabled}
        autoComplete="off"
      />
      {showOptions && filteredOptions.length > 0 && (
        <ul className="searchable-dropdown-options">
          {filteredOptions.map((option, index) => (
            <li
              key={index}
              onClick={() => handleOptionClick(option)}
              className="searchable-dropdown-option-item"
            >
              {option}
            </li>
          ))}
        </ul>
      )}
      {showOptions && filteredOptions.length === 0 && inputValue && (
        <p className="no-matches-message">No matching units found.</p>
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


const ReceivedUsedPage = () => {
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userRoles, setUserRoles] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [sites, setSites] = useState([]);
  const [items, setItems] = useState([]); // All items, global list

  const [allSiteSelectOptions, setAllSiteSelectOptions] = useState([]);
  const [allItemVariantSelectOptions, setAllItemVariantSelectOptions] = useState([]);

  // Filtered options for React-Select dropdowns
  const [filteredSiteOptionsInward, setFilteredSiteOptionsInward] = useState([]);
  const [filteredSiteOptionsOutward, setFilteredSiteOptionsOutward] = useState([]);
  const [filteredSiteOptionsFromTransfer, setFilteredSiteOptionsFromTransfer] = useState([]);
  const [filteredSiteOptionsToTransfer, setFilteredSiteOptionsToTransfer] = useState([]);
  const [filteredItemVariantOptionsInward, setFilteredItemVariantOptionsInward] = useState([]);
  const [filteredItemVariantOptionsOutward, setFilteredItemVariantOptionsOutward] = useState([]);
  const [filteredItemVariantOptionsTransfer, setFilteredItemVariantOptionsTransfer] = useState([]);
  const [filteredEditingTransferItemVariantOptions, setFilteredEditingTransferItemVariantOptions] = useState([]);
  const [filteredEditingTransferSiteOptions, setFilteredEditingTransferSiteOptions] = useState([]);

  const [selectedItemVariantOption, setSelectedItemVariantOption] = useState(null);
  const [selectedUnitOptionInward, setSelectedUnitOptionInward] = useState(null);
  const [selectedUnitOptionOutward, setSelectedUnitOptionOutward] = useState(null);
  const [selectedUnitOptionTransfer, setSelectedUnitOptionTransfer] = useState(null);

  // Use a single state for the globally selected site
  const [selectedSiteGlobally, setSelectedSiteGlobally] = useState(null);

  // Directly use selectedSiteGlobally for these
  const [selectedSiteOptionFromTransfer, setSelectedSiteOptionFromTransfer] = useState(null);
  const [selectedSiteOptionToTransfer, setSelectedSiteOptionToTransfer] = useState(null);

  const [currentSelectedFullItem, setCurrentSelectedFullItem] = useState(null);

  const [showCalendar, setShowCalendar] = useState(false);
  const [activeTab, setActiveTab] = useState("in");

  const [inwardForm, setInwardForm] = useState({
    siteId: "", itemId: "", variantId: "", unit: "", quantity: "", date: new Date(),
  });

  const [outwardForm, setOutwardForm] = useState({
    siteId: "", itemId: "", variantId: "", unit: "", quantity: "", date: new Date(),
  });

  const [transferForm, setTransferForm] = useState({
    fromSiteId: "", toSiteId: "", itemId: "", variantId: "", unit: "", quantity: "", date: new Date(),
  });

  const [editingTransfer, setEditingTransfer] = useState(null);
  const [editingTransferItemVariantOption, setEditingTransferItemVariantOption] = useState(null);
  const [editingTransferUnitOption, setEditingTransferUnitOption] = useState(null);
  const [editingTransferSiteOption, setEditingTransferSiteOption] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // States for Add Item tab (within ReceivedUsedPage)
  const [itemState, dispatchItem] = useReducer(itemReducer, {
    name: "",
    hasVariants: false,
    variants: [{ name: "" }],
    hasMultipleUnits: false,
    itemUnits: [{ name: "" }],
  });
  const [globalUnitList, setGlobalUnitList] = useState([]);
  const [editingUserItem, setEditingUserItem] = useState(null); // Item currently being edited in "Manage Your Added Items"

  // Theme state
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'

  // Effect to apply theme class to body
  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [theme]);

  // Toggle theme handler
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };


  // Fetch user-specific transfers
  const fetchTransfers = useCallback(async (uid) => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "users", uid, "transfers"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      setTransfers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching transfers:", err);
      setError("Failed to load transfers.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch GLOBAL sites
  const fetchSites = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "sites"));
      const fetchedSites = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSites(fetchedSites);
      setAllSiteSelectOptions(fetchedSites.map(s => ({ value: s.id, label: s.name })));
    } catch (err) {
      console.error("Error fetching sites:", err);
      setError("Failed to load sites.");
    }
  }, []);

  // Fetch GLOBAL items, variants, and units (used for both transactions and item management)
  const fetchItems = useCallback(async () => {
    try {
      const itemsSnapshot = await getDocs(collection(db, "items"));
      const variantsSnapshot = await getDocs(collection(db, "itemVariants"));
      const unitsSnapshot = await getDocs(collection(db, "itemUnits"));

      const fetchedVariants = variantsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const fetchedUnits = unitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const allItemsData = itemsSnapshot.docs.map((itemDoc) => {
        const itemData = { id: itemDoc.id, ...itemDoc.data() };
        itemData.variants = itemData.hasVariants ? fetchedVariants.filter(v => v.itemId === itemDoc.id) : [];
        itemData.itemUnits = itemData.hasMultipleUnits ? fetchedUnits.filter(u => u.itemId === itemDoc.id) : [{ name: itemData.unit || 'pcs', id: `${itemDoc.id}-${itemData.unit || 'pcs'}` }];
        return itemData;
      });

      setItems(allItemsData); // This sets the global `items` state

      // Prepare options for React-Select dropdowns (all items)
      const itemVariantOptions = [];
      allItemsData.forEach(item => {
        if (item.hasVariants && item.variants.length > 0) {
          item.variants.forEach(variant => {
            itemVariantOptions.push({
              value: `${item.id}|${variant.id}`, label: `${item.name} - ${variant.name}`,
              itemId: item.id, variantId: variant.id, itemName: item.name, variantName: variant.name, fullItem: item
            });
          });
        } else {
          itemVariantOptions.push({
            value: `${item.id}|`, label: `${item.name}`,
            itemId: item.id, variantId: null, itemName: item.name, fullItem: item
          });
        }
      });
      setAllItemVariantSelectOptions(itemVariantOptions);

    } catch (err) {
      console.error("Error fetching items, variants, or units:", err);
      setError("Failed to load items data.");
    }
  }, []);

  // Fetch global unit suggestions from Firestore
  const fetchGlobalUnits = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "globalUnits"));
      const fetchedUnits = querySnapshot.docs.map((doc) => doc.data().name);
      const combinedUnits = [...new Set([...baseUnitsSuggestions, ...fetchedUnits])];
      setGlobalUnitList(combinedUnits.sort());
    } catch (err) {
      console.error("Error fetching global units:", err);
      setError("Failed to load global unit suggestions.");
      setGlobalUnitList(baseUnitsSuggestions.sort());
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setUserName(user.displayName || user.email || "Unknown User");

        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserRoles(userDoc.data().roles || []);
            // Load globally selected site from user preferences if available
            const preferredSiteId = userDoc.data().preferredSiteId;
            if (preferredSiteId) {
              const site = (await getDoc(doc(db, "sites", preferredSiteId))).data();
              if (site) {
                setSelectedSiteGlobally({ value: preferredSiteId, label: site.name });
              }
            }
          } else {
            setUserRoles([]);
          }
        } catch (error) {
          console.error("Error fetching user role or preferred site:", error);
          setUserRoles([]);
        }

        fetchTransfers(user.uid);
        fetchSites();
        fetchItems();
        fetchGlobalUnits();
      } else {
        // Clear all states if user logs out
        setUserId("");
        setUserName("");
        setUserRoles([]);
        setTransfers([]);
        setSites([]);
        setItems([]);
        setAllSiteSelectOptions([]);
        setAllItemVariantSelectOptions([]);
        setFilteredSiteOptionsInward([]);
        setFilteredSiteOptionsOutward([]);
        setFilteredSiteOptionsFromTransfer([]);
        setFilteredSiteOptionsToTransfer([]);
        setFilteredItemVariantOptionsInward([]);
        setFilteredItemVariantOptionsOutward([]);
        setFilteredItemVariantOptionsTransfer([]);
        setFilteredEditingTransferItemVariantOptions([]);
        setFilteredEditingTransferSiteOptions([]);
        setSelectedUnitOptionInward(null);
        setSelectedUnitOptionOutward(null);
        setSelectedUnitOptionTransfer(null);
        setSelectedSiteOptionFromTransfer(null);
        setSelectedSiteOptionToTransfer(null);
        setSelectedSiteGlobally(null); // Clear global site on logout
        setCurrentSelectedFullItem(null);
        setError("Access Denied: Please log in to view this page.");
        setIsLoading(false); // Ensure loading state is reset
      }
    });
    return () => unsubscribe();
  }, [fetchTransfers, fetchSites, fetchItems, fetchGlobalUnits]);


  // Effect to set initial form siteId from selectedSiteGlobally
  useEffect(() => {
    if (selectedSiteGlobally) {
      setInwardForm(prev => ({ ...prev, siteId: selectedSiteGlobally.value }));
      setOutwardForm(prev => ({ ...prev, siteId: selectedSiteGlobally.value }));
    } else {
      setInwardForm(prev => ({ ...prev, siteId: "" }));
      setOutwardForm(prev => ({ ...prev, siteId: "" }));
    }
  }, [selectedSiteGlobally]);


  const filterSelectOptions = (inputValue, allOptions, setter) => {
    if (!inputValue) {
      setter([]); // Don't show options until something is typed
      return;
    }
    const lowerCaseInput = inputValue.toLowerCase();
    const filtered = allOptions.filter(option =>
      option.label.toLowerCase().includes(lowerCaseInput)
    );
    setter(filtered);
  };

  const handleSiteInputChangeInward = (inputValue) => filterSelectOptions(inputValue, allSiteSelectOptions, setFilteredSiteOptionsInward);
  const handleSiteInputChangeOutward = (inputValue) => filterSelectOptions(inputValue, allSiteSelectOptions, setFilteredSiteOptionsOutward);
  const handleSiteInputChangeFromTransfer = (inputValue) => filterSelectOptions(inputValue, allSiteSelectOptions, setFilteredSiteOptionsFromTransfer);
  const handleSiteInputChangeToTransfer = (inputValue) => filterSelectOptions(inputValue, allSiteSelectOptions, setFilteredSiteOptionsToTransfer);
  const handleEditingSiteInputChange = (inputValue) => filterSelectOptions(inputValue, allSiteSelectOptions, setFilteredEditingTransferSiteOptions);


  const handleItemVariantInputChangeInward = (inputValue) => filterSelectOptions(inputValue, allItemVariantSelectOptions, setFilteredItemVariantOptionsInward);
  const handleItemVariantInputChangeOutward = (inputValue) => filterSelectOptions(inputValue, allItemVariantSelectOptions, setFilteredItemVariantOptionsOutward);
  const handleItemVariantInputChangeTransfer = (inputValue) => filterSelectOptions(inputValue, allItemVariantSelectOptions, setFilteredItemVariantOptionsTransfer);
  const handleEditingItemVariantInputChange = (inputValue) => filterSelectOptions(inputValue, allItemVariantSelectOptions, setFilteredEditingTransferItemVariantOptions);


  const handleItemVariantSelectChange = (selectedOption, formType) => {
    setSelectedItemVariantOption(selectedOption);
    const fullItem = selectedOption ? items.find(i => i.id === selectedOption.itemId) : null;
    setCurrentSelectedFullItem(fullItem);

    const updateForm = (formSetter) => {
      formSetter(prev => ({
        ...prev,
        itemId: selectedOption ? selectedOption.itemId : "",
        variantId: selectedOption ? selectedOption.variantId : "",
        unit: "",
      }));
    };

    if (formType === "inward") {
      updateForm(setInwardForm); setSelectedUnitOptionInward(null); setFilteredItemVariantOptionsInward([]);
    } else if (formType === "outward") {
      updateForm(setOutwardForm); setSelectedUnitOptionOutward(null); setFilteredItemVariantOptionsOutward([]);
    } else if (formType === "transfer") {
      updateForm(setTransferForm); setSelectedUnitOptionTransfer(null); setFilteredItemVariantOptionsTransfer([]);
    }
  };

  const handleUnitSelectChange = (selectedOption, formType) => {
    const updateForm = (formSetter) => {
      formSetter(prev => ({ ...prev, unit: selectedOption ? selectedOption.value : "" }));
    };

    if (formType === "inward") {
      updateForm(setInwardForm); setSelectedUnitOptionInward(selectedOption);
    } else if (formType === "outward") {
      updateForm(setOutwardForm); setSelectedUnitOptionOutward(selectedOption);
    } else if (formType === "transfer") {
      updateForm(setTransferForm); setSelectedUnitOptionTransfer(selectedOption);
    }
  };

  // This function now handles updating the global site preference
  const handleSiteSelectChangeAndSetGlobal = async (selectedOption, formType) => {
    setSelectedSiteGlobally(selectedOption); // Update the global site state

    // Also update the specific form's site ID
    if (formType === "inward") {
      setInwardForm(prev => ({ ...prev, siteId: selectedOption ? selectedOption.value : "" }));
      setFilteredSiteOptionsInward([]);
    } else if (formType === "outward") {
      setOutwardForm(prev => ({ ...prev, siteId: selectedOption ? selectedOption.value : "" }));
      setFilteredSiteOptionsOutward([]);
    }

    // Save the preferred site to user's Firestore document
    if (userId) {
      try {
        await updateDoc(doc(db, "users", userId), {
          preferredSiteId: selectedOption ? selectedOption.value : null
        });
        setSuccessMessage("Default site set and applied!");
      } catch (err) {
        console.error("Error setting preferred site:", err);
        setError("Failed to save default site preference.");
      } finally {
        setTimeout(() => { setSuccessMessage(null); setError(null); }, 3000);
      }
    }
  };

  const handleTransferSiteChange = (selectedOption, siteType) => {
    if (siteType === "from") {
      setSelectedSiteOptionFromTransfer(selectedOption); setTransferForm(prev => ({ ...prev, fromSiteId: selectedOption ? selectedOption.value : "" })); setFilteredSiteOptionsFromTransfer([]);
    } else {
      setSelectedSiteOptionToTransfer(selectedOption); setTransferForm(prev => ({ ...prev, toSiteId: selectedOption ? selectedOption.value : "" })); setFilteredSiteOptionsToTransfer([]);
    }
  };

  const handleQuantityChange = (e, formType) => {
    const { value } = e.target;
    const setter = formType === "inward" ? setInwardForm : formType === "outward" ? setOutwardForm : setTransferForm;
    setter(prev => ({ ...prev, quantity: value }));
  };

  const addSingleTransferRecord = async (type, formData, transferId = null, remark = null) => {
    const { siteId, itemId, variantId, unit, quantity, date } = formData;
    const selectedSite = sites.find((s) => s.id === siteId);
    const selectedItem = items.find((i) => i.id === itemId);

    if (!selectedSite || !selectedItem) {
      setError("Invalid site or item selected. Please select from available options.");
      return false;
    }
    if (selectedItem.hasVariants && !variantId) {
      setError("Please select a variant for this item.");
      return false;
    }
    const isValidUnit = selectedItem.itemUnits.some(iu => iu.name === unit);
    if (!isValidUnit) {
      setError("Selected unit is not valid for this item.");
      return false;
    }
    if (Number(quantity) <= 0) {
      setError("Quantity must be a positive number.");
      return false;
    }

    try {
      await addDoc(collection(db, "users", userId, "transfers"), {
        type: type,
        timestamp: date || serverTimestamp(),
        siteId: siteId,
        siteName: selectedSite.name,
        itemName: selectedItem.name,
        itemId: itemId,
        variantName: selectedItem.variants.find(v => v.id === variantId)?.name || null,
        variantId: variantId || null,
        unit: unit,
        quantity: Number(quantity),
        toSite: type === "inward" ? selectedSite.name : null,
        fromSite: type === "outward" ? selectedSite.name : null,
        transferId: transferId,
        remark: remark,
        userId: userId,
        userName: auth.currentUser?.displayName || auth.currentUser?.email || "Unknown User",
      });
      return true;
    } catch (err) {
      console.error(`Error adding ${type} transfer:`, err);
      setError(`Failed to record ${type} transaction. Please try again.`);
      return false;
    }
  };

  const handleAddInward = async () => {
    if (!userId) { setError("User not authenticated."); return; }
    setIsLoading(true); setError(null); setSuccessMessage(null);
    const success = await addSingleTransferRecord("inward", inwardForm);
    if (success) {
      setInwardForm({ siteId: selectedSiteGlobally?.value || "", itemId: "", variantId: "", unit: "", quantity: "", date: new Date() });
      setSelectedItemVariantOption(null); setSelectedUnitOptionInward(null); setCurrentSelectedFullItem(null);
      setFilteredSiteOptionsInward([]); setFilteredItemVariantOptionsInward([]);
      await fetchTransfers(userId); setSuccessMessage(`Item received successfully!`);
    }
    setIsLoading(false);
    setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
  };

  const handleAddOutward = async () => {
    if (!userId) { setError("User not authenticated."); return; }
    setIsLoading(true); setError(null); setSuccessMessage(null);
    const success = await addSingleTransferRecord("outward", outwardForm);
    if (success) {
      setOutwardForm({ siteId: selectedSiteGlobally?.value || "", itemId: "", variantId: "", unit: "", quantity: "", date: new Date() });
      setSelectedItemVariantOption(null); setSelectedUnitOptionOutward(null); setCurrentSelectedFullItem(null);
      setFilteredSiteOptionsOutward([]); setFilteredItemVariantOptionsOutward([]);
      await fetchTransfers(userId); setSuccessMessage(`Item used successfully!`);
    }
    setIsLoading(false);
    setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
  };

  const handleAddTransfer = async () => {
    if (!userId) { setError("User not authenticated."); return; }
    const { fromSiteId, toSiteId, itemId, variantId, unit, quantity, date } = transferForm;

    if (!fromSiteId || !toSiteId || !itemId || !unit || !quantity || quantity <= 0) {
      setError("Please fill all required fields (From Site, To Site, Item, Unit, Quantity) and ensure quantity is positive."); return;
    }
    if (fromSiteId === toSiteId) { setError("From Site and To Site cannot be the same for a transfer."); return; }

    setIsLoading(true); setError(null); setSuccessMessage(null);

    const newTransferRef = doc(collection(db, "users", userId, "transfers"));
    const newTransferId = newTransferRef.id;

    const fromSiteName = sites.find(s => s.id === fromSiteId)?.name;
    const toSiteName = sites.find(s => s.id === toSiteId)?.name;
    const currentUserName = auth.currentUser?.displayName || auth.currentUser?.email || "Unknown User";

    const selectedItem = items.find((i) => i.id === itemId);
    const selectedVariant = selectedItem?.variants.find(v => v.id === variantId)?.name || null;

    try {
      await setDoc(newTransferRef, {
        type: "outward",
        timestamp: date || serverTimestamp(),
        siteId: fromSiteId,
        siteName: fromSiteName,
        itemName: selectedItem.name,
        itemId: itemId,
        variantName: selectedVariant,
        variantId: variantId || null,
        unit: unit,
        quantity: Number(quantity),
        fromSite: fromSiteName,
        toSite: null,
        transferId: newTransferId,
        remark: `Transferred to ${toSiteName} by ${currentUserName}`,
        userId: userId,
        userName: currentUserName,
      });
    } catch (err) {
      console.error("Error adding outward leg of transfer:", err);
      setError("Failed to record outward leg of transfer. Please try again.");
      setIsLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, "users", userId, "transfers"), {
        type: "inward",
        timestamp: date || serverTimestamp(),
        siteId: toSiteId,
        siteName: toSiteName,
        itemName: selectedItem.name,
        itemId: itemId,
        variantName: selectedVariant,
        variantId: variantId || null,
        unit: unit,
        quantity: Number(quantity),
        toSite: toSiteName,
        fromSite: null,
        transferId: newTransferId,
        remark: `Transferred from ${fromSiteName} by ${currentUserName}`,
        userId: userId,
        userName: currentUserName,
      });
    } catch (err) {
      console.error("Error adding inward leg of transfer:", err);
      setError("Inward transfer failed. Partial transfer recorded (outward only). Please contact support.");
      setIsLoading(false);
      return;
    }

    setTransferForm({ fromSiteId: "", toSiteId: "", itemId: "", variantId: "", unit: "", quantity: "", date: new Date() });
    setSelectedSiteOptionFromTransfer(null); setSelectedSiteOptionToTransfer(null);
    setSelectedItemVariantOption(null); setSelectedUnitOptionTransfer(null); setCurrentSelectedFullItem(null);
    setFilteredSiteOptionsFromTransfer([]); setFilteredSiteOptionsToTransfer([]); setFilteredItemVariantOptionsTransfer([]);

    await fetchTransfers(userId);
    setSuccessMessage(`Item transferred successfully from ${fromSiteName} to ${toSiteName}!`);
    setIsLoading(false);
    setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
  };


  const handleEditTransfer = (transfer) => {
    const transferDate = transfer.timestamp?.toDate ? transfer.timestamp.toDate() : new Date();
    setEditingTransfer({ ...transfer, date: transferDate });

    const originalFullItem = items.find(item => item.id === transfer.itemId);
    setCurrentSelectedFullItem(originalFullItem);

    const itemVariantOptionValue = `${transfer.itemId}|${transfer.variantId || ''}`;
    const initialItemVariantOption = allItemVariantSelectOptions.find(opt => opt.value === itemVariantOptionValue);
    setEditingTransferItemVariantOption(initialItemVariantOption || null);
    // When setting an initial option, ensure it's in the filtered list
    setFilteredEditingTransferItemVariantOptions(initialItemVariantOption ? [initialItemVariantOption] : []);

    const initialUnitOption = originalFullItem?.itemUnits.find(u => u.name === transfer.unit);
    setEditingTransferUnitOption(initialUnitOption ? { value: initialUnitOption.name, label: initialUnitOption.name } : null);

    const initialSiteOption = allSiteSelectOptions.find(opt => opt.value === transfer.siteId);
    setEditingTransferSiteOption(initialSiteOption || null);
    // When setting an initial option, ensure it's in the filtered list
    setFilteredEditingTransferSiteOptions(initialSiteOption ? [initialSiteOption] : []);
  };

  const handleEditingItemVariantSelectChange = (selectedOption) => {
    setEditingTransferItemVariantOption(selectedOption);
    setEditingTransfer(prev => ({
        ...prev,
        itemId: selectedOption ? selectedOption.itemId : "",
        variantId: selectedOption ? selectedOption.variantId : "",
        unit: "", // Reset unit when item/variant changes
        itemName: selectedOption ? selectedOption.itemName : "",
        variantName: selectedOption ? selectedOption.variantName : "",
    }));
    setEditingTransferUnitOption(null); // Clear unit selection
    setCurrentSelectedFullItem(selectedOption ? items.find(i => i.id === selectedOption.itemId) : null);
    setFilteredEditingTransferItemVariantOptions([]); // Clear filtered options after selection
  };

  const handleEditingUnitSelectChange = (selectedOption) => {
    setEditingTransferUnitOption(selectedOption);
    setEditingTransfer(prev => ({
        ...prev,
        unit: selectedOption ? selectedOption.value : "",
    }));
  };

  const handleEditingSiteSelectChange = (selectedOption) => {
    setEditingTransferSiteOption(selectedOption);
    setEditingTransfer(prev => ({
        ...prev,
        siteId: selectedOption ? selectedOption.value : "",
        siteName: selectedOption ? selectedOption.label : "",
    }));
    setFilteredEditingTransferSiteOptions([]); // Clear filtered options after selection
  };

  const handleUpdateTransfer = async () => {
    if (!editingTransfer || !userId) { setError("No transfer selected for editing or user not authenticated."); return; }
    const { id, type, siteId, itemId, variantId, unit, quantity, date, transferId, remark } = editingTransfer;
    if (!siteId || !itemId || !unit || !quantity || quantity <= 0) { setError("Please fill all required fields (Site, Item, Unit, Quantity) and ensure quantity is positive for update."); return; }

    const selectedSite = sites.find((s) => s.id === siteId);
    const selectedItem = items.find((i) => i.id === itemId);
    if (!selectedSite || !selectedItem) { setError("Invalid site or item selected for update."); return; }
    if (selectedItem.hasVariants && !variantId) { setError("Please select a variant for this item during update."); return; }
    if (!selectedItem.itemUnits.some(iu => iu.name === unit)) { setError("Selected unit is not valid for this item during update."); return; }

    setIsLoading(true); setError(null); setSuccessMessage(null);
    try {
      if (transferId) {
        const linkedTransfersQuery = query(
          collection(db, "users", userId, "transfers"),
          where("transferId", "==", transferId)
        );
        const linkedSnapshot = await getDocs(linkedTransfersQuery);

        await Promise.all(linkedSnapshot.docs.map(async (docSnapshot) => {
          const docRef = doc(db, "users", userId, "transfers", docSnapshot.id);
          const originalData = docSnapshot.data();

          const updateData = {
            timestamp: date,
            itemName: selectedItem.name,
            itemId: itemId,
            variantName: selectedItem.variants.find(v => v.id === variantId)?.name || null,
            variantId: variantId || null,
            unit: unit,
            quantity: Number(quantity),
          };

          if (originalData.type === "inward") {
            updateData.siteId = originalData.id === id ? siteId : originalData.siteId;
            updateData.siteName = originalData.id === id ? selectedSite.name : originalData.siteName;
            const otherLeg = linkedSnapshot.docs.find(d => d.id !== originalData.id);
            if (otherLeg) {
              const updatedFromSiteName = sites.find(s => s.id === otherLeg.data().siteId)?.name;
              updateData.remark = `Transferred from ${updatedFromSiteName} by ${auth.currentUser?.displayName || auth.currentUser?.email || "Unknown User"}`;
            }
          } else if (originalData.type === "outward") {
            updateData.siteId = originalData.id === id ? siteId : originalData.siteId;
            updateData.siteName = originalData.id === id ? selectedSite.name : originalData.siteName;
            const otherLeg = linkedSnapshot.docs.find(d => d.id !== originalData.id);
            if (otherLeg) {
              const updatedToSiteName = sites.find(s => s.id === otherLeg.data().siteId)?.name;
              updateData.remark = `Transferred to ${updatedToSiteName} by ${auth.currentUser?.displayName || auth.currentUser?.email || "Unknown User"}`;
            }
          } else {
              updateData.remark = remark;
          }

          await updateDoc(docRef, updateData);
        }));

      } else {
        const transferRef = doc(db, "users", userId, "transfers", id);
        await updateDoc(transferRef, {
          timestamp: date,
          siteId: siteId,
          siteName: selectedSite.name,
          itemName: selectedItem.name,
          itemId: itemId,
          variantName: selectedItem.variants.find(v => v.id === variantId)?.name || null,
          variantId: variantId || null,
          unit: unit,
          quantity: Number(quantity),
          toSite: type === "inward" ? selectedSite.name : null,
          fromSite: type === "outward" ? selectedSite.name : null,
          remark: remark,
        });
      }

      setEditingTransfer(null);
      setEditingTransferItemVariantOption(null);
      setEditingTransferUnitOption(null);
      setEditingTransferSiteOption(null);
      setCurrentSelectedFullItem(null);
      setFilteredEditingTransferItemVariantOptions([]);
      setFilteredEditingTransferSiteOptions([]);
      await fetchTransfers(userId);
      setSuccessMessage("Transaction updated successfully!");

    } catch (err) {
      console.error("Error updating transfer:", err);
      setError("Failed to update transaction. Please try again.");
    } finally {
      setIsLoading(false);
      setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
    }
  };


  const handleDeleteTransfer = async (transferIdToDelete) => {
    if (!userId || !window.confirm("Are you sure you want to delete this transaction? If it's part of a transfer, both linked records will be deleted.")) { return; }
    setIsLoading(true); setError(null); setSuccessMessage(null);

    try {
      const transferToDelete = transfers.find(t => t.id === transferIdToDelete);

      if (transferToDelete && transferToDelete.transferId) {
        const linkedTransfersQuery = query(
          collection(db, "users", userId, "transfers"),
          where("transferId", "==", transferToDelete.transferId)
        );
        const linkedSnapshot = await getDocs(linkedTransfersQuery);
        await Promise.all(linkedSnapshot.docs.map(docSnapshot =>
          deleteDoc(doc(db, "users", userId, "transfers", docSnapshot.id))
        ));
        setSuccessMessage("Linked transfer records deleted successfully!");
      } else {
        const transferRef = doc(db, "users", userId, "transfers", transferIdToDelete);
        await deleteDoc(transferRef);
        setSuccessMessage("Transaction deleted successfully!");
      }

      await fetchTransfers(userId);
    } catch (err) {
      console.error("Error deleting transfer:", err);
      setError("Failed to delete transaction. Please try again.");
    } finally {
      setIsLoading(false);
      setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
    }
  };

  const formatDate = (ts) => {
    const date = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
    return date ? date.toLocaleDateString("en-IN") : "-";
  };

  const inwardTransfers = transfers.filter((t) => t.type === "inward");
  const outwardTransfers = transfers.filter((t) => t.type === "outward");

  const getCurrentItemUnitOptions = () => {
    if (!currentSelectedFullItem || !currentSelectedFullItem.itemUnits) { return []; }
    return currentSelectedFullItem.itemUnits.map(u => ({ value: u.name, label: u.name }));
  };

  const calculateSiteWiseTotals = () => {
    const siteTotals = {};

    transfers.forEach((transfer) => {
      const { siteId, itemId, variantId, unit, quantity, type, siteName, itemName, variantName } = transfer;
      const itemKey = `${itemId || 'unknown'}-${variantId || 'no-variant'}-${unit || 'no-unit'}`;

      if (!siteTotals[siteId]) {
        siteTotals[siteId] = {
          name: siteName,
          items: {}
        };
      }
      if (!siteTotals[siteId].items[itemKey]) {
        siteTotals[siteId].items[itemKey] = {
          totalReceived: 0,
          totalUsed: 0,
          itemName: itemName,
          variantName: variantName || "",
          unit: unit || 'pcs'
        };
      }

      const transferQuantityInBase = convertUnit(quantity, unit, getUnitCategory(unit) ? unitConversionRates[getUnitCategory(unit)].base : unit);

      if (type === "inward") {
        siteTotals[siteId].items[itemKey].totalReceived += transferQuantityInBase;
      } else if (type === "outward") {
        siteTotals[siteId].items[itemKey].totalUsed += transferQuantityInBase;
      }
    });

    const summaryArray = [];
    for (const siteId in siteTotals) {
      for (const itemKey in siteTotals[siteId].items) {
        const itemSummary = siteTotals[siteId].items[itemKey];
        itemSummary.currentStock = itemSummary.totalReceived - itemSummary.totalUsed;

        const originalUnit = itemSummary.unit;
        const category = getUnitCategory(originalUnit);
        if (category) {
            const baseUnit = unitConversionRates[category].base;
            if (baseUnit !== originalUnit) {
              itemSummary.currentStock = convertUnit(itemSummary.currentStock, baseUnit, originalUnit);
              itemSummary.totalReceived = convertUnit(itemSummary.totalReceived, baseUnit, originalUnit);
              itemSummary.totalUsed = convertUnit(itemSummary.totalUsed, baseUnit, originalUnit);
            }
        }
        itemSummary.currentStock = parseFloat(itemSummary.currentStock.toFixed(3));
        itemSummary.totalReceived = parseFloat(itemSummary.totalReceived.toFixed(3));
        itemSummary.totalUsed = parseFloat(itemSummary.totalUsed.toFixed(3));

        summaryArray.push({
          siteName: siteTotals[siteId].name,
          ...itemSummary
        });
      }
    }

    summaryArray.sort((a, b) => {
        if (a.siteName < b.siteName) return -1;
        if (a.siteName > b.siteName) return 1;
        if (a.itemName < b.itemName) return -1;
        if (a.itemName > b.itemName) return 1;
        return 0;
    });

    return summaryArray;
  };

  const inventorySummary = calculateSiteWiseTotals();

  // Function to render unit inputs for Add Item form
  const renderAddItemUnitInputs = () => {
    if (!itemState.hasMultipleUnits) {
      return (
        <SearchableDropdown
          id="single-unit-select"
          value={itemState.itemUnits[0]?.name || ""}
          options={globalUnitList}
          onChange={(selectedValue) =>
            dispatchItem({
              type: "SET_FIELD",
              field: "itemUnits",
              value: [{ name: selectedValue }],
            })
          }
          placeholder="Select a Unit"
          disabled={isLoading}
        />
      );
    }
    return (
      <div className="units-section">
        <h3 className="sub-section-title">Item Units</h3>
        {itemState.itemUnits.map((unit, idx) => (
          <div key={idx} className="unit-input-group">
            <SearchableDropdown
              id={`add-item-unit-${idx}`}
              value={unit.name}
              options={globalUnitList}
              onChange={(selectedValue) =>
                dispatchItem({
                  type: "UPDATE_ITEM_UNIT",
                  index: idx,
                  value: selectedValue,
                })
              }
              placeholder="Select a Unit"
              disabled={isLoading}
            />
            {itemState.itemUnits.length > 1 && (
              <button
                className="remove-variant-button"
                onClick={() =>
                  dispatchItem({ type: "REMOVE_ITEM_UNIT", index: idx })
                }
                disabled={isLoading}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          className="add-variant-button"
          onClick={() => dispatchItem({ type: "ADD_ITEM_UNIT" })}
          disabled={isLoading}
        >
          ➕ Add Another Unit
        </button>
      </div>
    );
  };

  // Function to render unit inputs for Edit Item form
  const renderEditItemUnitInputs = () => {
    if (!editingUserItem?.hasMultipleUnits) {
      return (
        <SearchableDropdown
          id="edit-single-unit-select"
          value={editingUserItem?.itemUnits[0]?.name || ""}
          options={globalUnitList}
          onChange={(selectedValue) =>
            setEditingUserItem({
              ...editingUserItem,
              itemUnits: [{ name: selectedValue }],
            })
          }
          placeholder="Select a Unit"
          disabled={isLoading}
        />
      );
    }
    return (
      <div className="units-section">
        <h4 className="sub-section-title">Edit Units</h4>
        {editingUserItem.itemUnits.map((unit, idx) => (
          <div key={idx} className="unit-input-group">
            <SearchableDropdown
              id={`edit-item-unit-${idx}`}
              value={unit?.name || ""}
              options={globalUnitList}
              onChange={(selectedValue) => {
                const newUnits = [...editingUserItem.itemUnits];
                newUnits[idx] = { ...newUnits[idx], name: selectedValue };
                setEditingUserItem({ ...editingUserItem, itemUnits: newUnits });
              }}
              placeholder="Select a Unit"
              disabled={isLoading}
            />
            {editingUserItem.itemUnits.length > 1 && (
              <button
                className="remove-variant-button"
                onClick={() => {
                  const newUnits = editingUserItem.itemUnits.filter(
                    (_, uIdx) => uIdx !== idx
                  );
                  setEditingUserItem({ ...editingUserItem, itemUnits: newUnits });
                }}
                disabled={isLoading}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          className="add-variant-button"
          onClick={() =>
            setEditingUserItem({
              ...editingUserItem,
              itemUnits: [...editingUserItem.itemUnits, { name: "" }],
            })
          }
          disabled={isLoading}
        >
          ➕ Add Another Unit
        </button>
      </div>
    );
  };

  // This handleAddItem is specifically for ReceivedUsedPage's "Add/Manage Items" tab
  const handleAddItem = async () => {
    if (!userId) {
      setError("User not authenticated.");
      return;
    }
    if (!itemState.name.trim()) {
      setError("Item name is required.");
      return;
    }

    // Client-side check for duplicate item name
    const isDuplicate = items.some(item => item.name.toLowerCase() === itemState.name.trim().toLowerCase());
    if (isDuplicate) {
        setError("An item with this name already exists. Please choose a different name.");
        return;
    }

    if (!itemState.hasMultipleUnits && !itemState.itemUnits[0]?.name.trim()) {
      setError("Please select a unit for the item.");
      return;
    }
    if (itemState.hasMultipleUnits && itemState.itemUnits.some((u) => !u.name.trim())) {
      setError("All selected item unit names must be filled.");
      return;
    }
    if (itemState.hasVariants && itemState.variants.some((v) => !v.name.trim())) {
      setError("All variant names must be filled if variants are enabled.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const itemRef = await addDoc(collection(db, "items"), {
        name: itemState.name.trim(),
        hasVariants: itemState.hasVariants,
        hasMultipleUnits: itemState.hasMultipleUnits,
        unit: itemState.hasMultipleUnits ? null : (itemState.itemUnits[0]?.name.trim() || null),
        createdAt: new Date(),
        creatorId: userId, // Store the creator's user ID
        creatorName: userName, // Store the creator's name
      });

      if (itemState.itemUnits.length > 0 && itemState.itemUnits[0].name.trim() !== "") {
        await Promise.all(
          itemState.itemUnits
            .filter(u => u.name.trim() !== "")
            .map((u) =>
              addDoc(collection(db, "itemUnits"), {
                itemId: itemRef.id,
                name: u.name.trim(),
                createdAt: new Date(),
              })
            )
        );
      }

      if (itemState.hasVariants && itemState.variants.length > 0) {
        await Promise.all(
          itemState.variants
            .filter(v => v.name.trim() !== "")
            .map((v) =>
              addDoc(collection(db, "itemVariants"), {
                itemId: itemRef.id,
                name: v.name.trim(),
                unit: itemState.itemUnits[0]?.name.trim() || null,
                fullName: `${itemState.name.trim()} - ${v.name.trim()}`,
                createdAt: new Date(),
              })
            )
        );
      }

      dispatchItem({ type: "RESET_ITEM" });
      await fetchItems(); // Re-fetch all items to update the list for the current user
      setSuccessMessage("Item Added Successfully!");
    } catch (err) {
      console.error("Error adding item:", err);
      setError("Failed to add item. Please try again.");
    } finally {
      setIsLoading(false);
      setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
    }
  };

  // This handleEditUserItem is specifically for ReceivedUsedPage's "Manage Your Added Items" list
  const handleEditUserItem = (item) => {
    // THIS IS THE CRITICAL CHANGE: Only the creator can edit from *this* section.
    // Item Managers can edit any item, but they should do it from the dedicated Admin AddPage.
    if (item.creatorId !== userId) {
      setError("You can only edit items you have personally added from this section.");
      return;
    }
    const currentItemUnits = Array.isArray(item.itemUnits) && item.itemUnits.length > 0
      ? item.itemUnits
      : item.unit
      ? [{ name: item.unit }]
      : [{ name: "" }];

    const currentVariants = Array.isArray(item.variants) && item.variants.length > 0
      ? item.variants
      : [{ name: "" }];

    setEditingUserItem({
      ...item,
      hasMultipleUnits: item.hasMultipleUnits || false,
      hasVariants: item.hasVariants || false,
      variants: currentVariants,
      itemUnits: currentItemUnits,
    });
    setCurrentSelectedFullItem(item);
  };

  // This handleUpdateUserItem is specifically for ReceivedUsedPage's "Manage Your Added Items" list
  const handleUpdateUserItem = async () => {
    if (!editingUserItem || !userId) { setError("No item selected for editing or user not authenticated."); return; }
    // Only the creator can update from *this* section.
    if (editingUserItem.creatorId !== userId) {
      setError("You can only update items you have personally added from this section.");
      return;
    }
    if (!editingUserItem.name.trim()) { setError("Item name is required for update."); return; }

    // Client-side check for duplicate item name during update
    const isDuplicateUpdate = items.some(item =>
        item.name.toLowerCase() === editingUserItem.name.trim().toLowerCase() && item.id !== editingUserItem.id
    );
    if (isDuplicateUpdate) {
        setError("An item with this name already exists. Please choose a different name.");
        return;
    }

    if (!editingUserItem.hasMultipleUnits && !editingUserItem.itemUnits[0]?.name.trim()) {
      setError("Please select a unit for the item.");
      return;
    }
    if (editingUserItem.hasMultipleUnits && editingUserItem.itemUnits.some((u) => !u.name.trim())) {
      setError("All selected item unit names must be filled.");
      return;
    }
    if (editingUserItem.hasVariants && editingUserItem.variants.some((v) => !v.name.trim())) {
      setError("All variant names must be filled if variants are enabled.");
      return;
    }

    setIsLoading(true); setError(null); setSuccessMessage(null);
    try {
      const batch = writeBatch(db);
      const itemRef = doc(db, "items", editingUserItem.id);
      batch.update(itemRef, {
        name: editingUserItem.name.trim(),
        hasVariants: editingUserItem.hasVariants,
        hasMultipleUnits: editingUserItem.hasMultipleUnits,
        unit: editingUserItem.hasMultipleUnits ? null : (editingUserItem.itemUnits[0]?.name.trim() || null),
      });

      const existingItemUnitsQuery = await getDocs(
        query(collection(db, "itemUnits"), where("itemId", "==", editingUserItem.id))
      );
      existingItemUnitsQuery.docs.forEach((uDoc) => {
        batch.delete(doc(db, "itemUnits", uDoc.id));
      });
      if (editingUserItem.itemUnits.length > 0 && editingUserItem.itemUnits[0].name.trim() !== "") {
        editingUserItem.itemUnits.filter(u => u.name.trim() !== "").forEach((u) => {
          batch.set(doc(collection(db, "itemUnits")), {
            itemId: editingUserItem.id,
            name: u.name.trim(),
            createdAt: new Date(),
          });
        });
      }

      const existingVariantsQuery = await getDocs(
        query(collection(db, "itemVariants"), where("itemId", "==", editingUserItem.id))
      );
      existingVariantsQuery.docs.forEach((vDoc) => {
        batch.delete(doc(db, "itemVariants", vDoc.id));
      });
      if (editingUserItem.hasVariants && editingUserItem.variants.length > 0) {
        editingUserItem.variants.filter(v => v.name.trim() !== "").forEach((v) => {
          batch.set(doc(collection(db, "itemVariants")), {
            itemId: editingUserItem.id,
            name: v.name.trim(),
            unit: editingUserItem.itemUnits[0]?.name.trim() || null,
            fullName: `${editingUserItem.name.trim()} - ${v.name.trim()}`,
            createdAt: new Date(),
          });
        });
      }
      await batch.commit();

      setEditingUserItem(null);
      setCurrentSelectedFullItem(null);
      await fetchItems(); // Re-fetch all items after update
      setSuccessMessage("Item updated successfully!");

    } catch (err) {
      console.error("Error updating item:", err);
      setError("Failed to update item. Please try again.");
    } finally {
      setIsLoading(false);
      setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
    }
  };

  // This handleDeleteUserItem is specifically for ReceivedUsedPage's "Manage Your Added Items" list
  const handleDeleteUserItem = async (itemIdToDelete) => {
    if (!userId || !window.confirm("Are you sure you want to delete this item and its associated variants/units? This action cannot be undone.")) { return; }

    const itemToDelete = items.find(item => item.id === itemIdToDelete);
    // Only the creator can delete from *this* section.
    if (!itemToDelete || itemToDelete.creatorId !== userId) {
      setError("You can only delete items you have personally added from this section.");
      return;
    }

    setIsLoading(true); setError(null); setSuccessMessage(null);
    try {
      const batch = writeBatch(db);

      const variantQuerySnapshot = await getDocs(
        query(collection(db, "itemVariants"), where("itemId", "==", itemIdToDelete))
      );
      variantQuerySnapshot.docs.forEach((vDoc) => {
        batch.delete(doc(db, "itemVariants", vDoc.id));
      });

      const itemUnitsQuerySnapshot = await getDocs(
        query(collection(db, "itemUnits"), where("itemId", "==", itemIdToDelete))
      );
      itemUnitsQuerySnapshot.docs.forEach((uDoc) => {
        batch.delete(doc(db, "itemUnits", uDoc.id));
      });

      const itemRef = doc(db, "items", itemIdToDelete);
      batch.delete(itemRef);
      await batch.commit();

      await fetchItems(); // Re-fetch all items after deletion
      setSuccessMessage("Item Deleted Successfully!");
    } catch (err) {
      console.error("Error deleting item:", err);
      setError("Failed to delete item. Please try again.");
    } finally {
      setIsLoading(false);
      setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
    }
  };


  const isItemManager = userRoles && userRoles.includes("Item Manager");


  if (!userId) {
    return (
      <div className="page-container">
        <p className="no-data-message">Please log in to record and view inventory transactions.</p>
      </div>
    );
  }

  // Filter items for display in "Manage Your Added Items" section of ReceivedUsedPage.
  // This list ALWAYS shows only items added by the current user, regardless of role.
  const itemsToDisplayForManagement = items.filter(item => item.creatorId === userId);


  return (
    <div className="page-container">
      {isLoading && <div className="message loading-message">Loading...</div>}
      {error && <div className="message error-message">{error}</div>}
      {successMessage && <div className="message success-message">{successMessage}</div>}

      <div className="utility-section">
        <div className="calendar-toggle-section">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showCalendar}
              onChange={() => setShowCalendar(!showCalendar)}
            />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">
            {showCalendar ? "Select Date (Calendar ON)" : "Today's Date (Calendar OFF)"}
          </span>
        </div>

        {/* Theme Toggle Button */}
        <div className="theme-toggle-section">
          <button onClick={toggleTheme} className="theme-toggle-button">
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
      </div>

      <hr className="divider" />

      <div className="tab-container">
        <button
          className={`tab-button ${activeTab === "in" ? "active" : ""}`}
          onClick={() => setActiveTab("in")}
        >
          📥 In
        </button>
        <button
          className={`tab-button ${activeTab === "out" ? "active" : ""}`}
          onClick={() => setActiveTab("out")}
        >
          📤 Out
        </button>
        <button
          className={`tab-button ${activeTab === "transfer" ? "active" : ""}`}
          onClick={() => setActiveTab("transfer")}
        >
          🚚 Transfer
        </button>
        {isItemManager && ( // Only Item Managers see this tab
          <button
            className={`tab-button ${activeTab === "addItem" ? "active" : ""}`}
            onClick={() => setActiveTab("addItem")}
          >
            ➕ Add/Manage Items
          </button>
        )}
      </div>

      {activeTab === "in" && (
        <section className="transaction-section">
          <h2 className="section-title">Record Inward Items</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="inwardSite">Received At Site:</label>
              <Select
                id="inwardSite"
                name="siteId"
                options={allSiteSelectOptions} /* Use all options as filtering is done by React-Select internally */
                value={selectedSiteGlobally} /* Pre-fill with globally selected site */
                onChange={(option) => handleSiteSelectChangeAndSetGlobal(option, "inward")}
                onInputChange={handleSiteInputChangeInward}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Type to search and set Site"
                isClearable
                isDisabled={isLoading}
              />
              {selectedSiteGlobally && (
                <p className="current-default-site">
                  Current Default Site: <strong>{selectedSiteGlobally.label}</strong>
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="inwardItemVariant">Item & Variant:</label>
              <Select
                id="inwardItemVariant"
                name="itemVariant"
                options={filteredItemVariantOptionsInward} /* Use filtered options */
                value={selectedItemVariantOption}
                onChange={(option) => handleItemVariantSelectChange(option, "inward")}
                onInputChange={handleItemVariantInputChangeInward}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Type to search Item & Variant"
                isClearable
                isDisabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="inwardUnit">Unit:</label>
              <Select
                id="inwardUnit"
                name="unit"
                options={getCurrentItemUnitOptions()}
                value={selectedUnitOptionInward}
                onChange={(option) => handleUnitSelectChange(option, "inward")}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Select Unit"
                isClearable
                isDisabled={isLoading || !currentSelectedFullItem || getCurrentItemUnitOptions().length === 0}
              />
            </div>

            <div className="form-group">
              <label htmlFor="inwardQuantity">Quantity:</label>
              <input
                type="number"
                id="inwardQuantity"
                name="quantity"
                value={inwardForm.quantity}
                onChange={(e) => handleQuantityChange(e, "inward")}
                placeholder="Enter quantity"
                className="input-field"
                disabled={isLoading}
                min="1"
              />
            </div>

            {showCalendar && (
              <div className="form-group date-picker-group">
                <label htmlFor="inwardDate">Date:</label>
                <DatePicker
                  id="inwardDate"
                  selected={inwardForm.date}
                  onChange={(date) => setInwardForm((prev) => ({ ...prev, date }))}
                  className="input-field date-picker-input"
                  dateFormat="dd/MM/yyyy"
                  disabled={isLoading}
                />
              </div>
            )}

            <button
              onClick={handleAddInward}
              className="primary-button full-width"
              disabled={
                isLoading ||
                !inwardForm.siteId ||
                !inwardForm.itemId ||
                !inwardForm.unit ||
                !inwardForm.quantity ||
                inwardForm.quantity <= 0
              }
            >
              {isLoading ? "Receiving..." : "Record Inward"}
            </button>
          </div>
        </section>
      )}

      {activeTab === "out" && (
        <section className="transaction-section">
          <h2 className="section-title">Record Outward Items</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="outwardSite">Used From Site:</label>
              <Select
                id="outwardSite"
                name="siteId"
                options={allSiteSelectOptions} /* Use all options */
                value={selectedSiteGlobally} /* Pre-fill with globally selected site */
                onChange={(option) => handleSiteSelectChangeAndSetGlobal(option, "outward")}
                onInputChange={handleSiteInputChangeOutward}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Type to search and set Site"
                isClearable
                isDisabled={isLoading}
              />
               {selectedSiteGlobally && (
                <p className="current-default-site">
                  Current Default Site: <strong>{selectedSiteGlobally.label}</strong>
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="outwardItemVariant">Item & Variant:</label>
              <Select
                id="outwardItemVariant"
                name="itemVariant"
                options={filteredItemVariantOptionsOutward} /* Use filtered options */
                value={selectedItemVariantOption}
                onChange={(option) => handleItemVariantSelectChange(option, "outward")}
                onInputChange={handleItemVariantInputChangeOutward}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Type to search Item & Variant"
                isClearable
                isDisabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="outwardUnit">Unit:</label>
              <Select
                id="outwardUnit"
                name="unit"
                options={getCurrentItemUnitOptions()}
                value={selectedUnitOptionOutward}
                onChange={(option) => handleUnitSelectChange(option, "outward")}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Select Unit"
                isClearable
                isDisabled={isLoading || !currentSelectedFullItem || getCurrentItemUnitOptions().length === 0}
              />
            </div>

            <div className="form-group">
              <label htmlFor="outwardQuantity">Quantity:</label>
              <input
                type="number"
                id="outwardQuantity"
                name="quantity"
                value={outwardForm.quantity}
                onChange={(e) => handleQuantityChange(e, "outward")}
                placeholder="Enter quantity"
                className="input-field"
                disabled={isLoading}
                min="1"
              />
            </div>

            {showCalendar && (
              <div className="form-group date-picker-group">
                <label htmlFor="outwardDate">Date:</label>
                <DatePicker
                  id="outwardDate"
                  selected={outwardForm.date}
                  onChange={(date) => setOutwardForm((prev) => ({ ...prev, date }))}
                  className="input-field date-picker-input"
                  dateFormat="dd/MM/yyyy"
                  disabled={isLoading}
                />
              </div>
            )}

            <button
              onClick={handleAddOutward}
              className="primary-button full-width"
              disabled={
                isLoading ||
                !outwardForm.siteId ||
                !outwardForm.itemId ||
                !outwardForm.unit ||
                !outwardForm.quantity ||
                outwardForm.quantity <= 0
              }
            >
              {isLoading ? "Using..." : "Record Outward"}
            </button>
          </div>
        </section>
      )}

      {activeTab === "transfer" && (
        <section className="transaction-section">
          <h2 className="section-title">Record Item Transfer</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="fromSite">From Site:</label>
              <Select
                id="fromSite"
                name="fromSiteId"
                options={filteredSiteOptionsFromTransfer}
                value={selectedSiteOptionFromTransfer}
                onChange={(option) => handleTransferSiteChange(option, "from")}
                onInputChange={handleSiteInputChangeFromTransfer}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Type to search From Site"
                isClearable
                isDisabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="toSite">To Site:</label>
              <Select
                id="toSite"
                name="toSiteId"
                options={filteredSiteOptionsToTransfer} /* Use filtered options */
                value={selectedSiteOptionToTransfer}
                onChange={(option) => handleTransferSiteChange(option, "to")}
                onInputChange={handleSiteInputChangeToTransfer}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Type to search To Site"
                isClearable
                isDisabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="transferItemVariant">Item & Variant:</label>
              <Select
                id="transferItemVariant"
                name="itemVariant"
                options={filteredItemVariantOptionsTransfer} /* Use filtered options */
                value={selectedItemVariantOption}
                onChange={(option) => handleItemVariantSelectChange(option, "transfer")}
                onInputChange={handleItemVariantInputChangeTransfer}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Type to search Item & Variant"
                isClearable
                isDisabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="transferUnit">Unit:</label>
              <Select
                id="transferUnit"
                name="unit"
                options={getCurrentItemUnitOptions()}
                value={selectedUnitOptionTransfer}
                onChange={(option) => handleUnitSelectChange(option, "transfer")}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder="Select Unit"
                isClearable
                isDisabled={isLoading || !currentSelectedFullItem || getCurrentItemUnitOptions().length === 0}
              />
            </div>

            <div className="form-group">
              <label htmlFor="transferQuantity">Quantity:</label>
              <input
                type="number"
                id="transferQuantity"
                name="quantity"
                value={transferForm.quantity}
                onChange={(e) => handleQuantityChange(e, "transfer")}
                placeholder="Enter quantity"
                className="input-field"
                disabled={isLoading}
                min="1"
              />
            </div>

            {showCalendar && (
              <div className="form-group date-picker-group">
                <label htmlFor="transferDate">Date:</label>
                <DatePicker
                  id="transferDate"
                  selected={transferForm.date}
                  onChange={(date) => setTransferForm((prev) => ({ ...prev, date }))}
                  className="input-field date-picker-input"
                  dateFormat="dd/MM/yyyy"
                  disabled={isLoading}
                />
              </div>
            )}

            <button
              onClick={handleAddTransfer}
              className="primary-button full-width"
              disabled={
                isLoading ||
                !transferForm.fromSiteId ||
                !transferForm.toSiteId ||
                !transferForm.itemId ||
                !transferForm.unit ||
                !transferForm.quantity ||
                transferForm.quantity <= 0 ||
                transferForm.fromSiteId === transferForm.toSiteId
              }
            >
              {isLoading ? "Transferring..." : "Record Transfer"}
            </button>
          </div>
        </section>
      )}

      {isItemManager && activeTab === "addItem" && (
        <section className="transaction-section add-page-styles">
          <h2 className="section-title">➕ Add & Manage Your Items</h2> {/* Title changed */}

          <section className="add-section">
            <h3 className="sub-section-title">Add New Item</h3>

            <div className="form-group">
              <label htmlFor="addItemName">Item Name:</label>
              <input
                type="text"
                id="addItemName"
                className="input-field"
                placeholder="Item Name"
                value={itemState.name}
                onChange={(e) =>
                  dispatchItem({ type: "SET_FIELD", field: "name", value: e.target.value })
                }
                disabled={isLoading}
              />
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={itemState.hasMultipleUnits}
                onChange={(e) =>
                  dispatchItem({
                    type: "SET_FIELD",
                    field: "hasMultipleUnits",
                    value: e.target.checked,
                  })
                }
                disabled={isLoading}
              />
              This item has multiple units
            </label>

            <div className="form-group">{renderAddItemUnitInputs()}</div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={itemState.hasVariants}
                onChange={(e) =>
                  dispatchItem({
                    type: "SET_FIELD",
                    field: "hasVariants",
                    value: e.target.checked,
                  })
                }
                disabled={isLoading}
              />
              This item has variants
            </label>

            {itemState.hasVariants && (
              <div className="variants-section">
                <h4 className="sub-section-title">Item Variants</h4>
                {itemState.variants.map((variant, idx) => (
                  <div key={idx} className="variant-input-group">
                    <input
                      type="text"
                      className="input-field"
                      placeholder={`Variant ${idx + 1} Name`}
                      value={variant.name}
                      onChange={(e) =>
                        dispatchItem({
                          type: "UPDATE_VARIANT",
                          index: idx,
                          value: e.target.value,
                        })
                      }
                      disabled={isLoading}
                    />
                    {itemState.variants.length > 1 && (
                      <button
                        className="remove-variant-button"
                        onClick={() =>
                          dispatchItem({ type: "REMOVE_VARIANT", index: idx })
                        }
                        disabled={isLoading}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="add-variant-button"
                  onClick={() => dispatchItem({ type: "ADD_VARIANT" })}
                  disabled={isLoading}
                >
                  ➕ Add Another Variant
                </button>
              </div>
            )}

            <button
              className="primary-button add-item-final-button"
              onClick={handleAddItem}
              disabled={isLoading || !itemState.name.trim() ||
                (!itemState.hasMultipleUnits && !itemState.itemUnits[0]?.name.trim()) ||
                (itemState.hasMultipleUnits && itemState.itemUnits.some(u => !u.name.trim())) ||
                (itemState.hasVariants && itemState.variants.some(v => !v.name.trim()))
              }
            >
              {isLoading ? "Adding..." : "Add Item"}
            </button>
          </section>

          <hr className="divider" />

          {/* Manage Your Items Section */}
          <section className="edit-section">
            <h2 className="section-title">Manage Your Added Items</h2> {/* Title changed */}
            {itemsToDisplayForManagement.length === 0 && !isLoading ? (
              <p className="no-data-message">You haven't added any items yet.</p> /* Message changed */
            ) : (
              <ul className="edit-list">
                {itemsToDisplayForManagement.map((item) => (
                  <li key={item.id} className="edit-list-item">
                    {editingUserItem && editingUserItem.id === item.id ? (
                      <div className="edit-form-expanded">
                        <label htmlFor={`editItemName-${item.id}`}>Item Name:</label>
                        <input
                          id={`editItemName-${item.id}`}
                          type="text"
                          className="input-field"
                          value={editingUserItem?.name || ""}
                          onChange={(e) =>
                            setEditingUserItem({ ...editingUserItem, name: e.target.value })
                          }
                          disabled={isLoading}
                        />

                        <label className="checkbox-label full-width-checkbox">
                          <input
                            type="checkbox"
                            checked={editingUserItem.hasMultipleUnits}
                            onChange={(e) =>
                              setEditingUserItem({
                                ...editingUserItem,
                                hasMultipleUnits: e.target.checked,
                                itemUnits: e.target.checked ? [{ name: "" }] : [{ name: "" }],
                              })
                            }
                            disabled={isLoading}
                          />
                          Has Multiple Units
                        </label>

                        <div className="form-group">{renderEditItemUnitInputs()}</div>

                        <label className="checkbox-label full-width-checkbox">
                          <input
                            type="checkbox"
                            checked={editingUserItem.hasVariants}
                            onChange={(e) =>
                              setEditingUserItem({
                                ...editingUserItem,
                                hasVariants: e.target.checked,
                                variants: e.target.checked ? [{ name: "" }] : [],
                              })
                            }
                            disabled={isLoading}
                          />
                          Has Variants
                        </label>

                        {editingUserItem.hasVariants && (
                          <div className="variants-section">
                            <h4 className="sub-section-title">Edit Variants</h4>
                            {editingUserItem.variants.map((variant, idx) => (
                              <div key={idx} className="variant-input-group">
                                <input
                                  type="text"
                                  className="input-field"
                                  placeholder={`Variant ${idx + 1} Name`}
                                  value={variant.name}
                                  onChange={(e) => {
                                    const newVariants = [...editingUserItem.variants];
                                    newVariants[idx] = {
                                      ...newVariants[idx],
                                      name: e.target.value,
                                    };
                                    setEditingUserItem({ ...editingUserItem, variants: newVariants });
                                  }}
                                  disabled={isLoading}
                                />
                                {editingUserItem.variants.length > 1 && (
                                  <button
                                    className="remove-variant-button"
                                    onClick={() => {
                                      const newVariants = editingUserItem.variants.filter(
                                        (_, vIdx) => vIdx !== idx
                                      );
                                      setEditingUserItem({ ...editingUserItem, variants: newVariants });
                                    }}
                                    disabled={isLoading}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              className="add-variant-button"
                              onClick={() =>
                                setEditingUserItem({
                                  ...editingUserItem,
                                  variants: [...editingUserItem.variants, { name: "" }],
                                })
                              }
                              disabled={isLoading}
                            >
                              ➕ Add Another Variant
                            </button>
                          </div>
                        )}

                        <div className="action-buttons-group full-width-group">
                          <button
                            className="action-button save-button"
                            onClick={handleUpdateUserItem}
                            disabled={isLoading}
                          >
                            Save
                          </button>
                          <button
                            className="action-button cancel-button"
                            onClick={() => {setEditingUserItem(null); setCurrentSelectedFullItem(null);}}
                            disabled={isLoading}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="item-name">
                          {item.name} (Units:{" "}
                          {item.hasMultipleUnits
                            ? item.itemUnits.map((u) => u.name).join(", ")
                            : item.unit || item.itemUnits[0]?.name || "No Unit"})
                          {item.hasVariants && item.variants.length > 0 && (
                            <span className="item-variants-summary">
                              {" "}
                              - Variants: {item.variants.map((v) => v.name).join(", ")}
                            </span>
                          )}
                            <span className="item-creator-info"> (Added by: {item.creatorName || 'Unknown'})</span>
                        </span>
                        <div className="action-buttons-group">
                          {/* Only show Edit/Delete if current user is the creator */}
                          {item.creatorId === userId && ( // CRITICAL CHANGE HERE
                            <>
                              <button
                                className="action-button edit-button"
                                onClick={() => handleEditUserItem(item)}
                                disabled={isLoading}
                              >
                                Edit
                              </button>
                              <button
                                className="action-button delete-button"
                                onClick={() => handleDeleteUserItem(item.id)}
                                disabled={isLoading}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      )}

      {/* Remaining sections are unchanged */}
      <hr className="divider" />

      <section className="data-table-section">
        <h2 className="section-title">📦 Recent Inward Items</h2>
        {inwardTransfers.length === 0 && !isLoading ? (
          <p className="no-data-message">No inward items recorded yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Variant</th>
                  <th>Unit</th>
                  <th>Received At</th>
                  <th>Quantity</th>
                  <th>Remark</th>
                  <th>User</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inwardTransfers.map((transfer) => (
                  <tr key={transfer.id}>
                    {editingTransfer && editingTransfer.id === transfer.id ? (
                      <>
                        <td><DatePicker selected={editingTransfer.date} onChange={(date) => setEditingTransfer((prev) => ({ ...prev, date }))} className="input-field table-input-field" dateFormat="dd/MM/yyyy" disabled={isLoading} /></td>
                        <td><Select options={filteredEditingTransferItemVariantOptions} value={editingTransferItemVariantOption} onChange={handleEditingItemVariantSelectChange} onInputChange={handleEditingItemVariantInputChange} className="react-select-container table-select-container" classNamePrefix="react-select" placeholder="Type to search Item" isClearable isDisabled={isLoading} /></td>
                        <td>{editingTransfer.variantName || '-'}</td>
                        <td><Select options={getCurrentItemUnitOptions()} value={editingTransferUnitOption} onChange={handleEditingUnitSelectChange} className="react-select-container table-select-container" classNamePrefix="react-select" placeholder="Select Unit" isClearable isDisabled={isLoading || !currentSelectedFullItem || getCurrentItemUnitOptions().length === 0} /></td>
                        <td><Select options={filteredEditingTransferSiteOptions} value={editingTransferSiteOption} onChange={handleEditingSiteSelectChange} onInputChange={handleEditingSiteInputChange} className="react-select-container table-select-container" classNamePrefix="react-select" placeholder="Type to search Site" isClearable isDisabled={isLoading} /></td>
                        <td><input type="number" name="quantity" value={editingTransfer.quantity} onChange={(e) => setEditingTransfer((prev) => ({ ...prev, quantity: e.target.value }))} className="input-field table-input-field" disabled={isLoading} min="1" /></td>
                        <td><input type="text" value={editingTransfer.remark || ''} onChange={(e) => setEditingTransfer(prev => ({ ...prev, remark: e.target.value }))} className="input-field table-input-field" disabled={isLoading} placeholder="Remark" /></td>
                        <td>{transfer.userName || '-'}</td>
                        <td>
                          <div className="action-buttons-group">
                            <button className="action-button save-button" onClick={handleUpdateTransfer} disabled={isLoading}>Save</button>
                            <button className="action-button cancel-button" onClick={() => { setEditingTransfer(null); setEditingTransferItemVariantOption(null); setEditingTransferUnitOption(null); setEditingTransferSiteOption(null); setCurrentSelectedFullItem(null); setFilteredEditingTransferItemVariantOptions([]); setFilteredEditingTransferSiteOptions([]); }} disabled={isLoading}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{formatDate(transfer.timestamp)}</td>
                        <td>{transfer.itemName || "-"}</td>
                        <td>{transfer.variantName || "-"}</td>
                        <td>{transfer.unit || "-"}</td>
                        <td>{transfer.siteName || "-"}</td>
                        <td>{transfer.quantity}</td>
                        <td className={transfer.remark && transfer.remark.includes('Transferred from') ? 'remark-red' : (transfer.remark && transfer.remark.includes('Transferred to') ? 'remark-green' : '')}>
                          {transfer.remark || "-"}
                        </td>
                        <td>{transfer.userName || '-'}</td>
                        <td>
                          <div className="action-buttons-group">
                            <button className="action-button edit-button" onClick={() => handleEditTransfer(transfer)} disabled={isLoading}>Edit</button>
                            <button className="action-button delete-button" onClick={() => handleDeleteTransfer(transfer.id)} disabled={isLoading}>Delete</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <hr className="divider" />

      <section className="data-table-section">
        <h2 className="section-title">📉 Recent Outward Items</h2>
        {outwardTransfers.length === 0 && !isLoading ? (
          <p className="no-data-message">No outward items recorded yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Variant</th>
                  <th>Unit</th>
                  <th>Used From</th>
                  <th>Quantity</th>
                  <th>Remark</th>
                  <th>User</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {outwardTransfers.map((transfer) => (
                  <tr key={transfer.id}>
                    {editingTransfer && editingTransfer.id === transfer.id ? (
                      <>
                        <td><DatePicker selected={editingTransfer.date} onChange={(date) => setEditingTransfer((prev) => ({ ...prev, date }))} className="input-field table-input-field" dateFormat="dd/MM/yyyy" disabled={isLoading} /></td>
                        <td><Select options={filteredEditingTransferItemVariantOptions} value={editingTransferItemVariantOption} onChange={handleEditingItemVariantSelectChange} onInputChange={handleEditingItemVariantInputChange} className="react-select-container table-select-container" classNamePrefix="react-select" placeholder="Type to search Item" isClearable isDisabled={isLoading} /></td>
                        <td>{editingTransfer.variantName || '-'}</td>
                        <td><Select options={getCurrentItemUnitOptions()} value={editingTransferUnitOption} onChange={handleEditingUnitSelectChange} className="react-select-container table-select-container" classNamePrefix="react-select" placeholder="Select Unit" isClearable isDisabled={isLoading || !currentSelectedFullItem || getCurrentItemUnitOptions().length === 0} /></td>
                        <td><Select options={filteredEditingTransferSiteOptions} value={editingTransferSiteOption} onChange={handleEditingSiteSelectChange} onInputChange={handleEditingSiteInputChange} className="react-select-container table-select-container" classNamePrefix="react-select" placeholder="Type to search Site" isClearable isDisabled={isLoading} /></td>
                        <td><input type="number" name="quantity" value={editingTransfer.quantity} onChange={(e) => setEditingTransfer((prev) => ({ ...prev, quantity: e.target.value }))} className="input-field table-input-field" disabled={isLoading} min="1" /></td>
                        <td><input type="text" value={editingTransfer.remark || ''} onChange={(e) => setEditingTransfer(prev => ({ ...prev, remark: e.target.value }))} className="input-field table-input-field" disabled={isLoading} placeholder="Remark" /></td>
                        <td>{transfer.userName || '-'}</td>
                        <td>
                          <div className="action-buttons-group">
                            <button className="action-button save-button" onClick={handleUpdateTransfer} disabled={isLoading}>Save</button>
                            <button className="action-button cancel-button" onClick={() => { setEditingTransfer(null); setEditingTransferItemVariantOption(null); setEditingTransferUnitOption(null); setEditingTransferSiteOption(null); setCurrentSelectedFullItem(null); setFilteredEditingTransferItemVariantOptions([]); setFilteredEditingTransferSiteOptions([]); }} disabled={isLoading}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{formatDate(transfer.timestamp)}</td>
                        <td>{transfer.itemName || "-"}</td>
                        <td>{transfer.variantName || "-"}</td>
                        <td>{transfer.unit || "-"}</td>
                        <td>{transfer.siteName || "-"}</td>
                        <td>{transfer.quantity}</td>
                        <td className={transfer.remark && transfer.remark.includes('Transferred to') ? 'remark-green' : (transfer.remark && transfer.remark.includes('Transferred from') ? 'remark-red' : '')}>
                          {transfer.remark || "-"}
                        </td>
                        <td>{transfer.userName || '-'}</td>
                        <td>
                          <div className="action-buttons-group">
                            <button className="action-button edit-button" onClick={() => handleEditTransfer(transfer)} disabled={isLoading}>Edit</button>
                            <button className="action-button delete-button" onClick={() => handleDeleteTransfer(transfer.id)} disabled={isLoading}>Delete</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <hr className="divider" />

      <section className="data-table-section inventory-summary-section">
        <h2 className="section-title">📊 Inventory Summary (Site-wise)</h2>
        {inventorySummary.length === 0 && !isLoading ? (
          <p className="no-data-message">No inventory data available yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Item / Variant</th>
                  <th>Total Inward</th>
                  <th>Total Outward</th>
                  <th>Current Stock</th>
                </tr>
              </thead>
              <tbody>
                {inventorySummary.map((summary, index) => (
                  <tr key={index}>
                    <td>{summary.siteName || "-"}</td>
                    <td>
                      {summary.itemName}
                      {summary.variantName && ` - ${summary.variantName}`}
                    </td>
                    <td>
                      {summary.totalReceived} {summary.unit}
                    </td>
                    <td>
                      {summary.totalUsed} {summary.unit}
                    </td>
                    <td>
                      <span
                        className={`stock-status ${summary.currentStock < 0 ? "negative" : ""}`}
                      >
                        {summary.currentStock} {summary.unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ReceivedUsedPage;