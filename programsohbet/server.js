/* ============================================================
 *  BIZIM SOHBET — Profesyonel Backend v3.0.1
 *  ------------------------------------------------------------
 *  İki kişilik özel sohbet uygulaması
 *  - Socket.IO gerçek zamanlı
 *  - SQLite kalıcı veri
 *  - Admin panel + environment variable şifre
 * ============================================================ */

'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// ============================================================
//  SABİTLER
// ============================================================
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'sohbet.db');
const VERSION = '3.0.1';

// ⚠️ ADMIN ŞİFRESİ - Render'da Environment Variable ile değiştirilebilir
const ADMIN_PASSWORD = process.env.ADMIN_PASS || '999999';

const CONFIG = {
  MAX_MESSAGE_LENGTH: 4000,
  MAX_AUDIO_SIZE: 5 * 1024 * 1024,
  MAX_MESSAGES_HISTORY: 500,
  MAX_MESSAGES_ADMIN: 2000,
  RATE_LIMIT_WINDOW: 1000,
  RATE_LIMIT_MAX: 10,
  SESSION_TIMEOUT: 30 * 24 * 60 * 60 * 1000,
  AUDIO_MAX_DURATION: 120,
  EMOJI_LIST: ['❤️','😍','😂','😮','😢','👍','🔥','💕','🥰','😘']
};

// ============================================================
//  LOGGER
// ============================================================
const logger = {
  _format(level, msg, meta) {
    const ts = new Date().toISOString();
    const icon = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅' }[level] || '📝';
    let line = `[${ts}] ${icon} [${level.toUpperCase()}] ${msg}`;
    if (meta) line += ' ' + JSON.stringify(meta);
    return line;
  },
  info(m, meta) { console.log(this._format('info', m, meta)); },
  warn(m, meta) { console.warn(this._format('warn', m, meta)); },
  error(m, meta) { console.error(this._format('error', m, meta)); },
  success(m, meta) { console.log(this._format('success', m, meta)); }
};

// ============================================================
//  VERİTABANI
// ============================================================
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    code          TEXT    UNIQUE NOT NULL,
    name          TEXT    NOT NULL,
    avatar        TEXT    DEFAULT '💙',
    status        TEXT    DEFAULT 'Hayat güzel',
    bio           TEXT    DEFAULT '',
    theme         TEXT    DEFAULT 'auto',
    wallpaper     TEXT    DEFAULT 'default',
    is_admin      INTEGER DEFAULT 0,
    is_banned     INTEGER DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen     DATETIME,
    last_ip       TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id     INTEGER NOT NULL,
    message       TEXT    NOT NULL,
    type          TEXT    DEFAULT 'text',
    duration      INTEGER DEFAULT 0,
    audio_data    TEXT,
    reply_to      INTEGER,
    is_pinned     INTEGER DEFAULT 0,
    is_deleted    INTEGER DEFAULT 0,
    is_read       INTEGER DEFAULT 0,
    reactions     TEXT    DEFAULT '{}',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key           TEXT PRIMARY KEY,
    value         TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token         TEXT PRIMARY KEY,
    user_id       INTEGER NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at    DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

logger.success('Tablolar hazır');

// ============================================================
//  VARSAYILAN VERİLER
// ============================================================

// Admin kullanıcı (is_admin=1)
const adminUser = db.prepare('SELECT * FROM users WHERE is_admin = 1').get();
if (!adminUser) {
  db.prepare('INSERT INTO users (code, name, avatar, status, is_admin) VALUES (?, ?, ?, ?, 1)')
    .run('999999', 'Admin', '👑', 'Sistem Yöneticisi');
  logger.success('Admin oluşturuldu');
}

// Admin şifresi - HER BAŞLANGIÇTA ZORLA GÜNCELLE
db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  .run('admin_pass', ADMIN_PASSWORD);
logger.success('Admin şifresi ayarlandı: ' + ADMIN_PASSWORD);

