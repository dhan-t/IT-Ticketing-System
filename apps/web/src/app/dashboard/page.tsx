"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";
import StatusChip from "@/components/StatusChip";
import {
  Plus,
  Inbox,
  UserCheck,
  History,
  AlertCircle,
  Loader2,
  ChevronRight,
  Settings,
  Code,
  Server,
  Headset,
  Building2,
  PackageOpen,
  ArrowUpDown,
} from "lucide-react";

interface Ticket {
  id: number;
  title: string;
  status: "Open" | "In Progress" | "Escalated" | "Resolved" | "Closed";
  ticket_type_label: string;
  current_department_name: string;
  assigned_to_name: string | null;
  created_at: string;
}

type Tab = "unassigned" | "assigned" | "history";

type SortOption = "newest" | "oldest" | "title" | "status";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title (A–Z)" },
  { value: "status", label: "Status" },
];

const STATUS_ORDER: Record<Ticket["status"], number> = {
  Open: 0,
  "In Progress": 1,
  Escalated: 2,
  Resolved: 3,
  Closed: 4,
};

function sortTickets(tickets: Ticket[], sortBy: SortOption): Ticket[] {
  const sorted = [...tickets];
  switch (sortBy) {
    case "newest":
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      break;
    case "oldest":
      sorted.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      break;
    case "title":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "status":
      sorted.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      break;
  }
  return sorted;
}

