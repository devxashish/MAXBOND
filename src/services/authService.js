// src/services/authService.js
// ✅ Backend Admin Verification Service
// 
// SECURITY BEST PRACTICE:
// Admin status should NEVER be stored in frontend code.
// Instead, verify with backend that has secure admin list in database or environment.
//
// Two verification methods:
// 1. Firestore Custom Claims (Recommended if using Firebase as backend)
// 2. Backend API verification (Recommended for complex auth systems)

import { auth } from "../firebase";

/**
 * Get admin status from Firebase Custom Claims
 * 
 * SETUP (Backend - Firebase Cloud Functions):
 * When promoting user to admin, set custom claim:
 * admin.auth().setCustomUserClaims(uid, { admin: true })
 * 
 * @returns {Promise<boolean>} - True if user is admin, false otherwise
 */
export const isUserAdminFromClaims = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;

    // ✅ Force token refresh to get latest custom claims
    const idTokenResult = await currentUser.getIdTokenResult(true);
    return idTokenResult.claims.admin === true;
  } catch (error) {
    console.error("❌ Error checking admin claims:", error);
    return false;
  }
};

/**
 * Verify admin status via backend API
 * 
 * SETUP (Backend API):
 * Create endpoint: POST /api/verify-admin
 * Request body: { email: user.email, idToken: token }
 * Response: { isAdmin: boolean }
 * 
 * @param {string} email - User email to verify
 * @returns {Promise<boolean>} - True if user is admin, false otherwise
 */
export const isUserAdminFromAPI = async (email) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser || !email) return false;

    // Get fresh ID token for backend verification
    const idToken = await currentUser.getIdToken(true);

    const apiEndpoint = process.env.REACT_APP_ADMIN_VERIFY_ENDPOINT;
    if (!apiEndpoint) {
      console.warn(
        "⚠️ REACT_APP_ADMIN_VERIFY_ENDPOINT not configured. Using Firebase claims fallback."
      );
      return isUserAdminFromClaims();
    }

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      console.error("❌ Admin verification failed:", response.statusText);
      return false;
    }

    const data = await response.json();
    return data.isAdmin === true;
  } catch (error) {
    console.error("❌ Error verifying admin status:", error);
    return false;
  }
};

/**
 * PRIMARY: Check if user is admin (uses custom claims as default)
 * Falls back to API verification if claims method is not available
 * 
 * @returns {Promise<boolean>} - True if user is admin
 */
export const isUserAdmin = async () => {
  try {
    // Method 1: Try Firebase Custom Claims (fastest, no API call needed)
    const isAdmin = await isUserAdminFromClaims();
    if (isAdmin) return true;

    // Method 2: If no custom claims, try API verification
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.email) {
      return await isUserAdminFromAPI(currentUser.email);
    }

    return false;
  } catch (error) {
    console.error("❌ Error in isUserAdmin:", error);
    return false;
  }
};

/**
 * Get admin status synchronously from current user (USE WITH CAUTION)
 * 
 * ⚠️ WARNING: This only checks cached claims and should be used
 * for UI purposes only. Always verify with backend for sensitive operations.
 * 
 * @returns {boolean} - Admin status from cached token (may be outdated)
 */
export const isUserAdminSync = () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;

    const idTokenResult = currentUser.getIdTokenResultSync?.();
    if (!idTokenResult) return false;

    return idTokenResult.claims.admin === true;
  } catch (error) {
    console.error("❌ Error in isUserAdminSync:", error);
    return false;
  }
};
