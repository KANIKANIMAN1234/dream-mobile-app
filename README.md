# dream-mobile-app

顧客向け共通LIFF（`role=customer`）の実装です。  
画面仕様 `C-01 / C-02 / C-04 / C-05` を中心に、初回連携とプロフィール登録フローを含みます。

## 必須環境変数

`.env.local` に以下を設定してください。

- `NEXT_PUBLIC_LIFF_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINE_CHANNEL_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 実装済み機能

- 初回LIFF起動・LINEログイン
- 顧客コード + 電話番号による初回紐付け
- 初回WEBアクセス情報の登録（`m_customer_profiles`）
- C-01 注文履歴（`t_invoices` 参照）
- C-02 配達予定（`t_deliveries` 参照）
- C-04 お休み申請（監査イベントとして記録）
- C-05 お知らせ（簡易表示）
- `POST /api/line/webhook`（LINE Webhook受信・署名検証）
- `POST /api/line-webhook`（後方互換エイリアス）

## 起動

```bash
npm install
npm run dev
```
