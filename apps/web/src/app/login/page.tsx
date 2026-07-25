"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { AlertCircle, Loader2, PackageOpen } from "lucide-react"; // Or whichever icon represents your app in AppShell

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, staySignedIn);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-m-surface-variant px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-m-surface p-8 rounded-m-xl shadow-m-2 border border-m-outline-variant"
      >
        {/* App Logo / Header section mimicking dashboard styling */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-m-lg bg-m-primary-container flex items-center justify-center shrink-0">
            <PackageOpen className="w-5 h-5 text-m-on-primary-container" />
          </div>
          <h1 className="text-xl font-semibold text-m-on-surface leading-tight">
            IT Ticketing
          </h1>
        </div>

        <h2 className="text-2xl font-medium text-m-on-surface mb-6 leading-tight">
          Log in
        </h2>

        {error && (
          <div className="mb-6 flex items-center gap-2 text-sm text-m-on-error-container bg-m-error-container rounded-m-md px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-m-on-surface-variant mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-4 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors"
            placeholder="name@department.com"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-m-on-surface-variant mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-4 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors"
            placeholder="••••••••"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-m-on-surface-variant mb-8 cursor-pointer">
          <input
            type="checkbox"
            checked={staySignedIn}
            onChange={(e) => setStaySignedIn(e.target.checked)}
            className="rounded-sm border-m-outline-variant text-m-primary focus:ring-m-primary cursor-pointer"
          />
          Stay signed in
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-m-primary text-m-on-primary rounded-m-xl px-5 py-2.5 text-sm font-medium shadow-m-1 hover:shadow-m-2 transition-all disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? "Logging in..." : "Log in"}
        </button>

        <p className="text-sm text-m-on-surface-variant mt-6 text-center">
          No account?{" "}
          <Link
            href="/register"
            className="text-m-primary font-medium hover:underline"
          >
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
