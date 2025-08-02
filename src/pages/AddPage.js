import React, { useState, useEffect, useReducer, useRef } from "react";
import { db, auth } from "../firebase";
import {
  addDoc,
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import adminEmails from "../constants/adminEmails";
import "../styles/Addpage.css"; // Ensure this path is correct

// --- Reducer for complex item state ---
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
    default:
      return state;
  }
};

// --- Base Unit Suggestions (initial client-side defaults, will be loaded from Firestore) ---
const baseUnitsSuggestions = [
  "kg", "pcs", "meter", "liter", "set", "pack", "roll", "box", "sqft", "sqm" // Added more common base units
];

// --- NEW: SearchableDropdown Component (Moved to top of file for clarity and reuse) ---
const SearchableDropdown = ({ value, options, onChange, placeholder, disabled, id }) => {
  const [inputValue, setInputValue] = useState(value);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [showOptions, setShowOptions] = useState(false);
  const wrapperRef = useRef(null);

  // Update input value when external value prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Handle clicks outside to close dropdown
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

    // Filter options based on input
    const filtered = options.filter(
      (option) => typeof option === 'string' && option.toLowerCase().includes(lowerCaseNewValue)
    );
    setFilteredOptions(filtered);
    setShowOptions(true);
  };

  const handleOptionClick = (option) => {
    setInputValue(option);
    onChange(option); // Pass the selected option back to the parent
    setShowOptions(false);
  };

  const handleFocus = () => {
    // When focused, show all options initially
    setFilteredOptions(options);
    setShowOptions(true);
  };

  return (
    <div className="searchable-dropdown-wrapper" ref={wrapperRef}>
      <input
        type="text"
        id={id}
        className="input-field select-field" // Added select-field for consistent styling
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        disabled={disabled}
        autoComplete="off" // Prevent browser autocomplete
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
      {showOptions && filteredOptions.length === 0 && inputValue && ( // Only show if user typed something and no matches
        <p className="no-matches-message">No matching units found.</p>
      )}
      {inputValue && !disabled && (
        <button
          className="clear-search-button"
          onClick={() => {
            setInputValue("");
            onChange(""); // Clear the parent's value
            setFilteredOptions(options); // Show all options again
            setShowOptions(false);
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};


const AddPage = () => {
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [itemState, dispatchItem] = useReducer(itemReducer, {
    name: "",
    hasVariants: false,
    variants: [{ name: "" }],
    hasMultipleUnits: false,
    itemUnits: [{ name: "" }], // Default to empty string for initial unit selection
  });
  const [sites, setSites] = useState([]);
  const [items, setItems] = useState([]);

  const [newUnitSuggestion, setNewUnitSuggestion] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [globalUnitList, setGlobalUnitList] = useState([]); // Now loaded from Firestore
  const [editingSite, setEditingSite] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingGlobalUnit, setEditingGlobalUnit] = useState(null);

  const [bulkSiteNamesInput, setBulkSiteNamesInput] = useState("");
  const [bulkItemNamesInput, setBulkItemNamesInput] = useState("");

  const [selectedItemForVariants, setSelectedItemForVariants] = useState("");
  const [bulkVariantNamesInput, setBulkVariantNamesInput] = useState("");

  // NEW: State for bulk add item units to existing item
  const [selectedItemForUnits, setSelectedItemForUnits] = useState("");
  const [selectedUnitToAdd, setSelectedUnitToAdd] = useState("");
  const [unitsPendingAddition, setUnitsPendingAddition] = useState([]); // List of units to add to the item
  const [bulkNewUnitSuggestions, setBulkNewUnitSuggestions] = useState(""); // For bulk adding to global suggestions


  // Auth state listener and admin check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        if (user.email && adminEmails.includes(user.email)) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setUserId("");
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch sites, items, and GLOBAL units when userId/isAdmin is available
  useEffect(() => {
    if (isAdmin) {
      fetchSites();
      fetchItems();
      fetchGlobalUnits(); // Fetch global units when admin is recognized
    } else if (userId) {
      fetchSites();
      fetchItems();
      fetchGlobalUnits(); // Still fetch for non-admins to populate dropdowns
    }
  }, [userId, isAdmin]);

  // --- Fetch Data Functions ---
  const fetchSites = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "sites"));
      const fetchedSites = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSites(fetchedSites);
    } catch (err) {
      console.error("Error fetching sites:", err);
      setError("Failed to load sites.");
    }
  };

  const fetchItems = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "items"));
      const fetchedItems = await Promise.all(
        querySnapshot.docs.map(async (itemDoc) => {
          const itemData = { id: itemDoc.id, ...itemDoc.data() };

          const variantQuerySnapshot = await getDocs(
            query(collection(db, "itemVariants"), where("itemId", "==", itemDoc.id))
          );
          itemData.variants = variantQuerySnapshot.docs.map((vDoc) => ({
            id: vDoc.id,
            ...vDoc.data(),
          }));

          const unitQuerySnapshot = await getDocs(
            query(collection(db, "itemUnits"), where("itemId", "==", itemDoc.id))
          );
          itemData.itemUnits = unitQuerySnapshot.docs.map((uDoc) => ({
            id: uDoc.id,
            ...uDoc.data(),
          }));

          itemData.hasVariants = itemData.variants.length > 0;
          itemData.hasMultipleUnits = itemData.itemUnits.length > 0;

          // Handle legacy 'unit' field or default to empty if neither itemUnits nor unit exists
          if (!itemData.hasMultipleUnits && itemData.unit) {
            itemData.itemUnits = [{ name: itemData.unit }];
          } else if (!itemData.hasMultipleUnits && itemData.itemUnits.length === 0) {
            itemData.itemUnits = [{ name: "" }]; // Default to 'No Unit' (empty string)
          }

          return itemData;
        })
      );
      setItems(fetchedItems);
    } catch (err) {
      console.error("Error fetching items:", err);
      setError("Failed to load items.");
    }
  };

  // NEW: Fetch global unit suggestions from Firestore
  const fetchGlobalUnits = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "globalUnits"));
      const fetchedUnits = querySnapshot.docs.map((doc) => doc.data().name);
      // Combine with base suggestions, ensuring uniqueness
      const combinedUnits = [...new Set([...baseUnitsSuggestions, ...fetchedUnits])];
      setGlobalUnitList(combinedUnits.sort()); // Sort for display
    } catch (err) {
      console.error("Error fetching global units:", err);
      setError("Failed to load global unit suggestions.");
      // Fallback to base suggestions if Firestore fails
      setGlobalUnitList(baseUnitsSuggestions.sort());
    }
  };

  // --- Add Site Handler ---
  const handleAddSite = async () => {
    if (!isAdmin) {
      setError("Only admin users can add sites.");
      return;
    }
    if (!siteName.trim()) {
      setError("Site name is required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, "sites"), {
        name: siteName.trim(),
        createdAt: new Date(),
      });
      setSiteName("");
      await fetchSites();
      alert("Site Added Successfully!");
    } catch (err) {
      console.error("Error adding site:", err);
      setError("Failed to add site. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Edit Site Handlers ---
  const handleEditSite = (site) => {
    if (!isAdmin) {
      setError("Only admin users can edit sites.");
      return;
    }
    setEditingSite({ ...site });
  };

  const handleUpdateSite = async () => {
    if (!isAdmin) {
      setError("Only admin users can update sites.");
      return;
    }
    if (!editingSite || !editingSite.name.trim()) {
      setError("Site name is required for update.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const siteRef = doc(db, "sites", editingSite.id);
      await updateDoc(siteRef, {
        name: editingSite.name.trim(),
      });
      setEditingSite(null);
      await fetchSites();
      alert("Site Updated Successfully!");
    } catch (err) {
      console.error("Error updating site:", err);
      setError("Failed to update site. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSite = async (siteId) => {
    if (!isAdmin) {
      setError("Only admin users can delete sites.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this site?")) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const siteRef = doc(db, "sites", siteId);
      await deleteDoc(siteRef);
      await fetchSites();
      alert("Site Deleted Successfully!");
    } catch (err) {
      console.error("Error deleting site:", err);
      setError("Failed to delete site. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Add Item Handler ---
  const handleAddItem = async () => {
    if (!isAdmin) {
      setError("Only admin users can add items.");
      return;
    }
    if (!itemState.name.trim()) {
      setError("Item name is required.");
      return;
    }
    // If not multiple units, and first unit is empty, prompt error
    if (!itemState.hasMultipleUnits && !itemState.itemUnits[0]?.name.trim()) {
      setError("Please select a unit for the item.");
      return;
    }
    // If multiple units, ensure all are filled
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
        // Save 'unit' field only if not multiple units (for simpler legacy access)
        unit: itemState.hasMultipleUnits ? null : (itemState.itemUnits[0]?.name.trim() || null),
        createdAt: new Date(),
      });

      // Only add to itemUnits collection if there are actual units specified
      if (itemState.itemUnits.length > 0 && itemState.itemUnits[0].name.trim() !== "") {
        await Promise.all(
          itemState.itemUnits
            .filter(u => u.name.trim() !== "") // Ensure no empty units are saved
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
            .filter(v => v.name.trim() !== "") // Ensure no empty variants are saved
            .map((v) =>
              addDoc(collection(db, "itemVariants"), {
                itemId: itemRef.id,
                name: v.name.trim(),
                // Use the first unit if available, otherwise null
                unit: itemState.itemUnits[0]?.name.trim() || null,
                fullName: `${itemState.name.trim()} - ${v.name.trim()}`,
                createdAt: new Date(),
              })
            )
        );
      }

      dispatchItem({ type: "RESET_ITEM" });
      await fetchItems();
      alert("Item Added Successfully!");
    } catch (err) {
      console.error("Error adding item:", err);
      setError("Failed to add item. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Edit Item Handlers ---
  const handleEditItem = (item) => {
    if (!isAdmin) {
      setError("Only admin users can edit items.");
      return;
    }
    const currentItemUnits = Array.isArray(item.itemUnits) && item.itemUnits.length > 0
      ? item.itemUnits
      : item.unit
      ? [{ name: item.unit }]
      : [{ name: "" }]; // Default to 'No Unit' (empty string)

    const currentVariants = Array.isArray(item.variants) && item.variants.length > 0
      ? item.variants
      : [{ name: "" }];

    setEditingItem({
      ...item,
      hasMultipleUnits: item.hasMultipleUnits || false,
      hasVariants: item.hasVariants || false,
      variants: currentVariants,
      itemUnits: currentItemUnits,
    });
  };

  const handleUpdateItem = async () => {
    if (!isAdmin) {
      setError("Only admin users can update items.");
      return;
    }
    if (!editingItem || !editingItem.name.trim()) {
      setError("Item name is required for update.");
      return;
    }
    // Similar unit validation for editing
    if (!editingItem.hasMultipleUnits && !editingItem.itemUnits[0]?.name.trim()) {
        setError("Please select a unit for the item.");
        return;
    }
    if (editingItem.hasMultipleUnits && editingItem.itemUnits.some((u) => !u.name.trim())) {
      setError("All selected item unit names must be filled.");
      return;
    }
    if (editingItem.hasVariants && editingItem.variants.some((v) => !v.name.trim())) {
      setError("All variant names must be filled if variants are enabled.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const itemRef = doc(db, "items", editingItem.id);
      await updateDoc(itemRef, {
        name: editingItem.name.trim(),
        hasVariants: editingItem.hasVariants,
        hasMultipleUnits: editingItem.hasMultipleUnits,
        unit: editingItem.hasMultipleUnits ? null : (editingItem.itemUnits[0]?.name.trim() || null),
      });

      // Delete existing item-specific units and re-add them for updates
      const existingItemUnitsQuery = await getDocs(
        query(collection(db, "itemUnits"), where("itemId", "==", editingItem.id))
      );
      await Promise.all(
        existingItemUnitsQuery.docs.map((uDoc) =>
          deleteDoc(doc(db, "itemUnits", uDoc.id))
        )
      );
      if (editingItem.itemUnits.length > 0 && editingItem.itemUnits[0].name.trim() !== "") {
        await Promise.all(
          editingItem.itemUnits
            .filter(u => u.name.trim() !== "") // Ensure no empty units are saved
            .map((u) =>
              addDoc(collection(db, "itemUnits"), {
                itemId: editingItem.id,
                name: u.name.trim(),
                createdAt: new Date(),
              })
            )
        );
      }

      // Delete existing variants and re-add them for updates
      const existingVariantsQuery = await getDocs(
        query(collection(db, "itemVariants"), where("itemId", "==", editingItem.id))
      );
      await Promise.all(
        existingVariantsQuery.docs.map((vDoc) =>
          deleteDoc(doc(db, "itemVariants", vDoc.id))
        )
      );
      if (editingItem.hasVariants && editingItem.variants.length > 0) {
        await Promise.all(
          editingItem.variants
            .filter(v => v.name.trim() !== "")
            .map((v) =>
              addDoc(collection(db, "itemVariants"), {
                itemId: editingItem.id,
                name: v.name.trim(),
                // Use the first unit of the selected item if available, otherwise null
                unit: editingItem.itemUnits[0]?.name.trim() || editingItem.unit || null,
                fullName: `${editingItem.name.trim()} - ${v.name.trim()}`,
                createdAt: new Date(),
              })
            )
        );
      }

      setEditingItem(null);
      await fetchItems();
      alert("Item Updated Successfully!");
    } catch (err) {
      console.error("Error updating item:", err);
      setError("Failed to update item. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!isAdmin) {
      setError("Only admin users can delete items.");
      return;
    }
    if (
      !window.confirm(
        "Are you sure you want to delete this item and its associated variants/units?"
      )
    ) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const variantQuerySnapshot = await getDocs(
        query(collection(db, "itemVariants"), where("itemId", "==", itemId))
      );
      await Promise.all(
        variantQuerySnapshot.docs.map((vDoc) =>
          deleteDoc(doc(db, "itemVariants", vDoc.id))
        )
      );

      const itemUnitsQuerySnapshot = await getDocs(
        query(collection(db, "itemUnits"), where("itemId", "==", itemId))
      );
      await Promise.all(
        itemUnitsQuerySnapshot.docs.map((uDoc) =>
          deleteDoc(doc(db, "itemUnits", uDoc.id))
        )
      );

      const itemRef = doc(db, "items", itemId);
      await deleteDoc(itemRef);

      await fetchItems();
      alert("Item Deleted Successfully!");
    } catch (err) {
      console.error("Error deleting item:", err);
      setError("Failed to delete item. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handle Add/Update/Delete GLOBAL Unit Suggestions (Now saving to Firestore) ---
  const handleAddGlobalUnitSuggestion = async () => {
    if (!isAdmin) {
      setError("Only admin users can add global unit suggestions.");
      return;
    }
    const trimmedUnit = newUnitSuggestion.trim().toLowerCase();
    if (!trimmedUnit) {
      setError("Unit name cannot be empty.");
      return;
    }
    if (globalUnitList.includes(trimmedUnit)) {
      setError("Unit already exists in suggestions!");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, "globalUnits"), {
        name: trimmedUnit,
        createdAt: new Date(),
      });
      setNewUnitSuggestion("");
      await fetchGlobalUnits(); // Re-fetch to update list from Firestore
      alert("Global Unit Suggestion Added Successfully!");
    } catch (err) {
      console.error("Error adding global unit:", err);
      setError("Failed to add global unit suggestion.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditGlobalUnit = (unit) => {
    if (!isAdmin) {
      setError("Only admin users can edit global unit suggestions.");
      return;
    }
    setEditingGlobalUnit(unit);
    setNewUnitSuggestion(unit); // Pre-fill the input with the current unit name
  };

  const handleUpdateGlobalUnit = async () => {
    if (!isAdmin) {
      setError("Only admin users can update global unit suggestions.");
      return;
    }
    if (!editingGlobalUnit || !newUnitSuggestion.trim()) {
      setError("Unit name cannot be empty for update.");
      return;
    }
    const trimmedNewUnit = newUnitSuggestion.trim().toLowerCase();

    if (globalUnitList.includes(trimmedNewUnit) && trimmedNewUnit !== editingGlobalUnit) {
      setError("New unit name already exists in suggestions.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Find the document in Firestore to update
      const querySnapshot = await getDocs(
        query(collection(db, "globalUnits"), where("name", "==", editingGlobalUnit))
      );
      if (!querySnapshot.empty) {
        const docToUpdate = querySnapshot.docs[0];
        await updateDoc(doc(db, "globalUnits", docToUpdate.id), {
          name: trimmedNewUnit,
        });
        setEditingGlobalUnit(null);
        setNewUnitSuggestion("");
        await fetchGlobalUnits();
        alert("Global Unit Updated Successfully!");
      } else {
        setError("Original unit not found in database.");
      }
    } catch (err) {
      console.error("Error updating global unit:", err);
      setError("Failed to update global unit suggestion.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGlobalUnit = async (unitToDelete) => {
    if (!isAdmin) {
      setError("Only admin users can delete global unit suggestions.");
      return;
    }
    // Only allow deletion of units not in the hardcoded base list, unless specifically coded
    if (baseUnitsSuggestions.includes(unitToDelete)) {
      setError("Cannot delete default unit suggestions.");
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to delete the global unit suggestion "${unitToDelete}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(
        query(collection(db, "globalUnits"), where("name", "==", unitToDelete))
      );
      if (!querySnapshot.empty) {
        const docToDelete = querySnapshot.docs[0];
        await deleteDoc(doc(db, "globalUnits", docToDelete.id));
        setEditingGlobalUnit(null);
        setNewUnitSuggestion("");
        await fetchGlobalUnits();
        alert("Global Unit Deleted Successfully!");
      } else {
        setError("Unit not found in database for deletion.");
      }
    } catch (err) {
      console.error("Error deleting global unit:", err);
      setError("Failed to delete global unit suggestion.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Bulk Add Sites from comma-separated list ---
  const handleBulkAddSites = async () => {
    if (!isAdmin) {
      setError("Only admin users can add sites.");
      return;
    }
    const names = bulkSiteNamesInput
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setError("Please enter site names (comma-separated).");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      names.forEach((name) => {
        if (name) {
          const docRef = doc(collection(db, "sites"));
          batch.set(docRef, {
            name: name,
            createdAt: new Date(),
          });
        }
      });
      await batch.commit();

      setBulkSiteNamesInput("");
      await fetchSites();
      alert("Sites Added Successfully!");
    } catch (err) {
      console.error("Error bulk adding sites:", err);
      setError("Failed to add sites. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Bulk Add Items from comma-separated list (without specific variants/units initially) ---
  const handleBulkAddItems = async () => {
    if (!isAdmin) {
      setError("Only admin users can add items.");
      return;
    }
    const names = bulkItemNamesInput
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setError("Please enter item names (comma-separated).");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      for (const name of names) {
        if (name) {
          const itemRef = doc(collection(db, "items"));
          batch.set(itemRef, {
            name: name,
            hasVariants: false,
            hasMultipleUnits: false,
            unit: null, // Default to null for single unit if not specified
            createdAt: new Date(),
          });
          // Do NOT automatically add 'pcs' to itemUnits here, as default is now 'No Unit' (null/empty)
          // The user can add units via the bulk item unit adder or item edit
        }
      }
      await batch.commit();

      setBulkItemNamesInput("");
      await fetchItems();
      alert("Items Added Successfully!");
    } catch (err) {
      console.error("Error bulk adding items:", err);
      setError("Failed to add items. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handle Bulk Add Variants to an Existing Item ---
  const handleBulkAddVariantsToExistingItem = async () => {
    if (!isAdmin) {
      setError("Only admin users can add variants.");
      return;
    }
    if (!selectedItemForVariants) {
      setError("Please select an item to add variants to.");
      return;
    }
    const variantNames = bulkVariantNamesInput
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    if (variantNames.length === 0) {
      setError("Please enter variant names (comma-separated).");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const selectedItem = items.find((item) => item.id === selectedItemForVariants);
      if (!selectedItem) {
          setError("Selected item not found.");
          setIsLoading(false);
          return;
      }

      const batch = writeBatch(db);
      let updatedHasVariants = selectedItem.hasVariants;

      for (const variantName of variantNames) {
        if (variantName) {
          // Check if variant already exists for this item to avoid duplicates
          const existingVariant = selectedItem.variants.find(v => v.name.toLowerCase() === variantName.toLowerCase());
          if (!existingVariant) {
            batch.set(doc(collection(db, "itemVariants")), {
              itemId: selectedItemForVariants,
              name: variantName,
              // Use the first unit of the selected item if available, otherwise null
              unit: selectedItem.itemUnits[0]?.name.trim() || selectedItem.unit || null,
              fullName: `${selectedItem.name} - ${variantName}`,
              createdAt: new Date(),
            });
            updatedHasVariants = true;
          } else {
              console.warn(`Variant "${variantName}" already exists for item "${selectedItem.name}". Skipping.`);
          }
        }
      }

      if (updatedHasVariants) {
          const itemRef = doc(db, "items", selectedItemForVariants);
          batch.update(itemRef, { hasVariants: true });
      }

      await batch.commit();

      setBulkVariantNamesInput("");
      setSelectedItemForVariants("");
      await fetchItems();
      alert("Variants Added Successfully!");
    } catch (err) {
      console.error("Error bulk adding variants:", err);
      setError("Failed to add variants. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // NEW: Add a unit to the pending list for bulk addition
  const handleAddUnitToPendingList = () => {
    if (!selectedUnitToAdd.trim()) {
      setError("Please select a unit to add.");
      return;
    }
    if (!globalUnitList.includes(selectedUnitToAdd)) {
        setError(`"${selectedUnitToAdd}" is not a valid global unit suggestion. Please select from the list or add it globally first.`);
        return;
    }
    if (unitsPendingAddition.includes(selectedUnitToAdd)) {
        setError(`Unit "${selectedUnitToAdd}" is already in the list for this item.`);
        return;
    }

    setUnitsPendingAddition((prevUnits) => [...prevUnits, selectedUnitToAdd]);
    setSelectedUnitToAdd(""); // Clear the unit selection dropdown
    setError(null); // Clear any previous error
  };

  // NEW: Remove a unit from the pending list
  const handleRemoveUnitFromPendingList = (unitToRemove) => {
    setUnitsPendingAddition((prevUnits) =>
      prevUnits.filter((unit) => unit !== unitToRemove)
    );
  };


  // NEW: Handle Bulk Add Item Units to an Existing Item
  const handleBulkAddItemUnitsToExistingItem = async () => {
    if (!isAdmin) {
      setError("Only admin users can add units.");
      return;
    }
    if (!selectedItemForUnits) {
      setError("Please select an item to add units to.");
      return;
    }
    if (unitsPendingAddition.length === 0) { // Use unitsPendingAddition
      setError("Please add at least one unit to the list.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
        const selectedItem = items.find((item) => item.id === selectedItemForUnits);
        if (!selectedItem) {
            setError("Selected item not found.");
            setIsLoading(false);
            return;
        }

        const batch = writeBatch(db);
        let updatedHasMultipleUnits = selectedItem.hasMultipleUnits;
        const currentItemUnitNames = new Set(selectedItem.itemUnits.map(u => u.name.toLowerCase()));

        for (const unitName of unitsPendingAddition) { // Iterate over unitsPendingAddition
            if (unitName && !currentItemUnitNames.has(unitName)) { // Check for duplicates
                batch.set(doc(collection(db, "itemUnits")), {
                    itemId: selectedItemForUnits,
                    name: unitName,
                    createdAt: new Date(),
                });
                updatedHasMultipleUnits = true; // Mark item as having multiple units
                currentItemUnitNames.add(unitName); // Add to set for subsequent checks within the same batch
            } else if (currentItemUnitNames.has(unitName)) {
                console.warn(`Unit "${unitName}" already exists for item "${selectedItem.name}". Skipping.`);
            }
        }

        // Update the main item document if units were added or if it was previously single-unit
        // If it was single unit, and now has multiple from bulk add, update 'unit' field to null
        if (updatedHasMultipleUnits || !selectedItem.hasMultipleUnits) {
            const itemRef = doc(db, "items", selectedItemForUnits);
            batch.update(itemRef, {
                hasMultipleUnits: true, // Always true if we're adding multiple
                unit: null // Clear single unit field if switching to multiple
            });
        }


        await batch.commit();

        setUnitsPendingAddition([]); // Clear pending units after successful addition
        setSelectedUnitToAdd(""); // Clear single selection input
        setSelectedItemForUnits("");
        await fetchItems(); // Refresh items to show new units
        alert("Units Added Successfully!");
    } catch (err) {
        console.error("Error bulk adding item units:", err);
        setError("Failed to add item units. Please try again.");
    } finally {
        setIsLoading(false);
    }
};

  // NEW: Handle Bulk Add Global Unit Suggestions (Comma-separated)
  const handleBulkAddGlobalUnitSuggestions = async () => {
    if (!isAdmin) {
      setError("Only admin users can bulk add global unit suggestions.");
      return;
    }
    const units = bulkNewUnitSuggestions
      .split(",")
      .map((unit) => unit.trim().toLowerCase())
      .filter(Boolean);

    if (units.length === 0) {
      setError("Please enter unit suggestions.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      const existingUnitsInFirestore = new Set(globalUnitList.map(u => u.toLowerCase()));

      for (const unit of units) {
        if (unit && !existingUnitsInFirestore.has(unit)) {
          // Add to batch only if it's a new unique unit
          batch.set(doc(collection(db, "globalUnits")), {
            name: unit,
            createdAt: new Date(),
          });
          existingUnitsInFirestore.add(unit); // Add to local set to avoid duplicates within the same batch input
        } else if (unit) {
            console.warn(`Global unit "${unit}" already exists. Skipping.`);
        }
      }
      await batch.commit();
      setBulkNewUnitSuggestions("");
      await fetchGlobalUnits(); // Refresh to show newly added units
      alert("Bulk Global Unit Suggestions Added Successfully!");
    } catch (err) {
      console.error("Error bulk adding global units:", err);
      setError("Failed to bulk add global unit suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };


  // Function to render unit inputs for Add Item form
  const renderItemUnitInputs = () => {
    // If not multiple units, render a single searchable dropdown
    if (!itemState.hasMultipleUnits) {
      return (
        <SearchableDropdown
          id="single-unit-select" // Added ID for clarity
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

    // Render multiple unit inputs if hasMultipleUnits is true
    return (
      <div className="units-section">
        <h3 className="sub-section-title">Item Units</h3>
        {itemState.itemUnits.map((unit, idx) => (
          <div key={idx} className="unit-input-group">
            <SearchableDropdown
              id={`add-item-unit-${idx}`} // Unique ID for each dropdown
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
    if (!editingItem?.hasMultipleUnits) {
      return (
        <SearchableDropdown
          id="edit-single-unit-select" // Added ID for clarity
          value={editingItem?.itemUnits[0]?.name || ""}
          options={globalUnitList}
          onChange={(selectedValue) =>
            setEditingItem({
              ...editingItem,
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
        {editingItem.itemUnits.map((unit, idx) => (
          <div key={idx} className="unit-input-group">
            <SearchableDropdown
              id={`edit-item-unit-${idx}`} // Unique ID for each dropdown
              value={unit?.name || ""}
              options={globalUnitList}
              onChange={(selectedValue) => {
                const newUnits = [...editingItem.itemUnits];
                newUnits[idx] = { ...newUnits[idx], name: selectedValue };
                setEditingItem({ ...editingItem, itemUnits: newUnits });
              }}
              placeholder="Select a Unit"
              disabled={isLoading}
            />
            {editingItem.itemUnits.length > 1 && (
              <button
                className="remove-variant-button"
                onClick={() => {
                  const newUnits = editingItem.itemUnits.filter(
                    (_, uIdx) => uIdx !== idx
                  );
                  setEditingItem({ ...editingItem, itemUnits: newUnits });
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
            setEditingItem({
              ...editingItem,
              itemUnits: [...editingItem.itemUnits, { name: "" }],
            })
          }
          disabled={isLoading}
        >
          ➕ Add Another Unit
        </button>
      </div>
    );
  };

  // --- NEW: Helper to get item names for searchable dropdowns ---
  const getItemOptions = () => {
    return items.map(item => ({ id: item.id, name: item.name }));
  };


  if (!userId) {
    return (
      <div className="add-page-container">
        <p className="no-data-message">Please log in to manage inventory.</p>
      </div>
    );
  }

  return (
    <div className="add-page-container">
      {/* --- Error Display --- */}
      {error && <div className="error-message">{error}</div>}

      {!isAdmin && (
        <div className="access-denied-message">
          <p>
            You do not have admin privileges to access this page. Please contact
            an administrator.
          </p>
        </div>
      )}

      {/* Admin content conditional rendering */}
      {isAdmin && (
        <>
          {/* --- Add Site Section (Single) --- */}
          <section className="add-section">
            <h2 className="section-title">Add Site (Single)</h2>
            <div className="form-group">
              <input
                type="text"
                className="input-field"
                placeholder="Site Name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                disabled={isLoading}
              />
              <button
                className="primary-button"
                onClick={handleAddSite}
                disabled={isLoading}
              >
                {isLoading ? "Adding..." : "Add Site"}
              </button>
            </div>
          </section>

          <hr className="divider" />

          {/* --- NEW: Bulk Add Sites Section --- */}
          <section className="add-section">
            <h2 className="section-title">Bulk Add Sites</h2>
            <div className="form-group">
              <textarea
                className="input-field textarea-field"
                placeholder="Enter site names, comma-separated (e.g., Panipat, Yamunanagar, Sant Nagar)"
                value={bulkSiteNamesInput}
                onChange={(e) => setBulkSiteNamesInput(e.target.value)}
                disabled={isLoading}
                rows="3"
              ></textarea>
              <button
                className="primary-button"
                onClick={handleBulkAddSites}
                disabled={isLoading}
              >
                {isLoading ? "Adding..." : "Bulk Add Sites"}
              </button>
            </div>
          </section>

          <hr className="divider" />

          {/* --- Edit Sites Section --- */}
          <section className="edit-section">
            <h2 className="section-title">Edit Sites</h2>
            {sites.length === 0 ? (
              <p className="no-data-message">No sites added yet.</p>
            ) : (
              <ul className="edit-list">
                {sites.map((site) => (
                  <li key={site.id} className="edit-list-item">
                    {editingSite && editingSite.id === site.id ? (
                      <div className="edit-input-group">
                        <input
                          type="text"
                          className="input-field"
                          value={editingSite?.name || ""}
                          onChange={(e) =>
                            setEditingSite({ ...editingSite, name: e.target.value })
                          }
                          disabled={isLoading}
                        />
                        <button
                          className="action-button save-button"
                          onClick={handleUpdateSite}
                          disabled={isLoading}
                        >
                          Save
                        </button>
                        <button
                          className="action-button cancel-button"
                          onClick={() => setEditingSite(null)}
                          disabled={isLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="item-name">{site.name}</span>
                        <div className="action-buttons-group">
                          <button
                            className="action-button edit-button"
                            onClick={() => handleEditSite(site)}
                            disabled={isLoading}
                          >
                            Edit
                          </button>
                          <button
                            className="action-button delete-button"
                            onClick={() => handleDeleteSite(site.id)}
                            disabled={isLoading}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <hr className="divider" />

          {/* --- Add Item Section (Single) --- */}
          <section className="add-section">
            <h2 className="section-title">Add Item (Single)</h2>

            {/* Item Name */}
            <div className="form-group">
              <label htmlFor="itemName">Item Name:</label>
              <input
                type="text"
                id="itemName"
                className="input-field"
                placeholder="Item Name"
                value={itemState.name}
                onChange={(e) =>
                  dispatchItem({ type: "SET_FIELD", field: "name", value: e.target.value })
                }
                disabled={isLoading}
              />
            </div>

            {/* Has Multiple Units Checkbox */}
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

            {/* Unit Input(s) - NOW SEARCHABLE */}
            <div className="form-group">{renderItemUnitInputs()}</div>

            {/* Has Variants Checkbox */}
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

            {/* Variants Input Section */}
            {itemState.hasVariants && (
              <div className="variants-section">
                <h3 className="sub-section-title">Item Variants</h3>
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

            {/* Final Add Item Button */}
            <button
              className="primary-button add-item-final-button"
              onClick={handleAddItem}
              disabled={isLoading}
            >
              {isLoading ? "Adding..." : "Add Item"}
            </button>
          </section>

          <hr className="divider" />

          {/* --- NEW: Bulk Add Items Section (Simple) --- */}
          <section className="add-section">
            <h2 className="section-title">Bulk Add Items (No Initial Variants/Units)</h2>
            <p className="instructions">
              Enter item names, comma-separated. These items will be added with
              no pre-selected unit and no variants. You can add them later.
            </p>
            <div className="form-group">
              <textarea
                className="input-field textarea-field"
                placeholder="Enter item names, comma-separated (e.g., Hammer, Screwdriver, Wrench)"
                value={bulkItemNamesInput}
                onChange={(e) => setBulkItemNamesInput(e.target.value)}
                disabled={isLoading}
                rows="3"
              ></textarea>
              <button
                className="primary-button"
                onClick={handleBulkAddItems}
                disabled={isLoading}
              >
                {isLoading ? "Adding..." : "Bulk Add Items"}
              </button>
            </div>
          </section>

          <hr className="divider" />

          {/* --- NEW: Bulk Add Variants to Existing Item Section --- */}
          <section className="add-section">
            <h2 className="section-title">Bulk Add Variants to Existing Item</h2>
            <p className="instructions">
              Select an item from the list and then enter variant names, comma-separated.
            </p>
            <div className="form-group column-layout">
                <label htmlFor="selectItemForVariants">Select Item:</label>
                {/* Searchable dropdown for selecting item for variants */}
                <SearchableDropdown
                    id="selectItemForVariants"
                    value={items.find(item => item.id === selectedItemForVariants)?.name || ""}
                    options={getItemOptions().map(opt => opt.name)} // Pass only names as options
                    onChange={(selectedName) => {
                      const selectedItem = getItemOptions().find(opt => opt.name === selectedName);
                      setSelectedItemForVariants(selectedItem ? selectedItem.id : "");
                    }}
                    placeholder="-- Select an Item --"
                    disabled={isLoading}
                />

                <label htmlFor="bulkVariantNamesInput">Variant Names:</label>
                <textarea
                    id="bulkVariantNamesInput"
                    className="input-field textarea-field"
                    placeholder="Enter variant names, comma-separated (e.g., 2mm, 4mm, 6mm)"
                    value={bulkVariantNamesInput}
                    onChange={(e) => setBulkVariantNamesInput(e.target.value)}
                    disabled={isLoading}
                    rows="3"
                ></textarea>
                <button
                    className="primary-button"
                    onClick={handleBulkAddVariantsToExistingItem}
                    disabled={isLoading || !selectedItemForVariants}
                >
                    {isLoading ? "Adding..." : "Add Variants to Selected Item"}
                </button>
            </div>
          </section>

          <hr className="divider" />

          {/* --- NEW: Bulk Add Item-Specific Units to Existing Item Section --- */}
          <section className="add-section">
            <h2 className="section-title">Bulk Add Units to Existing Item</h2>
            <p className="instructions">
              Select an item and then choose units from the global suggestions.
            </p>
            <div className="form-group column-layout">
                <label htmlFor="selectItemForUnits">Select Item:</label>
                 {/* Searchable dropdown for selecting item for units */}
                <SearchableDropdown
                    id="selectItemForUnits"
                    value={items.find(item => item.id === selectedItemForUnits)?.name || ""}
                    options={getItemOptions().map(opt => opt.name)} // Pass only names as options
                    onChange={(selectedName) => {
                      const selectedItem = getItemOptions().find(opt => opt.name === selectedName);
                      setSelectedItemForUnits(selectedItem ? selectedItem.id : "");
                      // Optionally, clear pending units if item selection changes
                      setUnitsPendingAddition([]);
                    }}
                    placeholder="-- Select an Item --"
                    disabled={isLoading}
                />

                <label htmlFor="selectUnitToAdd">Select Unit to Add:</label>
                <div className="unit-selection-add-group">
                  <SearchableDropdown
                      id="selectUnitToAdd"
                      value={selectedUnitToAdd}
                      options={globalUnitList}
                      onChange={(selectedValue) => setSelectedUnitToAdd(selectedValue)}
                      placeholder="Select a unit"
                      disabled={isLoading}
                  />
                  <button
                    className="secondary-button"
                    onClick={handleAddUnitToPendingList}
                    disabled={isLoading || !selectedUnitToAdd.trim()}
                  >
                    Add to List
                  </button>
                </div>

                {unitsPendingAddition.length > 0 && (
                    <div className="pending-units-list-container">
                        <h4 className="sub-section-title">Units to Add:</h4>
                        <ul className="pending-units-list">
                            {unitsPendingAddition.map((unit, idx) => (
                                <li key={idx}>
                                  {unit}
                                  <button
                                    className="remove-unit-button"
                                    onClick={() => handleRemoveUnitFromPendingList(unit)}
                                    disabled={isLoading}
                                  >
                                    ✕
                                  </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <button
                    className="primary-button"
                    onClick={handleBulkAddItemUnitsToExistingItem}
                    disabled={isLoading || !selectedItemForUnits || unitsPendingAddition.length === 0}
                >
                    {isLoading ? "Adding..." : `Add ${unitsPendingAddition.length} Units to Selected Item`}
                </button>
            </div>
          </section>

          <hr className="divider" />

          {/* --- Add Global Unit Suggestion (Single) --- */}
          <section className="add-section">
            <h2 className="section-title">Add Global Unit Suggestion (Single)</h2>
            <div className="form-group add-unit-group">
              <input
                type="text"
                className="input-field"
                placeholder="Add New Unit (e.g., dozen)"
                value={newUnitSuggestion}
                onChange={(e) => setNewUnitSuggestion(e.target.value)}
                disabled={isLoading}
              />
              <button
                className="secondary-button"
                onClick={handleAddGlobalUnitSuggestion}
                disabled={isLoading}
              >
                Add Suggestion
              </button>
            </div>
          </section>

          <hr className="divider" />

          {/* --- NEW: Bulk Add Global Unit Suggestions Section --- */}
          <section className="add-section">
            <h2 className="section-title">Bulk Add Global Unit Suggestions</h2>
            <p className="instructions">
              Enter new unit suggestions, comma-separated (e.g., box, crate).
              These will be added to the global list for use with items.
            </p>
            <div className="form-group">
              <textarea
                className="input-field textarea-field"
                placeholder="Enter units, comma-separated (e.g., box, crate, palette)"
                value={bulkNewUnitSuggestions}
                onChange={(e) => setBulkNewUnitSuggestions(e.target.value)}
                disabled={isLoading}
                rows="3"
              ></textarea>
              <button
                className="primary-button"
                onClick={handleBulkAddGlobalUnitSuggestions}
                disabled={isLoading}
              >
                {isLoading ? "Adding..." : "Bulk Add Unit Suggestions"}
              </button>
            </div>
          </section>

          <hr className="divider" />


          {/* --- Manage Global Unit Suggestions Section --- */}
          <section className="edit-section">
            <h2 className="section-title">Manage Global Unit Suggestions</h2>
            {globalUnitList.length === 0 ? (
              <p className="no-data-message">No global unit suggestions yet.</p>
            ) : (
              <ul className="edit-list">
                {globalUnitList.map((unit, idx) => (
                  <li key={idx} className="edit-list-item">
                    {editingGlobalUnit === unit ? (
                      <div className="edit-input-group">
                        <input
                          type="text"
                          className="input-field"
                          value={newUnitSuggestion || ""}
                          onChange={(e) => setNewUnitSuggestion(e.target.value)}
                          disabled={isLoading}
                        />
                        <button
                          className="action-button save-button"
                          onClick={handleUpdateGlobalUnit}
                          disabled={isLoading}
                        >
                          Save
                        </button>
                        <button
                          className="action-button cancel-button"
                          onClick={() => {
                            setEditingGlobalUnit(null);
                            setNewUnitSuggestion("");
                          }}
                          disabled={isLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="item-name">{unit}</span>
                        <div className="action-buttons-group">
                          <button
                            className="action-button edit-button"
                            onClick={() => handleEditGlobalUnit(unit)}
                            disabled={isLoading}
                          >
                            Edit
                          </button>
                          <button
                            className="action-button delete-button"
                            onClick={() => handleDeleteGlobalUnit(unit)}
                            disabled={isLoading}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AddPage;