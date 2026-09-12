let token = localStorage.getItem('admin_t') || '';
let editId = null;
const $ = id => document.getElementById(id);

$('gir').onclick = async () => {
  const pw = $('pw').value;
  if (!pw) return;
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: pw })
  });
  const d = await r.json();
  if (d.success && d.isAdmin) {
    token = pw;
    localStorage.setItem('admin_t', token);
    ac();
  } else {
    $('err').textContent = 'Yanlış şifre!';
  }
};

$('pw').addEventListener('keypress', e => { if (e.key === 'Enter') $('gir').click(); });

if (token) ac();

function ac() {
  $('login').style.display = 'none';
  $('panel').classList.add('on');
  loadUsers();
  loadMessages();
}

$('cikis').onclick = () => {
  localStorage.removeItem('admin_t');
  location.reload();
};

async function api(url, opt = {}) {
  const r = await fetch(url, {
    ...opt,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token, ...(opt.headers || {}) }
  });
  if (r.status === 401) { localStorage.removeItem('admin_t'); location.reload(); }
  return r.json();
}

document.querySelectorAll('.tab').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    document.querySelectorAll('.cont').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    $('c-' + t.dataset.t).classList.add('on');
  };
});

// KULLANICILAR
async function loadUsers() {
  const users = await api('/api/admin/users');
  const list = $('ulist');
  if (!users.length) { list.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Kullanıcı yok</p>'; return; }
  list.innerHTML = users.map(u => `
    <div class="uitem">
      <div class="uinfo">
        <div class="uav">${u.avatar || '💙'}</div>
        <div class="udet">
          <div class="uname">${esc(u.name)} ${u.is_admin ? '<span class="admin-badge">ADMIN</span>' : ''}</div>
          <div>
            <span class="ucode">${u.code}</span>
            <span class="ustatus">${esc(u.status || '')}</span>
          </div>
          <div class="umeta">${tarih(u.created_at)} ${u.last_seen ? '• Son: ' + tarih(u.last_seen) : ''}</div>
        </div>
      </div>
      ${!u.is_admin ? `
      <div class="uacts">
        <button class="ib edit" onclick="editUser(${u.id}, '${esc(u.name)}', '${u.code}', '${u.avatar}')" title="Düzenle">✏️</button>
        <button class="ib del" onclick="delUser(${u.id})" title="Sil">🗑</button>
      </div>
      ` : ''}
    </div>
  `).join('');
}

$('createUser').onclick = async () => {
  const name = $('nuName').value.trim();
  const code = $('nuCode').value.trim();
  const avatar = $('nuAvatar').value.trim() || '💙';
  if (!name || !code) return alert('İsim ve şifre gerekli');
  if (code.length < 4) return alert('Şifre en az 4 karakter olmalı');
  const r = await api('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ name, code, avatar })
  });
  if (r.success) {
    $('newUserResult').innerHTML = `<div class="newuser"><div class="l">✓ Kullanıcı oluşturuldu:</div><div class="v">${esc(name)} - Şifre: ${code}</div></div>`;
    $('nuName').value = ''; $('nuCode').value = ''; $('nuAvatar').value = '';
    loadUsers();
  } else alert(r.error);
};

window.delUser = async id => {
  if (!confirm('Kullanıcı silinsin mi?')) return;
  await api('/api/admin/users/' + id, { method: 'DELETE' });
  loadUsers();
};

window.editUser = (id, name, code, avatar) => {
  editId = id;
  $('euName').value = name;
  $('euCode').value = code;
  $('euAvatar').value = avatar;
  $('editModal').classList.add('on');
};

$('editCancel').onclick = () => $('editModal').classList.remove('on');

$('editSave').onclick = async () => {
  const name = $('euName').value.trim();
  const code = $('euCode').value.trim();
  const avatar = $('euAvatar').value.trim() || '💙';
  if (!name || !code) return alert('İsim ve şifre gerekli');
  await api('/api/admin/users/' + editId, {
    method: 'PUT',
    body: JSON.stringify({ name, code, avatar })
  });
  $('editModal').classList.remove('on');
  loadUsers();
};

// MESAJLAR
async function loadMessages() {
  const msgs = await api('/api/admin/messages');
  const list = $('mlist');
  if (!msgs.length) { list.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Mesaj yok</p>'; return; }
  list.innerHTML = msgs.map(m => `
    <div class="mitem">
      <div class="mcontent">
        <div class="msender">${m.sender_avatar || ''} ${esc(m.sender_name)}</div>
        <div class="mtext">${m.type === 'audio' ? '🎤 Sesli mesaj (' + m.duration + 'sn)' : esc(m.message)}</div>
        <div class="mdate">${tarih(m.created_at)}</div>
      </div>
      <button class="mdel" onclick="delMsg(${m.id})">🗑</button>
    </div>
  `).join('');
}

window.delMsg = async id => {
  if (!confirm('Mesaj silinsin mi?')) return;
  await api('/api/admin/messages/' + id, { method: 'DELETE' });
  loadMessages();
};

$('clearAll').onclick = async () => {
  if (!confirm('TÜM mesajlar silinsin mi? Bu işlem geri alınamaz!')) return;
  await api('/api/admin/messages', { method: 'DELETE' });
  loadMessages();
};

// ŞİFRE
$('changePw').onclick = async () => {
  const np = $('newPw').value;
  if (np.length < 4) { $('pwResult').textContent = 'En az 4 karakter!'; return; }
  const r = await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ newPass: np }) });
  if (r.success) {
    token = r.newToken;
    localStorage.setItem('admin_t', token);
    $('pwResult').innerHTML = '<span style="color:#25d366;">✓ Şifre değiştirildi</span>';
    $('newPw').value = '';
  }
};

function tarih(s) {
  if (!s) return '-';
  return new Date(s + 'Z').toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }