import React from 'react';
import { toast, ToastContainer } from 'react-toastify';
// Import react-toastify's default CSS once in your root App.js or index.js
// so your custom styles can override it correctly.
// import 'react-toastify/dist/ReactToastify.css';

import styles from '../styles/CustomToast.module.css'; // Import its own CSS Module

// --- Icons ---
// You can use actual SVG components here for better control,
// but for simplicity, emojis or direct HTML entities are shown.
// For a production app, consider a dedicated icon library like Font Awesome or Material Icons.
const toastIcons = {
  info: '💡', // Lightbulb for info
  success: '✅', // Checkmark for success
  error: '🚨', // Siren for urgent/error
  warning: '⚠️', // Warning sign
};

// --- Custom Toast Content Component ---
const CustomToastContent = ({ type, title, message, toastId, closeToast }) => {
  const icon = toastIcons[type] || '💬'; // Fallback icon

  // The `closeToast` prop is provided by react-toastify to the component rendered inside `toast()`.
  // It's the recommended way to close the toast from within its content.
  const handleClose = () => {
    if (closeToast) {
      closeToast();
    } else if (toastId) {
      // Fallback if closeToast isn't directly available (less common but good for robustness)
      toast.dismiss(toastId);
    }
  };

  return (
    <div className={`${styles.toastContent} ${styles[type]}`}>
      {/* Icon Section */}
      <div className={styles.iconContainer}>
        <span className={styles.toastIcon} role="img" aria-label={`${type} icon`}>{icon}</span>
      </div>

      {/* Text Content */}
      <div className={styles.textContent}>
        {title && <div className={styles.toastTitle}>{title}</div>}
        <div className={styles.toastMessage}>{message}</div>
      </div>

      {/* Custom Close Button */}
      {/* react-toastify's `closeButton` option being `false` means we handle this ourselves */}
      <button onClick={handleClose} className={styles.closeButton} aria-label="Close notification">
        &times;
      </button>
    </div>
  );
};

// --- Helper function to show toasts with custom content and options ---
export const showThemedToast = (message, type = 'info', options = {}) => {
  const defaultTitles = {
    info: 'Information',
    success: 'Success',
    error: 'Urgent Alert', // Specific title for urgent alerts
    warning: 'Warning',
  };

  // Merge default options with user-provided options
  const mergedOptions = {
    // Default options for all themed toasts
    position: "top-right",
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    closeButton: false, // Always use our custom close button
    ...options, // Override defaults with user-provided options

    // Apply custom classes to the react-toastify wrapper and internal elements
    className: `${styles.toastWrapper} ${styles[`${type}Wrapper`]} ${options.className || ''}`,
    bodyClassName: `${styles.toastBody} ${options.bodyClassName || ''}`,
    progressClassName: `${styles.progressBar} ${options.progressClassName || ''}`,
  };

  // Render the custom content component inside react-toastify's toast()
  // react-toastify will pass `closeToast` and `toastProps` to `CustomToastContent`
  return toast(<CustomToastContent
    type={type}
    title={mergedOptions.title || defaultTitles[type]}
    message={message}
    // toastId is passed to the component via toastProps, so we don't need to pass it explicitly here for the onClose.
    // The `closeToast` prop passed by react-toastify is preferred.
  />, {
    type: type, // This controls default background/border provided by react-toastify if you don't fully override them
    ...mergedOptions,
  });
};

// --- Function to dismiss a toast by its ID ---
// This is the function the NotificationListener needs.
export const dismissToast = (toastId) => {
  if (toastId) {
    toast.dismiss(toastId);
  }
};

// --- Toast Container Component ---
// This component needs to be rendered once at the root of your application (e.g., App.js)
// to display all toasts.
export const CustomToastContainer = (props) => {
  return (
    <ToastContainer
      // You can pass global default props for all toasts managed by this container
      // E.g., position, limit, etc.
      // For more granular control, it's often better to set options in showThemedToast.
      {...props}
      // You can also override default container styles here if needed,
      // though typically react-toastify's default positions are fine.
    />
  );
};