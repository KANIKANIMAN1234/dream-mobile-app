"use client";

import liff from "@line/liff";
import { useEffect, useState } from "react";
import type { DashboardResponse, LiffResolveResponse, LiffSessionResponse } from "@/lib/types";

type Phase = "loading" | "link" | "profile" | "home";
type Tab = "history" | "delivery" | "holiday" | "notice";

type Customer = {
  id: string;
  customer_code: string;
  name: string;
  phone: string;
  postal_code: string | null;
  address: string | null;
};

type Bootstrap = {
  lineUserId: string;
  displayName: string;
  resolve: LiffResolveResponse;
};

type Props = {
  bootstrap?: Bootstrap;
};
export function MobileLiffApp({ bootstrap }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [tab, setTab] = useState<Tab>("history");
  const [lineUserId, setLineUserId] = useState(bootstrap?.lineUserId ?? "");
  const [displayName, setDisplayName] = useState(bootstrap?.displayName ?? "");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [customerCode, setCustomerCode] = useState("");
  const [phone, setPhone] = useState("");

  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [familyComposition, setFamilyComposition] = useState("");

  const [holidayType, setHolidayType] = useState<"single" | "range">("single");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");
  const [holidayReason, setHolidayReason] = useState("");

  function applyCustomerSession(json: LiffSessionResponse, userId: string) {
    if (!json.ok) throw new Error(json.message);
    if (!json.linked) {
      setPhase("link");
      return;
    }

    setCustomer(json.customer);
    setPostalCode(json.customer.postal_code ?? "");
    setAddress(json.customer.address ?? "");
    setEmergencyName(json.profile?.emergency_contact_name ?? "");
    setEmergencyPhone(json.profile?.emergency_contact_phone ?? "");
    setHouseholdSize(json.profile?.household_size ? String(json.profile.household_size) : "");
    setFamilyComposition(json.profile?.family_composition ?? "");

    if (!json.profile?.profile_confirmed_at) {
      setPhase("profile");
    } else {
      setPhase("home");
      void loadDashboard(userId);
    }
  }

  function applyResolve(resolve: LiffResolveResponse, userId: string) {
    if (!resolve.ok) throw new Error(resolve.message);
    if (resolve.role !== "customer") throw new Error("顧客向け画面を表示できません。");
    if (!resolve.linked) {
      setPhase("link");
      return;
    }
    setCustomer(resolve.customer);
    setPostalCode(resolve.customer.postal_code ?? "");
    setAddress(resolve.customer.address ?? "");
    setEmergencyName(resolve.profile?.emergency_contact_name ?? "");
    setEmergencyPhone(resolve.profile?.emergency_contact_phone ?? "");
    setHouseholdSize(resolve.profile?.household_size ? String(resolve.profile.household_size) : "");
    setFamilyComposition(resolve.profile?.family_composition ?? "");
    if (!resolve.profile?.profile_confirmed_at) {
      setPhase("profile");
    } else {
      setPhase("home");
      void loadDashboard(userId);
    }
  }

  useEffect(() => {
    if (bootstrap) {
      setLineUserId(bootstrap.lineUserId);
      setDisplayName(bootstrap.displayName);
      try {
        applyResolve(bootstrap.resolve, bootstrap.lineUserId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "初期化エラー");
        setPhase("link");
      }
      return;
    }
    void init();
  }, [bootstrap]);

  async function init() {
    try {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) throw new Error("NEXT_PUBLIC_LIFF_ID が未設定です。");
      await liff.init({ liffId });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      const profile = await liff.getProfile();
      setLineUserId(profile.userId);
      setDisplayName(profile.displayName);

      const res = await fetch("/api/liff/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId: profile.userId }),
      });
      const json = (await res.json()) as LiffSessionResponse;
      applyCustomerSession(json, profile.userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "初期化エラー");
      setPhase("link");
    }
  }

  async function loadDashboard(userId: string) {
    const res = await fetch("/api/customer/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId: userId }),
    });
    const json = (await res.json()) as DashboardResponse;
    setDashboard(json);
  }

  async function submitLink() {
    setError(null);
    const res = await fetch("/api/liff/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, customerCode, phone }),
    });
    const json = (await res.json()) as { ok: boolean; message?: string };
    if (!json.ok) {
      setError(json.message ?? "登録に失敗しました。");
      return;
    }
    const sessionRes = await fetch("/api/liff/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId }),
    });
    const sessionJson = (await sessionRes.json()) as LiffSessionResponse;
    if (sessionJson.ok && sessionJson.linked) {
      setCustomer(sessionJson.customer);
      setPostalCode(sessionJson.customer.postal_code ?? "");
      setAddress(sessionJson.customer.address ?? "");
    }
    setSuccess("登録しました。続けて初回情報を入力してください。");
    setPhase("profile");
  }

  async function submitProfile() {
    setError(null);
    const payload = {
      lineUserId,
      postal_code: postalCode,
      address,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      household_size: householdSize ? Number(householdSize) : undefined,
      family_composition: familyComposition,
    };
    const res = await fetch("/api/liff/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { ok: boolean; message?: string };
    if (!json.ok) {
      setError(json.message ?? "プロフィール保存に失敗しました。");
      return;
    }
    setSuccess("登録が完了しました。");
    setPhase("home");
    await loadDashboard(lineUserId);
  }

  async function submitHoliday() {
    setError(null);
    const res = await fetch("/api/customer/holiday-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId,
        requestType: holidayType,
        date: holidayDate,
        startDate: holidayStart,
        endDate: holidayEnd,
        reason: holidayReason,
      }),
    });
    const json = (await res.json()) as { ok: boolean; message?: string };
    if (!json.ok) {
      setError(json.message ?? "お休み申請に失敗しました。");
      return;
    }
    setSuccess("お休み申請を受け付けました。");
    setHolidayDate("");
    setHolidayStart("");
    setHolidayEnd("");
    setHolidayReason("");
  }

  return (
    <main className="container">
      <header className="header">
        <h1>ドリー夢 宅配サービス</h1>
        <p>{displayName ? `${displayName} さん` : "読み込み中..."}</p>
      </header>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      {phase === "loading" && <p>LIFFを初期化しています...</p>}

      {phase === "link" && (
        <section className="card">
          <h2>初回登録</h2>
          <p>初回ログイン時は、顧客番号と携帯番号で本人確認を行います。2回目以降はLINEログインで自動的に入れます。</p>
          <label>
            顧客番号
            <input value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} />
          </label>
          <label>
            携帯番号
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </label>
          <button onClick={() => void submitLink()}>登録する</button>
        </section>
      )}

      {phase === "profile" && (
        <section className="card">
          <h2>初回WEBアクセス情報</h2>
          <label>
            郵便番号
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </label>
          <label>
            住所
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label>
            緊急連絡先氏名
            <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
          </label>
          <label>
            緊急連絡先電話
            <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
          </label>
          <label>
            世帯人数
            <input value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} />
          </label>
          <label>
            家族構成
            <input value={familyComposition} onChange={(e) => setFamilyComposition(e.target.value)} />
          </label>
          <button onClick={submitProfile}>登録して進む</button>
        </section>
      )}

      {phase === "home" && (
        <>
          <nav className="tabs">
            <button onClick={() => setTab("history")}>C-01 注文履歴</button>
            <button onClick={() => setTab("delivery")}>C-02 配達予定</button>
            <button onClick={() => setTab("holiday")}>C-04 お休み申請</button>
            <button onClick={() => setTab("notice")}>C-05 お知らせ</button>
          </nav>

          {tab === "history" && (
            <section className="card">
              <h2>注文履歴</h2>
              {(dashboard?.ok && dashboard.orders.length > 0) ? (
                <ul>
                  {dashboard.orders.map((o, idx) => (
                    <li key={`${o.month}-${idx}`}>
                      {o.month} / 請求額: {o.total_amount.toLocaleString("ja-JP")}円 / {o.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>履歴はまだありません。</p>
              )}
            </section>
          )}

          {tab === "delivery" && (
            <section className="card">
              <h2>配達予定</h2>
              {(dashboard?.ok && dashboard.deliveries.length > 0) ? (
                <ul>
                  {dashboard.deliveries.map((d, idx) => (
                    <li key={`${d.delivery_date}-${idx}`}>
                      {d.delivery_date} / {d.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>配達予定はまだありません。</p>
              )}
            </section>
          )}

          {tab === "holiday" && (
            <section className="card">
              <h2>お休み申請</h2>
              <label>
                申請種別
                <select value={holidayType} onChange={(e) => setHolidayType(e.target.value as "single" | "range")}>
                  <option value="single">この日だけお休み</option>
                  <option value="range">期間でお休み</option>
                </select>
              </label>
              {holidayType === "single" ? (
                <label>
                  日付
                  <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
                </label>
              ) : (
                <>
                  <label>
                    開始日
                    <input type="date" value={holidayStart} onChange={(e) => setHolidayStart(e.target.value)} />
                  </label>
                  <label>
                    終了日
                    <input type="date" value={holidayEnd} onChange={(e) => setHolidayEnd(e.target.value)} />
                  </label>
                </>
              )}
              <label>
                理由（任意）
                <textarea value={holidayReason} onChange={(e) => setHolidayReason(e.target.value)} />
              </label>
              <button onClick={submitHoliday}>申請する</button>
            </section>
          )}

          {tab === "notice" && (
            <section className="card">
              <h2>お知らせ</h2>
              {(dashboard?.ok && dashboard.notices.length > 0) ? (
                <ul>
                  {dashboard.notices.map((n, idx) => (
                    <li key={`${n.title}-${idx}`}>
                      <strong>{n.title}</strong>
                      <p>{n.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>お知らせはありません。</p>
              )}
            </section>
          )}

          {customer && (
            <footer className="footer">
              <small>
                顧客: {customer.name} ({customer.customer_code})
              </small>
            </footer>
          )}
        </>
      )}
    </main>
  );
}
