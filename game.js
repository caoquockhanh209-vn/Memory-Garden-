/**
 * 🌿 MEMORY GARDEN - GAME.JS 🌿
 * Game logic cho cả 2 chế độ:
 * 1. Chơi với Máy (AI có bộ nhớ mô phỏng trí nhớ con người với 3 cấp độ)
 * 2. Đấu Online thời gian thực bằng Socket.IO (Server Authoritative)
 */

// ==================== CẤU HÌNH VÀ BIỂU TƯỢNG ====================
const GARDEN_SYMBOLS = ['🌸', '🌻', '🌷', '🌹', '🍎', '🍓', '🍊', '🍉'];
const TOTAL_CARDS = 16;

// ==================== HỆ THỐNG ÂM THANH (WEB AUDIO API) ====================
// Không cần tải file âm thanh ngoài, chạy mượt mà ngay trên trình duyệt
class SoundEffects {
  constructor() {
    this.audioCtx = null;
    this.isMuted = localStorage.getItem('memory_garden_muted') === 'true';
    this.updateSoundButtonUI();
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('memory_garden_muted', this.isMuted);
    this.updateSoundButtonUI();
    return !this.isMuted;
  }

  updateSoundButtonUI() {
    const icon = document.getElementById('soundIcon');
    if (icon) {
      icon.textContent = this.isMuted ? '🔇' : '🔊';
    }
  }

  // Âm thanh lật thẻ nhẹ nhàng
  playCardFlip() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const now = this.audioCtx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Âm thanh khi tìm đúng cặp (Chime vui tươi 3 nốt)
  playMatchSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    const notes = [523.25, 659.25, 783.99]; // Đô, Mi, Sol (C5, E5, G5)
    notes.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime + idx * 0.1;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  // Âm thanh khi lật sai cặp (2 nốt trầm nhẹ)
  playMismatchSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    const notes = [311.13, 277.18]; // Eb4, Db4
    notes.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime + idx * 0.12;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    });
  }

  // Âm thanh chiến thắng (Hợp âm Fanfare)
  playVictorySound() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    const chords = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chords.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime + idx * 0.12;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.52);
    });
  }

  // Âm thanh click nút thông thường
  playClick() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const now = this.audioCtx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }
}

const sounds = new SoundEffects();

// ==================== QUẢN LÝ TRẠNG THÁI GAME ====================
const gameState = {
  mode: null,              // 'bot' | 'online'
  botDifficulty: 'normal', // 'easy' | 'normal' | 'hard'
  
  // Trạng thái chung
  p1: { name: 'Bạn', score: 0, avatar: '👤' },
  p2: { name: 'Garden Bot', score: 0, avatar: '🤖' },
  currentTurn: 1,          // 1: P1, 2: P2 (hoặc socketId đối với online)
  matchedCount: 0,         // Số cặp đã tìm thấy (tối đa 8)
  isBoardLocked: false,

  // Dành riêng cho Chế độ Chơi với Máy (Local State)
  botGame: {
    deck: [],              // 16 ký hiệu
    flippedCards: [],      // [{ index, symbol }]
    matchedIndices: new Set(),
    computerMemory: {},    // { [index]: symbol } - Bộ nhớ của Bot
    seenOrder: []          // Thứ tự quan sát các thẻ (để quên bớt nếu ở mức dễ)
  },

  // Dành riêng cho Chế độ Online (Socket.IO)
  online: {
    socket: null,
    roomCode: null,
    myPlayerNum: null,     // 1 hoặc 2
    myPlayerId: null,
    players: []
  }
};

// ==================== KHỞI TẠO DOM ELEMENTS ====================
const screens = {
  home: document.getElementById('screenHome'),
  online: document.getElementById('screenOnline'),
  game: document.getElementById('screenGame')
};

const modals = {
  botSelect: document.getElementById('modalBotSelect'),
  help: document.getElementById('modalHelp'),
  gameOver: document.getElementById('modalGameOver')
};

