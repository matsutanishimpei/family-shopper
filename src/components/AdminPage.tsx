export const AdminPage = ({ familyName, user }: { familyName: string, user: string }) => (
  <div class="admin-page">
    <div class="card">
      <h1>{familyName || '家族'} 管理設定</h1>
      <p><a href="/">← メインページへ戻る</a></p>
      <section style="margin-top: 20px;">
        <h2>家族ユーザー管理</h2>
        <form id="user-form" class="input-group">
          <input type="text" id="new-username" placeholder="名前" required inputmode="email" autocapitalize="none" autocorrect="off" spellcheck={false} />
          <input type="password" id="new-password" placeholder="パスワード" required />
          <button type="submit" class="primary">追加</button>
        </form>
        <ul id="user-list" class="item-list" style="margin-top: 10px;"></ul>
      </section>
    </div>
    <script dangerouslySetInnerHTML={{ __html: `window.CURRENT_USER = '${user}';` }} />
    <script src="/static/js/admin.js"></script>
  </div>
)
