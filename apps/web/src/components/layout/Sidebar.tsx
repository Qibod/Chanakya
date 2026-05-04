"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shield,
  FileCheck,
  ClipboardList,
  AlertTriangle,
  Plug,
  BarChart3,
  Settings,
  Code,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useUIStore } from "@/store/ui";
import type { UserRole } from "@grc/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const FULL_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/controls", label: "Controls", icon: <Shield size={18} /> },
  { href: "/evidence", label: "Evidence", icon: <FileCheck size={18} /> },
  { href: "/audits", label: "Audits", icon: <ClipboardList size={18} /> },
  { href: "/risk", label: "Risk", icon: <AlertTriangle size={18} /> },
  { href: "/integrations", label: "Integrations", icon: <Plug size={18} /> },
  { href: "/reports", label: "Reports", icon: <BarChart3 size={18} /> },
];

const ROLE_NAV: Partial<Record<UserRole, NavItem[]>> = {
  OrgAdmin: [
    ...FULL_NAV,
    { href: "/settings/team", label: "Settings", icon: <Settings size={18} /> },
  ],
  AuditDirector: FULL_NAV,
  ControlOwner: [
    { href: "/my-tasks", label: "My Tasks", icon: <CheckSquare size={18} /> },
    { href: "/controls", label: "Controls", icon: <Shield size={18} /> },
    { href: "/evidence", label: "Evidence", icon: <FileCheck size={18} /> },
  ],
  Developer: [
    { href: "/developer", label: "Developer Portal", icon: <Code size={18} /> },
  ],
  ReadOnly: [
    { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/controls", label: "Controls", icon: <Shield size={18} /> },
  ],
};

const DEFAULT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
];

interface SidebarProps {
  role?: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const navItems = (role ? ROLE_NAV[role] : undefined) ?? DEFAULT_NAV;

  return (
    <aside
      className={`flex flex-col h-full bg-slate-900 border-r border-slate-800 transition-all duration-200 ease-out ${
        sidebarCollapsed ? "w-14" : "w-60"
      }`}
    >
      {/* Logo area */}
      <div className="flex items-center h-14 px-3 border-b border-slate-800 shrink-0">
        {!sidebarCollapsed && (
          <span className="text-white font-semibold text-sm tracking-wide">
            GRC Platform
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 h-11 px-3 mx-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              {!sidebarCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex items-center justify-center h-11 mx-2 mb-2 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
      >
        {sidebarCollapsed ? (
          <ChevronRight size={18} />
        ) : (
          <div className="flex items-center gap-2 px-3 w-full">
            <ChevronLeft size={18} />
            <span className="text-sm">Collapse</span>
          </div>
        )}
      </button>
    </aside>
  );
}
