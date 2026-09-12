// ========================================
// BIZIM SOHBET - Client Side
// ========================================

const socket = io();
const $ = id => document.getElementById(id);

// State
let me = null;
let isAdmin = false;
let myCode = '';
let avatarSelection = '💙';
let typingTimeout = null;
let isTyping = false;
let searchActive = false;
let soundEnabled = localStorage.getItem('sound') !== 'off';
let notifEnabled = localStorage.getItem('notif') !== 'off';

// Emoji listesi
const EMOJIS = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','💩','🤡','👹','👺','👻','👽','👾','🤖',
'❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','💌','💋','😻','💐','🌹','🌺','🌸','🌷','🌻','🌼','🌱','🌲','🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁','🍂','🍃','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🥝','🍅','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🍞','🥐','🥖','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🍵','🧃','🥤','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🥤','🧊',
'⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩'];

// ============ BAŞLANGIÇ ============
window.addEventListener('load', () => {
  initEmoji();
  initAvatars();
  loadSettings();
  
  // Otomatik giriş
  const saved = localStorage.getItem('chat_code');
  if (saved) {
    myCode = saved;
    socket.emit('giris', { code: saved });
  }
});

// ============ GİRİŞ ============
$('loginBtn').onclick = () => {
  const code = $('loginCode').value.trim();
  if (!code || code.length < 4) {
    $('loginError').textContent = 'En az 4 karakter gerekli';
    return;
  }
  myCode = code;
  socket.emit('giris', { code });
};

$('loginCode').addEventListener('keypress', e => {
  if (e.key === 'Enter') $('loginBtn').click();
});

$('loginCode').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
});

// ============ SOCKET OLAYLARI ============
socket.on('giris-ok', ({ user, isAdmin: adm }) => {
  me = user;
  isAdmin = adm;
  localStorage.setItem('chat_code', myCode);
  localStorage.setItem('chat_user', JSON.stringify(user));
  
  showChat();
  updateProfileUI();
});

socket.on('giris-hata', (msg) => {
  $('loginError').textContent = msg;
  localStorage.removeItem('chat_code');
  $('loginScreen').style.display = 'flex';
  $('chatScreen').classList.remove('active');
});

socket.on('gecmis', (msgs) => {
  $('messages').innerHTML = '';
  msgs.forEach(addMessage);
  scrollBottom();
});

socket.on('yeni-mesaj', (msg) => {
  addMessage(msg);
  scrollBottom();
  
  // Bildirim
  if (msg.sender_id !== me.id) {
    playSound();
    sendNotification(msg);
  }
});

socket.on('sistem', (txt) => {
  const d = document.createElement('div');
  d.className = 'sistem-msg';
  d.textContent = txt;
  $('messages').appendChild(d);
  scrollBottom();
});

socket.on('online-listesi', (list) => {
  const others = list.filter(u => u.id !== me.id);
  const status = others.length > 0
    ? `${others.map(u => u.avatar + ' ' + u.name).join(', ')} çevrimiçi`
    : 'Kimse çevrimiçi değil';
  $('onlineStatus').textContent = status;
});

socket.on('yaziyor', ({ name }) => {
  $('typing').innerHTML = `${name} yazıyor <span class="dots"><span></span><span></span><span></span></span>`;
  clearTimeout(window.typingT);
  window.typingT = setTimeout(() => $('typing').innerHTML = '', 2500);
});

socket.on('yaziyor-dur', () => {
  $('typing').innerHTML = '';
});

socket.on('profil-guncellendi', (user) => {
  if (user.id === me.id) {
    me = user;
    localStorage.setItem('chat_user', JSON.stringify(user));
    updateProfileUI();
  }
});

socket.on('mesaj-silindi', (id) => {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
});

socket.on('temizle', () => { $('messages').innerHTML = ''; });

socket.on('okundu-bildirimi', (userId) => {
  if (userId !== me.id) {
    document.querySelectorAll('.check.sent').forEach(c => {
      c.textContent = '✓✓';
      c.classList.remove('sent');
      c.classList.add('read');
    });
  }
});

// ============ ARAYÜZ ============
function showChat() {
  $('loginScreen').style.display = 'none';
  $('chatScreen').classList.add('active');
  $('chatTitle').textContent = '💕 Bizim Sohbetimiz';
}

function updateProfileUI() {
  if (!me) return;
  $('myAvatar').textContent = me.avatar;
  $('menuAvatar').textContent = me.avatar;
  $('menuName').textContent = me.name;
  $('menuStatus').textContent = me.status || 'Hayat güzel';
  $('avatarPreview').textContent = me.avatar;
  avatarSelection = me.avatar;
}

