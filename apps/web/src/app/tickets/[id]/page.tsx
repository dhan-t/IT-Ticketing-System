"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";
import StatusChip from "@/components/StatusChip";

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
      await apiFetch(`/tickets/${id}/status`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status: statusChoice,
          remark: remark || undefined,
        }),
      });
      await loadTicket();
      setRemark("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return null;

  if (!data) {
    return (
      <AppShell>
        {error ? (
          <div className="text-sm text-m-on-error-container bg-m-error-container rounded-m-md px-4 py-3 max-w-lg">
            {error}
          </div>
        ) : (
          <p className="text-sm text-m-on-surface-variant">Loading ticket…</p>
        )}
      </AppShell>
    );
  }

  const { ticket, pipeline, activity, canAct } = data;
  const isFinalStep = ticket.current_step_order === pipeline.length;

  return (
    <AppShell>
      <button
        onClick={() => router.push("/dashboard")}
        className="text-sm text-m-primary mb-4 hover:underline"
      >
        ← Back to dashboard
      </button>

      {/* Header */}
      <div className="bg-m-surface border border-m-outline-variant rounded-m-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-mono text-m-on-surface-variant">
              #{ticket.id}
            </p>
            <h2 className="text-2xl font-medium text-m-on-surface mt-1">
              {ticket.title}
            </h2>
            <p className="text-sm text-m-on-surface-variant mt-2">
              {ticket.ticket_type_label} · Submitted by {ticket.created_by_name}{" "}
              on {new Date(ticket.created_at).toLocaleDateString()}
            </p>
          </div>
          <StatusChip status={ticket.status} />
        </div>

        <p className="text-sm text-m-on-surface mt-4 whitespace-pre-wrap">
          {ticket.description}
        </p>

        {/* Pipeline stepper */}
        <div className="flex items-center gap-2 mt-6">
          {pipeline.map((step, i) => {
            const isDone = step.step_order < ticket.current_step_order;
            const isCurrent = step.step_order === ticket.current_step_order;
            return (
              <div key={step.step_order} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 rounded-m-md px-3 py-1.5 text-xs font-medium ${
                    isCurrent
                      ? "bg-m-primary text-m-on-primary"
                      : isDone
                        ? "bg-m-secondary-container text-m-on-secondary-container"
                        : "bg-m-surface-variant text-m-on-surface-variant"
                  }`}
                >
                  {step.department_name}
                </div>
                {i < pipeline.length - 1 && (
                  <div className="w-4 h-px bg-m-outline-variant" />
                )}
              </div>
            );
          })}
        </div>

        <p className="text-sm text-m-on-surface-variant mt-4">
          Currently in{" "}
          <span className="font-medium text-m-on-surface">
            {ticket.current_department_name}
          </span>
          {ticket.assigned_to_name && (
            <>
              , assigned to{" "}
              <span className="font-medium text-m-on-surface">
                {ticket.assigned_to_name}
              </span>
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-m-on-error-container bg-m-error-container rounded-m-md px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Actions */}
        {canAct && (
          <div className="bg-m-surface border border-m-outline-variant rounded-m-lg p-6">
            <h3 className="text-base font-medium text-m-on-surface mb-4">
              Actions
            </h3>

            <div className="mb-5">
              <label className="block text-xs font-medium text-m-on-surface-variant mb-1.5">
                Assign to
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(Number(e.target.value))}
                  className="flex-1 border border-m-outline rounded-m-sm px-3 py-2 text-sm bg-m-surface"
                >
                  <option value="">Select a member</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id === user.id ? `${m.name} (me)` : m.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={busy || !selectedAssignee}
                  className="bg-m-primary-container text-m-on-primary-container rounded-m-sm px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-m-on-surface-variant mb-1.5">
                Escalate to next department
                {isFinalStep && " — final step reached"}
              </label>
              <textarea
                rows={2}
                value={escalateMessage}
                onChange={(e) => setEscalateMessage(e.target.value)}
                placeholder="Optional note for the next department"
                disabled={isFinalStep}
                className="w-full border border-m-outline rounded-m-sm px-3 py-2 text-sm mb-2 resize-none disabled:opacity-50"
              />
              <button
                onClick={handleEscalate}
                disabled={busy || isFinalStep}
                className="bg-m-tertiary-container text-m-on-tertiary-container rounded-m-sm px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Escalate
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-m-on-surface-variant mb-1.5">
                Update status
              </label>
              <select
                value={statusChoice}
                onChange={(e) => setStatusChoice(e.target.value)}
                className="w-full border border-m-outline rounded-m-sm px-3 py-2 text-sm bg-m-surface mb-2"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <textarea
                rows={2}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Optional remark"
                className="w-full border border-m-outline rounded-m-sm px-3 py-2 text-sm mb-2 resize-none"
              />
              <button
                onClick={handleStatusUpdate}
                disabled={busy}
                className="bg-m-secondary-container text-m-on-secondary-container rounded-m-sm px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Update status
              </button>
            </div>
          </div>
        )}

        {/* Activity log */}
        <div
          className={`bg-m-surface border border-m-outline-variant rounded-m-lg p-6 ${!canAct ? "md:col-span-2" : ""}`}
        >
          <h3 className="text-base font-medium text-m-on-surface mb-4">
            Activity log
          </h3>
          <div className="space-y-4">
            {activity.map((entry) => (
              <div key={entry.id} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-m-primary mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm text-m-on-surface">
                    {describeEvent(entry)}
                  </p>
                  <p className="text-xs text-m-on-surface-variant mt-0.5">
                    {entry.actor_name} ·{" "}
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                  {entry.message && (
                    <p className="text-sm text-m-on-surface-variant mt-1 italic">
                      "{entry.message}"
                    </p>
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
      return `Ticket created in ${entry.to_department_name}`;
    case "assigned":
      return "Ticket assigned";
    case "escalated":
      return `Escalated from ${entry.from_department_name} to ${entry.to_department_name}`;
    case "status_changed":
      return `Status changed from ${entry.old_status} to ${entry.new_status}`;
    default:
      return entry.event_type;
  }
}
