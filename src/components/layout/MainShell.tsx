"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import type { Profile } from "@/types/database";

interface MainShellProps {
  profile: Profile;
  children: React.ReactNode;
}

export default function MainShell({ profile, children }: MainShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        profile={profile}
        mobileOpen={mobileOpen}
        collapsed={collapsed}
        onCloseMobile={closeMobile}
        onToggleCollapsed={toggleCollapsed}
      />
      <div
        className={`transition-all duration-300 ${
          collapsed ? "lg:pl-16" : "lg:pl-60"
        }`}
      >
        <Header profile={profile} onToggleMobile={toggleMobile} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
