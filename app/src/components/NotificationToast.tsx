"use client";
import { createContext, useContext, useState, useCallback, useEffect } from "react";

export type ToastType = "success" | "error" | "pending" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  txSig?: string;
  cta?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    // crypto.randomUUID is available in all modern browsers and Node 19+.
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxWidth: "360px",
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "#1a3a1a", border: "#a1d494", icon: "#a1d494" },
  error: { bg: "#3a1a1a", border: "#ffb4ab", icon: "#ffb4ab" },
  pending: { bg: "#3a2e1a", border: "#ffd89c", icon: "#ffd89c" },
  info: { bg: "#1a2a3a", border: "#93c5fd", icon: "#93c5fd" },
};

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "X",
  pending: "↻",
  info: "i",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const colors = COLORS[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "8px",
        padding: "12px 16px",
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        color: "var(--color-text-primary)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        animation: "slideIn 0.3s ease",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ color: colors.icon, fontWeight: 700 }}>{ICONS[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "14px",
            padding: "0 4px",
          }}
        >
          x
        </button>
      </div>
      {toast.txSig && (
        <a
          href={`https://solscan.io/tx/${toast.txSig}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--color-primary)",
            fontSize: "11px",
            textDecoration: "none",
          }}
        >
          View on Solscan
        </a>
      )}
      {toast.cta && (
        <button
          onClick={toast.cta.onClick}
          style={{
            background: "var(--color-surface-variant)",
            border: "1px solid var(--color-outline)",
            borderRadius: "4px",
            padding: "6px 12px",
            color: "var(--color-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          {toast.cta.label}
        </button>
      )}
    </div>
  );
}