"use client";

import {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  useId,
  useEffect,
  useRef,
  useCallback,
} from "react";

/* ─── Shared helpers ─── */

function generateId(prefix: string, providedId?: string, label?: string) {
  if (providedId) return providedId;
  if (label) return `${prefix}-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return undefined;
}

const baseFieldClasses = `
  w-full rounded-lg border border-[var(--input-border)] bg-input-bg
  px-3 py-2 text-sm text-foreground placeholder:text-muted
  outline-none transition-all duration-200
  focus:border-primary focus:ring-2 focus:ring-primary/20
  disabled:opacity-50 disabled:cursor-not-allowed
`.trim();

const errorFieldClasses =
  "border-danger focus:border-danger focus:ring-danger/20";

/* ─── Input ─── */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", id, ...props }, ref) => {
    const autoId = useId();
    const inputId = generateId("input", id, label) ?? autoId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const describedBy =
      [errorId, helperId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${baseFieldClasses} ${error ? errorFieldClasses : ""} ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

/* ─── Textarea ─── */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  autoResize?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      autoResize = false,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const autoId = useId();
    const inputId = generateId("textarea", id, label) ?? autoId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const describedBy =
      [errorId, helperId].filter(Boolean).join(" ") || undefined;

    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const handleAutoResize = useCallback(() => {
      const el = internalRef.current;
      if (!el || !autoResize) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [autoResize]);

    useEffect(() => {
      handleAutoResize();
    }, [handleAutoResize, props.value]);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-muted">
            {label}
          </label>
        )}
        <textarea
          ref={(node) => {
            internalRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          id={inputId}
          rows={props.rows ?? 3}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onInput={autoResize ? handleAutoResize : undefined}
          className={`${baseFieldClasses} ${autoResize ? "resize-none overflow-hidden" : "resize-y"} ${error ? errorFieldClasses : ""} ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

/* ─── Select ─── */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, className = "", id, children, ...props }, ref) => {
    const autoId = useId();
    const inputId = generateId("select", id, label) ?? autoId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const describedBy =
      [errorId, helperId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-muted">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${baseFieldClasses} appearance-none bg-[length:16px_16px] bg-[right_0.75rem_center] bg-no-repeat pr-10 ${error ? errorFieldClasses : ""} ${className}`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          }}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={errorId} className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export default Input;
export { Textarea, Select };
