import { HTMLAttributes, ReactNode } from "react";

type BadgeColor = "green" | "blue" | "red" | "yellow" | "purple" | "gray";
type BadgeSize = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
}

const colorClasses: Record<BadgeColor, string> = {
  green: "bg-primary/15 text-primary border-primary/25",
  blue: "bg-secondary/15 text-secondary border-secondary/25",
  red: "bg-danger/15 text-danger border-danger/25",
  yellow:
    "bg-[color:oklch(0.85_0.17_85/0.15)] text-[color:oklch(0.75_0.17_85)] border-[color:oklch(0.85_0.17_85/0.25)]",
  purple:
    "bg-[color:oklch(0.7_0.2_310/0.15)] text-[color:oklch(0.7_0.2_310)] border-[color:oklch(0.7_0.2_310/0.25)]",
  gray: "bg-muted/15 text-muted border-muted/25",
};

const dotColorClasses: Record<BadgeColor, string> = {
  green: "bg-primary",
  blue: "bg-secondary",
  red: "bg-danger",
  yellow: "bg-[color:oklch(0.85_0.17_85)]",
  purple: "bg-[color:oklch(0.7_0.2_310)]",
  gray: "bg-muted",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
};

export default function Badge({
  color = "green",
  size = "md",
  dot = false,
  children,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium
        transition-colors duration-200
        ${colorClasses[color]}
        ${sizeClasses[size]}
        ${className}
      `.trim()}
      {...props}
    >
      {dot && (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${dotColorClasses[color]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