// Varsayılan kullanıcılar (sadece hiç yoksa)
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 0').get().c;
if (userCount === 0) {
  db.prepare('INSERT INTO users (code, name, avatar, status) VALUES (?, ?, ?, ?)')
    .run('1111', 'Ben', '💙', 'Kod yazıyorum');
  db.prepare('INSERT INTO users (code, name, avatar, status) VALUES (?, ?, ?, ?)')
    .run('2222', 'Aşkım', '💕', 'Seni düşünüyorum');
  logger.success('Varsayılan kullanıcılar: 1111, 2222');
}

// ============================================================
//  YARDIMCI FONKSİYONLAR
// ============================================================
const Utils = {
  sanitize(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').trim().slice(0, CONFIG.MAX_MESSAGE_LENGTH);
  },
  sanitizeName(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[<>"'&]/g, '').trim().slice(0, 20);
  },
  isValidCode(code) {
    if (typeof code !== 'string') return false;
    return /^\d{4,8}$/.test(code);
  },
  isValidAdminPass(code) {
    if (typeof code !== 'string') return false;
    return /^[a-zA-Z0-9]{4,16}$/.test(code);
  },
  isValidAvatar(avatar) {
    return typeof avatar === 'string' && avatar.length > 0 && avatar.length <= 8;
  },
  formatMessage(m) {
    if (!m) return null;
    return {
      id: m.id,
      sender_id: m.sender_id,
      sender_name: m.sender_name,
      sender_avatar: m.sender_avatar,
      message: m.message,
      type: m.type,
      duration: m.duration,
      audio_data: m.audio_data,
      reply_to: m.reply_to,
      is_pinned: m.is_pinned === 1,
      is_read: m.is_read === 1,
      reactions: (() => { try { return JSON.parse(m.reactions || '{}'); } catch { return {}; } })(),
      created_at: m.created_at
    };
  },
  formatUserPublic(u) {
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      status: u.status,
      bio: u.bio,
      theme: u.theme,
      wallpaper: u.wallpaper,
      is_admin: u.is_admin === 1
    };
  },
  formatUser(u) {
    if (!u) return null;
    return {
      id: u.id,
      code: u.code,
      name: u.name,
      avatar: u.avatar,
      status: u.status,
      bio: u.bio,
      is_admin: u.is_admin === 1,
      is_banned: u.is_banned === 1,
      created_at: u.created_at,
      last_seen: u.last_seen
    };
  }
};

// ============================================================
//  RATE LIMITER
// ============================================================
class RateLimiter {
  constructor(windowMs, max) {
    this.windowMs = windowMs;
    this.max = max;
    this.hits = new Map();
    setInterval(() => this._clean(), 60000);
  }
  check(key) {
    const now = Date.now();
    const arr = (this.hits.get(key) || []).filter(t => now - t < this.windowMs);
    if (arr.length >= this.max) return false;
    arr.push(now);
    this.hits.set(key, arr);
    return true;
  }
  _clean() {
    const now = Date.now();
    for (const [k, arr] of this.hits.entries()) {
      const f = arr.filter(t => now - t < this.windowMs);
      if (f.length === 0) this.hits.delete(k);
      else this.hits.set(k, f);
    }
  }
}

const rateLimiter = new RateLimiter(CONFIG.RATE_LIMIT_WINDOW, CONFIG.RATE_LIMIT_MAX);

// ============================================================
//  EXPRESS + SOCKET.IO
// ============================================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: CONFIG.MAX_AUDIO_SIZE,
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token, X-Session-Token');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============================================================
//  API ROTALARI
// ============================================================

// ---- SAĞLIK ----
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: VERSION,
    uptime: process.uptime(),
    online: onlineUsers.size,
    messages: db.prepare('SELECT COUNT(*) AS c FROM messages WHERE is_deleted = 0').get().c
  });
});

