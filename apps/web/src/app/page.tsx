"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [loading, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-m-surface">
      <div className="w-10 h-10 border-4 border-m-primary-container border-t-m-primary rounded-full animate-spin" />
    </div>
  );
}
