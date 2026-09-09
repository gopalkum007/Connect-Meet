import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext({});

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '84px',
          left: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          pointerEvents: 'none',
          maxWidth: '380px'
        }}
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              style={{
                pointerEvents: 'auto',
                padding: '12px 16px',
                borderRadius: '10px',
                background: toast.type === 'error'
                  ? 'rgba(239, 68, 68, 0.95)'
                  : toast.type === 'warning'
                  ? 'rgba(245, 158, 11, 0.95)'
                  : toast.type === 'success'
                  ? 'rgba(16, 185, 129, 0.95)'
                  : 'rgba(31, 41, 55, 0.95)',
                color: '#ffffff',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: '1px solid rgba(255, 255, 255, 0.12)'
              }}
            >
              {toast.type === 'error' && <AlertCircle size={18} style={{ flexShrink: 0 }} />}
              {toast.type === 'warning' && <AlertCircle size={18} style={{ flexShrink: 0 }} />}
              {toast.type === 'success' && <CheckCircle size={18} style={{ flexShrink: 0 }} />}
              {toast.type === 'info' && <Info size={18} style={{ flexShrink: 0 }} />}

              <span style={{ flex: 1, wordBreak: 'break-word' }}>{toast.message}</span>

              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px'
                }}
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};


export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
