/* ============================================================
 *  BIZIM SOHBET — Client Side (Ana Uygulama)
 *  ------------------------------------------------------------
 *  Sürüm  : 3.0.0
 *  İçerik :
 *   1. Sabitler & Config
 *   2. Yardımcılar (Utils)
 *   3. State Yönetimi
 *   4. Toast Bildirimleri
 *   5. LocalStorage Yönetimi
 *   6. Kimlik Doğrulama (Auth)
 *   7. Socket.IO Bağlantısı
 *   8. Layout Yönetimi (Masaüstü/Mobil)
 *   9. Mesaj Render
 *  10. Mesaj Gönderme
 *  11. Ses Kayıt (MediaRecorder)
 *  12. Emoji Paneli
 *  13. Profil Düzenleme
 *  14. Ayarlar
 *  15. Tema Yönetimi
 *  16. Arama
 *  17. Context Menu (Reply/Pin/Delete)
 *  18. Yazıyor Göstergesi
 *  19. Bildirim Sesi + Browser Notification
 *  20. Klavye Kısayolları
 *  21. Event Listeners
 *  22. Başlat
 * ============================================================ */

'use strict';

/* ============================================================
   1. SABİTLER & CONFIG
   ============================================================ */
const CONFIG = {
  VERSION: '3.0.0',
  MAX_MESSAGE_LENGTH: 4000,
  MAX_AUDIO_DURATION: 120,
  TYPING_TIMEOUT: 1500,
  TYPING_DISPLAY_TIMEOUT: 2500,
  RECONNECT_DELAY: 2000,
  TOAST_DURATION: 3500,
  LONG_PRESS_DURATION: 450,
  SCROLL_THRESHOLD: 150
};

const EMOJI_DATA = {
  smileys: [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
    '🥲','😋','😛','😜','🤪','😝','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥',
    '😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😕',
    '😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓',
    '😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸',
    '😹','😻','😼','😽','🙀','😿','😾'
  ],
  hearts: [
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','💌',
    '💋','😻','💐','🌹','🌺','🌸','🌷','🌻','🌼','🌱','🌲','🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁','🍂',
    '🍃','🕊️','🦋','🐝','🐞','🌟','⭐','✨','⚡','🔥','💫','☀️','🌙','🌛','🌜','⛅','☁️','🌧️','⛈️','🌈'
  ],
  animals: [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔',
    '🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦗',
    '🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊',
    '🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙',
    '🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦'
  ],
  food: [
    '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🥝','🍅','🥥','🥑','🍆','🥔',
    '🥕','🌽','🌶️','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🍞','🥐','🥖','🥨','🥯','🥞','🧇','🧀','🍖','🍗',
    '🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🥣','🥗','🍿','🧈','🧂',
    '🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞',
    '🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕',
    '🍵','🧃','🥤','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃'
  ],
  objects: [
    '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🥅','⛳','🪁',
    '🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺',
    '🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫',
    '🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯',
    '🎳','🎮','🎰','🧩','💎','🔮','📿','🧿','💍','🌂','💼','👑','🎩','🧢','⛑️','🎓','📚','📖','✏️','🖊️',
    '🖋️','✒️','📝','💌','📩','📨','📧','💌','📦','📫','📪','📬','📭','📮','🗳️','✉️','📜','📃','📄','📑'
  ]
};

/* ============================================================
   2. YARDIMCILAR (Utils)
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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },
  escapeAttr: (text) => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },
  formatTime: (dateStr) => {
    if (!dateStr) return '';
    let d;
    try {
      d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z');
      if (isNaN(d)) d = new Date(dateStr);
    } catch { d = new Date(dateStr); }
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  },
  formatDate: (dateStr) => {
    if (!dateStr) return '';
    let d;
    try {
      d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z');
      if (isNaN(d)) d = new Date(dateStr);
    } catch { d = new Date(dateStr); }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDay.getTime() === today.getTime()) return 'Bugün';
    if (msgDay.getTime() === yesterday.getTime()) return 'Dün';
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  },
  formatDuration: (seconds) => {
    if (!seconds || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  },
  isSameDay: (dateA, dateB) => {
    try {
      const a = new Date(dateA.includes('T') ? dateA : dateA + 'Z');
      const b = new Date(dateB.includes('T') ? dateB : dateB + 'Z');
      return a.toDateString() === b.toDateString();
    } catch { return false; }
  },
  debounce: (fn, delay) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },
  throttle: (fn, delay) => {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        fn(...args);
      }
    };
  },
  vibrate: (pattern = 30) => {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {}
  },
  linkify: (text) => {
    const escaped = Utils.escapeHtml(text);
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    return escaped.replace(urlRegex, (url) => {
      return `<a href="${Utils.escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
  },
  isMobile: () => window.innerWidth < 900,
  generateWaveform: (bars = 20) => {
    return Array.from({ length: bars }, () => 0.2 + Math.random() * 0.8);
  }
};

const $ = Utils.$;
const $$ = Utils.$$;

/* ============================================================
   3. STATE YÖNETİMİ
   ============================================================ */
const AppState = {
  me: null,
  isAdmin: false,
  sessionToken: null,
  socket: null,
  onlineUsers: [],
  messages: [],
  pinnedMessage: null,
  replyTo: null,
  currentTheme: 'auto',
  currentWallpaper: 'default',
  isRecording: false,
  recordingStartTime: 0,
  isTyping: false,
  typingTimer: null,
  connected: false,
  searchQuery: '',
  soundEnabled: true,
  notifEnabled: true,
  tabTitleEnabled: true,
  unreadCount: 0,
  originalTitle: document.title
};

/* ============================================================
   4. TOAST BİLDİRİMLERİ
   ============================================================ */