// ---- GİRİŞ ----
app.post('/api/login', (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Şifre gerekli' });

    // Admin girişi (harf/rakam karışık olabilir)
    if (Utils.isValidAdminPass(code) && code === ADMIN_PASSWORD) {
      const admin = db.prepare('SELECT * FROM users WHERE is_admin = 1').get();
      const token = require('crypto').randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + CONFIG.SESSION_TIMEOUT).toISOString();
      db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, admin.id, expires);
      
      logger.info('Admin girişi', { ip: req.ip });
      return res.json({
        success: true,
        isAdmin: true,
        token,
        user: Utils.formatUserPublic(admin)
      });
    }

    // Normal kullanıcı (sadece rakam)
    if (!Utils.isValidCode(code)) {
      return res.status(400).json({ error: 'Şifre 4-8 haneli rakam olmalı' });
    }

    const user = db.prepare('SELECT * FROM users WHERE code = ? AND is_admin = 0').get(code);
    if (!user) return res.status(401).json({ error: 'Şifre yanlış' });
    if (user.is_banned) return res.status(403).json({ error: 'Hesabınız askıya alındı' });

    db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP, last_ip = ? WHERE id = ?').run(req.ip, user.id);
    const token = require('crypto').randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + CONFIG.SESSION_TIMEOUT).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expires);

    logger.info('Kullanıcı girişi', { name: user.name, ip: req.ip });
    res.json({
      success: true,
      isAdmin: false,
      token,
      user: Utils.formatUserPublic(user)
    });
  } catch (e) {
    logger.error('Login hatası', { error: e.message });
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ---- ÇIKIŞ ----
app.post('/api/logout', (req, res) => {
  const token = req.headers['x-session-token'];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ success: true });
});

// ---- PROFİL ----
app.put('/api/profile', (req, res) => {
  const token = req.headers['x-session-token'];
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'Oturum geçersiz' });

  const { name, avatar, status, bio } = req.body;
  const cleanName = Utils.sanitizeName(name);
  if (!cleanName) return res.status(400).json({ error: 'İsim gerekli' });
  if (!Utils.isValidAvatar(avatar)) return res.status(400).json({ error: 'Avatar geçersiz' });

  db.prepare('UPDATE users SET name = ?, avatar = ?, status = ?, bio = ? WHERE id = ?')
    .run(cleanName, avatar, Utils.sanitize(status || ''), Utils.sanitize(bio || ''), session.user_id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  io.emit('user-updated', Utils.formatUserPublic(updated));
  res.json({ success: true, user: Utils.formatUserPublic(updated) });
});

// ---- TEMA ----
app.put('/api/theme', (req, res) => {
  const token = req.headers['x-session-token'];
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'Oturum geçersiz' });
  const { theme, wallpaper } = req.body;
  db.prepare('UPDATE users SET theme = ?, wallpaper = ? WHERE id = ?')
    .run(theme || 'auto', wallpaper || 'default', session.user_id);
  res.json({ success: true });
});

// ---- MESAJ GEÇMİŞİ ----
app.get('/api/messages', (req, res) => {
  const token = req.headers['x-session-token'];
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'Oturum geçersiz' });

  const limit = Math.min(parseInt(req.query.limit) || CONFIG.MAX_MESSAGES_HISTORY, CONFIG.MAX_MESSAGES_HISTORY);
  const msgs = db.prepare(`
    SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE m.is_deleted = 0
    ORDER BY m.id DESC LIMIT ?
  `).all(limit).reverse();

  res.json(msgs.map(Utils.formatMessage));
});

// ============================================================
//  ADMIN ROTALARI
// ============================================================
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Token yok' });
  if (token === ADMIN_PASSWORD) return next();

  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (session) {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
    if (u && u.is_admin === 1) return next();
  }
  res.status(401).json({ error: 'Yetkisiz' });
}

// Kullanıcılar
app.get('/api/admin/users', adminAuth, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY id').all();
  const result = users.map(u => ({
    ...Utils.formatUser(u),
    messageCount: db.prepare('SELECT COUNT(*) AS c FROM messages WHERE sender_id = ? AND is_deleted = 0').get(u.id).c
  }));
  res.json(result);
});