// ============ MESAJ ============
$('messageForm').onsubmit = (e) => {
  e.preventDefault();
  sendText();
};

function sendText() {
  const text = $('messageInput').value.trim();
  if (!text) return;
  socket.emit('mesaj', { text, type: 'text' });
  $('messageInput').value = '';
  $('messageInput').focus();
  stopTyping();
}

$('messageInput').addEventListener('input', () => {
  if (!isTyping) {
    isTyping = true;
    socket.emit('yaziyor');
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 1500);
});

function stopTyping() {
  if (isTyping) {
    isTyping = false;
    socket.emit('yaziyor-dur');
  }
}

function addMessage(m) {
  const isMe = m.sender_id === me.id;
  const row = document.createElement('div');
  row.className = 'message-row ' + (isMe ? 'me' : 'other');
  row.dataset.id = m.id;
  row.dataset.text = (m.message || '').toLowerCase();

  const time = new Date(m.created_at + 'Z').toLocaleTimeString('tr-TR', {
    hour: '2-digit', minute: '2-digit'
  });

  if (m.type === 'audio' && m.audioData) {
    row.innerHTML = `
      <div class="msg-avatar">${m.sender_avatar || '💙'}</div>
      <div class="message-bubble">
        ${!isMe ? `<div class="msg-sender-name">${escapeHtml(m.sender_name)}</div>` : ''}
        <div class="audio-bubble">
          <button class="audio-play" data-audio="${m.audioData}">▶</button>
          <div class="audio-wave">
            ${Array.from({length: 20}, () => '<span></span>').join('')}
          </div>
          <div class="audio-duration">${formatDuration(m.duration || 0)}</div>
        </div>
        <div class="msg-meta">
          <span>${time}</span>
          ${isMe ? `<span class="check ${m.is_read ? 'read' : 'sent'}">${m.is_read ? '✓✓' : '✓'}</span>` : ''}
        </div>
      </div>
    `;
    row.querySelector('.audio-play').onclick = (e) => {
      const audio = new Audio(e.target.dataset.audio);
      audio.play();
      e.target.textContent = '⏸';
      audio.onended = () => e.target.textContent = '▶';
    };
  } else {
    row.innerHTML = `
      <div class="msg-avatar">${m.sender_avatar || '💙'}</div>
      <div class="message-bubble">
        ${!isMe ? `<div class="msg-sender-name">${escapeHtml(m.sender_name)}</div>` : ''}
        <div class="msg-text">${escapeHtml(m.message)}</div>
        <div class="msg-meta">
          <span>${time}</span>
          ${isMe ? `<span class="check ${m.is_read ? 'read' : 'sent'}">${m.is_read ? '✓✓' : '✓'}</span>` : ''}
        </div>
      </div>
    `;
  }

  $('messages').appendChild(row);
}

function scrollBottom() {
  const el = $('messages');
  el.scrollTop = el.scrollHeight;
}

// ============ EMOJİ ============
function initEmoji() {
  const grid = $('emojiGrid');
  grid.innerHTML = EMOJIS.map(e => `<button type="button">${e}</button>`).join('');
  grid.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      const input = $('messageInput');
      input.value += b.textContent;
      input.focus();
    };
  });
}

$('emojiBtn').onclick = () => {
  $('emojiPanel').classList.toggle('active');
  $('searchBar').classList.remove('active');
};

// ============ SES KAYDI ============
let mediaRecorder = null;
let audioChunks = [];
let recordingStart = 0;
let recordingTimer = null;

$('micBtn').onclick = async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
    return;
  }
  startRecording();
};

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    recordingStart = Date.now();

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const duration = Math.round((Date.now() - recordingStart) / 1000);
      
      // Base64'e çevir
      const reader = new FileReader();
      reader.onloadend = () => {
        const audioData = reader.result;
        socket.emit('mesaj', {
          text: '[Sesli mesaj]',
          type: 'audio',
          duration,
          audioData
        });
      };
      reader.readAsDataURL(blob);
      
      stream.getTracks().forEach(t => t.stop());
    };

    mediaRecorder.start();
    $('recordingOverlay').classList.add('active');
    $('recordingTime').textContent = '0:00';
    
    recordingTimer = setInterval(() => {
      const s = Math.floor((Date.now() - recordingStart) / 1000);
      $('recordingTime').textContent = formatDuration(s);
      if (s >= 60) stopRecording(); // max 60 sn
    }, 200);
  } catch (e) {
    alert('Mikrofon izni gerekli: ' + e.message);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    $('recordingOverlay').classList.remove('active');
    clearInterval(recordingTimer);
  }
}

