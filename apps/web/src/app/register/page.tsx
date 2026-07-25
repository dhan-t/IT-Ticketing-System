"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AlertCircle, Loader2, PackageOpen } from "lucide-react";

interface Department {
  id: number;
  name: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [role, setRole] = useState<"end_user" | "dept_member">("end_user");
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<{ departments: Department[] }>("/departments")
      .then((data) => setDepartments(data.departments))
      .catch(() => setError("Could not load departments"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!departmentId) {
      setError("Please select a department");
      return;
    }

    setSubmitting(true);
    try {
      await register(
        { name, email, password, departmentId: Number(departmentId), role },
        staySignedIn,
      );
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
        {/* App Logo / Header section */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-m-lg bg-m-primary-container flex items-center justify-center shrink-0">
            <PackageOpen className="w-5 h-5 text-m-on-primary-container" />
          </div>
          <h1 className="text-xl font-semibold text-m-on-surface leading-tight">
            IT Ticketing
          </h1>
        </div>

        <h2 className="text-2xl font-medium text-m-on-surface mb-6 leading-tight">
          Create account
        </h2>

        {error && (
          <div className="mb-6 flex items-center gap-2 text-sm text-m-on-error-container bg-m-error-container rounded-m-md px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-m-on-surface-variant mb-1.5">
            Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-4 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors"
            placeholder="John Doe"
          />
        </div>

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

        <div className="mb-4">
          <label className="block text-sm font-medium text-m-on-surface-variant mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-4 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors"
            placeholder="••••••••"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-m-on-surface-variant mb-1.5">
            Department
          </label>
          <select
            required
            value={departmentId}
            onChange={(e) => setDepartmentId(Number(e.target.value))}
            className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-4 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors appearance-none"
          >
            <option value="" disabled>
              Select a department
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-m-on-surface-variant mb-1.5">
            Role
          </label>
          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "end_user" | "dept_member")
            }
            className="w-full bg-transparent border border-m-outline-variant rounded-m-md px-4 py-2.5 text-sm text-m-on-surface focus:outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors appearance-none"
          >
            <option value="end_user">End User</option>
            <option value="dept_member">Department Member</option>
          </select>
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
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <p className="text-sm text-m-on-surface-variant mt-6 text-center">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-m-primary font-medium hover:underline"
          >
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
