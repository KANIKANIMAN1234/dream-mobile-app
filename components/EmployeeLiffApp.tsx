"use client";

import { useEffect, useState } from "react";
import { generateReflection, requestReflection, type ReflectionResult } from "@/lib/aiReflection";
import type { EmployeeSessionResponse } from "@/lib/types";

type Phase = "loading" | "link" | "home";
type Tab = "fix" | "leave" | "paid" | "reflection";

type Bootstrap = {
  lineUserId: string;
  displayName: string;
  session: EmployeeSessionResponse;
};

type Props = {
  bootstrap?: Bootstrap;
};

type TodayLog = {
  id: string;
  time: string;
  label: string;
  missing?: boolean;
};

type LeaveRequest = {
  id: string;
  type: string;
  start: string;
  end: string;
  status: string;
};

type EmployeeProfile = {
  code4: string;
  name: string;
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
  mandatoryProgress: number;
};

const demoProfiles: Record<string, EmployeeProfile> = {
  "1001": {
    code4: "1001",
    name: "田中 一郎",
    grantedDays: 20,
    usedDays: 8,
    remainingDays: 12,
    mandatoryProgress: 5,
  },
  "1002": {
    code4: "1002",
    name: "鈴木 花子",
    grantedDays: 18,
    usedDays: 3,
    remainingDays: 15,
    mandatoryProgress: 2,
  },
  "1003": {
    code4: "1003",
    name: "佐藤 次郎",
    grantedDays: 12,
    usedDays: 4,
    remainingDays: 8,
    mandatoryProgress: 4,
  },
};

function demoTodayLogs(): TodayLog[] {
  return [
    { id: "1", time: "08:47", label: "出動" },
    { id: "2", time: "12:00", label: "外出" },
    { id: "3", time: "13:00", label: "業務" },
    { id: "4", time: "", label: "退動", missing: true },
  ];
}

function statusLabel(status: string) {
  if (status === "pending") return "承認待ち";
  if (status === "approved") return "承認済";
  if (status === "rejected") return "却下";
  return status;
}

