/* ============================================================
 *  BIZIM SOHBET — Profesyonel Backend
 *  ------------------------------------------------------------
 *  Sürüm    : 3.0.0
 *  Yazar    : Profesyonel
 *  Açıklama : İki kişilik özel sohbet uygulaması
 *             - Socket.IO ile gerçek zamanlı mesajlaşma
 *             - SQLite ile kalıcı veri
 *             - Sesli mesaj, emoji, pin, reply, reaksiyon
 *             - Admin paneli (kullanıcı + mesaj yönetimi)
 *             - JWT benzeri token oturumu
 *             - Rate limiting + input sanitization
 * ============================================================ */

'use strict';

// ============================================================
//  BAĞIMLILIKLAR
// ============================================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// ============================================================
//  SABİTLER
// ============================================================
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'sohbet.db');
const VERSION = '3.0.0';

const CONFIG = {
  MAX_MESSAGE_LENGTH: 4000,
  MAX_AUDIO_SIZE: 5 * 1024 * 1024,        // 5 MB
  MAX_MESSAGES_HISTORY: 500,
  MAX_MESSAGES_ADMIN: 2000,
  RATE_LIMIT_WINDOW: 1000,                // 1 saniye
  RATE_LIMIT_MAX: 10,                     // 10 mesaj/saniye
  SESSION_TIMEOUT: 30 * 24 * 60 * 60 * 1000, // 30 gün
  AUDIO_MAX_DURATION: 120,                // 2 dakika
  EMOJI_LIST: ['❤️','😍','😂','😮','😢','👍','🔥','💕','🥰','😘']
};

const DEFAULT_EMOJI_AVATARS = [
  '💙','💕','💖','❤️','💘','💝','😍','🥰','😘','🌹',
  '🌸','🌺','⭐','✨','🌈','☀️','🌙','🦋','🐱','🐶',
  '🐼','🦊','🐰','🦁','🐯','🐨','🐸','🐵','🦄','🐝',
  '🐞','👑','🎀','💎','🍀'
];

// ============================================================
//  LOGGER
// ============================================================
const logger = {
  _format(level, msg, meta) {
    const ts = new Date().toISOString();
    const icon = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅', debug: '🐛' }[level] || '📝';
    let line = `[${ts}] ${icon} [${level.toUpperCase()}] ${msg}`;
    if (meta) line += ' ' + JSON.stringify(meta);
    return line;
  },
  info(msg, meta)    { console.log(this._format('info', msg, meta)); },
  warn(msg, meta)    { console.warn(this._format('warn', msg, meta)); },
  error(msg, meta)   { console.error(this._format('error', msg, meta)); },
  success(msg, meta) { console.log(this._format('success', msg, meta)); },
  debug(msg, meta)   { if (process.env.DEBUG) console.log(this._format('debug', msg, meta)); }
};

// ============================================================
//  VERİTABANI KATMANI
// ============================================================
class DatabaseLayer {
  constructor() {
    this._ensureDataDir();
    this.db = new Database(DB_FILE);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._createTables();
    this._seedDefaults();
    this._prepareStatements();
  }

