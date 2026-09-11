const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// data klasörü
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'sohbet.db'));

// Tablolar
db.exec(`
  CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_value TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Varsayılan admin şifresi
if (!db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_pass')) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_pass', 'admin123');
}

// Varsayılan key (hemen kullanabilmen için)
if (db.prepare('SELECT COUNT(*) as c FROM keys').get().c === 0) {
  db.prepare('INSERT INTO keys (key_value, name) VALUES (?, ?)').run('LOVE-2024-TRUE-LOVE', 'Ben');
  db.prepare('INSERT INTO keys (key_value, name) VALUES (?, ?)').run('ASK-2024-SEVG-LIM', 'Aşkım');
  console.log('💕 Varsayılan keyler oluşturuldu:');
  console.log('   Sen:    LOVE-2024-TRUE-LOVE');
  console.log('   O:      ASK-2024-SEVG-LIM');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== ADMIN API =====
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const pass = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_pass');
  if (password === pass.value) return res.json({ success: true, token: pass.value });
  res.status(401).json({ error: 'Yanlış şifre' });
});

function auth(req, res, next) {
  const token = req.headers['x-token'];
  const pass = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_pass');
  if (token === pass.value) next();
  else res.status(401).json({ error: 'Yetkisiz' });
}

app.get('/api/keys', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM keys ORDER BY id').all());
});

app.post('/api/keys', auth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'İsim gerekli' });
  // Rastgele güzel key üret
  const words = ['LOVE', 'ASK', 'KALP', 'RUH', 'SEVGI', 'CAN', 'BEBEK', 'MELEK', 'YILDIZ', 'GUNES'];
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  const key = `${w1}-${num}-${w2}-${Math.floor(10 + Math.random() * 90)}`;
  try {
    db.prepare('INSERT INTO keys (key_value, name) VALUES (?, ?)').run(key, name);
    res.json({ success: true, key });
  } catch (e) {
    res.status(400).json({ error: 'Key zaten var, tekrar dene' });
  }
});

app.delete('/api/keys/:id', auth, (req, res) => {
  db.prepare('DELETE FROM keys WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.patch('/api/keys/:id', auth, (req, res) => {
  const { is_active } = req.body;
  db.prepare('UPDATE keys SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.get('/api/messages', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all().reverse());
});

app.delete('/api/messages/:id', auth, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  io.emit('mesaj-silindi', Number(req.params.id));
  res.json({ success: true });
});

app.delete('/api/messages', auth, (req, res) => {
  db.prepare('DELETE FROM messages').run();
  io.emit('temizle');
  res.json({ success: true });
});

app.post('/api/password', auth, (req, res) => {
  const { newPass } = req.body;
  if (!newPass || newPass.length < 4) return res.status(400).json({ error: 'En az 4 karakter' });
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(newPass, 'admin_pass');
  res.json({ success: true, newToken: newPass });
});

// ===== SOCKET.IO =====
const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('giris', ({ key }) => {
    const k = db.prepare('SELECT * FROM keys WHERE key_value = ? AND is_active = 1').get(key);
    if (!k) return socket.emit('hata', 'Geçersiz key!');
    
    onlineUsers.set(socket.id, k.name);
    socket.emit('giris-ok', { name: k.name });
    
    // Son 100 mesaj
    const msgs = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 100').all().reverse();
    socket.emit('gecmis', msgs);
    
    io.emit('online', Array.from(onlineUsers.values()));
    io.emit('sistem', `${k.name} katıldı 💕`);
  });

  socket.on('mesaj', (msg) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender || !msg || !msg.trim()) return;
    const result = db.prepare('INSERT INTO messages (sender, message) VALUES (?, ?)').run(sender, msg.trim());
    const saved = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
    io.emit('yeni', saved);
  });

  socket.on('yaziyor', () => {
    const sender = onlineUsers.get(socket.id);
    if (sender) socket.broadcast.emit('yaziyor', sender);
  });

  socket.on('disconnect', () => {
    const sender = onlineUsers.get(socket.id);
    if (sender) {
      onlineUsers.delete(socket.id);
      io.emit('online', Array.from(onlineUsers.values()));
      io.emit('sistem', `${sender} ayrıldı`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n💕 Sohbet hazır: http://localhost:${PORT}`);
  console.log(`🔐 Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`🔑 Admin şifre: admin123\n`);
});