app.post('/api/admin/users', adminAuth, (req, res) => {
  const { code, name, avatar } = req.body;
  if (!Utils.isValidCode(code)) return res.status(400).json({ error: 'Şifre 4-8 haneli rakam olmalı' });
  const cleanName = Utils.sanitizeName(name);
  if (!cleanName) return res.status(400).json({ error: 'İsim gerekli' });
  if (db.prepare('SELECT * FROM users WHERE code = ?').get(code)) {
    return res.status(400).json({ error: 'Bu şifre zaten kullanılıyor' });
  }
  db.prepare('INSERT INTO users (code, name, avatar) VALUES (?, ?, ?)').run(code, cleanName, avatar || '💙');
  logger.info('Yeni kullanıcı', { name: cleanName });
  res.json({ success: true });
});

app.put('/api/admin/users/:id', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Bulunamadı' });
  if (user.is_admin) return res.status(400).json({ error: 'Admin düzenlenemez' });

  const { code, name, avatar } = req.body;
  if (code && !Utils.isValidCode(code)) return res.status(400).json({ error: 'Geçersiz şifre' });
  if (code) {
    const existing = db.prepare('SELECT * FROM users WHERE code = ?').get(code);
    if (existing && existing.id !== id) return res.status(400).json({ error: 'Bu şifre kullanılıyor' });
    db.prepare('UPDATE users SET code = ? WHERE id = ?').run(code, id);
  }
  db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?').run(Utils.sanitizeName(name), avatar, id);
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Bulunamadı' });
  if (user.is_admin) return res.status(400).json({ error: 'Admin silinemez' });
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  logger.warn('Kullanıcı silindi', { name: user.name });
  res.json({ success: true });
});

app.patch('/api/admin/users/:id/ban', adminAuth, (req, res) => {
  const { banned } = req.body;
  db.prepare('UPDATE users SET is_banned = ? WHERE id = ? AND is_admin = 0').run(banned ? 1 : 0, req.params.id);
  res.json({ success: true });
});

// Mesajlar
app.get('/api/admin/messages', adminAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 500, CONFIG.MAX_MESSAGES_ADMIN);
  const msgs = db.prepare(`
    SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
    FROM messages m JOIN users u ON m.sender_id = u.id
    ORDER BY m.id DESC LIMIT ?
  `).all(limit).reverse();
  res.json(msgs.map(Utils.formatMessage));
});

app.delete('/api/admin/messages/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  io.emit('message-deleted', Number(req.params.id));
  res.json({ success: true });
});

app.delete('/api/admin/messages', adminAuth, (req, res) => {
  db.prepare('DELETE FROM messages').run();
  io.emit('messages-cleared');
  logger.warn('Tüm mesajlar silindi');
  res.json({ success: true });
});

