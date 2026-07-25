"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import {
  Ticket,
  LayoutDashboard,
  FilePlus,
  LogOut,
  Settings,
  Code,
  Server,
  Headset,
  Building2,
} from "lucide-react";

const DEPARTMENT_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "General Operations": Settings,
  "Software Engineering": Code,
  Infrastructure: Server,
  "Help Desk": Headset,
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const initials = user?.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const DeptIcon =
    (user?.departmentName && DEPARTMENT_ICONS[user.departmentName]) ||
    Building2;

  return (
    <div className="flex min-h-screen bg-m-surface">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 flex flex-col bg-m-surface border-r border-m-outline-variant overflow-y-auto transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Header (Now acts as the toggle button) */}
        <div
          className={`py-5 flex items-center ${
            collapsed ? "justify-center px-3" : "px-6"
          }`}
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2.5 rounded-m-md outline-none focus-visible:ring-2 focus-visible:ring-m-primary hover:opacity-80 transition-opacity"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <div className="w-8 h-8 rounded-m-md bg-m-primary-container flex items-center justify-center shrink-0">
              <Ticket
                className="w-4.5 h-4.5 text-m-on-primary-container"
                strokeWidth={2}
              />
            </div>
            {!collapsed && (
              <h1 className="text-lg font-medium text-m-on-surface tracking-wide">
                I.T.T.S.
              </h1>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          <SidebarLink
            icon={LayoutDashboard}
            label="Dashboard"
            active={pathname === "/dashboard"}
            onClick={() => router.push("/dashboard")}
            collapsed={collapsed}
          />

          {user?.role === "end_user" && (
            <SidebarLink
              icon={FilePlus}
              label="New ticket"
              active={pathname === "/tickets/new"}
              onClick={() => router.push("/tickets/new")}
              collapsed={collapsed}
            />
          )}
        </nav>

        {/* User */}
        {user && (
          <div className="px-3 pb-4 border-t border-m-outline-variant pt-4 mx-3">
            <div
              className={`flex items-center ${
                collapsed ? "justify-center" : "gap-3"
              } px-3 py-2`}
            >
              <div className="w-9 h-9 rounded-full bg-m-primary-container text-m-on-primary-container flex items-center justify-center text-sm font-medium shrink-0">
                {initials}
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-m-on-surface truncate">
                    {user.name}
                  </p>

                  <div className="flex items-center gap-1 text-xs text-m-on-surface-variant truncate">
                    {user.role === "dept_member" && (
                      <DeptIcon className="w-3 h-3 shrink-0" />
                    )}

                    <span className="truncate">
                      {user.role === "dept_member"
                        ? user.departmentName
                        : "End User"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className={`w-full mt-2 flex items-center px-3 py-2 rounded-m-sm transition-colors bg-m-error-container text-m-on-error-container hover:bg-m-error hover:text-m-on-error ${
                collapsed ? "justify-center" : "gap-2"
              }`}
            >
              <LogOut className="w-4 h-4" />

              {!collapsed && (
                <span className="text-sm font-medium">Log out</span>
              )}
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div
        className={`flex-1 min-w-0 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({
  icon: Icon,
  label,
  active,
  onClick,
  collapsed,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center text-left text-sm font-medium px-3 py-2.5 rounded-m-sm transition-colors ${
        collapsed ? "justify-center" : "gap-3"
      } ${
        active
          ? "bg-m-primary-container text-m-on-primary-container"
          : "text-m-on-surface-variant hover:bg-m-surface-variant"
      }`}
    >
      <Icon className="w-4.5 h-4.5 shrink-0" />

      {!collapsed && label}
    </button>
  );
}
