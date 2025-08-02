import React, { useState, useEffect, useCallback } from "react";
import { auth, db } from "../firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import Select from 'react-select';
import styles from "../styles/ManageUsersPage.module.css"; // Using CSS Modules

const ManageUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [expandedUser, setExpandedUser] = useState(null); // Changed from editingUser to track expanded row
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [availableRoles, setAvailableRoles] = useState([]);
    const [activeActionTab, setActiveActionTab] = useState(null); // State to control which action tab is open for expandedUser

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const usersCollectionRef = collection(db, "users");
            const q = query(usersCollectionRef, orderBy("createdAt", "desc"), orderBy("invitedAt", "desc"));
            const querySnapshot = await getDocs(q);
            const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(fetchedUsers);
        } catch (err) {
            console.error("Error fetching users:", err);
            setError("Failed to load users. Please check your internet connection and permissions.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAvailableRoles = useCallback(async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "roles"));
            const rolesData = querySnapshot.docs.map(doc => ({
                value: doc.data().name,
                label: doc.data().name,
                id: doc.id
            }));
            setAvailableRoles(rolesData);
        } catch (err) {
            console.error("Error fetching available roles:", err);
            setError("Failed to load available roles for dropdown.");
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setLoggedInUser(user);
                fetchUsers();
                fetchAvailableRoles();
            } else {
                setLoggedInUser(null);
                setUsers([]);
                setAvailableRoles([]);
                setError("Access Denied: You must be logged in to view this page.");
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchUsers, fetchAvailableRoles]);

    const handleToggleExpand = (user) => {
        if (expandedUser && expandedUser.id === user.id) {
            setExpandedUser(null); // Collapse if already expanded
            setActiveActionTab(null);
        } else {
            setExpandedUser(user); // Expand this user
            setActiveActionTab('details'); // Default to details view
             // If roles are present, pre-populate for the Select component
            if (user.roles) {
                setExpandedUser({
                    ...user,
                    roles: user.roles.map(role => availableRoles.find(ar => ar.value === role) || { value: role, label: role })
                });
            }
        }
        setSuccessMessage(null); // Clear messages when expanding/collapsing
        setError(null);
    };

    const handleActionClick = (user, actionType) => {
        setExpandedUser(user); // Ensure this user is expanded
        setActiveActionTab(actionType); // 'edit', 'reset_password', 'resend_invite', 'delete_confirm'
        if (actionType === 'edit' && user.roles) {
            setExpandedUser({
                ...user,
                roles: user.roles.map(role => availableRoles.find(ar => ar.value === role) || { value: role, label: role })
            });
        }
        setSuccessMessage(null);
        setError(null);
    };

    const handleCloseActionTab = () => {
        setExpandedUser(null); // Close the expanded row
        setActiveActionTab(null);
        setSuccessMessage(null);
        setError(null);
    };

    const handleUpdateUser = async () => {
        if (!expandedUser || !loggedInUser) {
            setError("No user selected for editing or not authenticated.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const userRef = doc(db, "users", expandedUser.id);
            // Ensure roles is an array of strings, especially if it comes from react-select
            const rolesToSave = expandedUser.roles ? expandedUser.roles.map(role => role.value) : [];

            await updateDoc(userRef, {
                name: expandedUser.name.trim(),
                email: expandedUser.email.trim(),
                roles: rolesToSave,
                updatedAt: new Date(),
            });

            setSuccessMessage("User details updated successfully!");
            handleCloseActionTab();
            fetchUsers();
        } catch (err) {
            console.error("Error updating user:", err);
            let errMsg = "Failed to update user. Please try again.";
            setError(errMsg);
        } finally {
            setLoading(false);
            setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
        }
    };

    const handleDeleteUser = async () => {
        if (!expandedUser || !loggedInUser) {
            setError("No user selected for deletion or not authenticated.");
            return;
        }

        if (!window.confirm(`Are you sure you want to delete user ${expandedUser.email}? This will remove their Firestore profile.`)) {
            return;
        }

        if (loggedInUser && loggedInUser.uid === expandedUser.uid) {
            setError("You cannot delete your own account from here.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await deleteDoc(doc(db, "users", expandedUser.id));
            setSuccessMessage(`User ${expandedUser.email}'s profile deleted from Firestore. (Note: Authentication deletion still requires a backend Cloud Function for full removal).`);
            handleCloseActionTab();
            fetchUsers();
        } catch (err) {
            console.error("Error deleting user:", err);
            setError("Failed to delete user. Please check Firebase console for Auth user status or Cloud Function logs.");
        } finally {
            setLoading(false);
            setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString("en-IN") + " " + date.toLocaleTimeString("en-IN");
    };

    const handleSendPasswordReset = async () => {
        if (!expandedUser || !loggedInUser) {
            setError("No user selected or not authenticated.");
            return;
        }
        if (!window.confirm(`Are you sure you want to send a password reset email to ${expandedUser.email}?`)) {
            return;
        }
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await sendPasswordResetEmail(auth, expandedUser.email);
            setSuccessMessage(`Password reset email sent to ${expandedUser.email}!`);
            handleCloseActionTab();
        } catch (err) {
            console.error("Error sending password reset email:", err);
            let errMsg = `Failed to send password reset email to ${expandedUser.email}.`;
            if (err.code === 'auth/user-not-found') {
                errMsg = `No Firebase Auth user found with email: ${expandedUser.email}. (User may not have signed up yet or email is wrong in Auth).`;
            } else if (err.code === 'auth/invalid-email') {
                errMsg = `The email address ${expandedUser.email} is invalid.`;
            }
            setError(errMsg);
        } finally {
            setLoading(false);
            setTimeout(() => { setSuccessMessage(null); setError(null); }, 5000);
        }
    };

    const handleResendInvite = async () => {
        if (!expandedUser || !loggedInUser) {
            setError("No user selected or not authenticated.");
            return;
        }
        if (!window.confirm(`Are you sure you want to resend an invite to ${expandedUser.email}? This will prompt them to sign up.`)) {
            return;
        }
        setSuccessMessage(`Simulated: An invite link/message has been sent to ${expandedUser.email} (Direct them to your signup page).`);
        handleCloseActionTab();
        // In a real application, you might trigger a Cloud Function here to send a real invite email.
    };

    if (!loggedInUser) {
        return (
            <div className={styles.manageUsersContainer}>
                <div className={styles.accessDeniedMessage}>
                    <p>{error || "Please log in to view this page."}</p>
                </div>
            </div>
        );
    }

    if (loading && users.length === 0) {
        return (
            <div className={styles.manageUsersContainer}>
                <div className={`${styles.message} ${styles.loadingMessage}`}>Loading users...</div>
            </div>
        );
    }

    return (
        <div className={styles.manageUsersContainer}>
            {error && <div className={`${styles.message} ${styles.error}`}>{error}</div>}
            {successMessage && <div className={`${styles.message} ${styles.success}`}>{successMessage}</div>}

            <div className={styles.userListSection}>
                {users.length === 0 && !loading ? (
                    <p className={styles.noDataMessage}>No users found in the database. Create one!</p>
                ) : (
                    <div className={styles.tableResponsive}>
                        <table className={styles.usersTable}>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role(s)</th>
                                    <th>Status</th>
                                    <th>Date Created/Invited</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <React.Fragment key={user.id}>
                                        <tr
                                            className={`${styles.userRow} ${expandedUser && expandedUser.id === user.id ? styles.selectedRow : ''}`}
                                            onClick={() => handleToggleExpand(user)} // Clickable row
                                        >
                                            <td>{user.name}</td>
                                            <td>{user.email}</td>
                                            <td>{user.roles && user.roles.length > 0 ? user.roles.join(", ") : "N/A"}</td>
                                            <td>
                                                {user.hasSignedUp ? (
                                                    <span className={styles.statusActive}>Active</span>
                                                ) : (
                                                    <span className={styles.statusInvited}>Invited</span>
                                                )}
                                            </td>
                                            <td>{formatTimestamp(user.createdAt || user.invitedAt)}</td>
                                            <td>
                                                <button
                                                    className={`${styles.actionButton} ${styles.viewDetailsButton}`}
                                                    onClick={(e) => { e.stopPropagation(); handleToggleExpand(user); }} // Stop propagation to prevent row click
                                                    disabled={loading}
                                                >
                                                    {expandedUser && expandedUser.id === user.id ? 'Hide Details' : 'View Details'}
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Expanded details row */}
                                        {expandedUser && expandedUser.id === user.id && (
                                            <tr className={styles.expandedRow}>
                                                <td colSpan="6">
                                                    <div className={styles.expandedContent}>
                                                        <div className={styles.expandedTabNav}>
                                                            <button
                                                                className={`${styles.expandedTabButton} ${activeActionTab === 'details' ? styles.expandedTabActive : ''}`}
                                                                onClick={() => setActiveActionTab('details')}
                                                            >
                                                                Info
                                                            </button>
                                                            <button
                                                                className={`${styles.expandedTabButton} ${activeActionTab === 'edit' ? styles.expandedTabActive : ''}`}
                                                                onClick={() => setActiveActionTab('edit')}
                                                            >
                                                                Edit
                                                            </button>
                                                            {user.hasSignedUp && (
                                                                <button
                                                                    className={`${styles.expandedTabButton} ${activeActionTab === 'reset_password' ? styles.expandedTabActive : ''}`}
                                                                    onClick={() => setActiveActionTab('reset_password')}
                                                                >
                                                                    Reset Password
                                                                </button>
                                                            )}
                                                            {!user.hasSignedUp && (
                                                                <button
                                                                    className={`${styles.expandedTabButton} ${activeActionTab === 'resend_invite' ? styles.expandedTabActive : ''}`}
                                                                    onClick={() => setActiveActionTab('resend_invite')}
                                                                >
                                                                    Resend Invite
                                                                </button>
                                                            )}
                                                            <button
                                                                className={`${styles.expandedTabButton} ${activeActionTab === 'delete_confirm' ? styles.expandedTabActive : ''} ${styles.deleteButtonSmall}`}
                                                                onClick={() => setActiveActionTab('delete_confirm')}
                                                                disabled={loggedInUser && loggedInUser.uid === user.uid}
                                                            >
                                                                Delete User
                                                            </button>
                                                        </div>

                                                        <div className={styles.actionTabContent}>
                                                            {activeActionTab === 'details' && (
                                                                <div className={styles.actionSection}>
                                                                    <h4>User Information for {expandedUser.name}</h4>
                                                                    <p><strong>Name:</strong> {expandedUser.name}</p>
                                                                    <p><strong>Email:</strong> {expandedUser.email}</p>
                                                                    <p><strong>Roles:</strong> {expandedUser.roles && Array.isArray(expandedUser.roles) ? expandedUser.roles.map(role => role.label || role).join(", ") : "N/A"}</p>
                                                                    <p><strong>Status:</strong> {expandedUser.hasSignedUp ? 'Active' : 'Invited'}</p>
                                                                    <p><strong>Created/Invited On:</strong> {formatTimestamp(expandedUser.createdAt || expandedUser.invitedAt)}</p>
                                                                    {expandedUser.updatedAt && <p><strong>Last Updated On:</strong> {formatTimestamp(expandedUser.updatedAt)}</p>}
                                                                    {expandedUser.lastLoginAt && <p><strong>Last Login:</strong> {formatTimestamp(expandedUser.lastLoginAt)}</p>}
                                                                    {expandedUser.uid && <p><strong>Firebase UID:</strong> {expandedUser.uid}</p>}
                                                                </div>
                                                            )}

                                                            {activeActionTab === 'edit' && (
                                                                <div className={styles.actionSection}>
                                                                    <h4>Edit User Details for {expandedUser.name}</h4>
                                                                    <div className={styles.formGroup}>
                                                                        <label>Full Name:</label>
                                                                        <input
                                                                            type="text"
                                                                            value={expandedUser.name}
                                                                            onChange={(e) => setExpandedUser({ ...expandedUser, name: e.target.value })}
                                                                            className={styles.inputField}
                                                                            disabled={loading}
                                                                        />
                                                                    </div>
                                                                    <div className={styles.formGroup}>
                                                                        <label>Email:</label>
                                                                        <input
                                                                            type="email"
                                                                            value={expandedUser.email}
                                                                            onChange={(e) => setExpandedUser({ ...expandedUser, email: e.target.value })}
                                                                            className={styles.inputField}
                                                                            disabled={loading}
                                                                        />
                                                                    </div>
                                                                    <div className={styles.formGroup}>
                                                                        <label>Roles:</label>
                                                                        <Select
                                                                            isMulti
                                                                            options={availableRoles}
                                                                            value={expandedUser.roles}
                                                                            onChange={(selectedOptions) => setExpandedUser({ ...expandedUser, roles: selectedOptions })}
                                                                            className={styles.reactSelectContainer}
                                                                            classNamePrefix="react-select"
                                                                            isDisabled={loading || availableRoles.length === 0}
                                                                            styles={{
                                                                                control: (provided) => ({ ...provided, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderColor: 'var(--ds-border-color)', boxShadow: 'inset 0 0 5px rgba(0,0,0,0.5)', '&:hover': { borderColor: 'var(--ds-accent-red)' } }),
                                                                                menu: (provided) => ({ ...provided, backgroundColor: 'var(--ds-medium-bg)', border: '1px solid var(--ds-accent-red)' }),
                                                                                option: (provided, state) => ({ ...provided, backgroundColor: state.isFocused ? 'rgba(114, 61, 71, 0.5)' : 'var(--ds-medium-bg)', color: 'var(--ds-light-text)', '&:hover': { backgroundColor: 'var(--ds-accent-red)', color: 'white' } }),
                                                                                multiValue: (provided) => ({ ...provided, backgroundColor: 'var(--ds-accent-red)', color: 'white' }),
                                                                                multiValueLabel: (provided) => ({ ...provided, color: 'white' }),
                                                                                multiValueRemove: (provided) => ({ ...provided, color: 'white', '&:hover': { backgroundColor: 'var(--ds-dark-bg)', color: 'white' } }),
                                                                                singleValue: (provided) => ({ ...provided, color: 'var(--ds-light-text)' }),
                                                                                input: (provided) => ({ ...provided, color: 'var(--ds-light-text)' }),
                                                                                placeholder: (provided) => ({ ...provided, color: 'rgba(255, 255, 255, 0.5)' }),
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className={styles.actionButtonsGroup}>
                                                                        <button className={`${styles.primaryButton}`} onClick={handleUpdateUser} disabled={loading}>Save Changes</button>
                                                                        <button className={`${styles.actionButton} ${styles.cancelButton}`} onClick={handleCloseActionTab} disabled={loading}>Cancel</button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {activeActionTab === 'reset_password' && (
                                                                <div className={styles.actionSection}>
                                                                    <h4>Send Password Reset to {expandedUser.email}</h4>
                                                                    <p>This will send a password reset email to the user's registered email address. They can then set a new password.</p>
                                                                    <div className={styles.actionButtonsGroup}>
                                                                        <button className={styles.primaryButton} onClick={handleSendPasswordReset} disabled={loading}>Confirm Send Reset Email</button>
                                                                        <button className={`${styles.actionButton} ${styles.cancelButton}`} onClick={handleCloseActionTab} disabled={loading}>Cancel</button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {activeActionTab === 'resend_invite' && (
                                                                <div className={styles.actionSection}>
                                                                    <h4>Resend Invitation to {expandedUser.email}</h4>
                                                                    <p>This will simulate sending an invite again to the user. Direct them to your app's signup page if using this feature.</p>
                                                                    <div className={styles.actionButtonsGroup}>
                                                                        <button className={styles.primaryButton} onClick={handleResendInvite} disabled={loading}>Confirm Resend Invite</button>
                                                                        <button className={`${styles.actionButton} ${styles.cancelButton}`} onClick={handleCloseActionTab} disabled={loading}>Cancel</button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {activeActionTab === 'delete_confirm' && (
                                                                <div className={styles.actionSection}>
                                                                    <h4>Confirm Deletion for {expandedUser.name} ({expandedUser.email})</h4>
                                                                    <p className={styles.deleteWarning}>
                                                                        <span role="img" aria-label="warning">⚠️</span>
                                                                        Are you absolutely sure you want to delete this user? This action is irreversible for their Firestore profile. Firebase Authentication deletion requires a Cloud Function.
                                                                    </p>
                                                                    <div className={styles.actionButtonsGroup}>
                                                                        <button className={`${styles.primaryButton} ${styles.deleteConfirmButton}`} onClick={handleDeleteUser} disabled={loading || (loggedInUser && loggedInUser.uid === expandedUser.uid)}>
                                                                            Confirm Delete
                                                                        </button>
                                                                        <button className={`${styles.actionButton} ${styles.cancelButton}`} onClick={handleCloseActionTab} disabled={loading}>Cancel</button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageUsersPage;
