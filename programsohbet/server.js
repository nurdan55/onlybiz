// ========================================
// BIZIM SOHBET - Profesyonel Backend
// ========================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// ----- Veritabanı -----
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const db = new Database(path.join(dataDir, 'sohbet.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '💕',
    status TEXT DEFAULT 'Hayat güzel',
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    duration INTEGER DEFAULT 0,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Varsayılan admin
if (!db.prepare('SELECT * FROM users WHERE is_admin = 1').get()) {
  db.prepare('INSERT INTO users (code, name, avatar, is_admin) VALUES (?, ?, ?, 1)')
    .run('9999', 'Admin', '👑');
  console.log('👑 Admin oluşturuldu - Şifre: 9999');
}

// Varsayılan kullanıcılar
if (db.prepare('SELECT COUNT(*) as c FROM users WHERE is_admin = 0').get().c === 0) {
  db.prepare('INSERT INTO users (code, name, avatar) VALUES (?, ?, ?)').run('1111', 'Ben', '💙');
  db.prepare('INSERT INTO users (code, name, avatar) VALUES (?, ?, ?)').run('2222', 'Aşkım', '💕');
  console.log('💕 Varsayılan kullanıcılar: 1111 ve 2222');
}

// Admin şifresi
if (!db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_pass')) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_pass', 'admin123');
}

// ----- Express + Socket -----
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 10e6,
  cors: { origin: '*' }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ----- Yardımcılar -----
const onlineUsers = new Map();

function userPublic(u) {
  return { id: u.id, name: u.name, avatar: u.avatar, status: u.status, last_seen: u.last_seen };
}

function sendRecent(socket) {
  const msgs = db.prepare(`
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
    FROM messages m JOIN users u ON m.sender_id = u.id
    ORDER BY m.id DESC LIMIT 200
  `).all().reverse();
  socket.emit('gecmis', msgs);
}

function broadcastOnline() {
  const list = Array.from(onlineUsers.values()).map(u => ({
    id: u.userId, name: u.name, avatar: u.avatar, isAdmin: u.isAdmin
  }));
  io.emit('online-listesi', list);
}

// ----- API -----
app.post('/api/login', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Şifre gerekli' });
  
  const adminPass = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_pass').value;
  if (code === adminPass) {
    const admin = db.prepare('SELECT * FROM users WHERE is_admin = 1').get();
    return res.json({ success: true, isAdmin: true, user: userPublic(admin) });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE code = ? AND is_admin = 0').get(code);
  if (!user) return res.status(401).json({ error: 'Şifre yanlış' });
  
  db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  res.json({ success: true, isAdmin: false, user: userPublic(user) });
});

app.put('/api/profile/:id', (req, res) => {
  const { name, avatar, status } = req.body;
  db.prepare('UPDATE users SET name = ?, avatar = ?, status = ? WHERE id = ?')
    .run(name, avatar, status, req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  io.emit('profil-guncellendi', userPublic(u));
  res.json({ success: true, user: userPublic(u) });
});

// ----- Admin API -----
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  const pass = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_pass').value;
  if (token === pass) next();
  else res.status(401).json({ error: 'Yetkisiz' });
}

app.get('/api/admin/users', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT id, code, name, avatar, status, is_admin, created_at, last_seen FROM users ORDER BY id').all());
});

app.post('/api/admin/users', adminAuth, (req, res) => {
  const { code, name, avatar } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Şifre ve isim gerekli' });
  if (code.length < 4) return res.status(400).json({ error: 'En az 4 karakter' });
  try {
    db.prepare('INSERT INTO users (code, name, avatar) VALUES (?, ?, ?)').run(code, name, avatar || '💙');
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: 'Bu şifre zaten var' }); }
});

app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ? AND is_admin = 0').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/admin/users/:id', adminAuth, (req, res) => {
  const { code, name, avatar } = req.body;
  db.prepare('UPDATE users SET code = ?, name = ?, avatar = ? WHERE id = ? AND is_admin = 0')
    .run(code, name, avatar, req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/messages', adminAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
    FROM messages m JOIN users u ON m.sender_id = u.id
    ORDER BY m.id DESC LIMIT 500
  `).all().reverse();
  res.json(rows);
});

app.delete('/api/admin/messages/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  io.emit('mesaj-silindi', Number(req.params.id));
  res.json({ success: true });
});

app.delete('/api/admin/messages', adminAuth, (req, res) => {
  db.prepare('DELETE FROM messages').run();
  io.emit('temizle');
  res.json({ success: true });
});

app.post('/api/admin/password', adminAuth, (req, res) => {
  const { newPass } = req.body;
  if (!newPass || newPass.length < 4) return res.status(400).json({ error: 'En az 4 karakter' });
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(newPass, 'admin_pass');
  res.json({ success: true, newToken: newPass });
});

// ----- Socket.IO -----
io.on('connection', (socket) => {
  console.log('🔌 Bağlantı:', socket.id);

  socket.on('giris', ({ code }) => {
    const adminPass = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_pass').value;
    
    if (code === adminPass) {
      const admin = db.prepare('SELECT * FROM users WHERE is_admin = 1').get();
      onlineUsers.set(socket.id, { userId: admin.id, name: admin.name, avatar: admin.avatar, isAdmin: true });
      socket.emit('giris-ok', { user: userPublic(admin), isAdmin: true });
      sendRecent(socket);
      broadcastOnline();
      io.emit('sistem', `👑 ${admin.name} sohbete katıldı`);
      return;
    }
    
    const user = db.prepare('SELECT * FROM users WHERE code = ? AND is_admin = 0').get(code);
    if (!user) return socket.emit('giris-hata', 'Şifre yanlış');
    
    db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    onlineUsers.set(socket.id, { userId: user.id, name: user.name, avatar: user.avatar, isAdmin: false });
    socket.emit('giris-ok', { user: userPublic(user), isAdmin: false });
    sendRecent(socket);
    broadcastOnline();
    io.emit('sistem', `${user.avatar} ${user.name} katıldı`);
    
    db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id != ? AND is_read = 0').run(user.id);
    io.emit('okundu-bildirimi', user.id);
  });

  socket.on('mesaj', ({ text, type, duration, audioData }) => {
    const u = onlineUsers.get(socket.id);
    if (!u) return;
    if (!text && !audioData) return;
    
    const result = db.prepare(`
      INSERT INTO messages (sender_id, message, type, duration)
      VALUES (?, ?, ?, ?)
    `).run(u.userId, text || '', type || 'text', duration || 0);
    
    const saved = db.prepare(`
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);
    
    if (audioData) saved.audioData = audioData;
    io.emit('yeni-mesaj', saved);
  });

  socket.on('yaziyor', () => {
    const u = onlineUsers.get(socket.id);
    if (u) socket.broadcast.emit('yaziyor', { name: u.name });
  });

  socket.on('yaziyor-dur', () => {
    socket.broadcast.emit('yaziyor-dur');
  });

  socket.on('disconnect', () => {
    const u = onlineUsers.get(socket.id);
    if (u) {
      onlineUsers.delete(socket.id);
      broadcastOnline();
      io.emit('sistem', `${u.avatar} ${u.name} ayrıldı`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Sunucu: http://localhost:${PORT}`);
  console.log(`🔐 Admin: http://localhost:${PORT}/admin.html`);
  console.log(`👤 Test kullanıcıları: 1111 (Ben), 2222 (Aşkım)`);
  console.log(`👑 Admin şifre: admin123\n`);
});