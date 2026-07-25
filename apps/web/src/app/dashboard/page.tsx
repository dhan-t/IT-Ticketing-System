"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";
import StatusChip from "@/components/StatusChip";

interface Ticket {
  id: number;
  title: string;
  status: "Open" | "In Progress" | "Escalated" | "Resolved" | "Closed";
  ticket_type_label: string;
  current_department_name: string;
  assigned_to_name: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [unassigned, setUnassigned] = useState<Ticket[]>([]);
  const [assigned, setAssigned] = useState<Ticket[]>([]);
  const [tab, setTab] = useState<"unassigned" | "assigned">("unassigned");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-m-surface">
        <div className="w-10 h-10 border-4 border-m-primary-container border-t-m-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-medium text-m-on-surface">
          {user.role === "end_user" ? "My tickets" : "Department queue"}
        </h2>
        {user.role === "end_user" && (
          <button
            onClick={() => router.push("/tickets/new")}
            className="bg-m-primary text-m-on-primary rounded-m-xl px-5 py-2.5 text-sm font-medium shadow-m-1 hover:shadow-m-2 transition-shadow"
          >
            + New ticket
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 text-sm text-m-on-error-container bg-m-error-container rounded-m-md px-4 py-3">
          {error}
        </div>
      )}

      {user.role === "end_user" ? (
        <TicketList
          tickets={myTickets}
          loading={fetching}
          emptyLabel="You haven't submitted any tickets yet."
        />
      ) : (
        <>
          <div className="flex gap-1 mb-4 bg-m-surface-variant rounded-m-lg p-1 w-fit">
            <TabButton
              active={tab === "unassigned"}
              onClick={() => setTab("unassigned")}
            >
              Unassigned ({unassigned.length})
            </TabButton>
            <TabButton
              active={tab === "assigned"}
              onClick={() => setTab("assigned")}
            >
              Assigned ({assigned.length})
            </TabButton>
          </div>

          <TicketList
            tickets={tab === "unassigned" ? unassigned : assigned}
            loading={fetching}
            emptyLabel={
              tab === "unassigned"
                ? "No unassigned tickets in your department."
                : "No assigned tickets right now."
            }
            showAssignee={tab === "assigned"}
          />
        </>
      )}
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-m-md text-sm font-medium transition-colors ${
        active
          ? "bg-m-surface text-m-primary shadow-m-1"
          : "text-m-on-surface-variant"
      }`}
    >
      {children}
    </button>
  );
}

function TicketList({
  tickets,
  loading,
  emptyLabel,
  showAssignee = false,
}: {
  tickets: Ticket[];
  loading: boolean;
  emptyLabel: string;
  showAssignee?: boolean;
}) {
  const router = useRouter();

  if (loading) {
    return (
      <p className="text-sm text-m-on-surface-variant">Loading tickets…</p>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="border border-dashed border-m-outline-variant rounded-m-lg py-16 text-center">
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
          className="text-left bg-m-surface border border-m-outline-variant rounded-m-lg px-5 py-4 hover:shadow-m-1 transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-mono text-m-on-surface-variant">
                #{t.id}
              </p>
              <p className="text-base font-medium text-m-on-surface mt-0.5">
                {t.title}
              </p>
              <p className="text-xs text-m-on-surface-variant mt-1">
                {t.ticket_type_label} · {t.current_department_name}
                {showAssignee &&
                  t.assigned_to_name &&
                  ` · Assigned to ${t.assigned_to_name}`}
              </p>
            </div>
            <StatusChip status={t.status} />
          </div>
        </button>
      ))}
    </div>
  );
}
