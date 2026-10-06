# 🌿 MEMORY GARDEN - GAME LẬT THẺ ĐỐI KHÁNG 🌿

Chào mừng bạn đến với **Memory Garden** – một game lật thẻ ghi nhớ phong cách Casual nhẹ nhàng, dễ thương với màu sắc pastel thiên nhiên!

Dự án được xây dựng hoàn chỉnh với 2 chế độ chơi:
1. **👤 VS 🤖 Chơi với Máy (Garden Bot):** Bot mô phỏng trí nhớ con người với 3 cấp độ (Dễ, Vừa, Khó).
2. **👤 VS 👤 Đấu Online 2 người:** Đồng bộ thời gian thực qua **Socket.IO** theo mô hình **Server-Authoritative** (Server làm chủ hoàn toàn trạng thái và điểm số).

---

## 1. 📂 CẤU TRÚC THƯ MỤC DỰ ÁN

```text
memory-garden/
│
├── package.json         # Danh sách thư viện (Express, Socket.IO) và script chạy
├── server.js            # Node.js Server quản lý phòng và xác thực luật chơi game
├── README.md            # Tài liệu hướng dẫn cài đặt và sử dụng chi tiết
│
└── public/              # Tài nguyên Frontend (Client)
    ├── index.html       # Giao diện HTML5 (Home, Lobby, Bàn cờ 4x4, Modals)
    ├── style.css        # CSS3 Pastel Garden, hiệu ứng lật 3D, responsive mobile
    ├── game.js          # Logic game, trí tuệ nhân tạo Bot, Web Audio API, Socket.IO client
    └── assets/
        └── favicon.svg  # Biểu tượng chiếc lá mầm xinh xắn
```

---

## 2. 🚀 CÔNG NGHỆ SỬ DỤNG

* **Frontend:** HTML5, CSS3 (3D Transform `preserve-3d`, Flexbox, CSS Grid), Vanilla JavaScript (ES6+).
* **Backend:** Node.js, Express.
* **Real-time Engine:** Socket.IO.
* **Âm thanh:** Web Audio API (tạo sóng âm trực tiếp trong trình duyệt, không cần tải file mp3).
* **Không dùng thư viện/framework cồng kềnh**, cực kỳ trực quan và phù hợp cho học sinh THPT học tập, nghiên cứu và mở rộng.

---

## 3. 📖 CÁCH CÀI ĐẶT VÀ CHẠY DỰ ÁN

### Yêu cầu tiên quyết:
* Máy tính đã cài đặt **Node.js** (khuyến nghị phiên bản 18, 20 hoặc 24 LTS).

### Bước 1: Mở Terminal tại thư mục project
```bash
cd memory-garden
```

### Bước 2: Cài đặt thư viện
```bash
npm install
```

### Bước 3: Khởi động Server
```bash
npm start
```

### Bước 4: Mở trình duyệt và thưởng thức
Truy cập địa chỉ:
```text
http://localhost:3000
```

---

## 4. 🧪 CÁCH TEST CHẾ ĐỘ MULTIPLAYER TRÊN CÙNG MỘT MÁY

Để thử nghiệm tính năng đối kháng Online 2 người chơi:

1. Mở trình duyệt (hoặc 1 tab thường + 1 tab ẩn danh / 2 trình duyệt khác nhau như Chrome & Edge):
   * **Tab 1 (Người chơi 1):**
     * Chọn **"👤 ⚔️ 👤 ĐẤU ONLINE 2 NGƯỜI"**.
     * Nhập tên (vd: `Hoa Hồng`).
     * Nhấn **"🌿 TẠO PHÒNG MỚI"**.
     * Hệ thống sẽ hiển thị một mã phòng gồm 4 ký tự (ví dụ: `G7K2`).
     * Nhấn nút **"📋 Copy"** để chép mã phòng.
   * **Tab 2 (Người chơi 2):**
     * Chọn **"👤 ⚔️ 👤 ĐẤU ONLINE 2 NGƯỜI"**.
     * Bấm chuyển sang tab **"THAM GIA PHÒNG"**.
     * Nhập tên (vd: `Hướng Dương`).
     * Dán mã phòng vừa copy vào ô **Mã phòng** (vd: `G7K2`).
     * Nhấn **"🚀 THAM GIA NGAY"**.
