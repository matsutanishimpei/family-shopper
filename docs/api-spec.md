# API Specification

Family Shopper アプリケーションが提供する API エンドポイントの一覧です。

## 1. 認証・アカウント (Auth)

### `GET /login`
ログイン・家族登録画面を表示します。

### `POST /api/login`
ユーザー認証を行い、セッションクッキーを発行します。
- **Request Body:**
  ```json
  {
    "familyName": "string (任意。システム管理者の場合は空)",
    "username": "string",
    "password": "string"
  }
  ```
- **Response:**
  - `200 OK`: `{ "success": true, "role": "admin | member", "isSuperAdmin": boolean }`
  - `401 Unauthorized`: 認証失敗

### `POST /api/register-family`
新しい家族グループと、その管理者を登録します。
- **Request Body:**
  ```json
  {
    "familyName": "string",
    "username": "string",
    "password": "string"
  }
  ```
- **Response:**
  - `200 OK`: `{ "success": true, "familyId": number }`

### `POST /api/logout`
ログアウト処理を行い、クッキー（session, role, family_id）を削除します。

---

## 2. 管理者機能 (Admin)
※ `adminMiddleware` および `authMiddleware` による保護が必要です。

### `GET /admin`
管理設定画面を表示します。

### `GET /api/admin/users`
ユーザー一覧を取得します。
- **Behavior:**
  - システム管理者: 全家族の全ユーザーを取得（家族名付き）。
  - 家族管理者: 自分の家族に属するユーザーのみを取得。

### `POST /api/admin/users`
現在の家族に新しいメンバー（role: member）を追加します。
- **Request Body:** `{ "username": "string", "password": "string" }`

### `DELETE /api/admin/users/:id`
指定したユーザーを削除します。

---

## 3. 買い物リスト (Items)
※ `authMiddleware` による保護が必要です。

### `GET /`
買い物リスト画面を表示します。システム管理者の場合は `/admin` へリダイレクトされます。

### `GET /api/items`
現在の家族の買い物アイテム一覧を取得します。

### `POST /api/items`
新しいアイテムをリストに追加します。
- **Request Body:**
  ```json
  {
    "name": "string",
    "count": number,
    "unit": "string",
    "category": "string",
    "image_url": "string (任意、CloudinaryのURL)"
  }
  ```

### `PATCH /api/items/:id`
アイテムの「購入済み」状態を更新します。
- **Request Body:** `{ "bought": boolean }`

### `DELETE /api/items/:id`
アイテムを削除します。画像がある場合は Cloudinary からも削除を試みます。

### `POST /api/images/delete`
Cloudinary 上の画像を直接削除します。
- **Request Body:** `{ "public_id": "string" }`