  _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      logger.info('Veri klasörü oluşturuldu', { path: DATA_DIR });
    }
  }

  _createTables() {
    this.db.exec(`
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
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reply_to)  REFERENCES messages(id) ON DELETE SET NULL
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
    logger.info('Tablolar hazır');
  }

  _seedDefaults() {
    // Admin
    const admin = this.db.prepare('SELECT * FROM users WHERE is_admin = 1').get();
    if (!admin) {
      this.db.prepare(`
        INSERT INTO users (code, name, avatar, status, is_admin)
        VALUES (?, ?, ?, ?, 1)
      `).run('9999', 'Admin', '👑', 'Sistem Yöneticisi');
      logger.success('Varsayılan admin oluşturuldu', { code: '9999' });
    }

    // Varsayılan kullanıcılar
    const userCount = this.db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 0').get().c;
    if (userCount === 0) {
      this.db.prepare('INSERT INTO users (code, name, avatar, status) VALUES (?, ?, ?, ?)')
        .run('1111', 'Ben', '💙', 'Kod yazıyorum');
      this.db.prepare('INSERT INTO users (code, name, avatar, status) VALUES (?, ?, ?, ?)')
        .run('2222', 'Aşkım', '💕', 'Seni düşünüyorum');
      logger.success('Varsayılan kullanıcılar oluşturuldu', { codes: ['1111', '2222'] });
    }

    // Admin şifresi (sadece rakam)
const ADMIN_PASS = process.env.ADMIN_PASS || '999999';
// Admin şifresi - Environment variable'dan veya varsayılan
const ADMIN_PASS = process.env.ADMIN_PASS || '999999';
db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_pass', ADMIN_PASS);
console.log('👑 Admin şifresi ayarlandı:', ADMIN_PASS);
}
    // Diğer ayarlar
    const defaults = {
      app_name: 'Bizim Sohbet',
      maintenance: '0',
      allow_register: '1'
    };
    for (const [k, v] of Object.entries(defaults)) {
      if (!this.db.prepare('SELECT value FROM settings WHERE key = ?').get(k)) {
        this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(k, v);
      }
    }
  }

  _prepareStatements() {
    this.stmts = {
      // Kullanıcılar
      getUserByCode: this.db.prepare('SELECT * FROM users WHERE code = ?'),
      getUserById:   this.db.prepare('SELECT * FROM users WHERE id = ?'),
      getAllUsers:   this.db.prepare('SELECT * FROM users ORDER BY id'),
      insertUser:    this.db.prepare('INSERT INTO users (code, name, avatar, status) VALUES (?, ?, ?, ?)'),
      updateUser:    this.db.prepare('UPDATE users SET name = ?, avatar = ?, status = ?, bio = ? WHERE id = ?'),
      updateUserCode:this.db.prepare('UPDATE users SET code = ? WHERE id = ?'),
      updateLastSeen:this.db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP, last_ip = ? WHERE id = ?'),
      deleteUser:    this.db.prepare('DELETE FROM users WHERE id = ? AND is_admin = 0'),
      banUser:       this.db.prepare('UPDATE users SET is_banned = ? WHERE id = ? AND is_admin = 0'),
      setUserTheme:  this.db.prepare('UPDATE users SET theme = ?, wallpaper = ? WHERE id = ?'),

      // Mesajlar
      insertMessage: this.db.prepare(`
        INSERT INTO messages (sender_id, message, type, duration, audio_data, reply_to)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      getRecentMessages: this.db.prepare(`
        SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE m.is_deleted = 0
        ORDER BY m.id DESC LIMIT ?
      `),
      getMessageById: this.db.prepare(`
        SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
      `),
      deleteMessage: this.db.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?'),
      hardDeleteMessage: this.db.prepare('DELETE FROM messages WHERE id = ?'),
      clearMessages: this.db.prepare('UPDATE messages SET is_deleted = 1'),
      hardClearMessages: this.db.prepare('DELETE FROM messages'),
      markRead:      this.db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id != ? AND is_read = 0'),
      pinMessage:    this.db.prepare('UPDATE messages SET is_pinned = ? WHERE id = ?'),
      getPinned:     this.db.prepare(`
        SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE m.is_pinned = 1 AND m.is_deleted = 0
        ORDER BY m.id DESC
      `),
      setReactions:  this.db.prepare('UPDATE messages SET reactions = ? WHERE id = ?'),
      searchMessages:this.db.prepare(`
        SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE m.is_deleted = 0 AND m.message LIKE ?
        ORDER BY m.id DESC LIMIT 100
      `),
      countMessages: this.db.prepare('SELECT COUNT(*) AS c FROM messages WHERE is_deleted = 0'),
      countUserMessages: this.db.prepare('SELECT COUNT(*) AS c FROM messages WHERE sender_id = ? AND is_deleted = 0'),

      // Oturum
      insertSession: this.db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'),
      getSession:    this.db.prepare('SELECT * FROM sessions WHERE token = ?'),
      deleteSession: this.db.prepare('DELETE FROM sessions WHERE token = ?'),
      deleteUserSessions: this.db.prepare('DELETE FROM sessions WHERE user_id = ?'),
      cleanExpiredSessions: this.db.prepare('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP'),

      // Ayarlar
      getSetting:    this.db.prepare('SELECT value FROM settings WHERE key = ?'),
      setSetting:    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    };
  }

  // Hash (basit ama etkili)
  _hash(text) {
    return crypto.createHash('sha256').update(String(text)).digest('hex');
  }

  // ----- KULLANICI -----
  getUserByCode(code) {
    return this.stmts.getUserByCode.get(code);
  }

  getUserById(id) {
    return this.stmts.getUserById.get(id);
  }

  getAllUsers() {
    return this.stmts.getAllUsers.all();
  }

  createUser(code, name, avatar, status = 'Hayat güzel') {
    return this.stmts.insertUser.run(code, name, avatar || '💙', status);
  }

  updateUser(id, name, avatar, status, bio = '') {
    return this.stmts.updateUser.run(name, avatar, status, bio, id);
  }

  updateUserCode(id, code) {
    return this.stmts.updateUserCode.run(code, id);
  }

  updateLastSeen(id, ip) {
    return this.stmts.updateLastSeen.run(ip || '', id);
  }

  deleteUser(id) {
    return this.stmts.deleteUser.run(id);
  }

  banUser(id, banned) {
    return this.stmts.banUser.run(banned ? 1 : 0, id);
  }

  setUserTheme(id, theme, wallpaper) {
    return this.stmts.setUserTheme.run(theme, wallpaper, id);
  }

  // ----- MESAJ -----
  createMessage(senderId, message, type = 'text', duration = 0, audioData = null, replyTo = null) {
    return this.stmts.insertMessage.run(senderId, message, type, duration, audioData, replyTo);
  }

  getRecentMessages(limit = CONFIG.MAX_MESSAGES_HISTORY) {
    return this.stmts.getRecentMessages.all(limit).reverse();
  }

  getMessageById(id) {
    return this.stmts.getMessageById.get(id);
  }

  deleteMessage(id) {
    return this.stmts.deleteMessage.run(id);
  }

  hardDeleteMessage(id) {
    return this.stmts.hardDeleteMessage.run(id);
  }

  clearMessages() {
    return this.stmts.clearMessages.run();
  }

  hardClearMessages() {
    return this.stmts.hardClearMessages.run();
  }

  markRead(userId) {
    return this.stmts.markRead.run(userId);
  }

  pinMessage(id, pinned) {
    return this.stmts.pinMessage.run(pinned ? 1 : 0, id);
  }

  getPinned() {
    return this.stmts.getPinned.all();
  }

  setReactions(id, reactions) {
    return this.stmts.setReactions.run(JSON.stringify(reactions), id);
  }

  searchMessages(query) {
    return this.stmts.searchMessages.all(`%${query}%`);
  }

  countMessages() {
    return this.stmts.countMessages.get().c;
  }

  countUserMessages(id) {
    return this.stmts.countUserMessages.get(id).c;
  }

  // ----- OTURUM -----
  createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + CONFIG.SESSION_TIMEOUT).toISOString();
    this.stmts.insertSession.run(token, userId, expires);
    return token;
  }

  getSession(token) {
    return this.stmts.getSession.get(token);
  }

  deleteSession(token) {
    return this.stmts.deleteSession.run(token);
  }

  deleteUserSessions(userId) {
    return this.stmts.deleteUserSessions.run(userId);
  }

  cleanExpiredSessions() {
    return this.stmts.cleanExpiredSessions.run();
  }

  // ----- AYAR -----
  getSetting(key) {
    const row = this.stmts.getSetting.get(key);
    return row ? row.value : null;
  }

  setSetting(key, value) {
    return this.stmts.setSetting.run(key, value);
  }

  verifyAdminPass(pass) {
    const stored = this.getSetting('admin_pass');
    return stored === this._hash(pass);
  }

  setAdminPass(pass) {
    this.setSetting('admin_pass', this._hash(pass));
  }
}

