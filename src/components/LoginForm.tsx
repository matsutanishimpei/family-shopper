export const LoginForm = () => (
  <div class="card login-card" style="max-width: 400px; margin: 100px auto;">
    <h1>Login</h1>
    <form id="login-form" novalidate>
      <div class="input-group">
        <input type="text" id="family-name" placeholder="家族の名前（空欄で管理者ログイン）" class="full-width" style="margin-bottom: 10px;" />
        <input type="email" id="username" placeholder="ユーザー名" required class="full-width" style="margin-bottom: 10px;" autocapitalize="none" autocorrect="off" spellcheck={false} />
        <input type="password" id="password" placeholder="パスワード" required class="full-width" style="margin-bottom: 10px;" />
      </div>
      <button type="submit" class="primary full-width">ログイン</button>
    </form>
    <div style="margin-top: 20px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
      <a href="#" id="show-register" style="font-size: 0.9em; color: #6c5ce7; text-decoration: none;">新しい家族（グループ）を作成する</a>
      <form id="register-family-form" style="display: none; margin-top: 15px; text-align: left;" novalidate>
        <h2 style="font-size: 1em; margin-bottom: 10px;">新規家族登録</h2>
        <input type="text" id="reg-family-name" placeholder="家族の名前（例：松谷家）" required class="full-width" style="margin-bottom: 10px;" />
        <input type="email" id="reg-username" placeholder="管理者名（英字推奨）" required class="full-width" style="margin-bottom: 10px;" autocapitalize="none" autocorrect="off" spellcheck={false} />
        <input type="password" id="reg-password" placeholder="パスワード" required class="full-width" style="margin-bottom: 10px;" />
        <button type="submit" class="full-width" style="background: #6c5ce7; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">登録して開始</button>
      </form>
    </div>
    <script src="/static/js/login.js"></script>
  </div>
)
