"use client";

import liff from "@line/liff";
import { useEffect, useState } from "react";
import { EmployeeLiffApp } from "@/components/EmployeeLiffApp";
import { MobileLiffApp } from "@/components/MobileLiffApp";
import type { EmployeeSessionResponse, LiffResolveResponse, LiffSessionResponse } from "@/lib/types";

type Props = {
  forceRole?: "employee" | "customer";
};

export function LiffEntry({ forceRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineUserId, setLineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [employeeSession, setEmployeeSession] = useState<EmployeeSessionResponse | null>(null);
  const [customerResolve, setCustomerResolve] = useState<LiffResolveResponse | null>(null);
  const [view, setView] = useState<"employee" | "customer" | null>(null);

  useEffect(() => {
    void init();
  }, [forceRole]);

  async function init() {
    try {
      const liffId =
        forceRole === "employee"
          ? process.env.NEXT_PUBLIC_LIFF_ID_EMPLOYEE ?? process.env.NEXT_PUBLIC_LIFF_ID
          : process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) throw new Error("NEXT_PUBLIC_LIFF_ID が未設定です。");
      await liff.init({ liffId });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }

      const profile = await liff.getProfile();
      setLineUserId(profile.userId);
      setDisplayName(profile.displayName);

      if (forceRole === "employee") {
        setEmployeeSession(await fetchEmployeeSession(profile.userId));
        setView("employee");
        setLoading(false);
        return;
      }

      if (forceRole === "customer") {
        setCustomerResolve(await fetchCustomerSession(profile.userId));
        setView("customer");
        setLoading(false);
        return;
      }

      const resolve = await fetchResolve(profile.userId);
      if (!resolve.ok) throw new Error(resolve.message);

      if (resolve.role === "employee") {
        setEmployeeSession({
          ok: true,
          linked: true,
          employee: resolve.employee,
          paidLeave: resolve.paidLeave,
        });
        setView("employee");
      } else {
        setCustomerResolve(resolve);
        setView("customer");
      }
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "初期化エラー");
      setLoading(false);
    }
  }

  async function fetchEmployeeSession(userId: string): Promise<EmployeeSessionResponse> {
    const res = await fetch("/api/liff/employee/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId: userId }),
    });
    return (await res.json()) as EmployeeSessionResponse;
  }

  async function fetchCustomerSession(userId: string): Promise<LiffResolveResponse> {
    const res = await fetch("/api/liff/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId: userId }),
    });
    const json = (await res.json()) as LiffSessionResponse;
    if (!json.ok) return { ok: false, message: json.message };
    if (!json.linked) {
      return { ok: true, role: "customer", linked: false, message: json.message };
    }
    return {
      ok: true,
      role: "customer",
      linked: true,
      customer: json.customer,
      profile: json.profile,
    };
  }

  async function fetchResolve(userId: string): Promise<LiffResolveResponse> {
    const res = await fetch("/api/liff/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId: userId }),
    });
    return (await res.json()) as LiffResolveResponse;
  }

  if (loading) {
    return (
      <main className="container">
        <p>LIFFを初期化しています...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <p className="error">{error}</p>
      </main>
    );
  }

  if (view === "employee" && employeeSession) {
    return (
      <EmployeeLiffApp
        bootstrap={{
          lineUserId,
          displayName,
          session: employeeSession,
        }}
      />
    );
  }

  if (view === "customer" && customerResolve) {
    return (
      <MobileLiffApp
        bootstrap={{
          lineUserId,
          displayName,
          resolve: customerResolve,
        }}
      />
    );
  }

  return (
    <main className="container">
      <p className="error">ログイン情報を取得できませんでした。</p>
    </main>
  );
}