export function EmployeeLiffApp({ bootstrap }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [tab, setTab] = useState<Tab>("fix");
  const [displayName, setDisplayName] = useState(bootstrap?.displayName ?? "");
  const [lineUserId, setLineUserId] = useState(bootstrap?.lineUserId ?? "");
  const [employeeCode, setEmployeeCode] = useState("");
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [todayLogs, setTodayLogs] = useState<TodayLog[]>(demoTodayLogs());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    {
      id: "lr-1",
      type: "有給休暇",
      start: "2026-07-07",
      end: "2026-07-07",
      status: "pending",
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fixType, setFixType] = useState<"add" | "change" | "delete">("add");
  const [fixDate, setFixDate] = useState(new Date().toISOString().slice(0, 10));
  const [fixEvent, setFixEvent] = useState("end");
  const [fixHour, setFixHour] = useState("17");
  const [fixMinute, setFixMinute] = useState("30");
  const [fixReason, setFixReason] = useState("");

  const [leaveType, setLeaveType] = useState("有給休暇");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [reflectionNotes, setReflectionNotes] = useState("");
  const [reflectionResult, setReflectionResult] = useState<ReflectionResult | null>(null);
  const [isReflecting, setIsReflecting] = useState(false);

  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_SCOPE === "attendance";

  function applySession(session: EmployeeSessionResponse) {
    if (!session.ok) {
      setError(session.message);
      setPhase("link");
      return;
    }
    if (!session.linked) {
      setPhase("link");
      return;
    }
    setProfile({
      code4: session.employee.employee_code_4,
      name: session.employee.name,
      grantedDays: session.paidLeave.grantedDays,
      usedDays: session.paidLeave.usedDays,
      remainingDays: session.paidLeave.remainingDays,
      mandatoryProgress: session.paidLeave.mandatoryProgress,
    });
    setEmployeeCode(session.employee.employee_code_4);
    setPhase("home");
  }

  useEffect(() => {
    if (bootstrap) {
      setLineUserId(bootstrap.lineUserId);
      setDisplayName(bootstrap.displayName);
      applySession(bootstrap.session);
      return;
    }
    if (demoMode) {
      setDisplayName("デモユーザー");
      setPhase("link");
      return;
    }
    setError("ログイン情報を取得できませんでした。");
    setPhase("link");
  }, [bootstrap]);

  async function submitLink() {
    setError(null);
    const code = employeeCode.trim();
    if (!/^[0-9]{4}$/.test(code)) {
      setError("社員コードは4桁の数字で入力してください。");
      return;
    }

    if (!lineUserId) {
      if (demoMode) {
        const matched = demoProfiles[code];
        if (!matched) {
          setError("社員コードを確認してください。（デモ: 1001 / 1002 / 1003）");
          return;
        }
        setProfile(matched);
        setPhase("home");
        setSuccess(`${matched.name} さんとしてログインしました。`);
        return;
      }
      setError("LINEログインが必要です。");
      return;
    }

    const res = await fetch("/api/liff/employee/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, employeeCode4: code }),
    });
    const json = (await res.json()) as EmployeeSessionResponse;
    if (!json.ok || !json.linked) {
      setError(!json.ok ? json.message : "連携に失敗しました。");
      return;
    }
    applySession(json);
    setSuccess(`${json.employee.name} さんとしてログインしました。`);
  }

  function submitFixRequest() {
    setError(null);
    if (!fixReason.trim()) {
      setError("修正理由は必須です。");
      return;
    }
    setSuccess("勤怠修正申請を送信しました。管理者の承認をお待ちください。");
    setFixReason("");
  }

  function submitLeaveRequest() {
    setError(null);
    if (!leaveStart || !leaveEnd) {
      setError("開始日と終了日を入力してください。");
      return;
    }
    const id = `lr-${Date.now()}`;
    setLeaveRequests((prev) => [
      {
        id,
        type: leaveType,
        start: leaveStart,
        end: leaveEnd,
        status: "pending",
      },
      ...prev,
    ]);
    setSuccess("休暇申請を送信しました。承認結果はLINEでお知らせします。");
    setLeaveStart("");
    setLeaveEnd("");
    setLeaveReason("");
  }

  async function submitReflection() {
    setError(null);
    setSuccess(null);
    if (!reflectionNotes.trim()) {
      setError("振り返りメモを入力してください。");
      return;
    }
    setIsReflecting(true);
    try {
      const result = await requestReflection({
        title: profile ? `${profile.name} 業務振り返り` : "業務振り返り",
        meetingDate: new Date().toISOString().slice(0, 10),
        participants: profile?.name ?? "",
        notes: reflectionNotes,
        context: "daily",
      });
      setReflectionResult(result);
      setSuccess("AI振り返りを生成しました（AI-02 · 任意）");
    } catch {
      const fallback = generateReflection({
        title: profile ? `${profile.name} 業務振り返り` : "業務振り返り",
        meetingDate: new Date().toISOString().slice(0, 10),
        participants: profile?.name ?? "",
        notes: reflectionNotes,
        context: "daily",
      });
      setReflectionResult(fallback);
      setSuccess("オフライン簡易振り返りを表示しました。");
    } finally {
      setIsReflecting(false);
    }
  }

  return (
    <main className="container employeeApp">
      <header className="header employeeHeader">
        <h1>ドリー夢 従業員ポータル</h1>
        <p>{profile ? `${profile.name} さん（${profile.code4}）` : displayName || "読み込み中..."}</p>
        {demoMode && <span className="demoPill">デモ表示</span>}
      </header>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      {phase === "loading" && <p className="card">LIFFを初期化しています...</p>}

      {phase === "link" && (
        <section className="card">
          <h2>初回紐付け（E-00）</h2>
          <p>PC管理画面でLINE連携済みの方は自動ログインされます。未連携の方は4桁の社員コードで本人確認を行います。</p>
          <label>
            社員コード（4桁）
            <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} inputMode="numeric" />
          </label>
          <button onClick={submitLink}>連携する</button>
          {demoMode && <p className="muted">デモ用コード: 1001 / 1002 / 1003</p>}
        </section>
      )}

      {phase === "home" && profile && (
        <>
          <nav className="tabs employeeTabs">
            <button className={tab === "fix" ? "active" : ""} onClick={() => setTab("fix")}>
              E-01 勤怠修正
            </button>
            <button className={tab === "leave" ? "active" : ""} onClick={() => setTab("leave")}>
              E-02 休暇申請
            </button>
            <button className={tab === "paid" ? "active" : ""} onClick={() => setTab("paid")}>
              有休残数
            </button>
            <button className={tab === "reflection" ? "active" : ""} onClick={() => setTab("reflection")}>
              AI-02 振り返り
            </button>
          </nav>

          {tab === "fix" && (
            <section className="card">
              <h2>勤怠修正申請（E-01）</h2>
              <p className="muted">出退勤の新規打刻は事務所端末で行います。ここでは修正申請のみ可能です。</p>
              <div className="logList">
                <h3>本日の打刻記録</h3>
                <ul>
                  {todayLogs.map((log) => (
                    <li key={log.id} className={log.missing ? "missing" : ""}>
                      {log.time ? `${log.time} ${log.label}` : `${log.label} なし ⚠`}
                    </li>
                  ))}
                </ul>
              </div>
              <label>
                申請種別
                <select value={fixType} onChange={(e) => setFixType(e.target.value as "add" | "change" | "delete")}>
                  <option value="add">打刻の追加（漏れ）</option>
                  <option value="change">打刻の変更（区分間違い）</option>
                  <option value="delete">打刻の削除（誤操作）</option>
                </select>
              </label>
              <label>
                対象日
                <input type="date" value={fixDate} onChange={(e) => setFixDate(e.target.value)} />
              </label>
              <label>
                正しい区分
                <select value={fixEvent} onChange={(e) => setFixEvent(e.target.value)}>
                  <option value="start">出動</option>
                  <option value="end">退動</option>
                  <option value="out">外出</option>
                  <option value="work">業務</option>
                </select>
              </label>
              <div className="timeRow">
                <label>
                  時
                  <input value={fixHour} onChange={(e) => setFixHour(e.target.value)} inputMode="numeric" />
                </label>
                <label>
                  分
                  <input value={fixMinute} onChange={(e) => setFixMinute(e.target.value)} inputMode="numeric" />
                </label>
              </div>
              <label>
                修正理由（必須）
                <textarea value={fixReason} onChange={(e) => setFixReason(e.target.value)} placeholder="退動打刻を忘れました" />
              </label>
              <button onClick={submitFixRequest}>申請する</button>
            </section>
          )}

          {tab === "leave" && (
            <section className="card">
              <h2>休暇・シフト希望申請（E-02）</h2>
              <label>
                申請種別
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                  <option value="有給休暇">有給休暇</option>
                  <option value="半休（午前）">半休（午前）</option>
                  <option value="半休（午後）">半休（午後）</option>
                  <option value="特別休暇">特別休暇</option>
                  <option value="シフト希望">シフト希望</option>
                </select>
              </label>
              <label>
                開始日
                <input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
              </label>
              <label>
                終了日
                <input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
              </label>
              <label>
                理由（任意）
                <textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
              </label>
              <button onClick={submitLeaveRequest}>申請する</button>

              <h3>申請状況</h3>
              {leaveRequests.length === 0 ? (
                <p className="muted">申請履歴はありません。</p>
              ) : (
                <ul className="requestList">
                  {leaveRequests.map((row) => (
                    <li key={row.id}>
                      <div>
                        <strong>{row.type}</strong> {row.start} 〜 {row.end}
                      </div>
                      <span className={`status ${row.status}`}>{statusLabel(row.status)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === "paid" && (
            <section className="card">
              <h2>有休残数</h2>
              <div className="paidGrid">
                <div className="paidCard">
                  <div className="paidLabel">付与日数</div>
                  <div className="paidValue">{profile.grantedDays}日</div>
                </div>
                <div className="paidCard">
                  <div className="paidLabel">取得済み</div>
                  <div className="paidValue">{profile.usedDays}日</div>
                </div>
                <div className="paidCard highlight">
                  <div className="paidLabel">残日数</div>
                  <div className="paidValue">{profile.remainingDays}日</div>
                </div>
              </div>
              <div className="mandatoryBox">
                <div className="mandatoryLabel">年5日取得義務: {profile.mandatoryProgress}/5日</div>
                <div className="progressTrack">
                  <div
                    className={`progressFill${profile.mandatoryProgress >= 5 ? " ok" : ""}`}
                    style={{ width: `${Math.min(100, (profile.mandatoryProgress / 5) * 100)}%` }}
                  />
                </div>
              </div>
              <p className="muted">残日数は管理Web（M-06-PAID）と同期されます。給与計算（PCA）連携時にも反映されます。</p>
            </section>
          )}

          {tab === "reflection" && (
            <section className="card">
              <h2>感想戦 AI振り返り（AI-02 · 任意）</h2>
              <p className="muted">1日の業務終了時に、気づきや申請漏れをメモしてAIが整理します。</p>
              <label>
                今日の振り返りメモ
                <textarea
                  value={reflectionNotes}
                  onChange={(e) => setReflectionNotes(e.target.value)}
                  placeholder="例: 退動打刻を忘れそうだった / 来週の休暇を申請予定"
                />
              </label>
              <button onClick={() => void submitReflection()} disabled={isReflecting}>
                {isReflecting ? "生成中..." : "AIで振り返り生成"}
              </button>
              {reflectionResult && (
                <div className="reflectionBox">
                  <h3>振り返り結果</h3>
                  <p>{reflectionResult.summary}</p>
                  {reflectionResult.todos.length > 0 && (
                    <>
                      <h4>メモ・TODO</h4>
                      <ul>
                        {reflectionResult.todos.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {reflectionResult.nextActions.length > 0 && (
                    <>
                      <h4>次アクション</h4>
                      <ul>
                        {reflectionResult.nextActions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
