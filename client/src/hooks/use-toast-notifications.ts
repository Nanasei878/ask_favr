import { useState, useCallback } from "react";

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function useToastNotifications() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const showError = useCallback((message: string) => addToast(message, 'error'), [addToast]);
  const showInfo = useCallback((message: string) => addToast(message, 'info'), [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
  };
}