const dom = {
  // Bàn cờ
  cardGrid: document.getElementById('cardGrid'),
  statusBanner: document.getElementById('statusBanner'),
  statusIcon: document.getElementById('statusIcon'),
  statusText: document.getElementById('statusText'),
  gameRoomBadge: document.getElementById('gameRoomBadge'),
  gameRoomCodeText: document.getElementById('gameRoomCodeText'),
  matchedCountText: document.getElementById('matchedCountText'),
  
  // Người chơi 1 & 2
  p1Box: document.getElementById('p1Box'),
  p1Name: document.getElementById('p1Name'),
  p1Score: document.getElementById('p1Score'),
  p1Avatar: document.getElementById('p1Avatar'),
  p1TurnTag: document.getElementById('p1TurnTag'),

  p2Box: document.getElementById('p2Box'),
  p2Name: document.getElementById('p2Name'),
  p2Score: document.getElementById('p2Score'),
  p2Avatar: document.getElementById('p2Avatar'),
  p2TurnTag: document.getElementById('p2TurnTag'),

  // Game over modal
  goResultTitle: document.getElementById('goResultTitle'),
  goResultDesc: document.getElementById('goResultDesc'),
  goP1Name: document.getElementById('goP1Name'),
  goP1Score: document.getElementById('goP1Score'),
  goP2Name: document.getElementById('goP2Name'),
  goP2Score: document.getElementById('goP2Score'),

  // Online Lobby
  tabCreate: document.getElementById('tabCreate'),
  tabJoin: document.getElementById('tabJoin'),
  panelCreateRoom: document.getElementById('panelCreateRoom'),
  panelJoinRoom: document.getElementById('panelJoinRoom'),
  createPlayerName: document.getElementById('createPlayerName'),
  joinPlayerName: document.getElementById('joinPlayerName'),
  inputRoomCode: document.getElementById('inputRoomCode'),
  waitingRoomBox: document.getElementById('waitingRoomBox'),
  createdRoomCode: document.getElementById('createdRoomCode'),
  btnCopyCode: document.getElementById('btnCopyCode'),
  copySuccessMsg: document.getElementById('copySuccessMsg'),
  lobbyError: document.getElementById('lobbyError'),
  toastBox: document.getElementById('toastBox')
};

// ==================== HÀM TIỆN ÍCH GIAO DIỆN ====================
function showScreen(screenKey) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenKey].classList.add('active');
}

function openModal(modalEl) {
  modalEl.classList.add('active');
}

function closeModal(modalEl) {
  modalEl.classList.remove('active');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  dom.toastBox.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2800);
}

function updateStatus(icon, text) {
  dom.statusIcon.textContent = icon;
  dom.statusText.textContent = text;
}

