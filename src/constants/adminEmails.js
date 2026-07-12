// ⚠️ DEPRECATED: src/constants/adminEmails.js
// 
// ❌ DO NOT USE THIS FILE FOR ADMIN VERIFICATION
// 
// REASON: Storing admin emails in frontend is a CRITICAL security vulnerability:
// 1. Emails are visible in browser DevTools
// 2. Emails are visible in production bundles
// 3. Admin list cannot be updated without redeploying
// 4. Anyone with frontend access knows who admins are
//
// ✅ SOLUTION: Use server-side admin verification instead
// See: src/services/authService.js
//
// MIGRATION PATH:
// 1. Replace import with: import { isUserAdmin } from "./services/authService"
// 2. Replace usage: Instead of adminEmailSet.has(user.email)
//                   Use: const isAdmin = await isUserAdmin()
//
// For immediate backward compatibility during transition:
const ADMIN_EMAILS = [
  "rajk4435689@admin.com",
  "second.admin@gmail.com",
  "third.admin@gmail.com"
];

export default ADMIN_EMAILS;
