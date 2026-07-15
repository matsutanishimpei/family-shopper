export const ShoppingList = ({ familyName, user, role, cloudName, uploadPreset }: { familyName: string, user: string, role: string, cloudName: string, uploadPreset: string }) => (
  <>
    <div class="user-bar" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: white; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
      <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
        <span style="font-weight: 600; color: #333; display: inline-flex; align-items: center; gap: 6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); vertical-align: middle;">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>{familyName || '家族'}</span>
          <span style="margin: 0 2px; color: #ddd;">/</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); vertical-align: middle;">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>{user} さん</span>
        </span>
        {role === 'admin' && (
          <a href="/admin" style="font-size: 0.9em; color: var(--primary); text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            管理者ページ
          </a>
        )}
      </div>
      <button id="logout-btn" style="background: none; border: 1px solid #ddd; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 0.9em; color: #666;">ログアウト</button>
    </div>

    <div class="card">
      <h1>Family Shopper</h1>
      <form id="add-form">
        <div class="input-group">
          <input type="text" id="item-name" placeholder="何を買う？" required class="full-width" list="item-history" />
          <datalist id="item-history"></datalist>
          <input type="number" id="item-count" placeholder="個数" min="1" value="1" />
          <select id="item-unit">
            <option value="個">個</option><option value="袋">袋</option><option value="本">本</option>
            <option value="パック">パック</option><option value="枚">枚</option><option value="台">台</option>
            <option value="その他">その他</option>
          </select>
          <select id="item-category" class="full-width">
            <option value="dad">父用</option><option value="mom">母用</option>
            <option value="kids">子ども用</option><option value="other">その他</option>
          </select>
          <input type="hidden" id="item-image-url" />
          <input type="file" id="image-input" accept="image/*" capture="environment" style="display: none;" />
          <button type="button" id="upload-button" class="upload-btn-ui full-width" style="margin-top: 10px; background: #f0f2f5; border: 1px solid #ddd; padding: 10px; border-radius: 8px; cursor: pointer;">
            📷 写真を撮る・選ぶ
          </button>
          <div id="image-preview" style="display: none; width: 100%; text-align: center; margin-top: 10px;">
            <img src="" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;" />
          </div>
        </div>
        <button type="submit" class="primary full-width">リストに追加</button>
      </form>
    </div>

    <div class="card">
      <div class="filters">
        <button class="filter-btn active" data-filter="all">すべて</button>
        <button class="filter-btn" data-filter="dad">父用</button>
        <button class="filter-btn" data-filter="mom">母用</button>
        <button class="filter-btn" data-filter="kids">子ども用</button>
        <button class="filter-btn" data-filter="other">その他</button>
      </div>
      <ul id="item-list" class="item-list"></ul>
    </div>

    <div id="image-modal" class="modal-overlay" onclick="closeModal()">
      <img id="modal-img" class="modal-content" src="" alt="拡大画像" />
    </div>

    <div id="reset-trigger" style="text-align: center; margin-top: 40px; padding: 20px; color: #aaa; font-size: 0.8em; cursor: pointer; user-select: none;">
      &copy; 2026-03-16 matsutani shinpei. All Rights Reserved.
    </div>

    <script dangerouslySetInnerHTML={{ __html: `
      window.APP_CONFIG = {
        cloudName: '${cloudName}',
        uploadPreset: '${uploadPreset}'
      };
    ` }} />
    <script src="/static/js/main.js"></script>
  </>
)
