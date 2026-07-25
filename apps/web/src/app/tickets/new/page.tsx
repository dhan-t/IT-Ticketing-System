"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { PackageOpen, AlertCircle, Loader2, ArrowLeft } from "lucide-react";

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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-m-surface">
        <Loader2 className="w-8 h-8 text-m-primary animate-spin" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium text-m-on-surface-variant mb-6 hover:text-m-primary transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>

        <div className="bg-m-surface border border-m-outline-variant rounded-m-xl p-6 sm:p-8 shadow-sm">
          {/* Header Card */}
          <div className="flex items-start gap-4 mb-8 border-b border-m-outline-variant pb-6">
            <div className="w-12 h-12 rounded-m-lg bg-m-primary-container flex items-center justify-center shrink-0">
              <PackageOpen className="w-6 h-6 text-m-on-primary-container" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-m-on-surface leading-tight">
                Submit New Ticket
              </h2>
              <p className="text-sm text-m-on-surface-variant mt-1.5">
                Fill out the details below to route your issue to the correct
                department pipeline.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-6 flex items-center gap-2 text-sm text-m-on-error-container bg-m-error-container rounded-m-md px-4 py-3 shadow-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-m-on-surface-variant mb-1.5">
                Ticket type
              </label>
              <select
                required
                value={ticketTypeId}
                onChange={(e) => setTicketTypeId(Number(e.target.value))}
                className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-4 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors appearance-none cursor-pointer"
              >
                <option value="" disabled>
                  Select a type...
                </option>
                {ticketTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-m-on-surface-variant mb-1.5">
                Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of the issue"
                className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-4 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors"
              />
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-m-on-surface-variant mb-1.5">
                Description
              </label>
              <textarea
                required
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's happening? Steps to reproduce, error messages, or anything that helps."
                className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-4 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-m-outline-variant">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 bg-m-primary text-m-on-primary rounded-m-xl px-6 py-2.5 text-sm font-medium shadow-m-1 hover:shadow-m-2 transition-all disabled:opacity-50 min-w-[140px]"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
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
        </div>
      </div>
    </AppShell>
  );
}