2. Khi Người chơi 2 tham gia, Server sẽ tự động khởi động ván đấu và đồng bộ bàn cờ 16 thẻ cho cả 2 tab cùng lúc!
3. **Thử nghiệm luật chơi:**
   * Tab 1 lật đúng cặp 🌸 - 🌸: Tab 1 được +1 điểm, thẻ giữ ngửa, Tab 1 được tiếp tục đi.
   * Tab 1 lật sai 🌸 - 🍎: 2 thẻ rung nhẹ và tự động úp lại sau 1 giây, quyền đi chuyển sang Tab 2.
   * Khi hoàn thành cả 8 cặp: Popup kết thúc ván đấu sẽ xuất hiện với thông báo người chiến thắng hoặc hòa!

---

## 5. 🤖 CƠ CHẾ AI CỦA GARDEN BOT (CHƠI VỚI MÁY)

Garden Bot **hoàn toàn không gian lận** (không đọc trước vị trí các thẻ úp). Bot sở hữu một bộ nhớ `computerMemory`:
* Khi người chơi hoặc bot lật bất kỳ thẻ nào, bot sẽ "nhìn" và ghi nhớ tọa độ + biểu tượng của thẻ đó.
* **3 cấp độ khó:**
  * 🌱 **Dễ (Easy):** Có 35% tỉ lệ lơ đễnh (quên thẻ vừa thấy) và chỉ lưu tối đa 2 thẻ gần nhất.
  * 🌿 **Bình thường (Normal):** Nhớ khoảng 85% thẻ đã nhìn thấy.
  * 🌳 **Khó (Hard):** Trí nhớ siêu phàm, ghi nhớ 100% tất cả thẻ từng được mở.
* **Chiến thuật:**
  1. Kiểm tra bộ nhớ xem có cặp nào đã biết cả 2 vị trí chưa -> nếu có, lật ngay cặp đó!
  2. Nếu chưa, lật 1 thẻ ngẫu nhiên chưa mở -> cập nhật vào trí nhớ -> kiểm tra xem đã biết thẻ còn lại chưa -> lật tiếp nếu biết!
  3. Delay tự nhiên 700ms - 1100ms giữa các thao tác như một người chơi thực thụ.

---

## 6. 🌐 KIẾN TRÚC SERVER-AUTHORITATIVE & LUỒNG SOCKET.IO

Để chống gian lận và giữ cho dữ liệu 2 bên luôn đồng bộ tuyệt đối:
* Client **KHÔNG ĐƯỢC PHÉP** tự ý tăng điểm hay tự quyết định 2 thẻ có giống nhau hay không.
* Mọi hành động lật thẻ đều gửi sự kiện `flipCard` lên Server.
* Server kiểm tra:
  1. Người gửi có trong phòng không?
  2. Có đúng lượt người chơi không?
  3. Bàn cờ có đang bị khóa (isEvaluating) không?
  4. Thẻ đó đã được giải hay chưa?
  5. Có bị lật lặp lại cùng một thẻ không?
* Sau khi xác thực hợp lệ, Server phát `cardFlipped` và `matchResult` về cho tất cả người chơi trong phòng.

---

## 7. 🎨 TÙY BIẾN VÀ PHÁT TRIỂN THÊM

* Bạn có thể dễ dàng thay đổi biểu tượng trong mảng `GARDEN_SYMBOLS` trong `server.js` và `game.js` (ví dụ: đổi thành động vật 🐶🐱🦊🐼 hoặc đồ ăn 🍕🍔🍟🍦).
* Mở rộng kích thước bàn cờ lên 6x6 (36 thẻ) hoặc thêm thời gian đếm ngược (countdown timer) cho mỗi lượt chơi.

Chúc bạn có những giờ phút giải trí vui vẻ cùng **Memory Garden**! 🌿🌸
