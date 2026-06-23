import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "../icons";

export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  title: string;
  message?: string;
  tone?: ToastTone;
  duration?: number;
}

export interface ToastRecord extends ToastOptions {
  id: number;
  createdAt: number;
  read: boolean;
}

interface ToastContextValue {
  notify: (options: ToastOptions) => void;
  history: ToastRecord[];
  unreadCount: number;
  markAllRead: () => void;
  clearHistory: () => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const HISTORY_LIMIT = 50;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [history, setHistory] = useState<ToastRecord[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (options: ToastOptions) => {
      const id = (idRef.current += 1);
      const record: ToastRecord = {
        id,
        tone: "info",
        duration: 5000,
        createdAt: Date.now(),
        read: false,
        ...options,
      };
      setToasts((current) => [...current, record]);
      setHistory((current) => [record, ...current].slice(0, HISTORY_LIMIT));
      if (record.duration && record.duration > 0) {
        window.setTimeout(() => dismiss(id), record.duration);
      }
    },
    [dismiss],
  );

  const markAllRead = useCallback(() => {
    setHistory((current) => current.map((entry) => ({ ...entry, read: true })));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const unreadCount = useMemo(() => history.filter((entry) => !entry.read).length, [history]);

  const value = useMemo(
    () => ({ notify, history, unreadCount, markAllRead, clearHistory, dismiss }),
    [notify, history, unreadCount, markAllRead, clearHistory, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toaster" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
            <div className="toast-body">
              <p className="toast-title">{toast.title}</p>
              {toast.message && <p className="toast-message">{toast.message}</p>}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <CloseIcon size="sm" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
