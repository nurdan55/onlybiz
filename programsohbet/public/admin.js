/* ============================================================
 *  BIZIM SOHBET — Admin Panel Client
 *  ------------------------------------------------------------
 *  Sürüm  : 3.0.0
 *  İçerik :
 *   1. Config
 *   2. State
 *   3. Utils
 *   4. Toast
 *   5. Auth
 *   6. API Client
 *   7. Tabs (Sekme Yönetimi)
 *   8. Dashboard
 *   9. Kullanıcılar
 *  10. Mesajlar
 *  11. Çevrimiçi
 *  12. Ayarlar
 *  13. Loglar
 *  14. Modallar
 *  15. Socket (canlı güncelleme)
 *  16. Klavye kısayolları
 *  17. Başlat
 * ============================================================ */

'use strict';

/* ============================================================
   1. CONFIG
   ============================================================ */
const CONFIG = {
  VERSION: '3.0.0',
  TOKEN_KEY: 'admin_token',
  TOAST_DURATION: 3500,
  AUTO_REFRESH_INTERVAL: 30000
};

const TAB_INFO = {
  dashboard: { title: 'Dashboard', subtitle: 'Genel bakış ve istatistikler' },
  users: { title: 'Kullanıcı Yönetimi', subtitle: 'Kullanıcıları ekle, düzenle, sil' },
  messages: { title: 'Mesaj Yönetimi', subtitle: 'Tüm mesajları görüntüle ve yönet' },
  online: { title: 'Çevrimiçi Kullanıcılar', subtitle: 'Şu an aktif olan kullanıcılar' },
  settings: { title: 'Sistem Ayarları', subtitle: 'Şifre, site bilgileri, veritabanı' },
  logs: { title: 'Sistem Logları', subtitle: 'Aktivite geçmişi' }
};

/* ============================================================
   2. STATE
   ============================================================ */
const State = {
  token: null,
  users: [],
  messages: [],
  onlineUsers: [],
  filteredUsers: null, // null = tümü, 'online' = sadece çevrimiçi
  searchUsers: '',
  searchMessages: '',
  currentTab: 'dashboard',
  editUserId: null,
  confirmCallback: null,
  autoRefreshTimer: null,
  socket: null,
  logs: []
};

/* ============================================================
   3. UTILS
   ============================================================ */
const Utils = {
  $: (id) => document.getElementById(id),
  $$: (sel) => document.querySelectorAll(sel),
  
  create: (tag, cls, html) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html !== undefined) el.innerHTML = html;
    return el;
  },
  
  escapeHtml: (text) => {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },
  
  formatDate: (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z');
      if (isNaN(d)) return dateStr;
      return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch { return dateStr; }
  },
  
  timeAgo: (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z');
      const diff = Math.floor((Date.now() - d.getTime()) / 1000);
      
      if (diff < 60) return 'az önce';
      if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
      if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
      return Utils.formatDate(dateStr);
    } catch { return dateStr; }
  },
  
  formatUptime: (seconds) => {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}dk`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}sa ${Math.floor((seconds % 3600) / 60)}dk`;
    return `${Math.floor(seconds / 86400)}g ${Math.floor((seconds % 86400) / 3600)}sa`;
  },
  
  debounce: (fn, delay) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
};

const $ = Utils.$;
const $$ = Utils.$$;

/* ============================================================
   4. TOAST
   ============================================================ */
const Toast = {
  icons: { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' },
  
  show(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
    const container = $('toastContainer');
    if (!container) return;
    
    const toast = Utils.create('div', `toast ${type}`);
    toast.innerHTML = `
      <span class="toast-icon">${this.icons[type] || this.icons.info}</span>
      <span>${Utils.escapeHtml(message)}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); },
  warning(msg) { this.show(msg, 'warning'); }
};

/* ============================================================
   5. AUTH
   ============================================================ */
const Auth = {
  async login(password) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: password })
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.isAdmin) {
        throw new Error(data.error || 'Giriş başarısız');
      }
      
      State.token = data.token;
      localStorage.setItem(CONFIG.TOKEN_KEY, data.token);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
  
  logout() {
    if (confirm('Çıkış yapmak istediğine emin misin?')) {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      location.reload();
    }
  },
  
  isLoggedIn() {
    return !!localStorage.getItem(CONFIG.TOKEN_KEY);
  },
  
  loadToken() {
    State.token = localStorage.getItem(CONFIG.TOKEN_KEY);
  }
};

/* ============================================================
   6. API CLIENT
   ============================================================ */
const API = {
  async call(url, options = {}) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': State.token,
          ...(options.headers || {})
        }
      });
      
      if (res.status === 401) {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        location.reload();
        throw new Error('Oturum geçersiz');
      }
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'API hatası');
      return data;
    } catch (err) {
      console.error('API error:', err);
      throw err;
    }
  },
  
  // Users
  getUsers() { return this.call('/api/admin/users'); },
  createUser(data) { return this.call('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }); },
  updateUser(id, data) { return this.call(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  deleteUser(id) { return this.call(`/api/admin/users/${id}`, { method: 'DELETE' }); },
  banUser(id, banned) { return this.call(`/api/admin/users/${id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned }) }); },
  
  // Messages
  getMessages() { return this.call('/api/admin/messages'); },
  deleteMessage(id) { return this.call(`/api/admin/messages/${id}`, { method: 'DELETE' }); },
  clearMessages() { return this.call('/api/admin/messages', { method: 'DELETE' }); },
  
  // Stats
  getStats() { return this.call('/api/admin/stats'); },
  
  // Password
  changePassword(newPass) { return this.call('/api/admin/password', { method: 'POST', body: JSON.stringify({ newPass }) }); }
};

/* ============================================================
   7. TABS
   ============================================================ */
const Tabs = {
  init() {
    $$('.nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switch(btn.dataset.tab);
        // Mobilde sidebar'ı kapat
        if (window.innerWidth <= 900) Sidebar.close();
      });
    });
  },
  
  switch(tab) {
    State.currentTab = tab;
    
    // Nav itemları
    $$('.nav-item[data-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    
    // Paneller
    $$('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === `panel-${tab}`);
    });
    
    // Başlık
    const info = TAB_INFO[tab];
    if (info) {
      $('pageTitle').textContent = info.title;
      $('pageSubtitle').textContent = info.subtitle;
    }
    
    // Veri yükleme
    switch (tab) {
      case 'dashboard': Dashboard.load(); break;
      case 'users': Users.load(); break;
      case 'messages': Messages.load(); break;
      case 'online': Online.load(); break;
      case 'settings': Settings.load(); break;
      case 'logs': Logs.render(); break;
    }
  }
};

/* ============================================================
   8. DASHBOARD
   ============================================================ */
const Dashboard = {
  async load() {
    try {
      const [stats, users, messages] = await Promise.all([
        API.getStats(),
        API.getUsers(),
        API.getMessages()
      ]);
      
      State.users = users;
      State.messages = messages;
      
      // Stat kartları
      $('statTotalUsers').textContent = stats.totalUsers || 0;
      $('statTotalMessages').textContent = stats.totalMessages || 0;
      $('statOnline').textContent = stats.onlineNow || 0;
      $('statUptime').textContent = Utils.formatUptime(stats.uptime || 0);
      $('statVersion').textContent = `v${stats.version || CONFIG.VERSION}`;
      
      // Header
      $('headerOnlineCount').textContent = stats.onlineNow || 0;
      
      // Badge'ler
      $('userCountBadge').textContent = stats.totalUsers || 0;
      $('msgCountBadge').textContent = stats.totalMessages || 0;
      $('onlineCountBadge').textContent = stats.onlineNow || 0;
      
      // Son aktiviteler
      this.renderActivity(messages.slice(-10).reverse());
      
      $('statUserChange').textContent = `${users.filter(u => !u.is_admin).length} normal kullanıcı`;
      $('statMsgChange').textContent = `son 500 yüklendi`;
      
    } catch (e) {
      Toast.error('Dashboard yüklenemedi: ' + e.message);
    }
  },
  
  renderActivity(messages) {
    const container = $('recentActivity');
    
    if (!messages || messages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">Henüz aktivite yok</div>
          <div class="empty-desc">Mesajlar geldikçe burada görünecek</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = messages.map(m => `
      <div class="list-item">
        <div class="item-avatar">${Utils.escapeHtml(m.sender_avatar || '💬')}</div>
        <div class="item-info">
          <div class="item-name">${Utils.escapeHtml(m.sender_name)}</div>
          <div class="item-meta">
            <span>${m.type === 'audio' ? '🎤 Sesli mesaj' : Utils.escapeHtml((m.message || '').slice(0, 80))}</span>
          </div>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); flex-shrink: 0;">
          ${Utils.timeAgo(m.created_at)}
        </div>
      </div>
    `).join('');
  }
};

/* ============================================================
   9. KULLANICILAR
   ============================================================ */
const Users = {
  async load() {
    try {
      const users = await API.getUsers();
      State.users = users;
      this.render();
      
      $('userCountBadge').textContent = users.length;
    } catch (e) {
      Toast.error('Kullanıcılar yüklenemedi');
    }
  },
  
  render() {
    const container = $('usersList');
    let users = State.users;
    
    // Filtre
    if (State.filteredUsers === 'online') {
      const onlineIds = State.onlineUsers.map(u => u.id);
      users = users.filter(u => onlineIds.includes(u.id));
    }
    
    // Arama
    if (State.searchUsers) {
      const q = State.searchUsers.toLowerCase();
      users = users.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.code.includes(q)
      );
    }
    
    if (users.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <div class="empty-title">Kullanıcı bulunamadı</div>
          <div class="empty-desc">${State.searchUsers ? 'Arama kriterine uygun sonuç yok' : 'Yeni kullanıcı oluştur'}</div>
        </div>
      `;
      return;
    }
    
    const onlineIds = State.onlineUsers.map(u => u.id);
    
    container.innerHTML = users.map(u => {
      const isOnline = onlineIds.includes(u.id);
      
      return `
        <div class="list-item" data-user-id="${u.id}">
          <div class="item-avatar ${isOnline ? 'online' : ''}">
            ${Utils.escapeHtml(u.avatar || '💙')}
          </div>
          <div class="item-info">
            <div class="item-name">
              ${Utils.escapeHtml(u.name)}
              ${u.is_admin ? '<span class="admin-badge">ADMIN</span>' : ''}
              ${u.is_banned ? '<span class="banned-badge">BANLI</span>' : ''}
            </div>
            <div class="item-meta">
              <span class="meta-chip code">🔑 ${u.code}</span>
              <span class="meta-chip">💬 ${u.messageCount || 0} mesaj</span>
              ${u.last_seen ? `<span class="meta-chip">🕐 ${Utils.timeAgo(u.last_seen)}</span>` : ''}
            </div>
          </div>
          ${!u.is_admin ? `
            <div class="item-actions">
              <button class="item-action" data-action="edit" data-id="${u.id}" title="Düzenle">✏️</button>
              <button class="item-action ${u.is_banned ? 'success' : ''}" data-action="ban" data-id="${u.id}" title="${u.is_banned ? 'Banı Kaldır' : 'Banla'}">
                ${u.is_banned ? '✅' : '🚫'}
              </button>
              <button class="item-action danger" data-action="delete" data-id="${u.id}" title="Sil">🗑️</button>
            </div>
          ` : '<span style="font-size: 11px; color: var(--text-muted);">Korunuyor</span>'}
        </div>
      `;
    }).join('');
    
    // Event listeners
    container.querySelectorAll('.item-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id);
        
        if (action === 'edit') this.openEdit(id);
        else if (action === 'ban') this.toggleBan(id);
        else if (action === 'delete') this.delete(id);
      });
    });
  },
  
  async create() {
    const name = $('newUserName').value.trim();
    const code = $('newUserCode').value.trim();
    const avatar = $('newUserAvatar').value.trim() || '💙';
    const status = $('newUserStatus').value.trim() || 'Hayat güzel';
    
    if (!name) { Toast.error('İsim gerekli'); return; }
    if (!code || code.length < 4) { Toast.error('Şifre en az 4 karakter olmalı'); return; }
    
    try {
      await API.createUser({ name, code, avatar, status });
      
      $('newUserName').value = '';
      $('newUserCode').value = '';
      $('newUserAvatar').value = '';
      $('newUserStatus').value = '';
      
      $('newUserResult').innerHTML = `
        <div style="padding: 14px; background: rgba(52, 211, 153, 0.15); border-left: 3px solid var(--success); border-radius: 10px;">
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">✓ Kullanıcı oluşturuldu</div>
          <div style="font-weight: 700; color: var(--success);">${Utils.escapeHtml(name)} — Şifre: ${Utils.escapeHtml(code)}</div>
        </div>
      `;
      
      Toast.success('Kullanıcı oluşturuldu');
      this.load();
      Logs.add(`Yeni kullanıcı: ${name}`);
    } catch (e) {
      Toast.error(e.message);
    }
  },
  
  openEdit(id) {
    const user = State.users.find(u => u.id === id);
    if (!user) return;
    
    State.editUserId = id;
    
    $('editUserName').value = user.name || '';
    $('editUserCode').value = user.code || '';
    $('editUserAvatar').value = user.avatar || '💙';
    $('editUserStatus').value = user.status || '';
    
    $('editUserModal').classList.add('active');
  },
  
  async saveEdit() {
    const id = State.editUserId;
    const name = $('editUserName').value.trim();
    const code = $('editUserCode').value.trim();
    const avatar = $('editUserAvatar').value.trim() || '💙';
    const status = $('editUserStatus').value.trim();
    
    if (!name || !code) { Toast.error('İsim ve şifre gerekli'); return; }
    
    try {
      await API.updateUser(id, { name, code, avatar, status });
      Toast.success('Kullanıcı güncellendi');
      $('editUserModal').classList.remove('active');
      this.load();
      Logs.add(`Kullanıcı güncellendi: ${name}`);
    } catch (e) {
      Toast.error(e.message);
    }
  },
  
  async toggleBan(id) {
    const user = State.users.find(u => u.id === id);
    if (!user) return;
    
    try {
      await API.banUser(id, !user.is_banned);
      Toast.success(user.is_banned ? 'Ban kaldırıldı' : 'Kullanıcı banlandı');
      this.load();
      Logs.add(`${user.is_banned ? 'Ban kaldırıldı' : 'Banlandı'}: ${user.name}`);
    } catch (e) {
      Toast.error(e.message);
    }
  },
  
  delete(id) {
    const user = State.users.find(u => u.id === id);
    if (!user) return;
    
    Modal.confirm(
      'Kullanıcıyı Sil',
      `"${user.name}" adlı kullanıcıyı silmek istediğinden emin misin? Bu işlem geri alınamaz.`,
      async () => {
        try {
          await API.deleteUser(id);
          Toast.success('Kullanıcı silindi');
          this.load();
          Logs.add(`Kullanıcı silindi: ${user.name}`);
        } catch (e) {
          Toast.error(e.message);
        }
      }
    );
  }
};

/* ============================================================
   10. MESAJLAR
   ============================================================ */
const Messages = {
  async load() {
    try {
      const messages = await API.getMessages();
      State.messages = messages;
      this.render();
      
      $('msgCountBadge').textContent = messages.length;
    } catch (e) {
      Toast.error('Mesajlar yüklenemedi');
    }
  },
  
  render() {
    const container = $('messagesList');
    let messages = State.messages;
    
    // Arama
    if (State.searchMessages) {
      const q = State.searchMessages.toLowerCase();
      messages = messages.filter(m => 
        (m.message || '').toLowerCase().includes(q) ||
        (m.sender_name || '').toLowerCase().includes(q)
      );
    }
    
    if (messages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <div class="empty-title">Mesaj bulunamadı</div>
          <div class="empty-desc">${State.searchMessages ? 'Arama kriterine uygun sonuç yok' : 'Henüz mesaj yok'}</div>
        </div>
      `;
      return;
    }
    
    // Son 200 mesaj
    const display = messages.slice(-200).reverse();
    
    container.innerHTML = display.map(m => `
      <div class="message-item" data-msg-id="${m.id}">
        <div class="item-avatar" style="width: 38px; height: 38px; font-size: 18px;">
          ${Utils.escapeHtml(m.sender_avatar || '💬')}
        </div>
        <div class="message-content">
          <div class="message-author">
            ${Utils.escapeHtml(m.sender_name)}
            ${m.is_pinned ? '<span style="font-size: 10px; color: var(--warning);">📌</span>' : ''}
          </div>
          <div class="message-body ${m.type === 'audio' ? 'audio' : ''}">
            ${m.type === 'audio' ? `🎤 Sesli mesaj (${m.duration || 0}sn)` : Utils.escapeHtml(m.message || '').slice(0, 300)}
          </div>
          <div class="message-time">🕐 ${Utils.formatDate(m.created_at)}</div>
        </div>
        <button class="message-delete" data-action="delete-msg" data-id="${m.id}" title="Sil">🗑️</button>
      </div>
    `).join('');
    
    // Event listeners
    container.querySelectorAll('.message-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        this.delete(parseInt(btn.dataset.id));
      });
    });
  },
  
  delete(id) {
    Modal.confirm(
      'Mesajı Sil',
      'Bu mesajı silmek istediğinden emin misin?',
      async () => {
        try {
          await API.deleteMessage(id);
          Toast.success('Mesaj silindi');
          this.load();
        } catch (e) {
          Toast.error(e.message);
        }
      }
    );
  },
  
  clearAll() {
    Modal.confirm(
      'Tüm Mesajları Sil',
      '⚠️ TÜM mesajlar silinecek! Bu işlem geri alınamaz. Emin misin?',
      async () => {
        try {
          await API.clearMessages();
          Toast.success('Tüm mesajlar silindi');
          this.load();
          Logs.add('Tüm mesajlar temizlendi');
        } catch (e) {
          Toast.error(e.message);
        }
      }
    );
  }
};

