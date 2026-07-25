"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white p-8 rounded-lg shadow border border-gray-200"
      >
        <h1 className="text-xl font-semibold mb-6">Create account</h1>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
        />

        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
        />

        <label className="block text-sm font-medium mb-1">Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
        />

        <label className="block text-sm font-medium mb-1">Department</label>
        <select
          required
          value={departmentId}
          onChange={(e) => setDepartmentId(Number(e.target.value))}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
        >
          <option value="">Select a department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium mb-1">Role</label>
        <select
          value={role}
          onChange={(e) =>
            setRole(e.target.value as "end_user" | "dept_member")
          }
          className="w-full border border-gray-300 rounded px-3 py-2 mb-6 text-sm"
        >
          <option value="end_user">End User</option>
          <option value="dept_member">Department Member</option>
        </select>

        <label className="flex items-center gap-2 text-sm mb-6">
          <input
            type="checkbox"
            checked={staySignedIn}
            onChange={(e) => setStaySignedIn(e.target.checked)}
          />
          Stay signed in
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-black text-white rounded py-2 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <p className="text-sm text-gray-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-black underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