const Toast = {
  icons: {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  },

  show(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
    const container = $('toastContainer');
    if (!container) return;

    const toast = Utils.create('div', `toast ${type}`);
    toast.innerHTML = `
      <span class="toast-icon">${this.icons[type] || this.icons.info}</span>
      <span class="toast-msg">${Utils.escapeHtml(message)}</span>
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
   5. LOCALSTORAGE YÖNETİMİ
   ============================================================ */
const Storage = {
  KEY_TOKEN: 'chat_session_token',
  KEY_USER: 'chat_user',
  KEY_THEME: 'chat_theme',
  KEY_WALLPAPER: 'chat_wallpaper',
  KEY_SOUND: 'chat_sound',
  KEY_NOTIF: 'chat_notif',
  KEY_TAB_TITLE: 'chat_tab_title',

  get(key) {
    try { return localStorage.getItem(key); }
    catch { return null; }
  },

  set(key, value) {
    try { localStorage.setItem(key, value); }
    catch {}
  },

  remove(key) {
    try { localStorage.removeItem(key); }
    catch {}
  },

  getJSON(key) {
    try {
      const val = this.get(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },

  setJSON(key, value) {
    try { this.set(key, JSON.stringify(value)); }
    catch {}
  },

  clearAuth() {
    this.remove(this.KEY_TOKEN);
    this.remove(this.KEY_USER);
  }
};

/* ============================================================
   6. KİMLİK DOĞRULAMA (Auth)
   ============================================================ */
const Auth = {
  async login(code) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Giriş başarısız');
      }

      AppState.sessionToken = data.token;
      AppState.me = data.user;
      AppState.isAdmin = data.isAdmin;

      Storage.set(Storage.KEY_TOKEN, data.token);
      Storage.setJSON(Storage.KEY_USER, data.user);

      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  logout() {
    // Sunucuya bildir
    if (AppState.sessionToken) {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'X-Session-Token': AppState.sessionToken }
      }).catch(() => {});
    }

    Storage.clearAuth();
    if (AppState.socket) {
      AppState.socket.disconnect();
    }
    location.reload();
  },

  autoLogin() {
    const token = Storage.get(Storage.KEY_TOKEN);
    const user = Storage.getJSON(Storage.KEY_USER);
    if (token && user) {
      AppState.sessionToken = token;
      AppState.me = user;
      AppState.isAdmin = user.is_admin;
      return true;
    }
    return false;
  }
};

/* ============================================================
   7. SOCKET.IO BAĞLANTISI
   ============================================================ */
const SocketManager = {
  init() {
    if (typeof io === 'undefined') {
      console.error('Socket.IO yüklenemedi');
      return;
    }

    AppState.socket = io({
      reconnection: true,
      reconnectionDelay: CONFIG.RECONNECT_DELAY,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling']
    });

    this.bindEvents();
  },

  bindEvents() {
    const s = AppState.socket;

    s.on('connect', () => {
      AppState.connected = true;
      this.updateConnectionStatus(true);
      // Otomatik giriş
      if (AppState.sessionToken) {
        s.emit('login', { token: AppState.sessionToken });
      }
    });

    s.on('disconnect', () => {
      AppState.connected = false;
      this.updateConnectionStatus(false);
    });

    s.on('connect_error', (err) => {
      console.warn('Bağlantı hatası:', err.message);
      this.updateConnectionStatus(false);
    });

    s.on('login-ok', ({ user, isAdmin }) => {
      AppState.me = user;
      AppState.isAdmin = isAdmin;
      Storage.setJSON(Storage.KEY_USER, user);
      this.hideLoading();
      Layout.showApp();
      Profile.updateUI();
    });

    s.on('login-error', (msg) => {
      Toast.error(msg || 'Giriş başarısız');
      Auth.logout();
    });

    s.on('history', (messages) => {
      AppState.messages = messages;
      MessageRenderer.renderAll(messages);
    });

    s.on('new-message', (msg) => {
      AppState.messages.push(msg);
      MessageRenderer.append(msg);

      // Bildirim
      if (msg.sender_id !== AppState.me.id) {
        Sound.play();
        Notifier.show(msg);
        Layout.incrementUnread();
      }

      if (Layout.isNearBottom()) {
        Layout.scrollToBottom(true);
      }
    });

    s.on('message-deleted', (id) => {
      MessageRenderer.remove(id);
      AppState.messages = AppState.messages.filter(m => m.id !== id);
    });

    s.on('messages-cleared', () => {
      AppState.messages = [];
      MessageRenderer.renderAll([]);
      Toast.info('Tüm mesajlar silindi');
    });

    s.on('message-pinned', ({ id, pinned }) => {
      const msg = AppState.messages.find(m => m.id === id);
      if (msg) msg.is_pinned = pinned;
      MessageRenderer.updatePin(id, pinned);
    });

    s.on('pinned', (list) => {
      AppState.pinnedMessage = list[0] || null;
      Layout.updatePinnedBanner();
    });

    s.on('message-reaction', ({ id, reactions }) => {
      const msg = AppState.messages.find(m => m.id === id);
      if (msg) {
        msg.reactions = reactions;
        MessageRenderer.updateReactions(id, reactions);
      }
    });

    s.on('messages-read', (userId) => {
      if (userId !== AppState.me.id) {
        // Karşı taraf okudu
        $$('.msg-check').forEach(el => {
          el.classList.remove('sent');
          el.classList.add('read');
          el.textContent = '✓✓';
        });
      }
    });

    s.on('online-users', (list) => {
      AppState.onlineUsers = list;
      OnlineList.render(list);
      Layout.updateOnlineCount(list);
      Layout.updateHeaderStatus(list);
    });

    s.on('user-typing', ({ name }) => {
      Typing.show(name);
    });

    s.on('user-typing-stop', () => {
      Typing.hide();
    });

    s.on('user-updated', (user) => {
      // Profil güncellendi (başkası ya da ben)
      if (user.id === AppState.me.id) {
        AppState.me = { ...AppState.me, ...user };
        Storage.setJSON(Storage.KEY_USER, AppState.me);
        Profile.updateUI();
      } else {
        OnlineList.updateUser(user);
      }
    });

    s.on('system-message', ({ text }) => {
      MessageRenderer.appendSystem(text);
    });

    s.on('error-msg', (msg) => {
      Toast.error(msg);
    });
  },

  updateConnectionStatus(connected) {
    const statusEl = $('headerStatus');
    if (!statusEl) return;
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('span:last-child');
    if (connected) {
      if (dot) dot.classList.add('online');
      if (text) text.textContent = 'Bağlı';
    } else {
      if (dot) dot.classList.remove('online');
      if (text) text.textContent = 'Bağlanıyor...';
    }
  },

  hideLoading() {
    const loading = $('messagesLoading');
    if (loading) loading.remove();
  }
};

/* ============================================================
   8. LAYOUT YÖNETİMİ
   ============================================================ */
const Layout = {
  showApp() {
    $('authScreen').style.display = 'none';
    $('appShell').classList.add('active');
    this.updatePinnedBanner();
  },

  isNearBottom() {
    const el = $('messages');
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < CONFIG.SCROLL_THRESHOLD;
  },

  scrollToBottom(smooth = false) {
    const el = $('messages');
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  },

  updatePinnedBanner() {
    const banner = $('pinnedBanner');
    const text = $('pinnedText');
    if (!banner || !text) return;

    if (AppState.pinnedMessage) {
      const m = AppState.pinnedMessage;
      const preview = m.type === 'audio' ? '🎤 Sesli mesaj' : m.message;
      text.textContent = `${m.sender_name}: ${preview}`;
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  },

  updateOnlineCount(list) {
    const badge = $('onlineCount');
    if (badge) badge.textContent = list.length;
  },

  updateHeaderStatus(list) {
    const statusEl = $('headerStatus');
    if (!statusEl) return;

    const others = list.filter(u => u.id !== AppState.me.id);
    const text = statusEl.querySelector('span:last-child');
    const dot = statusEl.querySelector('.status-dot');
    if (!text) return;

    if (others.length > 0) {
      text.textContent = others.map(u => `${u.avatar} ${u.name}`).join(', ') + ' çevrimiçi';
      if (dot) dot.classList.add('online');
    } else {
      text.textContent = 'Kimse çevrimiçi değil';
      if (dot) dot.classList.remove('online');
    }
  },

  incrementUnread() {
    if (document.hasFocus()) return;
    AppState.unreadCount++;
    this.updateTabTitle();
  },

  clearUnread() {
    AppState.unreadCount = 0;
    this.updateTabTitle();
  },

  updateTabTitle() {
    if (!AppState.tabTitleEnabled) return;
    if (AppState.unreadCount > 0) {
      document.title = `(${AppState.unreadCount}) 💕 Bizim Sohbet`;
    } else {
      document.title = AppState.originalTitle;
    }
  },

  openMobileDrawer() {
    $('mobileDrawer').classList.add('active');
    $('mobileDrawerOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  closeMobileDrawer() {
    $('mobileDrawer').classList.remove('active');
    $('mobileDrawerOverlay').classList.remove('active');
    document.body.style.overflow = '';
  }
};

/* ============================================================
   9. MESAJ RENDER
   ============================================================ */
const MessageRenderer = {
  lastDate: null,
  lastSender: null,

  renderAll(messages) {
    const container = $('messages');
    if (!container) return;
    container.innerHTML = '';
    this.lastDate = null;
    this.lastSender = null;

    if (messages.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
          <div style="font-size:64px; margin-bottom:12px;">💌</div>
          <div style="font-size:16px; font-weight:600;">Henüz mesaj yok</div>
          <div style="font-size:13px; margin-top:6px;">İlk mesajı sen gönder!</div>
        </div>
      `;
      return;
    }

    messages.forEach(m => this.append(m, false));
    Layout.scrollToBottom();
  },

  append(msg, animate = true) {
    const container = $('messages');
    if (!container) return;

    // İlk mesaj placeholder'ı sil
    const placeholder = container.querySelector('div[style*="text-align:center"]');
    if (placeholder && placeholder.textContent.includes('Henüz mesaj yok')) {
      placeholder.remove();
    }

    // Tarih ayırıcı
    if (!this.lastDate || !Utils.isSameDay(this.lastDate, msg.created_at)) {
      this.appendDateDivider(msg.created_at);
      this.lastDate = msg.created_at;
      this.lastSender = null;
    }

    const isMe = msg.sender_id === AppState.me.id;
    const showAvatar = !isMe && this.lastSender !== msg.sender_id;

    const row = this.createRow(msg, isMe, showAvatar);
    if (!animate) row.style.animation = 'none';
    container.appendChild(row);

    this.lastSender = msg.sender_id;
  },

  createRow(msg, isMe, showAvatar) {
    const row = Utils.create('div', `msg-row ${isMe ? 'me' : 'other'}`);
    row.dataset.id = msg.id;

    // Avatar
    if (!isMe) {
      const avatar = Utils.create('div', 'msg-avatar');
      avatar.textContent = msg.sender_avatar || '💙';
      if (!showAvatar) avatar.style.visibility = 'hidden';
      row.appendChild(avatar);
    }

    // Content
    const content = Utils.create('div', 'msg-content');

    // Gönderen adı (sadece karşı taraf + avatar gösteriliyorsa)
    if (!isMe && showAvatar) {
      const senderName = Utils.create('div', 'msg-sender');
      senderName.textContent = msg.sender_name;
      content.appendChild(senderName);
    }

    // Bubble
    const bubble = Utils.create('div', 'msg-bubble');

    // Pinlenen göstergesi
    if (msg.is_pinned) {
      const pinBadge = Utils.create('span', 'msg-pinned-badge', '📌 Pinlendi');
      bubble.appendChild(pinBadge);
    }

    // Reply preview
    if (msg.reply_to) {
      const replyMsg = AppState.messages.find(m => m.id === msg.reply_to);
      if (replyMsg) {
        const rp = Utils.create('div', 'msg-reply-preview');
        rp.innerHTML = `
          <div class="rp-body">
            <div class="rp-name">${Utils.escapeHtml(replyMsg.sender_name)}</div>
            <div>${Utils.escapeHtml(replyMsg.type === 'audio' ? '🎤 Sesli mesaj' : replyMsg.message.slice(0, 100))}</div>
          </div>
        `;
        bubble.appendChild(rp);
      }
    }

    // İçerik
    if (msg.type === 'audio' && msg.audio_data) {
      const player = this.createAudioPlayer(msg);
      bubble.appendChild(player);
    } else {
      const text = Utils.create('div', 'msg-text');
      text.innerHTML = Utils.linkify(msg.message || '');
      bubble.appendChild(text);
    }

    // Reaksiyonlar
    if (msg.reactions && Object.keys(msg.reactions).length > 0) {
      const reactions = this.createReactions(msg.reactions);
      bubble.appendChild(reactions);
    }

    // Meta (saat + tik)
    const meta = Utils.create('div', 'msg-meta');
    const time = Utils.create('span');
    time.textContent = Utils.formatTime(msg.created_at);
    meta.appendChild(time);

    if (isMe) {
      const check = Utils.create('span', `msg-check ${msg.is_read ? 'read' : 'sent'}`);
      check.textContent = msg.is_read ? '✓✓' : '✓';
      meta.appendChild(check);
    }

    bubble.appendChild(meta);
    content.appendChild(bubble);
    row.appendChild(content);

    // Long-press / context menu
    this.bindRowEvents(row, msg);

    return row;
  },

  createAudioPlayer(msg) {
    const player = Utils.create('div', 'audio-player');
    const waves = Utils.generateWaveform(24);

    player.innerHTML = `
      <button class="audio-play-btn" data-audio="${Utils.escapeAttr(msg.audio_data)}">▶</button>
      <div class="audio-waveform">
        ${waves.map(h => `<span style="height:${h * 100}%"></span>`).join('')}
      </div>
      <div class="audio-duration">${Utils.formatDuration(msg.duration)}</div>
    `;

    const btn = player.querySelector('.audio-play-btn');
    const waveform = player.querySelector('.audio-waveform');

    btn.addEventListener('click', () => {
      const audio = new Audio(msg.audio_data);

      // Diğer çalan sesleri durdur
      $$('.audio-play-btn').forEach(b => {
        if (b !== btn) b.textContent = '▶';
      });
      $$('.audio-waveform').forEach(w => w.classList.remove('playing'));

      if (btn.textContent === '⏸') {
        btn.textContent = '▶';
        waveform.classList.remove('playing');
        if (window._currentAudio) {
          window._currentAudio.pause();
          window._currentAudio = null;
        }
        return;
      }

      btn.textContent = '⏸';
      waveform.classList.add('playing');
      window._currentAudio = audio;

      audio.play().catch(e => {
        Toast.error('Ses çalınamadı');
        btn.textContent = '▶';
        waveform.classList.remove('playing');
      });

      audio.onended = () => {
        btn.textContent = '▶';
        waveform.classList.remove('playing');
        window._currentAudio = null;
      };
    });

    return player;
  },

  createReactions(reactions) {
    const container = Utils.create('div', 'msg-reactions');
    for (const [emoji, users] of Object.entries(reactions)) {
      if (!users || users.length === 0) continue;
      const chip = Utils.create('div', `reaction-chip ${users.includes(AppState.me.id) ? 'mine' : ''}`);
      chip.innerHTML = `${emoji} <span class="r-count">${users.length}</span>`;
      container.appendChild(chip);
    }
    return container;
  },

  appendDateDivider(dateStr) {
    const container = $('messages');
    if (!container) return;
    const div = Utils.create('div', 'date-divider');
    div.innerHTML = `<span>${Utils.formatDate(dateStr)}</span>`;
    container.appendChild(div);
  },

  appendSystem(text) {
    const container = $('messages');
    if (!container) return;
    const div = Utils.create('div', 'system-msg');
    div.innerHTML = `<span>${Utils.escapeHtml(text)}</span>`;
    container.appendChild(div);
    if (Layout.isNearBottom()) Layout.scrollToBottom(true);
  },

  remove(id) {
    const el = document.querySelector(`.msg-row[data-id="${id}"]`);
    if (el) {
      el.style.transition = 'opacity 0.3s, transform 0.3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(40px)';
      setTimeout(() => el.remove(), 300);
    }
  },

  updatePin(id, pinned) {
    const el = document.querySelector(`.msg-row[data-id="${id}"] .msg-bubble`);
    if (!el) return;
    const existing = el.querySelector('.msg-pinned-badge');
    if (pinned && !existing) {
      const badge = Utils.create('span', 'msg-pinned-badge', '📌 Pinlendi');
      el.insertBefore(badge, el.firstChild);
    } else if (!pinned && existing) {
      existing.remove();
    }
  },

  updateReactions(id, reactions) {
    const bubble = document.querySelector(`.msg-row[data-id="${id}"] .msg-bubble`);
    if (!bubble) return;
    const old = bubble.querySelector('.msg-reactions');
    if (old) old.remove();
    if (Object.keys(reactions).length > 0) {
      const r = this.createReactions(reactions);
      const meta = bubble.querySelector('.msg-meta');
      if (meta) bubble.insertBefore(r, meta);
      else bubble.appendChild(r);
    }
  },

  bindRowEvents(row, msg) {
    let longPressTimer = null;

    const startLongPress = () => {
      longPressTimer = setTimeout(() => {
        Utils.vibrate(20);
        ContextMenu.show(row, msg);
      }, CONFIG.LONG_PRESS_DURATION);
    };

    const cancelLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    row.addEventListener('touchstart', startLongPress, { passive: true });
    row.addEventListener('touchend', cancelLongPress);
    row.addEventListener('touchmove', cancelLongPress);
    row.addEventListener('touchcancel', cancelLongPress);

    row.addEventListener('mousedown', (e) => {
      if (e.button === 0 && e.detail === 1) startLongPress();
    });
    row.addEventListener('mouseup', cancelLongPress);
    row.addEventListener('mouseleave', cancelLongPress);

    // Sağ tık
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      ContextMenu.show(row, msg, { x: e.clientX, y: e.clientY });
    });

    // Çift tık → hızlı reaksiyon (❤️)
    row.addEventListener('dblclick', () => {
      AppState.socket.emit('react-message', { id: msg.id, emoji: '❤️' });
    });
  }
};

