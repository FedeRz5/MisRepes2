"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  ClipboardList,
  Play,
  TrendingUp,
  User,
  Shield,
  Users,
  X,
  ChevronLeft,
  Activity,
  Camera,
} from "lucide-react";
import type { Profile } from "@/types/database";

interface SidebarProps {
  profile: Profile;
  mobileOpen: boolean;
  collapsed: boolean;
  onCloseMobile: () => void;
  onToggleCollapsed: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const mainItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5 shrink-0" />,
  },
  {
    href: "/exercises",
    label: "Ejercicios",
    icon: <Dumbbell className="h-5 w-5 shrink-0" />,
  },
  {
    href: "/routines",
    label: "Rutinas",
    icon: <ClipboardList className="h-5 w-5 shrink-0" />,
  },
  {
    href: "/sessions",
    label: "Sesiones",
    icon: <Play className="h-5 w-5 shrink-0" />,
  },
  {
    href: "/progress",
    label: "Progreso",
    icon: <TrendingUp className="h-5 w-5 shrink-0" />,
  },
  {
    href: "/progress-photos",
    label: "Progreso Corporal",
    icon: <Camera className="h-5 w-5 shrink-0" />,
  },
];

const accountItems: NavItem[] = [
  {
    href: "/profile",
    label: "Perfil",
    icon: <User className="h-5 w-5 shrink-0" />,
  },
];

const adminItems: NavItem[] = [
  {
    href: "/admin",
    label: "Admin",
    icon: <Shield className="h-5 w-5 shrink-0" />,
  },
  {
    href: "/admin/users",
    label: "Usuarios",
    icon: <Users className="h-5 w-5 shrink-0" />,
  },
];

const roleBadgeMap: Record<string, string> = {
  owner: "Owner",
  trainer: "Trainer",
  user: "Usuario",
};

export default function Sidebar({
  profile,
  mobileOpen,
  collapsed,
  onCloseMobile,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const isStaff = profile.role === "owner" || profile.role === "trainer";

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        onClick={onCloseMobile}
        title={collapsed ? item.label : undefined}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          collapsed ? "justify-center" : ""
        } ${
          active
            ? "bg-primary/10 text-primary"
            : "text-muted hover:bg-hover-bg hover:text-foreground"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        {item.icon}
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  }

  function SectionLabel({ label }: { label: string }) {
    if (collapsed) return <div className="my-2 border-t border-card-border" />;
    return (
      <span className="mb-1 mt-4 block px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
        {label}
      </span>
    );
  }

  const navContent = (
    <nav
      className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4"
      aria-label="Navegacion principal"
    >
      <SectionLabel label="Principal" />
      {mainItems.map((item) => (
        <NavLink key={item.href} item={item} />
      ))}

      <SectionLabel label="Cuenta" />
      {accountItems.map((item) => (
        <NavLink key={item.href} item={item} />
      ))}

      {isStaff && (
        <>
          <SectionLabel label="Administracion" />
          {adminItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </>
      )}
    </nav>
  );

  const brandBlock = (
    <div className="flex items-center justify-between border-b border-card-border px-4 py-4">
      <div
        className={`flex items-center gap-2.5 overflow-hidden ${
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        } transition-all duration-200`}
      >
        <Activity className="h-6 w-6 shrink-0 text-primary" />
        <span className="whitespace-nowrap text-lg font-bold text-primary">
          MisRepes
        </span>
      </div>
    </div>
  );

  const roleLabel = roleBadgeMap[profile.role] ?? profile.role;

  const roleBadge = !collapsed && (
    <div className="border-t border-card-border px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {profile.full_name
            ? profile.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)
            : "??"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {profile.full_name || "Usuario"}
          </p>
          <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {roleLabel}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-card-border bg-sidebar-bg transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navegacion principal"
      >
        <div className="flex items-center justify-between border-b border-card-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-primary">MisRepes</span>
          </div>
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-hover-bg hover:text-foreground cursor-pointer"
            aria-label="Cerrar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {navContent}
        {roleBadge}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 border-r border-card-border bg-sidebar-bg transition-all duration-300 ${
          collapsed ? "lg:w-16" : "lg:w-60"
        }`}
        aria-label="Navegacion principal"
      >
        {brandBlock}
        <div className="flex items-center justify-end px-2 py-1.5">
          <button
            onClick={onToggleCollapsed}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-hover-bg hover:text-foreground cursor-pointer"
            aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          >
            <ChevronLeft
              className={`h-4 w-4 transition-transform duration-200 ${
                collapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
        {navContent}
        {roleBadge}
      </aside>
    </>
  );
}
