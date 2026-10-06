/**
 * 🧪 TEST-E2E.JS - Kiểm thử tự động toàn diện Memory Garden
 * Kiểm tra:
 * 1. HTTP Server phục vụ static files (index.html, style.css, game.js)
 * 2. Socket.IO connection
 * 3. Tạo phòng (createRoom) -> sinh mã 4 ký tự
 * 4. Người thứ hai tham gia (joinRoom)
 * 5. Bắt đầu game (gameStarted) với đủ 2 người
 * 6. Kiểm tra quyền lượt (Chặn người chơi khi chưa đến lượt)
 * 7. Lật thẻ (flipCard) -> nhận cardFlipped từ server
 * 8. Server kiểm tra trùng khớp (matchResult) và tính điểm
 * 9. Chơi lại (restartGame)
 * 10. Xử lý ngắt kết nối (playerDisconnected)
 */

const http = require('http');
const { io: Client } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

function testHttp() {
  return new Promise((resolve, reject) => {
    http.get(SERVER_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 && data.includes('Memory Garden')) {
          console.log('✅ TEST 1: HTTP Server phục vụ index.html thành công (200 OK)');
          resolve();
        } else {
          reject(new Error(`HTTP test thất bại, statusCode: ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('\n🌿 ==========================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG MEMORY GARDEN');
  console.log('==========================================\n');

  try {
    // 1. Kiểm tra HTTP Server
    await testHttp();

    // 2. Kết nối Socket 1 (Player 1)
    console.log('🌱 Đang kết nối Người chơi 1 (Player 1)...');
    const socket1 = Client(SERVER_URL);
    await new Promise(r => socket1.on('connect', r));
    console.log(`✅ TEST 2: Người chơi 1 kết nối thành công: ${socket1.id}`);

    // 3. Player 1 tạo phòng
    const roomCreatedPromise = new Promise((resolve) => {
      socket1.on('roomCreated', (data) => {
        console.log(`✅ TEST 3: Tạo phòng thành công! Mã phòng: ${data.roomCode}, PlayerNum: ${data.playerNum}`);
        resolve(data);
      });
    });
    socket1.emit('createRoom', { playerName: 'Hoa Hồng 🌸' });
    const { roomCode } = await roomCreatedPromise;

    if (!roomCode || roomCode.length !== 4) {
      throw new Error(`Mã phòng không hợp lệ: ${roomCode}`);
    }

    // 4. Kết nối Socket 2 (Player 2)
    console.log('🌱 Đang kết nối Người chơi 2 (Player 2)...');
    const socket2 = Client(SERVER_URL);
    await new Promise(r => socket2.on('connect', r));
    console.log(`✅ TEST 4: Người chơi 2 kết nối thành công: ${socket2.id}`);

    // 5. Player 2 tham gia phòng và cả 2 nhận gameStarted
    const gameStartPromise1 = new Promise(r => socket1.on('gameStarted', r));
    const gameStartPromise2 = new Promise(r => socket2.on('gameStarted', r));

    socket2.emit('joinRoom', { roomCode, playerName: 'Hướng Dương 🌻' });

    const [gameData1, gameData2] = await Promise.all([gameStartPromise1, gameStartPromise2]);
    console.log(`✅ TEST 5: Trận đấu bắt đầu thành công cho cả 2 người chơi!`);
    console.log(`   - Phòng: ${gameData1.roomCode}`);
    console.log(`   - Người chơi: ${gameData1.players.map(p => `${p.name} (#${p.playerNum})`).join(' vs ')}`);
    console.log(`   - Lượt đi đầu tiên: ${gameData1.currentTurn === socket1.id ? 'Người chơi 1 (Đúng)' : 'Sai'}`);

    if (gameData1.currentTurn !== socket1.id) {
      throw new Error('Lượt đi đầu tiên phải thuộc về Người chơi 1');
    }

    // 6. Kiểm tra chống gian lận: Người chơi 2 cố lật thẻ khi chưa đến lượt
    const wrongTurnPromise = new Promise((resolve) => {
      socket2.on('systemNotification', (data) => {
        console.log(`✅ TEST 6: Chống gian lận thành công: Server từ chối lật thẻ sai lượt ("${data.message}")`);
        resolve();
      });
    });
    socket2.emit('flipCard', { roomCode, cardIndex: 0 });
    await wrongTurnPromise;

    // 7. Người chơi 1 lật thẻ 0
    const flip1Promise = new Promise((resolve) => {
      socket1.on('cardFlipped', (data) => {
        console.log(`✅ TEST 7: Thẻ #${data.cardIndex} được lật: [${data.symbol}] bởi ${data.playerId === socket1.id ? 'Player 1' : 'Player 2'}`);
        resolve(data);
      });
    });
    socket1.emit('flipCard', { roomCode, cardIndex: 0 });
    const flip1 = await flip1Promise;

    // 8. Người chơi 1 lật thẻ 1 (thẻ thứ hai trong lượt)
    const matchPromise = new Promise((resolve) => {
      socket1.on('matchResult', (data) => {
        console.log(`✅ TEST 8: Server tính toán kết quả lượt lật:`);
        console.log(`   - Cặp thẻ: [${data.cardIndices.join(', ')}]`);
        console.log(`   - Trùng khớp: ${data.match ? '🌸 ĐÚNG CẶP (+1 điểm, đi tiếp)' : '🍃 SAI CẶP (Đổi lượt)'}`);
        console.log(`   - Điểm số:`, data.scores);
        resolve(data);
      });
    });
    socket1.emit('flipCard', { roomCode, cardIndex: 1 });
    const matchResult = await matchPromise;

    // 9. Kiểm tra tính năng Chơi lại (restartGame)
    const restartPromise1 = new Promise(r => socket1.on('gameStarted', r));
    const restartPromise2 = new Promise(r => socket2.on('gameStarted', r));
    socket1.emit('restartGame', { roomCode });
    await Promise.all([restartPromise1, restartPromise2]);
    console.log(`✅ TEST 9: Tính năng Chơi lại (Ván mới) hoạt động hoàn hảo!`);

    // 10. Kiểm tra ngắt kết nối (Disconnect handling)
    const disconnectPromise = new Promise((resolve) => {
      socket1.on('playerDisconnected', (data) => {
        console.log(`✅ TEST 10: Xử lý ngắt kết nối chính xác: "${data.message}"`);
        resolve();
      });
    });
    socket2.disconnect();
    await disconnectPromise;

    socket1.disconnect();

    console.log('\n==========================================');
    console.log('🎉 TẤT CẢ 10 BÀI TEST ĐÃ VƯỢT QUA 100%! 🎉');
    console.log('==========================================\n');

    process.exit(0);

  } catch (err) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err);
    process.exit(1);
  }
}

runTests();