/* ============================================================
   10. MESAJ GÖNDERME
   ============================================================ */
const Messenger = {
  sendText(text) {
    if (!text || !text.trim()) return;

    const cleanText = text.trim().slice(0, CONFIG.MAX_MESSAGE_LENGTH);

    AppState.socket.emit('send-message', {
      text: cleanText,
      type: 'text',
      replyTo: AppState.replyTo ? AppState.replyTo.id : null
    });

    this.clearInput();
    this.clearReply();
    this.stopTyping();
  },

  sendAudio(audioData, duration) {
    AppState.socket.emit('send-message', {
      text: '[Sesli mesaj]',
      type: 'audio',
      duration,
      audioData,
      replyTo: AppState.replyTo ? AppState.replyTo.id : null
    });
    this.clearReply();
  },

  clearInput() {
    const input = $('messageInput');
    if (input) input.value = '';
  },

  setReply(msg) {
    AppState.replyTo = msg;
    const preview = $('replyPreview');
    const name = $('replyName');
    const text = $('replyText');
    if (!preview) return;

    if (name) name.textContent = msg.sender_name;
    if (text) text.textContent = msg.type === 'audio' ? '🎤 Sesli mesaj' : msg.message.slice(0, 80);
    preview.hidden = false;

    const input = $('messageInput');
    if (input) input.focus();
  },

  clearReply() {
    AppState.replyTo = null;
    const preview = $('replyPreview');
    if (preview) preview.hidden = true;
  },

  startTyping() {
    if (AppState.isTyping) return;
    AppState.isTyping = true;
    AppState.socket.emit('typing');

    clearTimeout(AppState.typingTimer);
    AppState.typingTimer = setTimeout(() => this.stopTyping(), CONFIG.TYPING_TIMEOUT);
  },

  stopTyping() {
    if (!AppState.isTyping) return;
    AppState.isTyping = false;
    AppState.socket.emit('typing-stop');
  }
};

