/**
 * 🌿 MEMORY GARDEN - SERVER.JS 🌿
 * Game lật thẻ ghi nhớ đối kháng thời gian thực
 * Công nghệ: Node.js, Express, Socket.IO
 * Kiến trúc: Server-Authoritative (Server làm chủ trạng thái game)
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Phục vụ file tĩnh từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// 8 loại biểu tượng khu vườn (mỗi loại 2 thẻ = 16 thẻ)
const GARDEN_SYMBOLS = ['🌸', '🌻', '🌷', '🌹', '🍎', '🍓', '🍊', '🍉'];

// Quản lý tất cả các phòng chơi: roomCode -> RoomData
const rooms = new Map();

/**
 * Tạo bộ bài 16 lá và xáo trộn ngẫu nhiên (Fisher-Yates)
 */
function createShuffledDeck() {
  const deck = [...GARDEN_SYMBOLS, ...GARDEN_SYMBOLS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Tạo mã phòng ngẫu nhiên gồm 4 ký tự chữ và số dễ đọc
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Bỏ các ký tự dễ nhầm lẫn như 0, O, 1, I
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

/**
 * Xử lý khi có client kết nối Socket.IO
 */
io.on('connection', (socket) => {
  console.log(`🌿 Client kết nối: ${socket.id}`);

  /**
   * 1. TẠO PHÒNG MỚI (createRoom)
   */
  socket.on('createRoom', ({ playerName }) => {
    const roomCode = generateRoomCode();
    const cleanName = (playerName && playerName.trim()) ? playerName.trim().substring(0, 15) : 'Player 1';

    const newRoom = {
      code: roomCode,
      players: [
        {
          id: socket.id,
          name: cleanName,
          playerNum: 1,
          score: 0
        }
      ],
      deck: createShuffledDeck(),
      scores: {
        [socket.id]: 0
      },
      currentTurn: socket.id,
      flippedCards: [],     // Lưu các thẻ đang mở trong lượt: [{ index, symbol }]
      matchedIndices: new Set(), // Tập hợp các index thẻ đã tìm thấy cặp
      isEvaluating: false,  // Khóa bàn chơi khi đang kiểm tra 2 thẻ
      status: 'waiting',    // waiting | playing | finished
      createdAt: Date.now()
    };

    rooms.set(roomCode, newRoom);
    socket.join(roomCode);
    socket.roomCode = roomCode;

    console.log(`🏡 Phòng ${roomCode} được tạo bởi ${cleanName} (${socket.id})`);

    socket.emit('roomCreated', {
      roomCode: roomCode,
      playerNum: 1,
      playerName: cleanName
    });
  });

  /**
   * 2. THAM GIA PHÒNG (joinRoom)
   */
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const formattedCode = roomCode ? roomCode.trim().toUpperCase() : '';
    const room = rooms.get(formattedCode);

    if (!room) {
      socket.emit('errorMessage', { message: '🌱 Phòng không tồn tại hoặc đã kết thúc!' });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('errorMessage', { message: '🌱 Phòng này đã đủ 2 người chơi!' });
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('errorMessage', { message: '🌱 Trận đấu trong phòng này đã bắt đầu!' });
      return;
    }

    const cleanName = (playerName && playerName.trim()) ? playerName.trim().substring(0, 15) : 'Player 2';

    const player2 = {
      id: socket.id,
      name: cleanName,
      playerNum: 2,
      score: 0
    };

    room.players.push(player2);
    room.scores[socket.id] = 0;
    room.status = 'playing';

    socket.join(formattedCode);
    socket.roomCode = formattedCode;

    console.log(`🤝 ${cleanName} (${socket.id}) đã tham gia phòng ${formattedCode}`);

    // Thông báo cho người chơi 2 biết đã vào thành công
    socket.emit('joinedRoom', {
      roomCode: formattedCode,
      playerNum: 2,
      playerName: cleanName
    });

    // Bắt đầu game cho cả 2 người
    io.to(formattedCode).emit('gameStarted', {
      roomCode: formattedCode,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        playerNum: p.playerNum,
        score: room.scores[p.id]
      })),
      currentTurn: room.currentTurn, // Người chơi 1 đi trước
      totalCards: 16
    });
  });

  /**
   * 3. LẬT THẺ (flipCard) - Server Authoritative
   */
  socket.on('flipCard', ({ roomCode, cardIndex }) => {
    const room = rooms.get(roomCode);

    // 1. Kiểm tra phòng tồn tại và đang diễn ra
    if (!room || room.status !== 'playing') return;

    // 2. Kiểm tra người chơi có trong phòng không
    const isPlayerInRoom = room.players.some(p => p.id === socket.id);
    if (!isPlayerInRoom) return;

    // 3. Kiểm tra có đúng lượt người chơi không
    if (room.currentTurn !== socket.id) {
      socket.emit('systemNotification', { message: '🍃 Chưa đến lượt của bạn!' });
      return;
    }

    // 4. Kiểm tra bàn cờ có đang bị khóa chờ xử lý kết quả không
    if (room.isEvaluating) return;

    // 5. Kiểm tra chỉ số thẻ hợp lệ
    const idx = parseInt(cardIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= 16) return;

    // 6. Kiểm tra thẻ đã được match trước đó chưa
    if (room.matchedIndices.has(idx)) return;

    // 7. Kiểm tra thẻ đã lật trong lượt hiện tại chưa (tránh click 2 lần vào 1 thẻ)
    if (room.flippedCards.some(c => c.index === idx)) return;

    // Lấy ký hiệu thẻ từ bộ bài trên Server (Bảo mật tuyệt đối, Client không đoán trước)
    const cardSymbol = room.deck[idx];
    room.flippedCards.push({ index: idx, symbol: cardSymbol });

    // Phát sự kiện mở thẻ cho toàn phòng
    io.to(roomCode).emit('cardFlipped', {
      cardIndex: idx,
      symbol: cardSymbol,
      playerId: socket.id
    });

    // Nếu đã lật đủ 2 thẻ trong lượt này
    if (room.flippedCards.length === 2) {
      room.isEvaluating = true; // Khóa bàn chơi

      const [first, second] = room.flippedCards;
      const isMatch = (first.symbol === second.symbol);

      if (isMatch) {
        // TRƯỜNG HỢP: 2 THẺ GIỐNG NHAU (+1 điểm, giữ ngửa, được đi tiếp)
        room.matchedIndices.add(first.index);
        room.matchedIndices.add(second.index);
        room.scores[socket.id] += 1;

        // Cập nhật điểm cho player object
        const activePlayer = room.players.find(p => p.id === socket.id);
        if (activePlayer) activePlayer.score = room.scores[socket.id];

        const isGameOver = (room.matchedIndices.size === 16);

        if (isGameOver) {
          room.status = 'finished';
          room.isEvaluating = false;
          room.flippedCards = [];

          // Xác định người thắng hoặc hòa
          const p1 = room.players[0];
          const p2 = room.players[1];
          let winnerId = null;
          let isDraw = false;

          if (room.scores[p1.id] > room.scores[p2.id]) {
            winnerId = p1.id;
          } else if (room.scores[p2.id] > room.scores[p1.id]) {
            winnerId = p2.id;
          } else {
            isDraw = true;
          }

          io.to(roomCode).emit('matchResult', {
            match: true,
            cardIndices: [first.index, second.index],
            scores: room.scores,
            currentTurn: room.currentTurn,
            scoredPlayerId: socket.id
          });

          // Gửi thông báo kết thúc trận đấu sau 600ms để hiệu ứng khớp hoàn tất
          setTimeout(() => {
            io.to(roomCode).emit('gameOver', {
              scores: room.scores,
              players: room.players.map(p => ({
                id: p.id,
                name: p.name,
                score: room.scores[p.id],
                playerNum: p.playerNum
              })),
              winnerId: winnerId,
              isDraw: isDraw
            });
          }, 600);

        } else {
          // Chưa hết bài, người chơi hiện tại ĐƯỢC TIẾP TỤC LƯỢT
          room.flippedCards = [];
          room.isEvaluating = false;

          io.to(roomCode).emit('matchResult', {
            match: true,
            cardIndices: [first.index, second.index],
            scores: room.scores,
            currentTurn: room.currentTurn,
            scoredPlayerId: socket.id
          });
        }

      } else {
        // TRƯỜNG HỢP: 2 THẺ KHÁC NHAU (Úp lại sau 1000ms và chuyển lượt)
        const otherPlayer = room.players.find(p => p.id !== socket.id);
        const nextTurnId = otherPlayer ? otherPlayer.id : socket.id;

        setTimeout(() => {
          room.flippedCards = [];
          room.isEvaluating = false;
          room.currentTurn = nextTurnId;

          io.to(roomCode).emit('matchResult', {
            match: false,
            cardIndices: [first.index, second.index],
            scores: room.scores,
            currentTurn: room.currentTurn
          });
        }, 1000);
      }
    }
  });

  /**
   * 4. CHƠI LẠI TRONG PHÒNG (restartGame)
   */
  socket.on('restartGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.players.length < 2) return;

    // Reset bàn cờ và bộ bài mới
    room.deck = createShuffledDeck();
    room.matchedIndices.clear();
    room.flippedCards = [];
    room.isEvaluating = false;
    room.status = 'playing';

    room.players.forEach(p => {
      room.scores[p.id] = 0;
      p.score = 0;
    });

    // Luôn đổi người đi trước hoặc chọn người chơi 1
    room.currentTurn = room.players[0].id;

    console.log(`🔄 Ván mới bắt đầu tại phòng ${roomCode}`);

    io.to(roomCode).emit('gameStarted', {
      roomCode: roomCode,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        playerNum: p.playerNum,
        score: 0
      })),
      currentTurn: room.currentTurn,
      totalCards: 16
    });
  });

  /**
   * 5. RỜI PHÒNG (leaveRoom)
   */
  socket.on('leaveRoom', ({ roomCode }) => {
    handlePlayerLeaving(socket, roomCode);
  });

  /**
   * 6. MẤT KẾT NỐI (disconnect)
   */
  socket.on('disconnect', () => {
    console.log(`🍂 Client ngắt kết nối: ${socket.id}`);
    if (socket.roomCode) {
      handlePlayerLeaving(socket, socket.roomCode);
    }
  });
});

/**
 * Xử lý khi một người chơi rời phòng hoặc mất kết nối
 */
function handlePlayerLeaving(socket, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const leavingPlayer = room.players.find(p => p.id === socket.id);
  const remainingPlayer = room.players.find(p => p.id !== socket.id);

  socket.leave(roomCode);
  delete socket.roomCode;

  if (remainingPlayer) {
    // Thông báo cho người còn lại
    io.to(roomCode).emit('playerDisconnected', {
      message: `🍃 ${leavingPlayer ? leavingPlayer.name : 'Đối thủ'} đã rời khỏi trận đấu!`
    });
  }

  // Xóa phòng khỏi danh sách
  rooms.delete(roomCode);
  console.log(`🧹 Đã dọn dẹp phòng ${roomCode}`);
}

// Khởi động server
server.listen(PORT, () => {
  console.log(`\n==========================================`);
  console.log(`🌿 MEMORY GARDEN SERVER ĐANG CHẠY!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`==========================================\n`);
});
