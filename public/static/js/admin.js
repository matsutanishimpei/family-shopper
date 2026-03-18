(function() {
  function escapeHTML(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  }

  async function loadUsers() {
    const res = await fetch('/api/admin/users');
    const users = await res.json();
    const list = document.getElementById('user-list');
    if (!list) return;

    const currentUser = window.CURRENT_USER || '';

    list.innerHTML = users.map(u => `
      <li class="item">
        <span class="item-name">${escapeHTML(u.username)} (${escapeHTML(u.role)})</span>
        ${u.username !== currentUser ? `<button onclick="deleteUser(${u.id})" style="background:none;border:none;color:red;cursor:pointer;">削除</button>` : ''}
      </li>
    `).join('');
  }

  window.deleteUser = async function(id) {
    if (!confirm('本当に削除しますか？')) return;
    await fetch('/api/admin/users/' + id, { method: 'DELETE' });
    loadUsers();
  };

  const form = document.getElementById('user-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const username = document.getElementById('new-username').value;
      const password = document.getElementById('new-password').value;
      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      e.target.reset();
      loadUsers();
    };
  }

  loadUsers();
})();