/* ============================================================
   11. SES KAYIT (MediaRecorder)
   ============================================================ */
const AudioRecorder = {
  mediaRecorder: null,
  chunks: [],
  stream: null,
  startTime: 0,
  timerInterval: null,
  waveInterval: null,

  async start() {
    if (AppState.isRecording) {
      this.stop();
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      const mimeType = this.pickMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.chunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => this.handleStop();

      this.mediaRecorder.start();
      AppState.isRecording = true;
      AppState.recordingStartTime = this.startTime;

      this.showOverlay();
      this.startTimer();

      Utils.vibrate(30);

    } catch (e) {
      console.error('Ses kayıt hatası:', e);
      if (e.name === 'NotAllowedError') {
        Toast.error('Mikrofon izni gerekli');
      } else {
        Toast.error('Ses kaydı başlatılamadı');
      }
    }
  },

  pickMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  },

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    AppState.isRecording = false;
  },

  handleStop() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    this.stopTimer();
    this.hideOverlay();

    if (duration < 1) {
      Toast.warning('Ses çok kısa');
      return;
    }

    if (duration > CONFIG.MAX_AUDIO_DURATION) {
      Toast.warning(`Ses çok uzun (max ${CONFIG.MAX_AUDIO_DURATION}sn)`);
      return;
    }

    const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
    const reader = new FileReader();

    reader.onloadend = () => {
      const base64 = reader.result;
      Messenger.sendAudio(base64, duration);
      Toast.success('Ses gönderildi 🎤');
    };

    reader.readAsDataURL(blob);
  },

  startTimer() {
    const timeEl = $('recordingTime');
    this.timerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - this.startTime) / 1000);
      if (timeEl) timeEl.textContent = Utils.formatDuration(sec);

      if (sec >= CONFIG.MAX_AUDIO_DURATION) {
        this.stop();
      }
    }, 200);

    // Wave animasyonu
    const waveEl = $('recordingWave');
    if (waveEl) {
      waveEl.innerHTML = '';
      for (let i = 0; i < 24; i++) {
        const bar = document.createElement('span');
        bar.style.animationDelay = `${i * 0.05}s`;
        waveEl.appendChild(bar);
      }
    }
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  showOverlay() {
    const el = $('recordingOverlay');
    if (el) el.hidden = false;
    const composer = document.querySelector('.composer');
    if (composer) composer.classList.add('recording');
    const icon = $('micIcon');
    if (icon) icon.textContent = '⏹';
  },

  hideOverlay() {
    const el = $('recordingOverlay');
    if (el) el.hidden = true;
    const composer = document.querySelector('.composer');
    if (composer) composer.classList.remove('recording');
    const icon = $('micIcon');
    if (icon) icon.textContent = '🎤';
    const timeEl = $('recordingTime');
    if (timeEl) timeEl.textContent = '0:00';
  }
};

