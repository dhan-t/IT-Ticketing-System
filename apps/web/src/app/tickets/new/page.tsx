"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";

interface TicketType {
  id: number;
  key: string;
  label: string;
}

export default function NewTicketPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [ticketTypeId, setTicketTypeId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    apiFetch<{ ticketTypes: TicketType[] }>("/ticket-types")
      .then((data) => setTicketTypes(data.ticketTypes))
      .catch(() => setError("Could not load ticket types"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!ticketTypeId) {
      setError("Please select a ticket type");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch<{ id: number }>("/tickets", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ticketTypeId, title, description }),
      });
      router.push(`/tickets/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <AppShell>
      <h2 className="text-2xl font-medium text-m-on-surface mb-6">
        New ticket
      </h2>

      <form
        onSubmit={handleSubmit}
        className="max-w-lg bg-m-surface border border-m-outline-variant rounded-m-lg p-6"
      >
        {error && (
          <div className="mb-4 text-sm text-m-on-error-container bg-m-error-container rounded-m-md px-4 py-3">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-m-on-surface mb-1">
          Ticket type
        </label>
        <select
          required
          value={ticketTypeId}
          onChange={(e) => setTicketTypeId(Number(e.target.value))}
          className="w-full border border-m-outline rounded-m-sm px-3 py-2.5 mb-4 text-sm bg-m-surface"
        >
          <option value="">Select a type</option>
          {ticketTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium text-m-on-surface mb-1">
          Title
        </label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary of the issue"
          className="w-full border border-m-outline rounded-m-sm px-3 py-2.5 mb-4 text-sm"
        />

        <label className="block text-sm font-medium text-m-on-surface mb-1">
          Description
        </label>
        <textarea
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's happening? Steps to reproduce, error messages, anything that helps."
          className="w-full border border-m-outline rounded-m-sm px-3 py-2.5 mb-6 text-sm resize-none"
        />

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-m-primary text-m-on-primary rounded-m-xl px-5 py-2.5 text-sm font-medium shadow-m-1 hover:shadow-m-2 transition-shadow disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit ticket"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-m-primary px-5 py-2.5 text-sm font-medium rounded-m-xl hover:bg-m-primary-container transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </AppShell>
  );
}