app.post('/api/admin/password', adminAuth, (req, res) => {
  const { newPass } = req.body;
  if (!newPass || !Utils.isValidAdminPass(newPass)) {
    return res.status(400).json({ error: 'Şifre 4-16 haneli harf/rakam olmalı' });
  }
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_pass', newPass);
  logger.warn('Admin şifresi değiştirildi');
  res.json({ success: true, newToken: newPass });
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json({
    totalUsers: users.length,
    activeUsers: users.filter(u => !u.is_admin).length,
    totalMessages: db.prepare('SELECT COUNT(*) AS c FROM messages WHERE is_deleted = 0').get().c,
    onlineNow: onlineUsers.size,
    uptime: process.uptime(),
    version: VERSION
  });
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Bulunamadı' }));

// ============================================================
//  SOCKET.IO
// ============================================================
const onlineUsers = new Map();

io.use((socket, next) => {
  const ip = socket.handshake.address;
  if (!rateLimiter.check('conn:' + ip)) {
    return next(new Error('Çok fazla bağlantı'));
  }
  next();
});

io.on('connection', (socket) => {
  logger.info('Socket bağlandı', { id: socket.id });

  socket.on('login', ({ token, code }) => {
    try {
      let user = null;
      let isAdmin = false;

      // Token ile
      if (token) {
        const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
        if (session) {
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
          if (user && user.is_admin === 1) isAdmin = true;
        }
      }

      // Kod ile
      if (!user && code) {
        if (code === ADMIN_PASSWORD) {
          user = db.prepare('SELECT * FROM users WHERE is_admin = 1').get();
          isAdmin = true;
        } else if (Utils.isValidCode(code)) {
          user = db.prepare('SELECT * FROM users WHERE code = ? AND is_admin = 0').get(code);
        }
      }

      if (!user) return socket.emit('login-error', 'Kullanıcı bulunamadı');
      if (user.is_banned) return socket.emit('login-error', 'Hesap askıya alındı');

      db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

      onlineUsers.set(socket.id, {
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        isAdmin
      });

      socket.join('chat-room');

      socket.emit('login-ok', {
        user: Utils.formatUserPublic(user),
        isAdmin
      });

      const history = db.prepare(`
        SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE m.is_deleted = 0
        ORDER BY m.id DESC LIMIT ?
      `).all(CONFIG.MAX_MESSAGES_HISTORY).reverse();
      socket.emit('history', history.map(Utils.formatMessage));

      // Pinlenen mesajlar
      const pinned = db.prepare(`
        SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE m.is_pinned = 1 AND m.is_deleted = 0
        ORDER BY m.id DESC
      `).all();
      socket.emit('pinned', pinned.map(Utils.formatMessage));

      broadcastOnline();

      io.to('chat-room').emit('system-message', {
        text: `${user.avatar} ${user.name} sohbete katıldı`,
        type: 'join'
      });

      if (!isAdmin) {
        db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id != ? AND is_read = 0').run(user.id);
        io.to('chat-room').emit('messages-read', user.id);
      }

      logger.info('Socket giriş', { name: user.name, isAdmin });
    } catch (e) {
      logger.error('Socket login hatası', { error: e.message });
      socket.emit('login-error', 'Sunucu hatası');
    }
  });

  socket.on('send-message', (data) => {
    const u = onlineUsers.get(socket.id);
    if (!u) return socket.emit('error-msg', 'Giriş yapmadınız');

    if (!rateLimiter.check('msg:' + u.userId)) {
      return socket.emit('error-msg', 'Çok hızlı mesaj gönderiyorsunuz');
    }

    const { text, type, duration, audioData, replyTo } = data || {};

    if (type === 'audio') {
      if (!audioData || typeof audioData !== 'string') return;
      if (audioData.length > CONFIG.MAX_AUDIO_SIZE * 1.4) return socket.emit('error-msg', 'Ses çok büyük');
      if (duration > CONFIG.AUDIO_MAX_DURATION) return socket.emit('error-msg', 'Ses çok uzun');
    } else {
      if (!text || typeof text !== 'string') return;
    }

    const cleanText = type === 'audio' ? '[Sesli mesaj]' : Utils.sanitize(text);
    if (type !== 'audio' && !cleanText) return;

    const result = db.prepare(`
      INSERT INTO messages (sender_id, message, type, duration, audio_data, reply_to)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(u.userId, cleanText, type || 'text', duration || 0, audioData || null, replyTo || null);

    const saved = db.prepare(`
      SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    io.to('chat-room').emit('new-message', Utils.formatMessage(saved));
  });

  socket.on('typing', () => {
    const u = onlineUsers.get(socket.id);
    if (u) socket.to('chat-room').emit('user-typing', { name: u.name });
  });

  socket.on('typing-stop', () => {
    socket.to('chat-room').emit('user-typing-stop');
  });

  socket.on('delete-message', ({ id }) => {
    const u = onlineUsers.get(socket.id);
    if (!u) return;
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!msg) return;
    if (msg.sender_id !== u.userId && !u.isAdmin) return;
    db.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').run(id);
    io.to('chat-room').emit('message-deleted', id);
  });

  socket.on('pin-message', ({ id, pinned }) => {
    const u = onlineUsers.get(socket.id);
    if (!u) return;
    db.prepare('UPDATE messages SET is_pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id);
    io.to('chat-room').emit('message-pinned', { id, pinned });
    const pinnedMsgs = db.prepare(`
      SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE m.is_pinned = 1 AND m.is_deleted = 0
      ORDER BY m.id DESC
    `).all();
    io.to('chat-room').emit('pinned', pinnedMsgs.map(Utils.formatMessage));
  });

  socket.on('react-message', ({ id, emoji }) => {
    const u = onlineUsers.get(socket.id);
    if (!u) return;
    if (!CONFIG.EMOJI_LIST.includes(emoji)) return;

    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!msg) return;

    let reactions = {};
    try { reactions = JSON.parse(msg.reactions || '{}'); } catch {}
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(u.userId);
    if (idx === -1) reactions[emoji].push(u.userId);
    else reactions[emoji].splice(idx, 1);
    if (reactions[emoji].length === 0) delete reactions[emoji];

    db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), id);
    io.to('chat-room').emit('message-reaction', { id, reactions });
  });

  socket.on('mark-read', () => {
    const u = onlineUsers.get(socket.id);
    if (!u) return;
    db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id != ? AND is_read = 0').run(u.userId);
    io.to('chat-room').emit('messages-read', u.userId);
  });

  socket.on('update-profile', ({ name, avatar, status, bio }) => {
    const u = onlineUsers.get(socket.id);
    if (!u) return;
    const cleanName = Utils.sanitizeName(name);
    if (!cleanName || !Utils.isValidAvatar(avatar)) return;

    db.prepare('UPDATE users SET name = ?, avatar = ?, status = ?, bio = ? WHERE id = ?')
      .run(cleanName, avatar, Utils.sanitize(status || ''), Utils.sanitize(bio || ''), u.userId);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(u.userId);
    u.name = updated.name;
    u.avatar = updated.avatar;

    io.to('chat-room').emit('user-updated', Utils.formatUserPublic(updated));
    broadcastOnline();
  });

  socket.on('disconnect', () => {
    const u = onlineUsers.get(socket.id);
    if (u) {
      onlineUsers.delete(socket.id);
      broadcastOnline();
      io.to('chat-room').emit('system-message', {
        text: `${u.avatar} ${u.name} sohbetten ayrıldı`,
        type: 'leave'
      });
    }
  });
});