/* ============================================================
   12. EMOJİ PANELİ
   ============================================================ */
const EmojiPanel = {
  currentCategory: 'all',

  init() {
    this.render('all');
    this.bindTabs();
  },

  bindTabs() {
    $$('.emoji-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.emoji-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentCategory = tab.dataset.cat;
        this.render(this.currentCategory);
      });
    });
  },

  render(category) {
    const grid = $('emojiGrid');
    if (!grid) return;

    let emojis = [];
    if (category === 'all') {
      for (const list of Object.values(EMOJI_DATA)) {
        emojis = emojis.concat(list);
      }
    } else {
      emojis = EMOJI_DATA[category] || [];
    }

    grid.innerHTML = emojis.map(e =>
      `<button type="button" class="emoji-btn-item" data-emoji="${e}">${e}</button>`
    ).join('');

    grid.querySelectorAll('.emoji-btn-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = $('messageInput');
        if (!input) return;
        input.value += btn.dataset.emoji;
        input.focus();
        Messenger.startTyping();
      });
    });
  },

  toggle() {
    const panel = $('emojiPanel');
    if (!panel) return;
    const isHidden = panel.hidden;
    panel.hidden = !isHidden;
    $('emojiBtn').classList.toggle('active', isHidden);

    if (isHidden) {
      Layout.scrollToBottom(true);
    }
  },

  hide() {
    const panel = $('emojiPanel');
    if (panel) panel.hidden = true;
    const btn = $('emojiBtn');
    if (btn) btn.classList.remove('active');
  }
};

/* ============================================================
   13. PROFİL DÜZENLEME
   ============================================================ */
const Profile = {
  selectedAvatar: '💙',

  initAvatars() {
    const avatars = [
      '💙','💕','💖','❤️','💘','💝','😍','🥰','😘','🌹',
      '🌸','🌺','⭐','✨','🌈','☀️','🌙','🦋','🐱','🐶',
      '🐼','🦊','🐰','🦁','🐯','🐨','🐸','🐵','🦄','🐝',
      '🐞','👑','🎀','💎','🍀','💐','🌷','🌻','🌼','🔥'
    ];
    const grid = $('avatarOptions');
    if (!grid) return;

    grid.innerHTML = avatars.map(a =>
      `<button type="button" class="avatar-opt" data-avatar="${a}">${a}</button>`
    ).join('');

    grid.querySelectorAll('.avatar-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedAvatar = btn.dataset.avatar;
        const preview = $('avatarPreview');
        if (preview) preview.textContent = this.selectedAvatar;
      });
    });
  },

  updateUI() {
    if (!AppState.me) return;
    const u = AppState.me;

    ['headerAvatar', 'sidebarAvatar', 'drawerAvatar'].forEach(id => {
      const el = $(id);
      if (el) el.textContent = u.avatar;
    });

    const name = $('sidebarName');
    if (name) name.textContent = u.name;

    const drawerName = $('drawerName');
    if (drawerName) drawerName.textContent = u.name;

    const status = $('sidebarStatus');
    if (status) {
      status.querySelector('.status-text').textContent = u.status || 'Hayat güzel';
    }

    const drawerStatus = $('drawerStatus');
    if (drawerStatus) drawerStatus.textContent = u.status || 'Hayat güzel';

    const menuAvatar = $('menuAvatar');
    if (menuAvatar) menuAvatar.textContent = u.avatar;
  },

  openModal() {
    if (!AppState.me) return;
    this.selectedAvatar = AppState.me.avatar;

    const preview = $('avatarPreview');
    if (preview) preview.textContent = this.selectedAvatar;

    const nameInput = $('profileName');
    if (nameInput) nameInput.value = AppState.me.name || '';

    const statusInput = $('profileStatus');
    if (statusInput) statusInput.value = AppState.me.status || '';

    const bioInput = $('profileBio');
    if (bioInput) bioInput.value = AppState.me.bio || '';

    $$('.avatar-opt').forEach(b => {
      b.classList.toggle('selected', b.dataset.avatar === this.selectedAvatar);
    });

    const modal = $('profileModal');
    if (modal) modal.hidden = false;

    // Mobil drawer'ı kapat
    Layout.closeMobileDrawer();
  },

  closeModal() {
    const modal = $('profileModal');
    if (modal) modal.hidden = true;
  },

  async save() {
    const name = ($('profileName').value || '').trim();
    const status = ($('profileStatus').value || '').trim();
    const bio = ($('profileBio').value || '').trim();

    if (!name) {
      Toast.error('İsim gerekli');
      return;
    }

    AppState.socket.emit('update-profile', {
      name,
      avatar: this.selectedAvatar,
      status,
      bio
    });

    Toast.success('Profil güncellendi');
    this.closeModal();
  }
};

