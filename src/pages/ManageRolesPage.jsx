import React, { useState, useEffect, useCallback } from "react";
import { auth, db } from "../firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Select from 'react-select'; // Assuming react-select is still used
import styles from "../styles/ManageRolesPage.module.css"; // Using CSS Modules

// A simple SVG icon for a role (can be customized)
const RoleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.roleIcon}>
    <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM19.5 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 22.5c-2.905 0-5.657-.655-8.199-1.882z" clipRule="evenodd" />
  </svg>
);

const ManageRolesPage = () => {
    const [roles, setRoles] = useState([]);
    const [newRoleName, setNewRoleName] = useState("");
    const [bulkRoleNamesInput, setBulkRoleNamesInput] = useState("");
    const [editingRole, setEditingRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);

    // This admin check should ideally be done server-side (Firebase Rules)
    // and/or by checking a custom claim/role stored in user's Firestore doc.
    // For now, keeping your client-side adminEmails check for demo purposes.
    // Ensure 'adminEmails' import path is correct if not 'src/constants/adminEmails'
    // This file was not part of the provided snippets, so ensure it exists.
    // Example: import adminEmails from '../constants/adminEmails';
    // For testing, you might just set setCurrentUserIsAdmin(true) temporarily.
    const checkAdminStatus = useCallback(async (user) => {
        if (!user || !user.email) {
            setCurrentUserIsAdmin(false);
            return false;
        }
        // This is where you would typically read user's role from Firestore doc
        // e.g., const userDoc = await getDoc(doc(db, "users", user.uid));
        // if (userDoc.exists() && userDoc.data().roles.includes('Admin')) { ... }
        // For now, based on your original snippet, I'm assuming a client-side adminEmails check.
        // However, this client-side check is NOT secure for data access.
        // The Firebase Security Rules are the actual gatekeepers.
        
        // If you are using the email pattern from rules:
        if (user.email.endsWith('@admin.com')) {
             setCurrentUserIsAdmin(true);
             return true;
        }
        // If you still have adminEmails.js file and want to use it client-side for UI only:
        // import adminEmails from '../constants/adminEmails';
        // if (adminEmails.includes(user.email)) {
        //     setCurrentUserIsAdmin(true);
        //     return true;
        // }
        
        setCurrentUserIsAdmin(false);
        return false;
    }, []);


    const fetchRoles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const rolesCollectionRef = collection(db, "roles");
            const querySnapshot = await getDocs(rolesCollectionRef);
            const fetchedRoles = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
            setRoles(fetchedRoles);
        } catch (err) {
            console.error("Error fetching roles:", err);
            setError("Failed to load roles. Please check your internet connection and permissions.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const isAdmin = await checkAdminStatus(user);
                if (isAdmin) {
                    fetchRoles();
                } else {
                    setError("Access Denied: You must be an administrator to manage roles.");
                    setLoading(false);
                }
            } else {
                setCurrentUserIsAdmin(false);
                setRoles([]);
                setError("Access Denied: You must be logged in to view this page.");
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchRoles, checkAdminStatus]);

    const handleAddOrUpdateRole = async () => {
        if (!currentUserIsAdmin) {
            setError("Access Denied: Only administrators can add/edit roles.");
            return;
        }
        const trimmedRoleName = newRoleName.trim();
        if (!trimmedRoleName) {
            setError("Role name cannot be empty.");
            return;
        }
        if (editingRole) {
            if (roles.some(role => role.name.toLowerCase() === trimmedRoleName.toLowerCase() && role.id !== editingRole.id)) {
                setError("Role with this name already exists.");
                return;
            }
            setLoading(true);
            setError(null);
            setSuccessMessage(null);
            try {
                const roleRef = doc(db, "roles", editingRole.id);
                await updateDoc(roleRef, {
                    name: trimmedRoleName,
                    updatedAt: new Date(),
                });
                setEditingRole(null);
                setNewRoleName("");
                await fetchRoles();
                setSuccessMessage("Role updated successfully!");
            } catch (err) {
                console.error("Error updating role:", err);
                setError("Failed to update role. Please try again.");
            } finally {
                setLoading(false);
                setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
            }
        } else {
            if (roles.some(role => role.name.toLowerCase() === trimmedRoleName.toLowerCase())) {
                setError("Role with this name already exists.");
                return;
            }
            setLoading(true);
            setError(null);
            setSuccessMessage(null);
            try {
                await addDoc(collection(db, "roles"), {
                    name: trimmedRoleName,
                    createdAt: new Date(),
                });
                setNewRoleName("");
                await fetchRoles();
                setSuccessMessage("Role added successfully!");
            } catch (err) {
                console.error("Error adding role:", err);
                setError("Failed to add role. Please try again.");
            } finally {
                setLoading(false);
                setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
            }
        }
    };

    const handleEditRole = (role) => {
        setEditingRole({ ...role });
        setNewRoleName(role.name);
    };

    const handleDeleteRole = async (roleId, roleName) => {
        if (!currentUserIsAdmin || !window.confirm(`Are you sure you want to delete the role "${roleName}"? This action cannot be undone and may affect users assigned to this role.`)) {
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await deleteDoc(doc(db, "roles", roleId));
            await fetchRoles();
            setSuccessMessage("Role deleted successfully!");
        } catch (err) {
            console.error("Error deleting role:", err);
            setError("Failed to delete role. Please try again.");
        } finally {
            setLoading(false);
            setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
        }
    };

    const handleBulkAddRoles = async () => {
        if (!currentUserIsAdmin) {
            setError("Access Denied: Only administrators can bulk add roles.");
            return;
        }
        const newNames = bulkRoleNamesInput
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean);

        if (newNames.length === 0) {
            setError("Please enter role names (comma-separated) for bulk addition.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const batch = writeBatch(db);
            const existingRoleNames = new Set(roles.map(role => role.name.toLowerCase()));
            let rolesAddedCount = 0;

            for (const name of newNames) {
                const lowerCaseName = name.toLowerCase();
                if (!existingRoleNames.has(lowerCaseName)) {
                    batch.set(doc(collection(db, "roles")), {
                        name: name,
                        createdAt: new Date(),
                    });
                    existingRoleNames.add(lowerCaseName);
                    rolesAddedCount++;
                } else {
                    console.warn(`Role "${name}" already exists. Skipping.`);
                }
            }

            if (rolesAddedCount > 0) {
                await batch.commit();
                setBulkRoleNamesInput("");
                await fetchRoles();
                setSuccessMessage(`${rolesAddedCount} role(s) added successfully!`);
            } else {
                setSuccessMessage("No new roles were added (they might already exist).");
            }
        } catch (err) {
            console.error("Error bulk adding roles:", err);
            setError("Failed to bulk add roles. Please try again.");
        } finally {
            setLoading(false);
            setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
        }
    };


    if (loading) {
        return (
            <div className={styles.manageRolesContainer}>
                <div className={styles.loadingState}>
                    <div className={styles.spinner}></div>
                    <p>Loading roles and checking admin status...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.manageRolesContainer}>
                <div className={styles.errorState}>
                    <p className={styles.errorMessageTitle}>Access Denied!</p>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    // Only render the content if currentUserIsAdmin is true
    if (!currentUserIsAdmin) {
        return (
            <div className={styles.manageRolesContainer}>
                <div className={styles.errorState}>
                    <p className={styles.errorMessageTitle}>Access Denied!</p>
                    <p>You must be an administrator to manage roles.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.manageRolesContainer}>
            <h1>🛠️ Add/Manage Roles</h1>

            {error && <div className={`${styles.message} ${styles.error}`}>{error}</div>}
            {successMessage && <div className={`${styles.message} ${styles.success}`}>{successMessage}</div>}

            <div className={styles.addRoleSection}>
                <h2>Single Role Management</h2>
                <div className={styles.formGroup}>
                    <input
                        type="text"
                        placeholder="Role Name"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        className={styles.inputField}
                        disabled={loading}
                    />
                    <button
                        onClick={handleAddOrUpdateRole}
                        className={styles.primaryButton}
                        disabled={loading || !newRoleName.trim()}
                    >
                        {loading ? "Saving..." : (editingRole ? "Update Role" : "Add Role")}
                    </button>
                    {editingRole && (
                        <button
                            onClick={() => { setEditingRole(null); setNewRoleName(""); }}
                            className={styles.cancelButton}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.bulkAddRolesSection}>
                <h2>Bulk Add Roles</h2>
                <div className={styles.formGroup}>
                    <textarea
                        placeholder="Enter roles, comma-separated (e.g., Admin, Supervisor, Analyst)"
                        value={bulkRoleNamesInput}
                        onChange={(e) => setBulkRoleNamesInput(e.target.value)}
                        className={`${styles.inputField} ${styles.textareaField}`}
                        rows="3"
                        disabled={loading}
                    ></textarea>
                    <button
                        onClick={handleBulkAddRoles}
                        className={styles.primaryButton}
                        disabled={loading || !bulkRoleNamesInput.trim()}
                    >
                        {loading ? "Adding..." : "Bulk Add Roles"}
                    </button>
                </div>
            </div>


            <div className={styles.roleListSection}>
                <h2>Existing Roles</h2>
                {roles.length === 0 ? (
                    <p className={styles.noDataMessage}>No roles defined yet.</p>
                ) : (
                    <ul className={styles.roleList}>
                        {roles.map((role) => (
                            <li key={role.id} className={styles.roleListItem}>
                                <span className={styles.roleName}>{role.name}</span>
                                <div className={styles.actionButtonsGroup}>
                                    <button className={`${styles.actionButton} ${styles.editButton}`} onClick={() => handleEditRole(role)} disabled={loading}>Edit</button>
                                    <button className={`${styles.actionButton} ${styles.deleteButton}`} onClick={() => handleDeleteRole(role.id, role.name)} disabled={loading}>Delete</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default ManageRolesPage;