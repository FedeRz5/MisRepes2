"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

/* ───────────────────────────── Types ───────────────────────────── */

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

/* ─────────────────────────── Constants ─────────────────────────── */

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 4000;

const iconMap: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap: Record<ToastType, string> = {
  success: "var(--success)",
  error: "var(--danger)",
  info: "var(--info)",
  warning: "var(--warning)",
};

/* ─────────────────────────── Context ──────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

/* ──────────────────────── Single toast ─────────────────────────── */

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const Icon = iconMap[toast.type];
  const color = colorMap[toast.type];

  // Slide-in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      handleClose();
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [onDismiss, toast.id]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        borderLeftColor: color,
        transform: entered && !exiting ? "translateX(0)" : "translateX(120%)",
        opacity: entered && !exiting ? 1 : 0,
      }}
      className="pointer-events-auto relative flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden rounded-lg border border-card-border border-l-4 bg-card-bg px-4 py-3 shadow-lg transition-all duration-200 ease-out"
    >
      {/* Icon */}
      <Icon
        className="mt-0.5 h-5 w-5 shrink-0"
        style={{ color }}
        aria-hidden="true"
      />

      {/* Message */}
      <p className="flex-1 text-sm text-foreground">{toast.message}</p>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="shrink-0 rounded p-0.5 text-muted transition-colors hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Cerrar notificación"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-0.5 w-full">
        <div
          className="h-full"
          style={{
            backgroundColor: color,
            animation: `toast-progress ${AUTO_DISMISS_MS}ms linear forwards`,
          }}
        />
      </div>

      {/* Keyframe injected inline (scoped via style tag would duplicate; use global) */}
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────── Provider ─────────────────────────────── */

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = `toast-${++idCounter}-${Date.now()}`;
    setToasts((prev) => {
      const next = [...prev, { id, type, message, createdAt: Date.now() }];
      // Keep only the newest MAX_TOASTS
      if (next.length > MAX_TOASTS) {
        return next.slice(next.length - MAX_TOASTS);
      }
      return next;
    });
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container — bottom-right on desktop, bottom-left on mobile */}
      <div
        className="fixed bottom-4 right-4 left-auto z-[100] flex flex-col gap-2 max-sm:left-4 max-sm:right-auto"
        aria-label="Notificaciones"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