/* ============================================================
   14. AYARLAR
   ============================================================ */
const Settings = {
  init() {
    // Yükle
    AppState.soundEnabled = Storage.get(Storage.KEY_SOUND) !== 'off';
    AppState.notifEnabled = Storage.get(Storage.KEY_NOTIF) !== 'off';
    AppState.tabTitleEnabled = Storage.get(Storage.KEY_TAB_TITLE) !== 'off';

    const sound = $('soundToggle');
    if (sound) sound.checked = AppState.soundEnabled;
    const notif = $('notifToggle');
    if (notif) notif.checked = AppState.notifEnabled;
    const tabTitle = $('tabTitleToggle');
    if (tabTitle) tabTitle.checked = AppState.tabTitleEnabled;

    const theme = $('themeSelect');
    if (theme) theme.value = AppState.currentTheme;
    const wp = $('wallpaperSelect');
    if (wp) wp.value = AppState.currentWallpaper;

    // Info
    const v = $('infoVersion');
    if (v) v.textContent = `v${CONFIG.VERSION}`;
    const msgCount = $('infoMessages');
    if (msgCount) msgCount.textContent = AppState.messages.length;
  },

  open() {
    this.init();
    const modal = $('settingsModal');
    if (modal) modal.hidden = false;
    Layout.closeMobileDrawer();
  },

  close() {
    const modal = $('settingsModal');
    if (modal) modal.hidden = true;
  },

  save() {
    const sound = $('soundToggle');
    const notif = $('notifToggle');
    const tabTitle = $('tabTitleToggle');
    const theme = $('themeSelect');
    const wp = $('wallpaperSelect');

    AppState.soundEnabled = sound ? sound.checked : true;
    AppState.notifEnabled = notif ? notif.checked : true;
    AppState.tabTitleEnabled = tabTitle ? tabTitle.checked : true;

    Storage.set(Storage.KEY_SOUND, AppState.soundEnabled ? 'on' : 'off');
    Storage.set(Storage.KEY_NOTIF, AppState.notifEnabled ? 'on' : 'off');
    Storage.set(Storage.KEY_TAB_TITLE, AppState.tabTitleEnabled ? 'on' : 'off');

    if (theme) Theme.set(theme.value);
    if (wp) Theme.setWallpaper(wp.value);

    // Bildirim izni
    if (AppState.notifEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    this.close();
    Toast.success('Ayarlar kaydedildi');
  }
};

/* ============================================================
   15. TEMA YÖNETİMİ
   ============================================================ */
const Theme = {
  init() {
    const saved = Storage.get(Storage.KEY_THEME) || 'auto';
    const wp = Storage.get(Storage.KEY_WALLPAPER) || 'default';
    this.set(saved, false);
    this.setWallpaper(wp, false);
  },

  set(theme, save = true) {
    AppState.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (save) {
      Storage.set(Storage.KEY_THEME, theme);
      if (AppState.socket && AppState.socket.connected) {
        AppState.socket.emit('update-profile', {
          ...AppState.me,
          theme
        });
      }
    }
    const sel = $('themeSelect');
    if (sel) sel.value = theme;
  },

  toggle() {
    const order = ['auto', 'light', 'dark'];
    const idx = order.indexOf(AppState.currentTheme);
    const next = order[(idx + 1) % order.length];
    this.set(next);
    const names = { auto: 'Otomatik', light: 'Açık', dark: 'Koyu' };
    Toast.info(`Tema: ${names[next]}`);
  },

  setWallpaper(wp, save = true) {
    AppState.currentWallpaper = wp;
    const chatMain = $('chatMain');
    if (chatMain) {
      chatMain.setAttribute('data-wallpaper', wp);
    }
    if (save) {
      Storage.set(Storage.KEY_WALLPAPER, wp);
    }
    const sel = $('wallpaperSelect');
    if (sel) sel.value = wp;
  }
};

/* ============================================================
   16. ARAMA
   ============================================================ */
const Search = {
  open() {
    const bar = $('searchBar');
    if (bar) {
      bar.hidden = false;
      const input = $('searchInput');
      if (input) {
        input.focus();
        input.value = '';
      }
    }
  },

  close() {
    const bar = $('searchBar');
    if (bar) bar.hidden = true;
    this.clear();
  },

  clear() {
    AppState.searchQuery = '';
    $$('.msg-row').forEach(r => {
      r.style.display = '';
      r.classList.remove('highlight');
    });
    const input = $('searchInput');
    if (input) input.value = '';
    const sidebarInput = $('sidebarSearchInput');
    if (sidebarInput) sidebarInput.value = '';
  },

  perform(query) {
    AppState.searchQuery = query.toLowerCase().trim();

    if (!AppState.searchQuery) {
      this.clear();
      return;
    }

    let matchCount = 0;
    $$('.msg-row').forEach(row => {
      const text = (row.textContent || '').toLowerCase();
      const matches = text.includes(AppState.searchQuery);
      row.style.display = matches ? '' : 'none';
      row.classList.toggle('highlight', matches);
      if (matches) matchCount++;
    });

    if (matchCount > 0) {
      const first = document.querySelector('.msg-row.highlight');
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
};

/* ============================================================
   17. CONTEXT MENU
   ============================================================ */
const ContextMenu = {
  currentMsg: null,
  currentRow: null,

  show(row, msg, position) {
    this.currentMsg = msg;
    this.currentRow = row;

    const menu = $('contextMenu');
    if (!menu) return;

    // Sil butonunu kendi mesajımız değilse gizle
    const deleteBtn = menu.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.style.display = (msg.sender_id === AppState.me.id || AppState.isAdmin) ? 'flex' : 'none';
    }

    // Pin label
    const pinBtn = menu.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.querySelector('span:last-child').textContent = msg.is_pinned ? 'Pini Kaldır' : 'Pinle';
    }

    menu.hidden = false;

    // Konumlandır
    const menuRect = menu.getBoundingClientRect();
    let x, y;

    if (position) {
      x = position.x;
      y = position.y;
    } else {
      const rowRect = row.getBoundingClientRect();
      x = rowRect.left + rowRect.width / 2 - menuRect.width / 2;
      y = rowRect.top - menuRect.height - 8;
    }

    // Ekran dışına taşmasın
    x = Math.max(8, Math.min(x, window.innerWidth - menuRect.width - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - menuRect.height - 8));

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  },

  hide() {
    const menu = $('contextMenu');
    if (menu) menu.hidden = true;
    this.currentMsg = null;
    this.currentRow = null;
  },

  handle(action) {
    const msg = this.currentMsg;
    if (!msg) return;

    switch (action) {
      case 'reply':
        Messenger.setReply(msg);
        Toast.info('Yanıtlanıyor');
        break;

      case 'pin':
        AppState.socket.emit('pin-message', {
          id: msg.id,
          pinned: !msg.is_pinned
        });
        Toast.success(msg.is_pinned ? 'Pin kaldırıldı' : 'Pinlendi');
        break;

      case 'copy':
        navigator.clipboard.writeText(msg.message || '').then(() => {
          Toast.success('Kopyalandı');
        }).catch(() => {
          Toast.error('Kopyalanamadı');
        });
        break;

      case 'delete':
        if (confirm('Bu mesajı silmek istediğinden emin misin?')) {
          AppState.socket.emit('delete-message', { id: msg.id });
        }
        break;
    }

    this.hide();
  }
};

/* ============================================================
   18. YAZIYOR GÖSTERGESİ
   ============================================================ */
const Typing = {
  timer: null,

  show(name) {
    const el = $('typingIndicator');
    const text = $('typingText');
    if (!el || !text) return;

    text.textContent = `${name} yazıyor`;
    el.classList.add('active');

    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), CONFIG.TYPING_DISPLAY_TIMEOUT);
  },

  hide() {
    const el = $('typingIndicator');
    if (el) el.classList.remove('active');
  }
};