function formatDuration(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ============ ARAMA ============
$('searchBtn').onclick = () => {
  $('searchBar').classList.toggle('active');
  if ($('searchBar').classList.contains('active')) {
    $('searchInput').focus();
  } else {
    clearSearch();
  }
};

$('closeSearch').onclick = () => {
  $('searchBar').classList.remove('active');
  clearSearch();
};

$('searchInput').oninput = (e) => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll('.message-row').forEach(row => {
    if (!q) {
      row.style.display = '';
      row.classList.remove('highlight');
      return;
    }
    const match = (row.dataset.text || '').includes(q);
    row.style.display = match ? '' : 'none';
    if (match) row.classList.add('highlight');
    else row.classList.remove('highlight');
  });
};

function clearSearch() {
  $('searchInput').value = '';
  document.querySelectorAll('.message-row').forEach(row => {
    row.style.display = '';
    row.classList.remove('highlight');
  });
}

// ============ MENÜ ============
$('menuBtn').onclick = () => $('menuOverlay').classList.add('active');
$('menuClose').onclick = () => $('menuOverlay').classList.remove('active');
$('menuOverlay').onclick = (e) => {
  if (e.target === $('menuOverlay')) $('menuOverlay').classList.remove('active');
};

// ============ PROFİL ============
function initAvatars() {
  const avatars = ['💙','💕','💖','❤️','💘','💝','😍','🥰','😘','🌹','🌸','🌺','⭐','✨','🌈','☀️','🌙','🦋','🐱','🐶','🐼','🦊','🐰','🦁','🐯','🐨','🐸','🐵','🦄','🐝','🐞','👑','🎀','💎','🍀'];
  const grid = $('avatarOptions');
  grid.innerHTML = avatars.map(a => `<button type="button" data-av="${a}">${a}</button>`).join('');
  grid.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      grid.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      avatarSelection = b.dataset.av;
      $('avatarPreview').textContent = avatarSelection;
    };
  });
}

$('editProfileBtn').onclick = () => {
  $('menuOverlay').classList.remove('active');
  $('profileName').value = me.name;
  $('profileStatus').value = me.status || '';
  $('avatarPreview').textContent = me.avatar;
  avatarSelection = me.avatar;
  document.querySelectorAll('#avatarOptions button').forEach(b => {
    b.classList.toggle('selected', b.dataset.av === me.avatar);
  });
  $('profileModal').classList.add('active');
};

$('profileCancel').onclick = () => $('profileModal').classList.remove('active');

$('profileSave').onclick = async () => {
  const name = $('profileName').value.trim();
  const status = $('profileStatus').value.trim() || 'Hayat güzel';
  if (!name) return alert('İsim gerekli');
  
  const res = await fetch(`/api/profile/${me.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, avatar: avatarSelection, status })
  });
  const data = await res.json();
  if (data.success) {
    me = data.user;
    localStorage.setItem('chat_user', JSON.stringify(me));
    updateProfileUI();
    $('profileModal').classList.remove('active');
  }
};

// ============ AYARLAR ============
$('settingsBtn').onclick = () => {
  $('menuOverlay').classList.remove('active');
  $('soundToggle').checked = soundEnabled;
  $('notifToggle').checked = notifEnabled;
  $('settingsModal').classList.add('active');
};

$('settingsClose').onclick = () => {
  soundEnabled = $('soundToggle').checked;
  notifEnabled = $('notifToggle').checked;
  localStorage.setItem('sound', soundEnabled ? 'on' : 'off');
  localStorage.setItem('notif', notifEnabled ? 'on' : 'off');
  $('settingsModal').classList.remove('active');
  
  if (notifEnabled && Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

function loadSettings() {
  $('soundToggle').checked = soundEnabled;
  $('notifToggle').checked = notifEnabled;
}

// ============ ÇIKIŞ ============
$('logoutBtn').onclick = () => {
  if (!confirm('Çıkış yapılsın mı?')) return;
  localStorage.removeItem('chat_code');
  localStorage.removeItem('chat_user');
  location.reload();
};

// ============ BİLDİRİM ============
function playSound() {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

function sendNotification(msg) {
  if (!notifEnabled) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;
  
  new Notification(`${msg.sender_avatar} ${msg.sender_name}`, {
    body: msg.type === 'audio' ? '🎤 Sesli mesaj' : msg.message,
    icon: '/icons/icon-192.png',
    tag: 'chat-msg'
  });
}

// ============ YARDIMCI ============
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Sayfa görünür olduğunda scroll
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scrollBottom();
});

// Mobil klavye
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', scrollBottom);
}

// Socket yeniden bağlanma
socket.on('disconnect', () => {
  $('onlineStatus').textContent = 'Bağlantı koptu...';
});

socket.on('connect', () => {
  if (me) socket.emit('giris', { code: myCode });
});