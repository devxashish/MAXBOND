// services/authService.js

import { auth } from "../firebase";
import ADMIN_EMAILS from "../constants/adminEmails";

// ✅ Get current logged-in user
export function getCurrentUser() {
  return auth.currentUser;
}

// ✅ Check if user is an admin
export function isAdminUser() {
  const user = getCurrentUser();
  return user?.email && ADMIN_EMAILS.includes(user.email);
}