/* ============================================================
   19. BİLDİRİM SESİ + BROWSER NOTIFICATION
   ============================================================ */
const Sound = {
  ctx: null,

  play() {
    if (!AppState.soundEnabled) return;

    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = this.ctx;
      const now = ctx.currentTime;

      // İki tonlu ding
      [880, 1175].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.3);
      });
    } catch (e) {
      // Sessizce yut
    }
  }
};

const Notifier = {
  show(msg) {
    if (!AppState.notifEnabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.hasFocus()) return;

    try {
      const body = msg.type === 'audio' ? '🎤 Sesli mesaj' : (msg.message || '').slice(0, 120);
      const notif = new Notification(`${msg.sender_avatar || '💬'} ${msg.sender_name}`, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        tag: 'chat-msg',
        renotify: true,
        vibrate: [100, 50, 100]
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {}
  },

  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
};

/* ============================================================
   20. ONLINE LİSTE
   ============================================================ */
const OnlineList = {
  render(list) {
    const el = $('onlineList');
    if (!el) return;

    const others = list.filter(u => u.id !== AppState.me.id);

    if (others.length === 0) {
      el.innerHTML = `
        <div style="padding:14px;text-align:center;font-size:12px;color:var(--text-muted);">
          Şu an yalnızsın 💫
        </div>
      `;
      return;
    }

    el.innerHTML = others.map(u => `
      <div class="online-item" data-user-id="${u.id}">
        <div class="online-avatar">${Utils.escapeHtml(u.avatar || '💙')}</div>
        <div class="online-info">
          <div class="online-name">${Utils.escapeHtml(u.name)}</div>
          <div class="online-sub">çevrimiçi</div>
        </div>
      </div>
    `).join('');
  },

  updateUser(user) {
    const el = document.querySelector(`.online-item[data-user-id="${user.id}"]`);
    if (!el) return;
    const avatar = el.querySelector('.online-avatar');
    const name = el.querySelector('.online-name');
    if (avatar) avatar.textContent = user.avatar;
    if (name) name.textContent = user.name;
  }
};

/* ============================================================
   21. PINLENEN MESAJLAR
   ============================================================ */
const PinnedMessages = {
  render(list) {
    const section = $('pinnedSection');
    const container = $('pinnedList');
    if (!section || !container) return;

    if (!list || list.length === 0) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    container.innerHTML = list.slice(0, 5).map(m => {
      const preview = m.type === 'audio' ? '🎤 Sesli mesaj' : m.message.slice(0, 50);
      return `
        <div class="pinned-item" data-msg-id="${m.id}">
          <div class="pinned-author">${Utils.escapeHtml(m.sender_name)}</div>
          <div class="pinned-preview">${Utils.escapeHtml(preview)}</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.pinned-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.msgId);
        const row = document.querySelector(`.msg-row[data-id="${id}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.style.animation = 'none';
          row.offsetHeight;
          row.style.animation = '';
          row.classList.add('highlight');
          setTimeout(() => row.classList.remove('highlight'), 2000);
        }
      });
    });
  }
};

/* ============================================================
   22. KLAVYE KISAYOLLARI
   ============================================================ */
const Keyboard = {
  init() {
    document.addEventListener('keydown', (e) => {
      // ESC → modalları kapat
      if (e.key === 'Escape') {
        ContextMenu.hide();
        EmojiPanel.hide();
        Search.close();
        Profile.closeModal();
        Settings.close();
        Layout.closeMobileDrawer();
        Messenger.clearReply();
      }

      // Ctrl/Cmd + F → arama
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        Search.open();
      }

      // Ctrl/Cmd + K → arama
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        Search.open();
      }
    });
  }
};

/* ============================================================
   23. EVENT LISTENERS
   ============================================================ */
