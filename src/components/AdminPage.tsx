export const AdminPage = ({ familyName, user }: { familyName: string, user: string }) => (
  <div class="admin-page">
    <div class="user-bar" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: white; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
      <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
        <span style="font-weight: 600; color: #333; display: inline-flex; align-items: center; gap: 6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); vertical-align: middle;">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>{familyName || 'システム'}</span>
          <span style="margin: 0 2px; color: #ddd;">/</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); vertical-align: middle;">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>{user} さん (管理者)</span>
        </span>
      </div>
      <button id="logout-btn" style="background: none; border: 1px solid #ddd; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 0.9em; color: #666;">ログアウト</button>
    </div>

    <div class="card">
      <h1>{familyName || '家族'} 管理設定</h1>
      <p><a href="/">← メインページへ戻る</a></p>
      <section style="margin-top: 20px;">
        <h2>家族ユーザー管理</h2>
        <form id="user-form" class="input-group" novalidate>
          <input type="email" id="new-username" placeholder="名前" required autocapitalize="none" autocorrect="off" spellcheck={false} />
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
