import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  const Icon = icons[type];

  return (
    <div className={`fixed top-4 right-4 z-50 ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 max-w-sm animate-in slide-in-from-top-2`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button 
        onClick={onClose}
        className="flex-shrink-0 hover:bg-white/10 rounded p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ToastNotificationManagerProps {
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>;
  removeToast: (id: string) => void;
}

export function ToastNotificationManager({ toasts, removeToast }: ToastNotificationManagerProps) {
  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  );
}