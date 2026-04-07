"use client";

import {
  useEffect,
  useCallback,
  useRef,
  ReactNode,
  useState,
  useId,
} from "react";
import { X } from "lucide-react";

type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: ModalSize;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Handle open/close animation
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setVisible(true);
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => {
        setVisible(false);
        previousFocusRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [visible]);

  // Focus trap + Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener("keydown", handleKeyDown);
      // Auto-focus: prefer first input/textarea/select, fallback to close button
      requestAnimationFrame(() => {
        const firstInput = panelRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
        );
        if (firstInput) {
          firstInput.focus();
        }
      });
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, handleKeyDown]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Backdrop */}
      <div
        className={`
          absolute inset-0 bg-background/60 backdrop-blur-sm
          transition-opacity duration-200
          ${animating ? "opacity-100" : "opacity-0"}
        `.trim()}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          relative z-10 w-full ${sizeClasses[size]} mx-4
          rounded-xl border border-card-border bg-card-bg shadow-2xl
          transition-all duration-200 ease-out
          ${animating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2"}
        `.trim()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-all duration-200 hover:bg-[var(--hover-bg)] hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