// ==================== TẠO BÀN CỜ 4x4 ====================
function createBoard(total = 16) {
  dom.cardGrid.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const card = document.createElement('div');
    card.className = 'garden-card';
    card.dataset.index = i;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back">
          <span class="card-back-icon">🌿</span>
        </div>
        <div class="card-face card-front">
          <span class="card-symbol" id="card-symbol-${i}">❓</span>
        </div>
      </div>
    `;

    // Sự kiện click lật thẻ
    card.addEventListener('click', () => handleCardClick(i));
    dom.cardGrid.appendChild(card);
  }
}

// ================================================================
// PHẦN 1: CHẾ ĐỘ CHƠI VỚI MÁY (BOT VỚI BỘ NHỚ THỰC TẾ)
// ================================================================

/**
 * Xáo trộn bài ngẫu nhiên (Fisher-Yates) cho chế độ chơi offline
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Bắt đầu trận đấu với Garden Bot
 */
function startBotGame() {
  gameState.mode = 'bot';
  gameState.p1 = { name: 'Bạn', score: 0, avatar: '👤' };
  
  // Tên máy theo cấp độ
  const botNames = {
    easy: 'Garden Bot 🌱',
    normal: 'Garden Bot 🌿',
    hard: 'Garden Bot 🌳'
  };
  gameState.p2 = { name: botNames[gameState.botDifficulty], score: 0, avatar: '🤖' };
  
  gameState.currentTurn = 1; // Bạn đi trước
  gameState.matchedCount = 0;
  gameState.isBoardLocked = false;

  // Chuẩn bị bộ bài
  const deck = shuffle([...GARDEN_SYMBOLS, ...GARDEN_SYMBOLS]);
  gameState.botGame = {
    deck: deck,
    flippedCards: [],
    matchedIndices: new Set(),
    computerMemory: {},
    seenOrder: []
  };

  // Cập nhật giao diện
  dom.gameRoomBadge.style.display = 'none';
  dom.p1Name.textContent = gameState.p1.name;
  dom.p1Avatar.textContent = gameState.p1.avatar;
  dom.p2Name.textContent = gameState.p2.name;
  dom.p2Avatar.textContent = gameState.p2.avatar;

  updateScoreUI();
  updateTurnUI();
  createBoard(16);
  showScreen('game');
  updateStatus('🌸', 'Lượt của bạn! Hãy lật 2 thẻ');
}

/**
 * Ghi nhớ thẻ vào bộ nhớ của Máy dựa trên độ khó
 */
function recordCardToBotMemory(index, symbol) {
  const bg = gameState.botGame;
  const diff = gameState.botDifficulty;

  if (diff === 'easy') {
    // 35% khả năng Bot không để ý (quên thẻ này)
    if (Math.random() < 0.35) return;
    
    // Chỉ nhớ tối đa 2 thẻ gần nhất
    bg.computerMemory[index] = symbol;
    bg.seenOrder.push(index);
    if (bg.seenOrder.length > 2) {
      const forgottenIndex = bg.seenOrder.shift();
      delete bg.computerMemory[forgottenIndex];
    }
  } else if (diff === 'normal') {
    // Nhớ khoảng 85% các thẻ
    if (Math.random() < 0.15) return;
    bg.computerMemory[index] = symbol;
  } else {
    // Hard: Nhớ tuyệt đối 100% tất cả thẻ đã thấy
    bg.computerMemory[index] = symbol;
  }
}

/**
 * Xử lý click lật thẻ trong chế độ chơi với Bot
 */
function handleBotModeCardClick(index) {
  const bg = gameState.botGame;

  // Kiểm tra tính hợp lệ
  if (gameState.isBoardLocked) return;
  if (gameState.currentTurn !== 1) return; // Không phải lượt người
  if (bg.matchedIndices.has(index)) return;
  if (bg.flippedCards.some(c => c.index === index)) return;

  // Lật thẻ thứ 1 hoặc thứ 2 của người chơi
  flipLocalCard(index);
}

/**
 * Lật hiển thị thẻ trên bàn cờ
 */
function flipLocalCard(index) {
  const bg = gameState.botGame;
  const symbol = bg.deck[index];
  const cardEl = dom.cardGrid.children[index];
  
  cardEl.classList.add('flipped');
  const symbolEl = document.getElementById(`card-symbol-${index}`);
  if (symbolEl) symbolEl.textContent = symbol;
  
  sounds.playCardFlip();

  // Thêm vào danh sách thẻ đang lật
  bg.flippedCards.push({ index, symbol });

  // Bot cũng nhìn thấy và ghi nhớ thẻ này!
  recordCardToBotMemory(index, symbol);

  // Nếu đã lật đủ 2 thẻ trong lượt
  if (bg.flippedCards.length === 2) {
    gameState.isBoardLocked = true;
    checkBotModeMatch();
  }
}

/**
 * Kiểm tra kết quả 2 thẻ trong chế độ Chơi với Máy
 */
function checkBotModeMatch() {
  const bg = gameState.botGame;
  const [first, second] = bg.flippedCards;
  const isMatch = (first.symbol === second.symbol);

  if (isMatch) {
    // ĐÚNG CẶP!
    setTimeout(() => {
      sounds.playMatchSound();
      
      // Đánh dấu khớp trên DOM
      const card1 = dom.cardGrid.children[first.index];
      const card2 = dom.cardGrid.children[second.index];
      card1.classList.add('matched');
      card2.classList.add('matched');

      bg.matchedIndices.add(first.index);
      bg.matchedIndices.add(second.index);
      delete bg.computerMemory[first.index];
      delete bg.computerMemory[second.index];

      // Cộng điểm cho người đang có lượt
      if (gameState.currentTurn === 1) {
        gameState.p1.score++;
        showToast('🌸 Bạn tìm thấy 1 cặp (+1 điểm)!');
      } else {
        gameState.p2.score++;
        showToast('🤖 Bot tìm thấy 1 cặp (+1 điểm)!');
      }

      gameState.matchedCount++;
      updateScoreUI();

      bg.flippedCards = [];
      gameState.isBoardLocked = false;

      // Kiểm tra kết thúc game
      if (bg.matchedIndices.size === TOTAL_CARDS) {
        endGame();
      } else {
        // Người tìm đúng ĐƯỢC ĐI TIẾP
        if (gameState.currentTurn === 1) {
          updateStatus('🌸', 'Đúng rồi! Bạn được lật tiếp');
        } else {
          updateStatus('🤖', 'Bot đúng và được đi tiếp...');
          setTimeout(triggerBotTurn, 1000);
        }
      }
    }, 450);

  } else {
    // SAI CẶP!
    setTimeout(() => {
      sounds.playMismatchSound();
      
      const card1 = dom.cardGrid.children[first.index];
      const card2 = dom.cardGrid.children[second.index];
      card1.classList.add('mismatch');
      card2.classList.add('mismatch');

      // Úp lại sau 1000ms
      setTimeout(() => {
        card1.classList.remove('flipped', 'mismatch');
        card2.classList.remove('flipped', 'mismatch');

        bg.flippedCards = [];
        gameState.isBoardLocked = false;

        // Chuyển lượt
        gameState.currentTurn = (gameState.currentTurn === 1) ? 2 : 1;
        updateTurnUI();

        if (gameState.currentTurn === 2) {
          updateStatus('🤖', `${gameState.p2.name} đang suy nghĩ...`);
          setTimeout(triggerBotTurn, 900);
        } else {
          updateStatus('🌸', 'Lượt của bạn! Hãy lật 2 thẻ');
        }
      }, 1000);
    }, 350);
  }
}

/**
 * Xử lý trí tuệ nhân tạo của Garden Bot khi đến lượt
 */
function triggerBotTurn() {
  if (gameState.mode !== 'bot' || gameState.currentTurn !== 2) return;
  const bg = gameState.botGame;

  // Tập hợp các thẻ chưa mở
  const unrevealedIndices = [];
  for (let i = 0; i < TOTAL_CARDS; i++) {
    if (!bg.matchedIndices.has(i)) {
      unrevealedIndices.push(i);
    }
  }

  if (unrevealedIndices.length === 0) return;

  // Bước 1: Kiểm tra xem trong bộ nhớ có cặp nào đã biết cả 2 vị trí không
  let knownPair = findKnownPairInMemory(bg.computerMemory, bg.matchedIndices);

  let firstIndex = -1;
  let secondIndex = -1;

  if (knownPair) {
    [firstIndex, secondIndex] = knownPair;
  } else {
    // Bước 2: Chưa biết cặp nào -> chọn ngẫu nhiên một thẻ chưa mở
    // Ưu tiên thẻ chưa từng có trong memory để khám phá thêm
    const unknownIndices = unrevealedIndices.filter(idx => !(idx in bg.computerMemory));
    if (unknownIndices.length > 0) {
      firstIndex = unknownIndices[Math.floor(Math.random() * unknownIndices.length)];
    } else {
      firstIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
    }
  }

  // Delay lật thẻ thứ 1 của bot để tạo cảm giác tự nhiên (800ms)
  setTimeout(() => {
    flipBotCard(firstIndex);

    // Sau khi lật thẻ 1, kiểm tra xem thẻ 2 có thể tìm thấy trong memory không
    const firstSymbol = bg.deck[firstIndex];
    let mateIndex = -1;

    // Tìm trong memory xem có thẻ nào cùng symbol với thẻ 1 vừa lật không (khác firstIndex)
    for (const [idxStr, sym] of Object.entries(bg.computerMemory)) {
      const idx = parseInt(idxStr, 10);
      if (idx !== firstIndex && sym === firstSymbol && !bg.matchedIndices.has(idx)) {
        mateIndex = idx;
        break;
      }
    }

    if (secondIndex === -1) {
      if (mateIndex !== -1) {
        secondIndex = mateIndex; // Đã nhớ vị trí cặp của thẻ 1!
      } else {
        // Không biết cặp ở đâu -> chọn ngẫu nhiên 1 thẻ khác
        const remaining = unrevealedIndices.filter(i => i !== firstIndex);
        secondIndex = remaining[Math.floor(Math.random() * remaining.length)];
      }
    }

    // Delay lật thẻ thứ 2 (950ms)
    setTimeout(() => {
      flipBotCard(secondIndex);
    }, 950);

  }, 800);
}

/**
 * Tìm xem trong memory có 2 vị trí nào có cùng ký hiệu không
 */
function findKnownPairInMemory(memory, matchedSet) {
  const symbolMap = {}; // symbol -> [indices]
  for (const [idxStr, sym] of Object.entries(memory)) {
    const idx = parseInt(idxStr, 10);
    if (matchedSet.has(idx)) continue;
    if (!symbolMap[sym]) symbolMap[sym] = [];
    symbolMap[sym].push(idx);
    if (symbolMap[sym].length === 2) {
      return [symbolMap[sym][0], symbolMap[sym][1]];
    }
  }
  return null;
}

/**
 * Bot thực hiện lật thẻ
 */
function flipBotCard(index) {
  const bg = gameState.botGame;
  const symbol = bg.deck[index];
  const cardEl = dom.cardGrid.children[index];

  cardEl.classList.add('flipped');
  const symbolEl = document.getElementById(`card-symbol-${index}`);
  if (symbolEl) symbolEl.textContent = symbol;

  sounds.playCardFlip();
  bg.flippedCards.push({ index, symbol });
  recordCardToBotMemory(index, symbol);

  if (bg.flippedCards.length === 2) {
    gameState.isBoardLocked = true;
    checkBotModeMatch();
  }
}

// ================================================================
// PHẦN 2: CHẾ ĐỘ ĐẤU ONLINE 2 NGƯỜI (SOCKET.IO - SERVER AUTHORITATIVE)
// ================================================================

function initSocketConnection() {
  if (gameState.online.socket) return;

  // Kết nối đến cùng host và port đang phục vụ web
  gameState.online.socket = io();
  const socket = gameState.online.socket;

  // Lắng nghe: Tạo phòng thành công
  socket.on('roomCreated', ({ roomCode, playerNum, playerName }) => {
    gameState.online.roomCode = roomCode;
    gameState.online.myPlayerNum = playerNum;
    gameState.online.myPlayerId = socket.id;

    dom.createdRoomCode.textContent = roomCode;
    dom.waitingRoomBox.classList.remove('hidden');
    dom.lobbyError.classList.add('hidden');
    showToast(`🌱 Phòng ${roomCode} đã tạo thành công!`);
  });

  // Lắng nghe: Tham gia phòng thành công
  socket.on('joinedRoom', ({ roomCode, playerNum, playerName }) => {
    gameState.online.roomCode = roomCode;
    gameState.online.myPlayerNum = playerNum;
    gameState.online.myPlayerId = socket.id;
    dom.lobbyError.classList.add('hidden');
  });

  // Lắng nghe: Game bắt đầu (khi đủ 2 người)
  socket.on('gameStarted', ({ roomCode, players, currentTurn, totalCards }) => {
    gameState.mode = 'online';
    gameState.online.roomCode = roomCode;
    gameState.online.players = players;
    gameState.matchedCount = 0;
    gameState.isBoardLocked = false;

    // Xác định ai là Player 1 và Player 2
    const p1Data = players.find(p => p.playerNum === 1);
    const p2Data = players.find(p => p.playerNum === 2);

    gameState.p1 = {
      id: p1Data.id,
      name: p1Data.name + (p1Data.id === socket.id ? ' (Bạn)' : ''),
      score: 0,
      avatar: '👤'
    };
    gameState.p2 = {
      id: p2Data.id,
      name: p2Data.name + (p2Data.id === socket.id ? ' (Bạn)' : ''),
      score: 0,
      avatar: '👤'
    };

    gameState.currentTurn = currentTurn;

    // Cập nhật giao diện phòng chơi
    dom.gameRoomBadge.style.display = 'inline-block';
    dom.gameRoomCodeText.textContent = roomCode;
    dom.p1Name.textContent = gameState.p1.name;
    dom.p1Avatar.textContent = gameState.p1.avatar;
    dom.p2Name.textContent = gameState.p2.name;
    dom.p2Avatar.textContent = gameState.p2.avatar;

    updateScoreUI();
    updateTurnUI();
    createBoard(totalCards || 16);
    showScreen('game');

    const isMyTurn = (currentTurn === socket.id);
    if (isMyTurn) {
      updateStatus('🌸', 'Trận đấu bắt đầu! Lượt của bạn');
    } else {
      updateStatus('⏳', 'Trận đấu bắt đầu! Lượt của đối thủ');
    }
    showToast('🚀 Trận đấu Online đã bắt đầu!');
  });

  // Lắng nghe: Thẻ được lật (nhận từ Server Authoritative)
  socket.on('cardFlipped', ({ cardIndex, symbol, playerId }) => {
    const cardEl = dom.cardGrid.children[cardIndex];
    if (!cardEl) return;

    cardEl.classList.add('flipped');
    const symbolEl = document.getElementById(`card-symbol-${cardIndex}`);
    if (symbolEl) symbolEl.textContent = symbol;

    sounds.playCardFlip();
  });

  // Lắng nghe: Kết quả so sánh 2 thẻ từ Server
  socket.on('matchResult', ({ match, cardIndices, scores, currentTurn, scoredPlayerId }) => {
    const [idx1, idx2] = cardIndices;
    const card1 = dom.cardGrid.children[idx1];
    const card2 = dom.cardGrid.children[idx2];

    // Cập nhật điểm từ Server
    if (scores) {
      if (gameState.p1.id in scores) gameState.p1.score = scores[gameState.p1.id];
      if (gameState.p2.id in scores) gameState.p2.score = scores[gameState.p2.id];
      updateScoreUI();
    }

    if (match) {
      // Đúng cặp!
      sounds.playMatchSound();
      if (card1) card1.classList.add('matched');
      if (card2) card2.classList.add('matched');

      gameState.matchedCount++;
      dom.matchedCountText.textContent = gameState.matchedCount;

      const isMe = (scoredPlayerId === socket.id);
      if (isMe) {
        showToast('🌸 Bạn tìm thấy 1 cặp (+1 điểm)!');
      } else {
        showToast('Đối thủ tìm thấy 1 cặp!');
      }

    } else {
      // Sai cặp! Hiệu ứng rung nhẹ rồi úp lại
      sounds.playMismatchSound();
      if (card1) card1.classList.add('mismatch');
      if (card2) card2.classList.add('mismatch');

      setTimeout(() => {
        if (card1) card1.classList.remove('flipped', 'mismatch');
        if (card2) card2.classList.remove('flipped', 'mismatch');
      }, 950);
    }

    // Cập nhật lượt chơi mới
    gameState.currentTurn = currentTurn;
    updateTurnUI();

    const isMyTurn = (currentTurn === socket.id);
    if (isMyTurn) {
      updateStatus('🌸', match ? 'Đúng rồi! Bạn được lật tiếp' : 'Đến lượt bạn! Hãy lật 2 thẻ');
    } else {
      updateStatus('⏳', 'Đang chờ đối thủ lật thẻ...');
    }
  });

  // Lắng nghe: Kết thúc trận đấu
  socket.on('gameOver', ({ scores, players, winnerId, isDraw }) => {
    sounds.playVictorySound();
    
    // Cập nhật điểm cuối cùng
    const p1Data = players.find(p => p.playerNum === 1);
    const p2Data = players.find(p => p.playerNum === 2);
    
    dom.goP1Name.textContent = p1Data.name;
    dom.goP1Score.textContent = `${scores[p1Data.id]} điểm`;
    dom.goP2Name.textContent = p2Data.name;
    dom.goP2Score.textContent = `${scores[p2Data.id]} điểm`;

    if (isDraw) {
      dom.goResultTitle.textContent = '🌿 TRẬN ĐẤU HÒA!';
      dom.goResultDesc.textContent = 'Cả hai người chơi đều có trí nhớ siêu phàm!';
    } else if (winnerId === socket.id) {
      dom.goResultTitle.textContent = '🏆 BẠN ĐÃ CHIẾN THẮNG!';
      dom.goResultDesc.textContent = 'Tuyệt vời! Bạn là chủ nhân của khu vườn ký ức!';
    } else {
      dom.goResultTitle.textContent = '🍃 ĐỐI THỦ ĐÃ THẮNG!';
      dom.goResultDesc.textContent = 'Đừng buồn, hãy thử lại ở ván tiếp theo nhé!';
    }

    openModal(modals.gameOver);
  });

  // Lắng nghe: Đối thủ rời phòng hoặc mất kết nối
  socket.on('playerDisconnected', ({ message }) => {
    showToast(message || '🍃 Đối thủ đã rời phòng!');
    updateStatus('🍃', message || 'Đối thủ đã rời khỏi phòng');
    setTimeout(() => {
      alert(message || 'Đối thủ đã ngắt kết nối. Nhấn OK để về trang chủ.');
      showScreen('home');
      closeModal(modals.gameOver);
    }, 1500);
  });

  // Lắng nghe lỗi từ Server
  socket.on('errorMessage', ({ message }) => {
    dom.lobbyError.textContent = message;
    dom.lobbyError.classList.remove('hidden');
    showToast(message);
  });

  // Thông báo hệ thống
  socket.on('systemNotification', ({ message }) => {
    showToast(message);
  });
}

/**
 * Xử lý click lật thẻ trong chế độ Online: Gửi request lên Server xác thực
 */
function handleOnlineModeCardClick(index) {
  const socket = gameState.online.socket;
  if (!socket) return;

  // Kiểm tra cơ bản phía client để tránh spam socket không cần thiết
  if (gameState.currentTurn !== socket.id) {
    showToast('🍃 Chưa đến lượt của bạn!');
    return;
  }

  const cardEl = dom.cardGrid.children[index];
  if (cardEl && (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched'))) {
    return;
  }

  // Gửi sự kiện lên server
  socket.emit('flipCard', {
    roomCode: gameState.online.roomCode,
    cardIndex: index
  });
}

// ==================== ĐIỀU HƯỚNG SỰ KIỆN CLICK THẺ ====================
function handleCardClick(index) {
  if (gameState.mode === 'bot') {
    handleBotModeCardClick(index);
  } else if (gameState.mode === 'online') {
    handleOnlineModeCardClick(index);
  }
}

// ==================== CẬP NHẬT UI ĐIỂM VÀ LƯỢT ====================
function updateScoreUI() {
  dom.p1Score.textContent = gameState.p1.score;
  dom.p2Score.textContent = gameState.p2.score;
  dom.matchedCountText.textContent = gameState.matchedCount;
}

function updateTurnUI() {
  if (gameState.mode === 'bot') {
    if (gameState.currentTurn === 1) {
      dom.p1Box.classList.add('active-turn');
      dom.p2Box.classList.remove('active-turn');
    } else {
      dom.p1Box.classList.remove('active-turn');
      dom.p2Box.classList.add('active-turn');
    }
  } else if (gameState.mode === 'online') {
    if (gameState.currentTurn === gameState.p1.id) {
      dom.p1Box.classList.add('active-turn');
      dom.p2Box.classList.remove('active-turn');
    } else {
      dom.p1Box.classList.remove('active-turn');
      dom.p2Box.classList.add('active-turn');
    }
  }
}

// ==================== KẾT THÚC GAME VÀ MODAL WINNER ====================
function endGame() {
  sounds.playVictorySound();

  dom.goP1Name.textContent = gameState.p1.name;
  dom.goP1Score.textContent = `${gameState.p1.score} điểm`;
  dom.goP2Name.textContent = gameState.p2.name;
  dom.goP2Score.textContent = `${gameState.p2.score} điểm`;

  if (gameState.p1.score > gameState.p2.score) {
    dom.goResultTitle.textContent = '🏆 BẠN ĐÃ CHIẾN THẮNG!';
    dom.goResultDesc.textContent = 'Chúc mừng bạn đã chinh phục Memory Garden!';
  } else if (gameState.p2.score > gameState.p1.score) {
    dom.goResultTitle.textContent = '🤖 GARDEN BOT CHIẾN THẮNG!';
    dom.goResultDesc.textContent = 'Bot đã ghi nhớ xuất sắc! Hãy thử lại nào!';
  } else {
    dom.goResultTitle.textContent = '🌿 TRẬN ĐẤU HÒA!';
    dom.goResultDesc.textContent = 'Cả hai đều có trí nhớ thật đáng kinh ngạc!';
  }

  openModal(modals.gameOver);
}

// ==================== LẮNG NGHE SỰ KIỆN GIAO DIỆN (EVENT LISTENERS) ====================
document.addEventListener('DOMContentLoaded', () => {

  // Nút âm thanh
  document.getElementById('btnSoundToggle').addEventListener('click', () => {
    sounds.toggleMute();
  });

  // Nút mở hướng dẫn
  document.getElementById('btnHelp').addEventListener('click', () => {
    sounds.playClick();
    openModal(modals.help);
  });
  document.getElementById('btnMenuHelp').addEventListener('click', () => {
    sounds.playClick();
    openModal(modals.help);
  });

  // Đóng modal qua nút x và nút xác nhận
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      sounds.playClick();
      const modalId = btn.getAttribute('data-close');
      const targetModal = document.getElementById(modalId);
      if (targetModal) closeModal(targetModal);
    });
  });

  // Mở modal chọn cấp độ Bot
  document.getElementById('btnOpenBotModal').addEventListener('click', () => {
    sounds.playClick();
    openModal(modals.botSelect);
  });

  // Chọn cấp độ Bot trong modal
  document.querySelectorAll('.btn-diff').forEach(btn => {
    btn.addEventListener('click', () => {
      sounds.playClick();
      document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameState.botDifficulty = btn.getAttribute('data-diff');
    });
  });

  // Bắt đầu game với Bot
  document.getElementById('btnStartBotGame').addEventListener('click', () => {
    sounds.playClick();
    closeModal(modals.botSelect);
    startBotGame();
  });

  // Mở màn hình Online Lobby
  document.getElementById('btnOpenOnlineModal').addEventListener('click', () => {
    sounds.playClick();
    initSocketConnection();
    showScreen('online');
    dom.waitingRoomBox.classList.add('hidden');
    dom.lobbyError.classList.add('hidden');
  });

  // Nút quay lại từ Lobby về Home
  document.getElementById('btnBackToHomeFromLobby').addEventListener('click', () => {
    sounds.playClick();
    showScreen('home');
  });

  // Tab Tạo phòng / Vào phòng
  dom.tabCreate.addEventListener('click', () => {
    sounds.playClick();
    dom.tabCreate.classList.add('active');
    dom.tabJoin.classList.remove('active');
    dom.panelCreateRoom.classList.add('active');
    dom.panelJoinRoom.classList.remove('active');
    dom.lobbyError.classList.add('hidden');
  });

  dom.tabJoin.addEventListener('click', () => {
    sounds.playClick();
    dom.tabJoin.classList.add('active');
    dom.tabCreate.classList.remove('active');
    dom.panelJoinRoom.classList.add('active');
    dom.panelCreateRoom.classList.remove('active');
    dom.lobbyError.classList.add('hidden');
  });

  // Tạo phòng Socket.IO
  document.getElementById('btnDoCreateRoom').addEventListener('click', () => {
    sounds.playClick();
    initSocketConnection();
    const name = dom.createPlayerName.value.trim() || 'Player 1';
    gameState.online.socket.emit('createRoom', { playerName: name });
  });

  // Sao chép mã phòng
  dom.btnCopyCode.addEventListener('click', () => {
    sounds.playClick();
    const code = dom.createdRoomCode.textContent;
    if (code && code !== '----') {
      navigator.clipboard.writeText(code).then(() => {
        dom.copySuccessMsg.classList.remove('hidden');
        setTimeout(() => dom.copySuccessMsg.classList.add('hidden'), 2500);
      });
    }
  });

  // Tham gia phòng Socket.IO
  document.getElementById('btnDoJoinRoom').addEventListener('click', () => {
    sounds.playClick();
    initSocketConnection();
    const name = dom.joinPlayerName.value.trim() || 'Player 2';
    const code = dom.inputRoomCode.value.trim().toUpperCase();

    if (!code) {
      dom.lobbyError.textContent = '🌱 Vui lòng nhập mã phòng!';
      dom.lobbyError.classList.remove('hidden');
      return;
    }

    gameState.online.socket.emit('joinRoom', { roomCode: code, playerName: name });
  });

  // Nút chơi lại trong bàn cờ
  document.getElementById('btnRestartGame').addEventListener('click', () => {
    sounds.playClick();
    if (gameState.mode === 'bot') {
      startBotGame();
    } else if (gameState.mode === 'online') {
      gameState.online.socket.emit('restartGame', { roomCode: gameState.online.roomCode });
    }
  });

  // Nút rời bàn về sảnh/home
  document.getElementById('btnLeaveGame').addEventListener('click', () => {
    sounds.playClick();
    if (confirm('Bạn có chắc chắn muốn rời trận đấu hiện tại?')) {
      if (gameState.mode === 'online' && gameState.online.socket) {
        gameState.online.socket.emit('leaveRoom', { roomCode: gameState.online.roomCode });
      }
      showScreen('home');
    }
  });

  // Nút chơi lại từ modal Game Over
  document.getElementById('btnGoPlayAgain').addEventListener('click', () => {
    sounds.playClick();
    closeModal(modals.gameOver);
    if (gameState.mode === 'bot') {
      startBotGame();
    } else if (gameState.mode === 'online') {
      gameState.online.socket.emit('restartGame', { roomCode: gameState.online.roomCode });
    }
  });

  // Nút về Home từ modal Game Over
  document.getElementById('btnGoHome').addEventListener('click', () => {
    sounds.playClick();
    closeModal(modals.gameOver);
    if (gameState.mode === 'online' && gameState.online.socket) {
      gameState.online.socket.emit('leaveRoom', { roomCode: gameState.online.roomCode });
    }
    showScreen('home');
  });

  // Click logo nhỏ để về Home nếu không trong trận
  document.getElementById('miniLogo').addEventListener('click', () => {
    if (screens.game.classList.contains('active')) {
      if (confirm('Rời trận đấu để về trang chủ?')) {
        showScreen('home');
      }
    } else {
      showScreen('home');
    }
  });

});
