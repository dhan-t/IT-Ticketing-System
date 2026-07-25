"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";
import StatusChip from "@/components/StatusChip";
import {
  ArrowLeft,
  PackageOpen,
  Loader2,
  UserPlus,
  ArrowUpRight,
  MessageSquare,
  AlertCircle,
  RotateCcw, // <-- Added for the Reactivate button
} from "lucide-react";

interface TicketDetail {
  id: number;
  title: string;
  description: string;
  status: "Open" | "In Progress" | "Escalated" | "Resolved" | "Closed";
  current_department_name: string;
  current_step_order: number;
  ticket_type_label: string;
  created_by_name: string;
  assigned_to_name: string | null;
  assigned_to: number | null;
  created_at: string;
}

interface PipelineStep {
  step_order: number;
  department_name: string;
}

interface ActivityEntry {
  id: number;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  message: string | null;
  created_at: string;
  actor_name: string;
  from_department_name: string | null;
  to_department_name: string | null;
}

interface Member {
  id: number;
  name: string;
}

const STATUSES = ["Open", "In Progress", "Escalated", "Resolved", "Closed"];

export default function TicketDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, token, loading } = useAuth();

  const [data, setData] = useState<{
    ticket: TicketDetail;
    pipeline: PipelineStep[];
    activity: ActivityEntry[];
    canAct: boolean;
  } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<number | "">("");
  const [escalateMessage, setEscalateMessage] = useState("");
  const [statusChoice, setStatusChoice] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTicket = useCallback(async () => {
    if (!token) return;
    try {
      const result = await apiFetch<typeof data>(`/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(result);
      setStatusChoice(result!.ticket.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket");
    }
  }, [id, token]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    if (!data?.canAct || !token) return;
    apiFetch<{ members: Member[] }>(
      `/departments/${user!.departmentId}/members`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
      .then((res) => setMembers(res.members))
      .catch(() => {});
  }, [data?.canAct, token, user]);

  async function handleAssign() {
    if (!selectedAssignee) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/tickets/${id}/assign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assigneeId: selectedAssignee }),
      });
      await loadTicket();
      setSelectedAssignee("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign ticket");
    } finally {
      setBusy(false);
    }
  }

  async function handleEscalate() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/tickets/${id}/escalate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: escalateMessage || undefined }),
      });
      await loadTicket();
      setEscalateMessage("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to escalate ticket",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusUpdate() {
    setBusy(true);
    setError(null);
    try {
      // Intercept the request if they selected "Escalated"
      if (statusChoice === "Escalated") {
        if (isFinalStep) {
          throw new Error(
            "Cannot escalate: This ticket is already at the final department.",
          );
        }
        await apiFetch(`/tickets/${id}/escalate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: remark || undefined }), // Uses the remark as the escalate note
        });
      } else {
        // Standard status update for Open, In Progress, Resolved, Closed
        await apiFetch(`/tickets/${id}/status`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            status: statusChoice,
            remark: remark || undefined,
          }),
        });
      }
      await loadTicket();
      setRemark("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ticket");
    } finally {
      setBusy(false);
    }
  }

  async function handleReactivate() {
    const confirm = window.confirm(
      `This ticket is currently ${data?.ticket.status}. Are you sure you want to reactivate it?`,
    );
    if (!confirm) return;

    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/tickets/${id}/status`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status: "Open", // Forces the ticket back to Open
          remark: "Ticket reactivated by user.",
        }),
      });
      await loadTicket();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reactivate ticket",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-m-surface">
        <Loader2 className="w-8 h-8 text-m-primary animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <AppShell>
        {error ? (
          <div className="flex items-center gap-2 text-sm text-m-on-error-container bg-m-error-container rounded-m-md px-4 py-3 max-w-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-m-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p className="text-sm font-medium">Loading ticket details...</p>
          </div>
        )}
      </AppShell>
    );
  }

  const { ticket, pipeline, activity, canAct } = data;
  const isFinalStep = ticket.current_step_order === pipeline.length;
  // <-- NEW CHECK: Determines if we should show the Reactivate flow
  const isArchived = ticket.status === "Resolved" || ticket.status === "Closed";

  return (
    <AppShell>
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 text-sm font-medium text-m-on-surface-variant mb-6 hover:text-m-primary transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to dashboard
      </button>

      {/* Header Card */}
      <div className="bg-m-surface border border-m-outline-variant rounded-m-xl p-6 mb-6 shadow-m-1">
        <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-m-lg bg-m-primary-container flex items-center justify-center shrink-0">
              <PackageOpen className="w-6 h-6 text-m-on-primary-container" />
            </div>
            <div>
              <p className="text-sm font-mono font-medium text-m-on-surface-variant">
                #{ticket.id}
              </p>
              <h2 className="text-2xl font-semibold text-m-on-surface mt-0.5 leading-tight">
                {ticket.title}
              </h2>
              <p className="text-sm text-m-on-surface-variant mt-2 flex items-center gap-2 flex-wrap">
                <span className="font-medium bg-m-surface-variant px-2 py-0.5 rounded text-xs">
                  {ticket.ticket_type_label}
                </span>
                <span>
                  Submitted by{" "}
                  <span className="font-medium text-m-on-surface">
                    {ticket.created_by_name}
                  </span>
                </span>
                <span>·</span>
                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
              </p>
            </div>
          </div>
          <div className="shrink-0 mt-2 sm:mt-0">
            <StatusChip status={ticket.status} />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-m-outline-variant">
          <h3 className="text-sm font-medium text-m-on-surface-variant mb-2">
            Description
          </h3>
          <p className="text-base text-m-on-surface whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </p>
        </div>

        {/* Pipeline stepper */}
        <div className="mt-8 bg-m-surface-variant/50 rounded-m-lg p-5 border border-m-outline-variant/50">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-m-on-surface-variant mb-4">
            Routing Pipeline
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {pipeline.map((step, i) => {
              const isDone = step.step_order < ticket.current_step_order;
              const isCurrent = step.step_order === ticket.current_step_order;
              return (
                <div key={step.step_order} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-2 rounded-m-md px-3 py-1.5 text-xs font-semibold border ${
                      isCurrent
                        ? "bg-m-primary text-m-on-primary border-m-primary shadow-sm"
                        : isDone
                          ? "bg-m-surface text-m-on-surface border-m-outline"
                          : "bg-transparent text-m-on-surface-variant border-dashed border-m-outline-variant"
                    }`}
                  >
                    {step.step_order}. {step.department_name}
                  </div>
                  {i < pipeline.length - 1 && (
                    <div
                      className={`w-6 h-px ${isDone ? "bg-m-primary" : "bg-m-outline-variant"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-sm text-m-on-surface-variant mt-4 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2 mr-1">
              {!isArchived && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-m-primary opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${isArchived ? "bg-m-outline-variant" : "bg-m-primary"}`}
              ></span>
            </span>
            {isArchived ? "Ended in" : "Currently in"}{" "}
            <span className="font-semibold text-m-on-surface">
              {ticket.current_department_name}
            </span>
            {ticket.assigned_to_name && (
              <>
                , assigned to{" "}
                <span className="font-semibold text-m-on-surface">
                  {ticket.assigned_to_name}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 text-sm text-m-on-error-container bg-m-error-container rounded-m-md px-4 py-3 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Actions Sidebar */}
        {canAct && (
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-m-surface border border-m-outline-variant rounded-m-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-m-on-surface mb-6 border-b border-m-outline-variant pb-3">
                Department Actions
              </h3>

              {/* Assign Action (Disabled if archived) */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-m-on-surface-variant mb-2">
                  Assign Ticket
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedAssignee}
                    onChange={(e) =>
                      setSelectedAssignee(Number(e.target.value))
                    }
                    disabled={isArchived}
                    className="flex-1 bg-transparent border border-m-outline-variant rounded-m-md px-3 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors appearance-none disabled:opacity-50"
                  >
                    <option value="" disabled>
                      Select a member
                    </option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id === user.id ? `${m.name} (Me)` : m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssign}
                    disabled={busy || !selectedAssignee || isArchived}
                    className="flex items-center gap-2 bg-m-primary text-m-on-primary rounded-m-md px-4 py-2.5 text-sm font-medium shadow-sm hover:shadow-m-1 transition-all disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    Assign
                  </button>
                </div>
              </div>

              {/* Status / Reactivate Action */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-m-on-surface-variant mb-2">
                  {isArchived ? "Reactivate Ticket" : "Update Status"}
                </label>

                {isArchived ? (
                  <button
                    onClick={handleReactivate}
                    disabled={busy}
                    className="w-full flex justify-center items-center gap-2 bg-m-primary-container text-m-on-primary-container rounded-m-md px-4 py-2.5 text-sm font-medium hover:bg-opacity-80 transition-all disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reactivate ticket?
                  </button>
                ) : (
                  <>
                    <select
                      value={statusChoice}
                      onChange={(e) => setStatusChoice(e.target.value)}
                      className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-3 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors appearance-none mb-3"
                    >
                      {STATUSES.map((s) => (
                        <option
                          key={s}
                          value={s}
                          disabled={s === "Escalated" && isFinalStep}
                        >
                          {s === "Escalated" && isFinalStep
                            ? "Escalated (Final Tier Reached)"
                            : s}
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={2}
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="Add an optional status remark..."
                      className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-3 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors resize-none mb-3"
                    />
                    <button
                      onClick={handleStatusUpdate}
                      disabled={busy}
                      className="w-full flex justify-center items-center gap-2 bg-m-secondary-container text-m-on-secondary-container rounded-m-md px-4 py-2.5 text-sm font-medium hover:bg-opacity-80 transition-all disabled:opacity-50"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Save Status
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Activity Log */}
        <div
          className={`bg-m-surface border border-m-outline-variant rounded-m-xl p-6 shadow-sm ${!canAct ? "lg:col-span-12" : "lg:col-span-7"}`}
        >
          <h3 className="text-lg font-semibold text-m-on-surface mb-6 border-b border-m-outline-variant pb-3">
            Activity History
          </h3>
          <div className="relative border-l-2 border-m-outline-variant/40 ml-3 space-y-8 pb-4">
            {activity.map((entry) => (
              <div key={entry.id} className="relative pl-6">
                {/* Timeline Dot */}
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-m-surface border-2 border-m-primary" />

                <div className="bg-m-surface-variant/30 rounded-m-lg p-4 border border-m-outline-variant/30">
                  <p className="text-sm font-medium text-m-on-surface">
                    {describeEvent(entry)}
                  </p>
                  <p className="text-xs text-m-on-surface-variant mt-1.5 flex items-center gap-1.5">
                    <span className="font-semibold text-m-on-surface">
                      {entry.actor_name}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(entry.created_at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </p>
                  {entry.message && (
                    <div className="mt-3 bg-m-surface border border-m-outline-variant rounded-m-md p-3">
                      <p className="text-sm text-m-on-surface-variant italic">
                        "{entry.message}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function describeEvent(entry: ActivityEntry): string {
  switch (entry.event_type) {
    case "created":
      return `Ticket submitted to ${entry.to_department_name}`;
    case "assigned":
      return "Ticket ownership assigned";
    case "escalated":
      return `Escalated from ${entry.from_department_name} to ${entry.to_department_name}`;
    case "status_changed":
      return `Status changed from ${entry.old_status} to ${entry.new_status}`;
    default:
      return entry.event_type;
  }
}
