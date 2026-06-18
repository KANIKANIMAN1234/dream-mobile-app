export type ReflectionInput = {
  title: string;
  meetingDate: string;
  participants: string;
  notes: string;
  context?: "meeting" | "demo" | "daily";
};

export type ReflectionResult = {
  summary: string;
  decisions: string[];
  todos: string[];
  openQuestions: string[];
  nextActions: string[];
  isDemo: boolean;
};

function splitLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pickKeywords(notes: string) {
  const keywords: string[] = [];
  const patterns: Array<[RegExp, string]> = [
    [/PCA|給与|経理/i, "PCA給与連携"],
    [/iPad|端末/i, "勤怠端末導入"],
    [/契約|正式/i, "契約締結"],
    [/有休|休暇/i, "有休管理"],
    [/打刻|勤怠/i, "勤怠運用"],
    [/近代|移行/i, "システム移行"],
    [/CSV/i, "CSV出力"],
    [/通知|LINE/i, "LINE通知"],
    [/9月|10月/i, "スケジュール"],
  ];
  patterns.forEach(([regex, label]) => {
    if (regex.test(notes)) keywords.push(label);
  });
  return keywords.length > 0 ? keywords : ["勤怠管理", "要件確認"];
}

export function generateReflection(input: ReflectionInput): ReflectionResult {
  const keywords = pickKeywords(input.notes);
  const noteLines = splitLines(input.notes);
  const title = input.title.trim() || "打合せ振り返り";
  const dateLabel = input.meetingDate || new Date().toISOString().slice(0, 10);

  const decisions = noteLines
    .filter((line) => /決定|方針|確定|進める|見送|しない/.test(line))
    .slice(0, 5);
  if (decisions.length === 0) {
    decisions.push(
      `${keywords[0]}について、現行フローを維持しつつ新システムへ段階移行する方針で合意`,
      "デモで提示した画面構成をベースに、経理担当者の追加要件を反映する",
    );
  }

  const todos = noteLines
    .filter((line) => /TODO|宿題|確認|対応|送|準備|テスト|連絡/.test(line))
    .slice(0, 6);
  if (todos.length === 0) {
    todos.push(
      "PCA取込CSVのフォーマットを経理担当者と最終確認する",
      "iPad推奨スペックと購入台数（武蔵野・本社）を確定する",
      "次回までに修正申請・休暇申請フローの運用ルールを文書化する",
    );
  }

  const openQuestions = noteLines
    .filter((line) => /？|\?|未|不明|要確認|検討/.test(line))
    .slice(0, 4);
  if (openQuestions.length === 0) {
    openQuestions.push(
      "PCA側の取込テストをいつ・誰が実施するか",
      "近代システムからの完全移行タイミング（9月前テスト目標との整合）",
    );
  }

  const nextActions = [
    `${dateLabel}の論点（${keywords.join("・")}）について、決定事項を関係者へ共有`,
    "宿題の担当と期限を一覧化し、次回打合せのアジェンダ草案を作成",
    "デモで未実装だった項目は「任意機能（AI-02含む）」として優先度を整理",
  ];

  const summary = [
    `「${title}」（${dateLabel}）の振り返りです。`,
    input.participants.trim() ? `参加者: ${input.participants.trim()}` : "",
    `主要論点: ${keywords.join("、")}。`,
    noteLines.length > 0
      ? `入力メモから ${noteLines.length} 件の論点を抽出し、決定・宿題・確認事項に整理しました。`
      : "メモ未入力のため、勤怠・経理デモ向けの標準テンプレートで整理しました。",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary,
    decisions,
    todos,
    openQuestions,
    nextActions,
    isDemo: true,
  };
}

export async function requestReflection(input: ReflectionInput) {
  const res = await fetch("/api/ai-reflection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as { ok: boolean; message?: string } & ReflectionResult;
  if (!json.ok) {
    throw new Error(json.message ?? "AI振り返りの生成に失敗しました。");
  }
  return json;
}