// ============================================================
//  YARDIMCILAR
// ============================================================
const Utils = {
  sanitize(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .trim()
      .slice(0, CONFIG.MAX_MESSAGE_LENGTH);
  },

  sanitizeName(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[<>"'&]/g, '').trim().slice(0, 20);
  },

  isValidCode(code) {
    return typeof code === 'string' && /^\d{4,8}$/.test(code);
  },

  isValidAvatar(avatar) {
    return typeof avatar === 'string' && avatar.length > 0 && avatar.length <= 8;
  },

  generateToken() {
    return crypto.randomBytes(32).toString('hex');
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

  formatUser(u) {
    if (!u) return null;
    return {
      id: u.id,
      code: u.code,
      name: u.name,
      avatar: u.avatar,
      status: u.status,
      bio: u.bio,
      theme: u.theme,
      wallpaper: u.wallpaper,
      is_admin: u.is_admin === 1,
      is_banned: u.is_banned === 1,
      created_at: u.created_at,
      last_seen: u.last_seen
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
    setInterval(() => this._clean(), 60_000);
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
      const filtered = arr.filter(t => now - t < this.windowMs);
      if (filtered.length === 0) this.hits.delete(k);
      else this.hits.set(k, filtered);
    }
  }
}

// ============================================================
//  UYGULAMA
// ============================================================
class App {
  constructor() {
    this.db = new DatabaseLayer();
    this.rateLimiter = new RateLimiter(CONFIG.RATE_LIMIT_WINDOW, CONFIG.RATE_LIMIT_MAX);
    this.onlineUsers = new Map(); // socketId -> { userId, code, name, avatar, isAdmin, joinedAt }
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      maxHttpBufferSize: CONFIG.MAX_AUDIO_SIZE,
      cors: { origin: '*', methods: ['GET', 'POST'] },
      pingTimeout: 60_000,
      pingInterval: 25_000
    });

    this._setupMiddleware();
    this._setupRoutes();
    this._setupSocket();
    this._setupCron();
  }

  _setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(express.static(path.join(__dirname, 'public'), {
      maxAge: '1h',
      etag: true
    }));

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token, X-Session-Token');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
      if (req.method === 'OPTIONS') return res.sendStatus(200);
      next();
    });

    // Log istekler
    this.app.use((req, res, next) => {
      if (req.url.startsWith('/socket.io')) return next();
      logger.debug(`${req.method} ${req.url}`);
      next();
    });
  }

  _setupRoutes() {
    const app = this.app;
    const db = this.db;

    // ---------- SAĞLIK ----------
    app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        version: VERSION,
        uptime: process.uptime(),
        online: this.onlineUsers.size,
        messages: db.countMessages()
      });
    });

    // ---------- GİRİŞ ----------
    app.post('/api/login', (req, res) => {
      try {
        const { code } = req.body;
        if (!Utils.isValidCode(code)) {
          return res.status(400).json({ error: 'Geçersiz şifre formatı (4-8 hane)' });
        }

        // Admin girişi
        if (db.verifyAdminPass(code)) {
          const admin = db.getAllUsers().find(u => u.is_admin === 1);
          const session = db.createSession(admin.id);
          logger.info('Admin girişi', { ip: req.ip });
          return res.json({
            success: true,
            isAdmin: true,
            token: session,
            user: Utils.formatUserPublic(admin)
          });
        }

        // Normal kullanıcı
        const user = db.getUserByCode(code);
        if (!user) return res.status(401).json({ error: 'Şifre yanlış' });
        if (user.is_banned) return res.status(403).json({ error: 'Hesabınız askıya alındı' });
        if (user.is_admin) return res.status(401).json({ error: 'Şifre yanlış' });

        db.updateLastSeen(user.id, req.ip);
        const session = db.createSession(user.id);

        logger.info('Kullanıcı girişi', { name: user.name, ip: req.ip });
        res.json({
          success: true,
          isAdmin: false,
          token: session,
          user: Utils.formatUserPublic(user)
        });
      } catch (e) {
        logger.error('Login hatası', { error: e.message });
        res.status(500).json({ error: 'Sunucu hatası' });
      }
    });

    // ---------- ÇIKIŞ ----------
    app.post('/api/logout', (req, res) => {
      const token = req.headers['x-session-token'];
      if (token) db.deleteSession(token);
      res.json({ success: true });
    });

    // ---------- PROFİL ----------
    app.put('/api/profile', (req, res) => {
      try {
        const token = req.headers['x-session-token'];
        const session = db.getSession(token);
        if (!session) return res.status(401).json({ error: 'Oturum geçersiz' });

        const { name, avatar, status, bio } = req.body;
        const cleanName = Utils.sanitizeName(name);
        if (!cleanName) return res.status(400).json({ error: 'İsim gerekli' });
        if (!Utils.isValidAvatar(avatar)) return res.status(400).json({ error: 'Avatar geçersiz' });

        db.updateUser(session.user_id, cleanName, avatar, Utils.sanitize(status || ''), Utils.sanitize(bio || ''));
        const updated = db.getUserById(session.user_id);

        this.io.emit('user-updated', Utils.formatUserPublic(updated));
        res.json({ success: true, user: Utils.formatUserPublic(updated) });
      } catch (e) {
        logger.error('Profil güncelleme hatası', { error: e.message });
        res.status(500).json({ error: 'Sunucu hatası' });
      }
    });

    // ---------- TEMA ----------
    app.put('/api/theme', (req, res) => {
      const token = req.headers['x-session-token'];
      const session = db.getSession(token);
      if (!session) return res.status(401).json({ error: 'Oturum geçersiz' });

      const { theme, wallpaper } = req.body;
      db.setUserTheme(session.user_id, theme || 'auto', wallpaper || 'default');
      res.json({ success: true });
    });

    // ---------- MESAJ GEÇMİŞİ ----------
    app.get('/api/messages', (req, res) => {
      const token = req.headers['x-session-token'];
      const session = db.getSession(token);
      if (!session) return res.status(401).json({ error: 'Oturum geçersiz' });

      const limit = Math.min(parseInt(req.query.limit) || CONFIG.MAX_MESSAGES_HISTORY, CONFIG.MAX_MESSAGES_HISTORY);
      const messages = db.getRecentMessages(limit).map(Utils.formatMessage);
      res.json(messages);
    });

    // ---------- ARAMA ----------
    app.get('/api/search', (req, res) => {
      const token = req.headers['x-session-token'];
      const session = db.getSession(token);
      if (!session) return res.status(401).json({ error: 'Oturum geçersiz' });

      const q = (req.query.q || '').trim();
      if (q.length < 2) return res.json([]);
      const results = db.searchMessages(q).map(Utils.formatMessage);
      res.json(results);
    });

    // ---------- PINLENEN ----------
    app.get('/api/pinned', (req, res) => {
      const token = req.headers['x-session-token'];
      const session = db.getSession(token);
      if (!session) return res.status(401).json({ error: 'Oturum geçersiz' });

      res.json(db.getPinned().map(Utils.formatMessage));
    });

    // ============================================================
    //  ADMIN ROTALARI
    // ============================================================
    const adminAuth = (req, res, next) => {
      const token = req.headers['x-admin-token'];
      if (!token) return res.status(401).json({ error: 'Token yok' });

      // Session token veya direkt şifre
      const session = db.getSession(token);
      if (session) {
        const u = db.getUserById(session.user_id);
        if (u && u.is_admin === 1) return next();
      }
      if (db.verifyAdminPass(token)) return next();

      res.status(401).json({ error: 'Yetkisiz' });
    };

    // Admin: kullanıcılar
    app.get('/api/admin/users', adminAuth, (req, res) => {
      const users = db.getAllUsers().map(u => ({
        ...Utils.formatUser(u),
        messageCount: db.countUserMessages(u.id)
      }));
      res.json(users);
    });

    // Admin: kullanıcı oluştur
    app.post('/api/admin/users', adminAuth, (req, res) => {
      try {
        const { code, name, avatar } = req.body;
        if (!Utils.isValidCode(code)) return res.status(400).json({ error: 'Geçersiz şifre (4-8 hane)' });
        const cleanName = Utils.sanitizeName(name);
        if (!cleanName) return res.status(400).json({ error: 'İsim gerekli' });

        const existing = db.getUserByCode(code);
        if (existing) return res.status(400).json({ error: 'Bu şifre zaten kullanılıyor' });

        db.createUser(code, cleanName, avatar || '💙');
        logger.info('Yeni kullanıcı oluşturuldu', { name: cleanName });
        res.json({ success: true });
      } catch (e) {
        logger.error('Kullanıcı oluşturma hatası', { error: e.message });
        res.status(500).json({ error: 'Sunucu hatası' });
      }
    });

    // Admin: kullanıcı güncelle
    app.put('/api/admin/users/:id', adminAuth, (req, res) => {
      try {
        const { code, name, avatar } = req.body;
        const id = parseInt(req.params.id);
        const user = db.getUserById(id);
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        if (user.is_admin) return res.status(400).json({ error: 'Admin düzenlenemez' });

        if (code && !Utils.isValidCode(code)) return res.status(400).json({ error: 'Geçersiz şifre' });
        if (code) {
          const existing = db.getUserByCode(code);
          if (existing && existing.id !== id) return res.status(400).json({ error: 'Bu şifre zaten kullanılıyor' });
          db.updateUserCode(id, code);
        }

        db.updateUser(id, Utils.sanitizeName(name), avatar, user.status, user.bio);
        res.json({ success: true });
      } catch (e) {
        logger.error('Kullanıcı güncelleme hatası', { error: e.message });
        res.status(500).json({ error: 'Sunucu hatası' });
      }
    });

    // Admin: kullanıcı sil
    app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
      const id = parseInt(req.params.id);
      const user = db.getUserById(id);
      if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      if (user.is_admin) return res.status(400).json({ error: 'Admin silinemez' });

      db.deleteUserSessions(id);
      db.deleteUser(id);
      logger.warn('Kullanıcı silindi', { id, name: user.name });
      res.json({ success: true });
    });

    // Admin: ban / unban
    app.patch('/api/admin/users/:id/ban', adminAuth, (req, res) => {
      const id = parseInt(req.params.id);
      const { banned } = req.body;
      db.banUser(id, banned);
      res.json({ success: true });
    });

    // Admin: mesajlar
    app.get('/api/admin/messages', adminAuth, (req, res) => {
      const limit = Math.min(parseInt(req.query.limit) || 500, CONFIG.MAX_MESSAGES_ADMIN);
      const messages = db.getRecentMessages(limit).map(Utils.formatMessage);
      res.json(messages);
    });

    // Admin: mesaj sil
    app.delete('/api/admin/messages/:id', adminAuth, (req, res) => {
      const id = parseInt(req.params.id);
      db.hardDeleteMessage(id);
      this.io.emit('message-deleted', id);
      res.json({ success: true });
    });

    // Admin: tüm mesajları sil
    app.delete('/api/admin/messages', adminAuth, (req, res) => {
      db.hardClearMessages();
      this.io.emit('messages-cleared');
      logger.warn('Tüm mesajlar silindi');
      res.json({ success: true });
    });

    // Admin: şifre değiştir
    app.post('/api/admin/password', adminAuth, (req, res) => {
      const { newPass } = req.body;
      if (!newPass || newPass.length < 4) return res.status(400).json({ error: 'En az 4 karakter' });
      db.setAdminPass(newPass);
      logger.warn('Admin şifresi değiştirildi');
      res.json({ success: true, newToken: newPass });
    });

    // Admin: istatistik
    app.get('/api/admin/stats', adminAuth, (req, res) => {
      const users = db.getAllUsers();
      res.json({
        totalUsers: users.length,
        activeUsers: users.filter(u => !u.is_admin).length,
        totalMessages: db.countMessages(),
        onlineNow: this.onlineUsers.size,
        uptime: process.uptime(),
        version: VERSION
      });
    });

    // 404
    app.use((req, res) => {
      res.status(404).json({ error: 'Bulunamadı' });
    });

    // Hata yakalayıcı
    app.use((err, req, res, next) => {
      logger.error('Express hata', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Sunucu hatası' });
    });
  }

  _setupSocket() {
    const db = this.db;
    const io = this.io;
    const self = this;

    io.use((socket, next) => {
      const ip = socket.handshake.address;
      const key = `conn:${ip}`;
      if (!self.rateLimiter.check(key)) {
        logger.warn('Socket rate limit', { ip });
        return next(new Error('Çok fazla bağlantı'));
      }
      next();
    });

    io.on('connection', (socket) => {
      logger.debug('Socket bağlandı', { id: socket.id });

      // ---------- GİRİŞ ----------
      socket.on('login', ({ token, code }) => {
        try {
          let user = null;
          let isAdmin = false;

          // Token ile
          if (token) {
            const session = db.getSession(token);
            if (session) {
              user = db.getUserById(session.user_id);
              if (user && user.is_admin === 1) isAdmin = true;
            }
          }

          // Kod ile
          if (!user && code) {
            if (!Utils.isValidCode(code)) {
              return socket.emit('login-error', 'Geçersiz şifre');
            }
            if (db.verifyAdminPass(code)) {
              user = db.getAllUsers().find(u => u.is_admin === 1);
              isAdmin = true;
            } else {
              user = db.getUserByCode(code);
            }
          }

          if (!user) return socket.emit('login-error', 'Kullanıcı bulunamadı');
          if (user.is_banned) return socket.emit('login-error', 'Hesap askıya alındı');

          db.updateLastSeen(user.id, socket.handshake.address);

          self.onlineUsers.set(socket.id, {
            userId: user.id,
            code: user.code,
            name: user.name,
            avatar: user.avatar,
            isAdmin,
            joinedAt: Date.now()
          });

          socket.join('chat-room');

          socket.emit('login-ok', {
            user: Utils.formatUserPublic(user),
            isAdmin
          });

          // Geçmiş mesajlar
          const history = db.getRecentMessages(CONFIG.MAX_MESSAGES_HISTORY).map(Utils.formatMessage);
          socket.emit('history', history);

          // Pinlenen mesajlar
          socket.emit('pinned', db.getPinned().map(Utils.formatMessage));

          // Online listesi
          self._broadcastOnline();

          // Sistem mesajı
          io.to('chat-room').emit('system-message', {
            text: `${user.avatar} ${user.name} sohbete katıldı`,
            type: 'join'
          });

          // Okunmamış mesajları okundu yap
          if (!isAdmin) {
            db.markRead(user.id);
            io.to('chat-room').emit('messages-read', user.id);
          }

          logger.info('Socket giriş', { name: user.name, isAdmin });
        } catch (e) {
          logger.error('Socket login hatası', { error: e.message });
          socket.emit('login-error', 'Sunucu hatası');
        }
      });

      // ---------- MESAJ ----------
      socket.on('send-message', (data) => {
        try {
          const u = self.onlineUsers.get(socket.id);
          if (!u) return socket.emit('error-msg', 'Giriş yapmadınız');

          // Rate limit
          const key = `msg:${u.userId}`;
          if (!self.rateLimiter.check(key)) {
            return socket.emit('error-msg', 'Çok hızlı mesaj gönderiyorsunuz');
          }

          const { text, type, duration, audioData, replyTo } = data || {};

          // Doğrulama
          if (type === 'audio') {
            if (!audioData || typeof audioData !== 'string') return;
            if (audioData.length > CONFIG.MAX_AUDIO_SIZE * 1.4) {
              return socket.emit('error-msg', 'Ses dosyası çok büyük');
            }
            if (duration > CONFIG.AUDIO_MAX_DURATION) {
              return socket.emit('error-msg', 'Ses çok uzun (max 2 dk)');
            }
          } else {
            if (!text || typeof text !== 'string') return;
          }

          const cleanText = type === 'audio' ? '[Sesli mesaj]' : Utils.sanitize(text);
          if (type !== 'audio' && !cleanText) return;

          const result = db.createMessage(
            u.userId,
            cleanText,
            type || 'text',
            duration || 0,
            audioData || null,
            replyTo || null
          );

          const saved = Utils.formatMessage(db.getMessageById(result.lastInsertRowid));
          io.to('chat-room').emit('new-message', saved);

          logger.debug('Mesaj gönderildi', { from: u.name, type });
        } catch (e) {
          logger.error('Mesaj gönderme hatası', { error: e.message });
          socket.emit('error-msg', 'Mesaj gönderilemedi');
        }
      });

      // ---------- YAZIYOR ----------
      socket.on('typing', () => {
        const u = self.onlineUsers.get(socket.id);
        if (u) socket.to('chat-room').emit('user-typing', { name: u.name });
      });

      socket.on('typing-stop', () => {
        socket.to('chat-room').emit('user-typing-stop');
      });

      // ---------- MESAJ SİL ----------
      socket.on('delete-message', ({ id }) => {
        const u = self.onlineUsers.get(socket.id);
        if (!u) return;
        const msg = db.getMessageById(id);
        if (!msg) return;
        if (msg.sender_id !== u.userId && !u.isAdmin) return;

        db.deleteMessage(id);
        io.to('chat-room').emit('message-deleted', id);
      });

      // ---------- PIN ----------
      socket.on('pin-message', ({ id, pinned }) => {
        const u = self.onlineUsers.get(socket.id);
        if (!u) return;
        db.pinMessage(id, pinned);
        io.to('chat-room').emit('message-pinned', { id, pinned });
        io.to('chat-room').emit('pinned', db.getPinned().map(Utils.formatMessage));
      });

      // ---------- REAKSİYON ----------
      socket.on('react-message', ({ id, emoji }) => {
        const u = self.onlineUsers.get(socket.id);
        if (!u) return;
        if (!CONFIG.EMOJI_LIST.includes(emoji)) return;

        const msg = db.getMessageById(id);
        if (!msg) return;

        let reactions = {};
        try { reactions = JSON.parse(msg.reactions || '{}'); } catch {}
        if (!reactions[emoji]) reactions[emoji] = [];
        const idx = reactions[emoji].indexOf(u.userId);
        if (idx === -1) reactions[emoji].push(u.userId);
        else reactions[emoji].splice(idx, 1);
        if (reactions[emoji].length === 0) delete reactions[emoji];

        db.setReactions(id, reactions);
        io.to('chat-room').emit('message-reaction', { id, reactions });
      });

      // ---------- OKUNDU ----------
      socket.on('mark-read', () => {
        const u = self.onlineUsers.get(socket.id);
        if (!u) return;
        db.markRead(u.userId);
        io.to('chat-room').emit('messages-read', u.userId);
      });

      // ---------- PROFİL GÜNCELLE ----------
      socket.on('update-profile', ({ name, avatar, status, bio }) => {
        const u = self.onlineUsers.get(socket.id);
        if (!u) return;
        const cleanName = Utils.sanitizeName(name);
        if (!cleanName) return;
        if (!Utils.isValidAvatar(avatar)) return;

        db.updateUser(u.userId, cleanName, avatar, Utils.sanitize(status || ''), Utils.sanitize(bio || ''));
        const updated = db.getUserById(u.userId);

        u.name = updated.name;
        u.avatar = updated.avatar;

        io.to('chat-room').emit('user-updated', Utils.formatUserPublic(updated));
        self._broadcastOnline();
      });

      // ---------- ÇIKIŞ ----------
      socket.on('disconnect', () => {
        const u = self.onlineUsers.get(socket.id);
        if (u) {
          self.onlineUsers.delete(socket.id);
          self._broadcastOnline();
          io.to('chat-room').emit('system-message', {
            text: `${u.avatar} ${u.name} sohbetten ayrıldı`,
            type: 'leave'
          });
          logger.debug('Socket ayrıldı', { name: u.name });
        }
      });
    });
  }

  _broadcastOnline() {
    const list = Array.from(this.onlineUsers.values()).map(u => ({
      id: u.userId,
      name: u.name,
      avatar: u.avatar,
      isAdmin: u.isAdmin
    }));
    this.io.to('chat-room').emit('online-users', list);
  }

  _setupCron() {
    // Her 5 dakikada bir oturumları temizle
    setInterval(() => {
      try {
        this.db.cleanExpiredSessions();
      } catch (e) {
        logger.error('Cron hatası', { error: e.message });
      }
    }, 5 * 60_000);

    // Her 30 saniyede bir online bilgisi yayınla
    setInterval(() => this._broadcastOnline(), 30_000);
  }

  start() {
    this.server.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`  💕  BIZIM SOHBET  v${VERSION}`);
      console.log('='.repeat(60));
      console.log(`  🚀  Sunucu     : http://localhost:${PORT}`);
      console.log(`  🔐  Admin      : http://localhost:${PORT}/admin.html`);
      console.log(`  👤  Test       : 1111 (Ben), 2222 (Aşkım)`);
      console.log(`  👑  Admin pass : admin123`);
      console.log('='.repeat(60) + '\n');
      logger.success('Sunucu başlatıldı', { port: PORT, version: VERSION });
    });
  }
}

// ============================================================
//  BAŞLAT
// ============================================================
process.on('uncaughtException', (err) => {
  logger.error('Yakalanmamış hata', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('İşlenmemiş promise reddi', { reason: String(reason) });
});

const app = new App();
app.start();
