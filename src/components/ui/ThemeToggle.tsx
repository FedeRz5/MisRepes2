"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useState } from "react";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [showTooltip, setShowTooltip] = useState(false);

  const isDark = theme === "dark";
  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <div className="relative">
      <button
        onClick={toggleTheme}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="relative rounded-lg p-2 text-muted transition-all duration-200 hover:bg-[var(--hover-bg)] hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label={label}
      >
        <div className="relative h-4 w-4">
          {/* Sun icon */}
          <Sun
            className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${
              isDark
                ? "rotate-0 scale-100 opacity-100"
                : "-rotate-90 scale-0 opacity-0"
            }`}
          />
          {/* Moon icon */}
          <Moon
            className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${
              isDark
                ? "rotate-90 scale-0 opacity-0"
                : "rotate-0 scale-100 opacity-100"
            }`}
          />
        </div>
      </button>

      {/* Tooltip */}
      <div
        role="tooltip"
        className={`
          absolute right-0 top-full mt-2 whitespace-nowrap rounded-md
          bg-foreground text-background px-2.5 py-1 text-xs font-medium
          shadow-lg pointer-events-none
          transition-all duration-150
          ${showTooltip ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}
        `.trim()}
      >
        {label}
      </div>
    </div>
  );
}