const Events = {
  bindAll() {
    this.bindLogin();
    this.bindComposer();
    this.bindSidebar();
    this.bindHeader();
    this.bindMobileDrawer();
    this.bindModals();
    this.bindContextMenu();
    this.bindMisc();
  },

  bindLogin() {
    const form = $('loginForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = $('loginCode');
        const btn = $('loginBtn');
        const err = $('loginError');
        const code = (input.value || '').trim();

        if (err) err.textContent = '';

        if (code.length < 4) {
          if (err) err.textContent = 'En az 4 karakter gerekli';
          return;
        }

        btn.disabled = true;
        btn.classList.add('loading');

        const res = await Auth.login(code);

        btn.disabled = false;
        btn.classList.remove('loading');

        if (!res.success) {
          if (err) err.textContent = res.error;
          Utils.vibrate([50, 30, 50]);
        } else {
          // Socket girişi zaten Auth.login sonrası otomatik
          if (AppState.socket) {
            AppState.socket.emit('login', { token: AppState.sessionToken });
          }
        }
      });
    }

    const input = $('loginCode');
    if (input) {
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
      });
    }
  },

  bindComposer() {
    const form = $('messageForm');
    const input = $('messageInput');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        Messenger.sendText(input.value);
      });
    }

    if (input) {
      input.addEventListener('input', () => {
        Messenger.startTyping();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          Messenger.sendText(input.value);
        }
      });
    }

    const emojiBtn = $('emojiBtn');
    if (emojiBtn) emojiBtn.addEventListener('click', () => EmojiPanel.toggle());

    const micBtn = $('micBtn');
    if (micBtn) micBtn.addEventListener('click', () => AudioRecorder.start());

    const replyClose = $('replyClose');
    if (replyClose) replyClose.addEventListener('click', () => Messenger.clearReply());
  },

  bindSidebar() {
    const editBtn = $('sidebarEditBtn');
    if (editBtn) editBtn.addEventListener('click', () => Profile.openModal());

    const profileCard = $('sidebarProfile');
    if (profileCard) profileCard.addEventListener('click', (e) => {
      if (e.target.closest('.profile-edit-btn')) return;
      Profile.openModal();
    });

    const themeBtn = $('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => Theme.toggle());

    const settingsBtn = $('settingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => Settings.open());

    const logoutBtn = $('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      if (confirm('Çıkış yapmak istediğine emin misin?')) Auth.logout();
    });

    const searchInput = $('sidebarSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        Search.perform(e.target.value);
        const clearBtn = $('sidebarSearchClear');
        if (clearBtn) clearBtn.hidden = !e.target.value;
      }, 200));
    }

    const searchClear = $('sidebarSearchClear');
    if (searchClear) {
      searchClear.addEventListener('click', () => {
        Search.clear();
        searchClear.hidden = true;
      });
    }
  },

  bindHeader() {
    const menuBtn = $('headerMenuBtn');
    if (menuBtn) menuBtn.addEventListener('click', () => Layout.openMobileDrawer());

    const searchBtn = $('searchToggleBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const bar = $('searchBar');
        if (bar && bar.hidden) Search.open();
        else Search.close();
      });
    }

    const closeSearch = $('closeSearchBtn');
    if (closeSearch) closeSearch.addEventListener('click', () => Search.close());

    const searchInput = $('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        Search.perform(e.target.value);
      }, 150));
    }

    const moreBtn = $('headerMoreBtn');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        Toast.info('Menü için sol taraftaki ☰ butonunu kullan');
      });
    }

    const unpinBtn = $('unpinBtn');
    if (unpinBtn) {
      unpinBtn.addEventListener('click', () => {
        if (AppState.pinnedMessage) {
          AppState.socket.emit('pin-message', {
            id: AppState.pinnedMessage.id,
            pinned: false
          });
        }
      });
    }
  },

  bindMobileDrawer() {
    const close = $('drawerClose');
    if (close) close.addEventListener('click', () => Layout.closeMobileDrawer());

    const overlay = $('mobileDrawerOverlay');
    if (overlay) overlay.addEventListener('click', () => Layout.closeMobileDrawer());

    const editBtn = $('mEditProfileBtn');
    if (editBtn) editBtn.addEventListener('click', () => Profile.openModal());

    const themeBtn = $('mThemeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      Theme.toggle();
      Layout.closeMobileDrawer();
    });

    const settingsBtn = $('mSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => Settings.open());

    const logoutBtn = $('mLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      if (confirm('Çıkış yapmak istediğine emin misin?')) Auth.logout();
    });
  },

  bindModals() {
    const profileClose = $('profileModalClose');
    if (profileClose) profileClose.addEventListener('click', () => Profile.closeModal());
    const profileCancel = $('profileCancel');
    if (profileCancel) profileCancel.addEventListener('click', () => Profile.closeModal());
    const profileSave = $('profileSave');
    if (profileSave) profileSave.addEventListener('click', () => Profile.save());

    const profileModal = $('profileModal');
    if (profileModal) {
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) Profile.closeModal();
      });
    }

    const settingsClose = $('settingsModalClose');
    if (settingsClose) settingsClose.addEventListener('click', () => Settings.close());
    const settingsSave = $('settingsSave');
    if (settingsSave) settingsSave.addEventListener('click', () => Settings.save());

    const settingsModal = $('settingsModal');
    if (settingsModal) {
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) Settings.close();
      });
    }
  },

  bindContextMenu() {
    const menu = $('contextMenu');
    if (!menu) return;

    menu.querySelectorAll('.context-item').forEach(item => {
      item.addEventListener('click', () => {
        ContextMenu.handle(item.dataset.action);
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) ContextMenu.hide();
    });

    document.addEventListener('scroll', () => ContextMenu.hide(), true);
  },

  bindMisc() {
    // Sayfa görünür olduğunda okundu işaretle
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        Layout.clearUnread();
        if (AppState.socket && AppState.socket.connected) {
          AppState.socket.emit('mark-read');
        }
      }
    });

    window.addEventListener('focus', () => {
      Layout.clearUnread();
      if (AppState.socket && AppState.socket.connected) {
        AppState.socket.emit('mark-read');
      }
    });

    // Online/offline
    window.addEventListener('online', () => {
      Toast.success('Bağlantı yeniden kuruldu');
    });

    window.addEventListener('offline', () => {
      Toast.warning('İnternet bağlantısı koptu');
    });

    // Klavye kısayolları
    Keyboard.init();

    // Visual viewport (mobil klavye açıldığında)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        if (Layout.isNearBottom()) Layout.scrollToBottom();
      });
    }
  }
};

/* ============================================================
   23. BAŞLAT
   ============================================================ */
async function init() {
  console.log(`%c💕 Bizim Sohbet v${CONFIG.VERSION}`, 
    'color:#ec4899;font-size:16px;font-weight:bold;');

  // Tema
  Theme.init();

  // Ayarlar
  Settings.init();

  // Avatarları hazırla
  Profile.initAvatars();

  // Emoji paneli
  EmojiPanel.init();

  // Event listeners
  Events.bindAll();

  // Bildirim izni
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      Notifier.requestPermission();
    }, 3000);
  }

  // Socket bağlan
  SocketManager.init();

  // Otomatik giriş
  const auto = Auth.autoLogin();
  if (auto) {
    console.log('🔄 Otomatik giriş yapılıyor...');
  }
}

// DOM hazır olduğunda başlat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}