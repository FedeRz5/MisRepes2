import { HTMLAttributes, ReactNode } from "react";

type Padding = "compact" | "normal" | "spacious";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: Padding;
  header?: ReactNode;
  footer?: ReactNode;
}

const paddingClasses: Record<Padding, string> = {
  compact: "p-3",
  normal: "p-5",
  spacious: "p-7",
};

export default function Card({
  children,
  hover = false,
  padding = "normal",
  header,
  footer,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-xl border border-card-border bg-card-bg
        shadow-sm transition-all duration-200
        ${hover ? "hover:border-primary/40 hover:shadow-md cursor-pointer" : ""}
        ${className}
      `.trim()}
      {...props}
    >
      {header && (
        <div className="border-b border-card-border px-5 py-4">{header}</div>
      )}
      <div className={paddingClasses[padding]}>{children}</div>
      {footer && (
        <div className="border-t border-card-border px-5 py-4">{footer}</div>
      )}
    </div>
  );
}
