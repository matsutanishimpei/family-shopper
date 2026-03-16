(function() {
  async function loadUsers() {
    const res = await fetch('/api/admin/users');
    const users = await res.json();
    const list = document.getElementById('user-list');
    if (!list) return;

    // currentUser is expected to be defined globally via an inline script
    const currentUser = window.CURRENT_USER || '';

    list.innerHTML = users.map(u => `
      <li class="item">
        <span class="item-name">${u.username} (${u.role})</span>
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
      const role = document.getElementById('new-role').value;
      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
      e.target.reset();
      loadUsers();
    };
  }

  loadUsers();
})();