/* ============================================================
   11. ÇEVRİMİÇİ
   ============================================================ */
const Online = {
  async load() {
    // Socket üzerinden anlık al
    this.render();
  },
  
  render() {
    const container = $('onlineUsersList');
    const list = State.onlineUsers;
    
    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">😴</div>
          <div class="empty-title">Kimse çevrimiçi değil</div>
          <div class="empty-desc">Kullanıcılar giriş yapınca burada görünecek</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = list.map(u => {
      const user = State.users.find(x => x.id === u.id);
      return `
        <div class="list-item">
          <div class="item-avatar online">
            ${Utils.escapeHtml(u.avatar || '💙')}
          </div>
          <div class="item-info">
            <div class="item-name">
              ${Utils.escapeHtml(u.name)}
              ${u.isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}
            </div>
            <div class="item-meta">
              <span class="meta-chip" style="background: rgba(52, 211, 153, 0.15); color: var(--success);">🟢 Çevrimiçi</span>
              ${user ? `<span class="meta-chip code">🔑 ${user.code}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
};

/* ============================================================
   12. AYARLAR
   ============================================================ */
const Settings = {
  async load() {
    // Şifre formunu temizle
    $('newAdminPass').value = '';
    $('newAdminPass2').value = '';
    $('passwordResult').innerHTML = '';
  },
  
  async changePassword() {
    const pass1 = $('newAdminPass').value;
    const pass2 = $('newAdminPass2').value;
    
    if (!pass1 || pass1.length < 4) {
      Toast.error('Şifre en az 4 karakter olmalı');
      return;
    }
    
    if (pass1 !== pass2) {
      Toast.error('Şifreler eşleşmiyor');
      return;
    }
    
    try {
      const res = await API.changePassword(pass1);
      State.token = res.newToken;
      localStorage.setItem(CONFIG.TOKEN_KEY, res.newToken);
      
      $('passwordResult').innerHTML = `
        <div style="padding: 14px; background: rgba(52, 211, 153, 0.15); border-left: 3px solid var(--success); border-radius: 10px;">
          <div style="font-weight: 700; color: var(--success);">✓ Şifre başarıyla değiştirildi</div>
        </div>
      `;
      
      $('newAdminPass').value = '';
      $('newAdminPass2').value = '';
      
      Toast.success('Şifre değiştirildi');
      Logs.add('Admin şifresi değiştirildi');
    } catch (e) {
      Toast.error(e.message);
    }
  },
  
  exportData() {
    const data = {
      exported_at: new Date().toISOString(),
      version: CONFIG.VERSION,
      users: State.users,
      messages: State.messages
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sohbet-yedek-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    Toast.success('Veriler indirildi');
  },
  
  resetAll() {
    Modal.confirm(
      '⚠️ Sistemi Sıfırla',
      'TÜM kullanıcılar ve mesajlar silinecek! Bu işlem GERİ ALINAMAZ. Emin misin?',
      async () => {
        try {
          // Tüm kullanıcıları sil (admin hariç)
          for (const u of State.users) {
            if (!u.is_admin) {
              await API.deleteUser(u.id).catch(() => {});
            }
          }
          // Tüm mesajları sil
          await API.clearMessages();
          
          Toast.success('Sistem sıfırlandı');
          Logs.add('⚠️ Sistem sıfırlandı');
          Dashboard.load();
        } catch (e) {
          Toast.error(e.message);
        }
      }
    );
  }
};

/* ============================================================
   13. LOGLAR
   ============================================================ */
const Logs = {
  add(text) {
    State.logs.unshift({
      text,
      time: new Date().toISOString()
    });
    
    if (State.logs.length > 100) State.logs.pop();
    
    if (State.currentTab === 'logs') this.render();
  },
  
  render() {
    const container = $('logsList');
    
    if (State.logs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Henüz log yok</div>
          <div class="empty-desc">Sistem aktiviteleri burada görünecek</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = State.logs.map(log => `
      <div class="list-item">
        <div class="item-avatar" style="background: linear-gradient(135deg, #f59e0b, #f97316);">📌</div>
        <div class="item-info">
          <div class="item-name">${Utils.escapeHtml(log.text)}</div>
          <div class="item-meta">
            <span class="meta-chip">🕐 ${Utils.timeAgo(log.time)}</span>
          </div>
        </div>
      </div>
    `).join('');
  },
  
  clear() {
    if (State.logs.length === 0) return;
    if (confirm('Tüm loglar temizlensin mi?')) {
      State.logs = [];
      this.render();
      Toast.success('Loglar temizlendi');
    }
  }
};

/* ============================================================
   14. MODALLAR
   ============================================================ */
const Modal = {
  confirm(title, message, callback) {
    State.confirmCallback = callback;
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    $('confirmModal').classList.add('active');
  },
  
  closeConfirm() {
    $('confirmModal').classList.remove('active');
    State.confirmCallback = null;
  }
};

/* ============================================================
   15. SOCKET (Canlı Güncelleme)
   ============================================================ */
const SocketManager = {
  init() {
    if (typeof io === 'undefined') return;
    
    State.socket = io();
    
    State.socket.on('connect', () => {
      console.log('[Admin] Socket bağlandı');
      State.socket.emit('login', { token: State.token });
    });
    
    State.socket.on('online-users', (list) => {
      State.onlineUsers = list;
      $('headerOnlineCount').textContent = list.length;
      $('onlineCountBadge').textContent = list.length;
      
      // Aktif sekme güncellemesi
      if (State.currentTab === 'online') Online.render();
      if (State.currentTab === 'users') Users.render();
    });
    
    State.socket.on('new-message', () => {
      if (State.currentTab === 'messages' || State.currentTab === 'dashboard') {
        Messages.load();
      }
    });
    
    State.socket.on('message-deleted', () => {
      if (State.currentTab === 'messages') Messages.load();
    });
    
    State.socket.on('messages-cleared', () => {
      if (State.currentTab === 'messages') Messages.load();
    });
  }
};

/* ============================================================
   16. KLAVYE KISAYOLLARI
   ============================================================ */
const Keyboard = {
  init() {
    document.addEventListener('keydown', (e) => {
      // ESC → modalları kapat
      if (e.key === 'Escape') {
        $('editUserModal').classList.remove('active');
        Modal.closeConfirm();
        Sidebar.close();
      }
      
      // Ctrl+K → ara
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (State.currentTab === 'users') $('userSearch').focus();
        else if (State.currentTab === 'messages') $('messageSearch').focus();
      }
      
      // Ctrl+R → yenile
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        Tabs.switch(State.currentTab);
        Toast.info('Yenilendi');
      }
    });
  }
};

/* ============================================================
   SIDEBAR (Mobil)
   ============================================================ */
const Sidebar = {
  open() {
    $('sidebar').classList.add('open');
    $('sidebarOverlay').classList.add('active');
  },
  
  close() {
    $('sidebar').classList.remove('open');
    $('sidebarOverlay').classList.remove('active');
  },
  
  toggle() {
    if ($('sidebar').classList.contains('open')) this.close();
    else this.open();
  }
};

/* ============================================================
   17. EVENT LISTENERS
   ============================================================ */
const Events = {
  bindAll() {
    this.bindLogin();
    this.bindSidebar();
    this.bindDashboard();
    this.bindUsers();
    this.bindMessages();
    this.bindSettings();
    this.bindModals();
    this.bindMisc();
  },
  
  bindLogin() {
    const form = $('loginForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const input = $('loginPassword');
        const btn = $('loginBtn');
        const err = $('loginError');
        
        err.textContent = '';
        err.classList.remove('show');
        
        btn.disabled = true;
        
        const res = await Auth.login(input.value);
        
        btn.disabled = false;
        
        if (!res.success) {
          err.textContent = res.error;
          err.classList.add('show');
          return;
        }
        
        showPanel();
      });
    }
    
    // Şifre göster/gizle
    const toggle = $('passwordToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const input = $('loginPassword');
        if (input.type === 'password') {
          input.type = 'text';
          toggle.textContent = '🙈';
        } else {
          input.type = 'password';
          toggle.textContent = '👁️';
        }
      });
    }
  },
  
  bindSidebar() {
    $('menuToggle').addEventListener('click', () => Sidebar.toggle());
    $('sidebarOverlay').addEventListener('click', () => Sidebar.close());
    
    $('logoutBtn').addEventListener('click', () => Auth.logout());
    $('viewChatBtn').addEventListener('click', () => window.open('/', '_blank'));
  },
  
  bindDashboard() {
    $('refreshBtn').addEventListener('click', () => {
      Tabs.switch(State.currentTab);
      Toast.info('Yenilendi');
    });
  },
  
  bindUsers() {
    $('createUserBtn').addEventListener('click', () => Users.create());
    
    $('userSearch').addEventListener('input', Utils.debounce((e) => {
      State.searchUsers = e.target.value;
      Users.render();
    }, 200));
    
    $('filterAll').addEventListener('click', () => {
      State.filteredUsers = null;
      Users.render();
      Toast.info('Tümü gösteriliyor');
    });
    
    $('filterOnline').addEventListener('click', () => {
      State.filteredUsers = 'online';
      Users.render();
      Toast.info('Sadece çevrimiçi');
    });
    
    $('editUserSave').addEventListener('click', () => Users.saveEdit());
    $('editUserCancel').addEventListener('click', () => {
      $('editUserModal').classList.remove('active');
    });
    $('editUserClose').addEventListener('click', () => {
      $('editUserModal').classList.remove('active');
    });
  },
  
  bindMessages() {
    $('clearAllMessagesBtn').addEventListener('click', () => Messages.clearAll());
    
    $('messageSearch').addEventListener('input', Utils.debounce((e) => {
      State.searchMessages = e.target.value;
      Messages.render();
    }, 200));
  },
  
  bindSettings() {
    $('changePasswordBtn').addEventListener('click', () => Settings.changePassword());
    $('exportDataBtn').addEventListener('click', () => Settings.exportData());
    $('resetAllBtn').addEventListener('click', () => Settings.resetAll());
    $('clearLogsBtn').addEventListener('click', () => Logs.clear());
  },
  
  bindModals() {
    // Confirm modal
    $('confirmOk').addEventListener('click', () => {
      if (State.confirmCallback) State.confirmCallback();
      Modal.closeConfirm();
    });
    
    $('confirmCancel').addEventListener('click', () => Modal.closeConfirm());
    $('confirmClose').addEventListener('click', () => Modal.closeConfirm());
    
    $('confirmModal').addEventListener('click', (e) => {
      if (e.target === $('confirmModal')) Modal.closeConfirm();
    });
    
    // Edit user modal
    $('editUserModal').addEventListener('click', (e) => {
      if (e.target === $('editUserModal')) $('editUserModal').classList.remove('active');
    });
  },
  
  bindMisc() {
    // Yenile butonu
    $('refreshOnline').addEventListener('click', () => Online.load());
    
    // Otomatik yenileme
    State.autoRefreshTimer = setInterval(() => {
      if (State.currentTab === 'dashboard' || State.currentTab === 'online') {
        Tabs.switch(State.currentTab);
      }
    }, CONFIG.AUTO_REFRESH_INTERVAL);
  }
};

/* ============================================================
   BAŞLAT
   ============================================================ */
function showPanel() {
  $('loginScreen').style.display = 'none';
  $('adminPanel').classList.add('active');
  
  SocketManager.init();
  Tabs.switch('dashboard');
  Logs.add('Admin panele giriş yapıldı');
}

function init() {
  console.log(`%c🔐 Admin Panel v${CONFIG.VERSION}`, 
    'color:#818cf8;font-size:16px;font-weight:bold;');
  
  Events.bindAll();
  Keyboard.init();
  
  Auth.loadToken();
  
  if (Auth.isLoggedIn()) {
    showPanel();
  } else {
    $('loginScreen').style.display = 'flex';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}