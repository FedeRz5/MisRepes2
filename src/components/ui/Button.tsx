import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary/50 shadow-sm",
  secondary:
    "bg-[var(--hover-bg)] text-foreground border border-card-border hover:bg-card-border focus-visible:ring-card-border/50",
  danger:
    "bg-danger text-white hover:bg-danger-hover focus-visible:ring-danger/50 shadow-sm",
  ghost:
    "bg-transparent text-foreground hover:bg-[var(--hover-bg)] focus-visible:ring-card-border/50",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5 min-h-[44px]",
  md: "px-4 py-2 text-sm rounded-lg gap-2",
  lg: "px-6 py-3 text-base rounded-xl gap-2.5",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={`
          inline-flex items-center justify-center font-medium
          transition-all duration-200 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background
          disabled:opacity-50 disabled:pointer-events-none
          active:scale-[0.97] cursor-pointer
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `.trim()}
        {...props}
      >
        {loading && (
          <Loader2
            className={`animate-spin ${size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4"}`}
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
