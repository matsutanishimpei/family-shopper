# Family Shopper 🛒

家族で共有できる、シンプルで直感的なお買い物リストアプリです。
Cloudflare Workers, D1 Database, そして Cloudinary を活用した、モダンで高速な SPA (Single Page Application) です。

## ✨ 特徴

- **リアルタイムお買い物リスト**: 家族の誰かがアイテムを追加・購入すると即座に反映。
- **写真付きアイテム管理**: Cloudinary 連携により、商品写真を撮影・アップロードして保存。
- **画像拡大表示**: リストの画像をタップすると、全画面で詳細を確認可能。
- **家族メンバー管理**: 管理者が家族用のアカウントを自由に発行可能。
- **カテゴリフィルタ**: 「父用」「母用」「子ども用」などでリストを素早く絞り込み。
- **モバイル最適化**: スマホのカメラやギャラリーから直接アップロードできるネイティブなUI。

## 🚀 テクノロジースタック

- **Frontend/Backend**: [Hono](https://hono.dev/) (Vite)
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- **Storage**: [Cloudinary](https://cloudinary.com/) (画像保存)
- **Language**: TypeScript

## 🛠️ セットアップ

### 1. 環境変数の設定 (Cloudflare Pages)

以下のシークレットを Cloudflare のダッシュボードまたは `wrangler` で設定してください。

| 名前 | 説明 |
| :--- | :--- |
| `CLOUD_NAME` | Cloudinary の Cloud Name |
| `UPLOAD_PRESET` | Cloudinary の Unsigned Upload Preset |
| `CLOUDINARY_API_KEY` | Cloudinary の API Key (画像削除用) |
| `CLOUDINARY_API_SECRET` | Cloudinary の API Secret (画像削除用) |
| `ADMIN_USER` | 初回起動時の管理者ユーザー名 |
| `ADMIN_PASS` | 初回起動時の管理者パスワード |

### 2. データベースの準備

```bash
# ローカルDBの作成
npx wrangler d1 execute family-shopper-db --file=schema.sql --local
npx wrangler d1 execute family-shopper-db --file=user_migration.sql --local

# リモートDBへの反映
npx wrangler d1 execute family-shopper-db --file=schema.sql --remote
npx wrangler d1 execute family-shopper-db --file=user_migration.sql --remote
```

### 3. デプロイ

```bash
npm run deploy
```

## 📖 使い方

1. **管理者ログイン**: `ADMIN_USER` / `ADMIN_PASS` でログインします。
2. **家族の登録**: 「管理者ページ」へ進み、家族の名前とパスワードを登録します。
3. **お買い物**: メイン画面でアイテムを追加します。写真を撮っておくと、買い間違いを防げます。
4. **完了**: 購入したらアイテムをタップしてチェックを入れます。
5. **削除**: 不要になったアイテムはゴミ箱アイコンで完全に削除（Cloudinary の画像も連動して削除されます）。

## 📄 ライセンス

MIT