function broadcastOnline() {
  const list = Array.from(onlineUsers.values()).map(u => ({
    id: u.userId,
    name: u.name,
    avatar: u.avatar,
    isAdmin: u.isAdmin
  }));
  io.to('chat-room').emit('online-users', list);
}

// ============================================================
//  CRON
// ============================================================
setInterval(() => {
  try {
    db.prepare('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP').run();
  } catch (e) {}
}, 5 * 60 * 1000);

setInterval(() => broadcastOnline(), 30000);

// ============================================================
//  HATA YAKALAMA
// ============================================================
process.on('uncaughtException', (err) => {
  logger.error('Yakalanmamış hata', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('İşlenmemiş promise reddi', { reason: String(reason) });
});

// ============================================================
//  BAŞLAT
// ============================================================
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log(`  💕  BIZIM SOHBET  v${VERSION}`);
  console.log('='.repeat(60));
  console.log(`  🚀  Sunucu     : http://localhost:${PORT}`);
  console.log(`  🔐  Admin      : http://localhost:${PORT}/admin.html`);
  console.log(`  👤  Test       : 1111 (Ben), 2222 (Aşkım)`);
  console.log(`  👑  Admin şifre: ${ADMIN_PASSWORD}`);
  console.log('='.repeat(60) + '\n');
  logger.success('Sunucu başlatıldı', { port: PORT, version: VERSION });
});
