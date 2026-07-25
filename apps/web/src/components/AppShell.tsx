"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

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

  return (
    <div className="min-h-screen bg-m-surface">
      <header className="flex items-center justify-between px-6 py-4 bg-m-surface shadow-m-1">
        <div>
          <h1 className="text-lg font-medium text-m-on-surface">
            IT Ticketing
          </h1>
          {user && (
            <p className="text-xs text-m-on-surface-variant">
              {user.role === "dept_member" ? "Department Member" : "End User"}
            </p>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-m-on-surface-variant hidden sm:inline">
              {user.name}
            </span>
            <div className="w-9 h-9 rounded-full bg-m-primary-container text-m-on-primary-container flex items-center justify-center text-sm font-medium">
              {initials}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-m-primary px-3 py-1.5 rounded-m-sm hover:bg-m-primary-container transition-colors"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