const DEPARTMENT_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "General Operations": Settings,
  "Software Engineering": Code,
  Infrastructure: Server,
  "Help Desk": Headset,
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [unassigned, setUnassigned] = useState<Ticket[]>([]);
  const [assigned, setAssigned] = useState<Ticket[]>([]);
  const [history, setHistory] = useState<Ticket[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("unassigned");
  const [fetching, setFetching] = useState(true);
  const [historyFetching, setHistoryFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<Record<Tab, SortOption>>({
    unassigned: "newest",
    assigned: "newest",
    history: "newest",
  });
  const [mySortBy, setMySortBy] = useState<SortOption>("newest");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !token) return;

    async function loadTickets() {
      try {
        if (user!.role === "end_user") {
          const data = await apiFetch<{ tickets: Ticket[] }>("/tickets/mine", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMyTickets(data.tickets);
        } else {
          const data = await apiFetch<{
            unassigned: Ticket[];
            assigned: Ticket[];
          }>("/tickets/department", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUnassigned(data.unassigned);
          setAssigned(data.assigned);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tickets");
      } finally {
        setFetching(false);
      }
    }

    loadTickets();
  }, [user, token]);

  useEffect(() => {
    if (tab !== "history" || historyLoaded || !token) return;

    setHistoryFetching(true);
    apiFetch<{ tickets: Ticket[] }>("/tickets/department/history", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => {
        setHistory(data.tickets);
        setHistoryLoaded(true);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load history"),
      )
      .finally(() => setHistoryFetching(false));
  }, [tab, historyLoaded, token]);

  const sortedUnassigned = useMemo(
    () => sortTickets(unassigned, sortBy.unassigned),
    [unassigned, sortBy.unassigned],
  );
  const sortedAssigned = useMemo(
    () => sortTickets(assigned, sortBy.assigned),
    [assigned, sortBy.assigned],
  );
  const sortedHistory = useMemo(
    () => sortTickets(history, sortBy.history),
    [history, sortBy.history],
  );
  const sortedMyTickets = useMemo(
    () => sortTickets(myTickets, mySortBy),
    [myTickets, mySortBy],
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-m-surface">
        <Loader2 className="w-8 h-8 text-m-primary animate-spin" />
      </div>
    );
  }

  const DeptIcon =
    (user.departmentName && DEPARTMENT_ICONS[user.departmentName]) || Building2;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {user.role === "dept_member" && (
            <div className="w-10 h-10 rounded-m-lg bg-m-primary-container flex items-center justify-center shrink-0">
              <DeptIcon className="w-5 h-5 text-m-on-primary-container" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-medium text-m-on-surface leading-tight">
              {user.role === "end_user"
                ? "My tickets"
                : `${user.departmentName}`}
            </h2>
            {user.role === "dept_member" && (
              <p className="text-sm text-m-on-surface-variant">Ticket queue</p>
            )}
          </div>
        </div>

        {user.role === "end_user" && (
          <button
            onClick={() => router.push("/tickets/new")}
            className="flex items-center gap-2 bg-m-primary text-m-on-primary rounded-m-xl px-5 py-2.5 text-sm font-medium shadow-m-1 hover:shadow-m-2 transition-shadow"
          >
            <Plus className="w-4 h-4" />
            New ticket
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-m-on-error-container bg-m-error-container rounded-m-md px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {user.role === "end_user" ? (
        <>
          <div className="flex justify-end mb-3">
            <SortSelect value={mySortBy} onChange={setMySortBy} />
          </div>
          <div className="max-h-[70vh] overflow-y-auto scrollbar-hide pr-1">
            <TicketList
              tickets={sortedMyTickets}
              loading={fetching}
              emptyLabel="You haven't submitted any tickets yet."
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div className="flex gap-1 bg-m-surface-variant rounded-m-lg p-1 w-fit">
              <TabButton
                icon={Inbox}
                active={tab === "unassigned"}
                onClick={() => setTab("unassigned")}
              >
                Unassigned ({unassigned.length})
              </TabButton>
              <TabButton
                icon={UserCheck}
                active={tab === "assigned"}
                onClick={() => setTab("assigned")}
              >
                Assigned ({assigned.length})
              </TabButton>
              <TabButton
                icon={History}
                active={tab === "history"}
                onClick={() => setTab("history")}
              >
                History
              </TabButton>
            </div>

            <SortSelect
              value={sortBy[tab]}
              onChange={(value) =>
                setSortBy((prev) => ({ ...prev, [tab]: value }))
              }
            />
          </div>

          <div className="max-h-[70vh] overflow-y-auto scrollbar-hide pr-1">
            {tab === "unassigned" && (
              <TicketList
                tickets={sortedUnassigned}
                loading={fetching}
                emptyLabel="No unassigned tickets in your department."
              />
            )}
            {tab === "assigned" && (
              <TicketList
                tickets={sortedAssigned}
                loading={fetching}
                emptyLabel="No assigned tickets right now."
                showAssignee
              />
            )}
            {tab === "history" && (
              <TicketList
                tickets={sortedHistory}
                loading={historyFetching}
                emptyLabel="No tickets have passed through this department yet."
                showAssignee
                showStatusNote
              />
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (value: SortOption) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-m-surface border border-m-outline-variant rounded-m-md px-3 py-1.5">
      <ArrowUpDown className="w-3.5 h-3.5 text-m-on-surface-variant shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="text-sm text-m-on-surface bg-transparent focus:outline-none cursor-pointer"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TabButton({
  icon: Icon,
  active,
  onClick,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-m-md text-sm font-medium transition-colors ${
        active
          ? "bg-m-surface text-m-primary shadow-m-1"
          : "text-m-on-surface-variant hover:text-m-on-surface"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}

function TicketList({
  tickets,
  loading,
  emptyLabel,
  showAssignee = false,
  showStatusNote = false,
}: {
  tickets: Ticket[];
  loading: boolean;
  emptyLabel: string;
  showAssignee?: boolean;
  showStatusNote?: boolean;
}) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-m-on-surface-variant py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading tickets…
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 border border-dashed border-m-outline-variant rounded-m-lg py-16 text-center">
        <PackageOpen className="w-8 h-8 text-m-on-surface-variant" />
        <p className="text-sm text-m-on-surface-variant">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {tickets.map((t) => (
        <button
          key={t.id}
          onClick={() => router.push(`/tickets/${t.id}`)}
          className="group text-left bg-m-surface border border-m-outline-variant rounded-m-lg px-5 py-4 hover:shadow-m-1 hover:border-m-primary/40 transition-all"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-mono text-m-on-surface-variant">
                #{t.id}
              </p>
              <p className="text-base font-medium text-m-on-surface mt-0.5 truncate">
                {t.title}
              </p>
              <p className="text-xs text-m-on-surface-variant mt-1 truncate">
                {t.ticket_type_label} · {t.current_department_name}
                {showAssignee &&
                  t.assigned_to_name &&
                  ` · Assigned to ${t.assigned_to_name}`}
                {showStatusNote &&
                  t.status !== "Open" &&
                  t.status !== "In Progress" &&
                  ` · now in ${t.current_department_name}`}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <StatusChip status={t.status} />
              <ChevronRight className="w-4 h-4 text-m-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
