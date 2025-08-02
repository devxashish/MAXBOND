import React, { useState, useContext, createContext, useCallback, useEffect } from 'react';
import './Toast.css';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);
    const [timerId, setTimerId] = useState(null);
    const [toastTheme, setToastTheme] = useState(() => {
        // Load default toast theme from local storage
        return localStorage.getItem('toastAppTheme') || 'default-toast-theme';
    });

    const showToast = useCallback((type, message, onUndo = null, duration = 3000) => {
        if (timerId) {
            clearTimeout(timerId);
        }
        setToast(null);

        const newToastId = Date.now();
        setToast({ message, type, id: newToastId, onUndo, duration });

        const newTimerId = setTimeout(() => {
            setToast(null);
            setTimerId(null);
        }, duration);
        setTimerId(newTimerId);

    }, [timerId]);

    useEffect(() => {
        return () => {
            if (timerId) {
                clearTimeout(timerId);
            }
        };
    }, [timerId]);

    const handleUndoClick = useCallback(() => {
        if (toast && toast.onUndo) {
            toast.onUndo();
            setToast(null);
            if (timerId) {
                clearTimeout(timerId);
                setTimerId(null);
            }
        }
    }, [toast, timerId]);

    // **IMPORTANT FIX:** Ensure setToastTheme is provided in the context value
    const contextValue = { showToast, setToastTheme };

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            {toast && (
                <div key={toast.id}
                     className={`toast-container ${toast.type}-toast ${toastTheme}`}
                     style={{animationDuration: `${toast.duration / 1000}s`}}
                >
                    <div className="toast-content">
                        {toast.type === "success" && <i className="fas fa-check-circle"></i>}
                        {toast.type === "error" && <i className="fas fa-exclamation-circle"></i>}
                        {toast.type === "info" && <i className="fas fa-info-circle"></i>}
                        {toast.type === "premium-delete" && <i className="fas fa-fire"></i>}
                        <span>{toast.message}</span>
                    </div>
                    {toast.onUndo && (
                        <button className="toast-undo-button" onClick={handleUndoClick}>
                            UNDO
                        </button>
                    )}
                </div>
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};