(function() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const familyName = document.getElementById('family-name').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyName, username, password })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.isSuperAdmin) {
        window.location.href = '/admin';
      } else {
        window.location.href = '/';
      }
    } else {
      alert('ログインに失敗しました。');
    }
  };

  const showRegister = document.getElementById('show-register');
  const registerForm = document.getElementById('register-family-form');
  if (showRegister && registerForm) {
    showRegister.onclick = (e) => {
      e.preventDefault();
      registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
      showRegister.innerText = registerForm.style.display === 'none' ? '新しい家族（グループ）を作成する' : 'キャンセル';
    };

    registerForm.onsubmit = async (e) => {
      e.preventDefault();
      const familyName = document.getElementById('reg-family-name').value;
      const username = document.getElementById('reg-username').value;
      const password = document.getElementById('reg-password').value;

      const res = await fetch('/api/register-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyName, username, password })
      });

      if (res.ok) {
        alert('家族の登録が完了しました！作成したユーザーでログインしてください。');
        registerForm.reset();
        registerForm.style.display = 'none';
        showRegister.innerText = '新しい家族（グループ）を作成する';
        // 入力欄を埋めてあげる
        document.getElementById('family-name').value = familyName;
        document.getElementById('username').value = username;
        document.getElementById('password').value = password;
      } else {
        const data = await res.json();
        alert('登録に失敗しました: ' + (data.error || '不明なエラー'));
      }
    };
  }
})();
