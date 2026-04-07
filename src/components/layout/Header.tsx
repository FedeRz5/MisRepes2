"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Menu, User, ChevronDown } from "lucide-react";
import type { Profile } from "@/types/database";
import { createBrowserClient } from "@supabase/ssr";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface HeaderProps {
  profile: Profile;
  onToggleMobile: () => void;
}

const roleBadgeMap: Record<string, string> = {
  owner: "Owner",
  trainer: "Trainer",
  user: "Usuario",
};

export default function Header({ profile, onToggleMobile }: HeaderProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);

  // Listen for avatar changes from profile page
  useEffect(() => {
    function onAvatarUpdate() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", profile.id)
        .single()
        .then(({ data }) => {
          if (data) setAvatarUrl(data.avatar_url);
        });
    }
    window.addEventListener("avatar-updated", onAvatarUpdate);
    return () => window.removeEventListener("avatar-updated", onAvatarUpdate);
  }, [profile.id]);

  const handleLogout = useCallback(async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [dropdownOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    if (dropdownOpen) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [dropdownOpen]);

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  const roleLabel = roleBadgeMap[profile.role] ?? profile.role;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-card-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      {/* Left: mobile menu button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobile}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-hover-bg hover:text-foreground cursor-pointer lg:hidden"
          aria-label="Abrir menu de navegacion"
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="text-lg font-bold text-primary lg:hidden">
          MisRepes
        </span>
      </div>

      {/* Right: theme toggle + user */}
      <div className="flex items-center gap-2 ml-auto">
        <ThemeToggle />

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-hover-bg cursor-pointer"
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile.full_name}
                className="h-8 w-8 rounded-full object-cover border border-card-border"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary border border-primary/25">
                {initials}
              </div>
            )}
            <span className="hidden text-sm font-medium text-foreground sm:block max-w-[120px] truncate">
              {profile.full_name}
            </span>
            <ChevronDown
              className={`hidden h-4 w-4 text-muted transition-transform duration-200 sm:block ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 origin-top-right rounded-xl border border-card-border bg-card-bg shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
              {/* User info */}
              <div className="border-b border-card-border px-4 py-3">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile.full_name || "Usuario"}
                </p>
                <p className="text-xs text-muted truncate mt-0.5">
                  {profile.email}
                </p>
                <span className="mt-1.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {roleLabel}
                </span>
              </div>

              {/* Links */}
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-hover-bg"
                >
                  <User className="h-4 w-4 text-muted" />
                  Perfil
                </Link>
              </div>

              {/* Logout */}
              <div className="border-t border-card-border py-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-danger transition-colors hover:bg-hover-bg cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
