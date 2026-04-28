"use client";

import React, { useState, useEffect, useCallback, createContext, useContext } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const borderClass = {
    success: "border-l-[#4ade80]",
    error: "border-l-[#f87171]",
    info: "border-l-[#E8A87C]",
  }[toast.type];

  return (
    <div
      className={`glass-card pointer-events-auto flex items-center justify-between gap-4 px-6 py-4 min-w-[320px] max-w-[400px] border-l-4 ${borderClass} animate-[fadeInRight_0.4s_ease-out]`}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs uppercase tracking-widest font-bold opacity-50">
          {toast.type}
        </span>
        <p className="text-sm font-medium text-primary">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-text-muted hover:text-aura transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
