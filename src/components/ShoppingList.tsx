export const ShoppingList = ({ familyName, user, role, cloudName, uploadPreset }: { familyName: string, user: string, role: string, cloudName: string, uploadPreset: string }) => (
  <>
    <div class="user-bar" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: white; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
      <div>
        <span style="font-weight: 600; color: #333;">🏠 {familyName || '家族'} / 👤 {user} さん</span>
        {role === 'admin' && <a href="/admin" style="margin-left: 15px; font-size: 0.9em; color: #6c5ce7; text-decoration: none;">⚙️ 管理者ページ</a>}
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
