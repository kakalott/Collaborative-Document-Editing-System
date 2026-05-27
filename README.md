# Collaborative Document Editing System

## Giới thiệu

**Collaborative Document Editing System** là hệ thống hỗ trợ nhiều người dùng cùng chỉnh sửa tài liệu theo thời gian thực.

Dự án được xây dựng với:

* Frontend: ReactJS + TailwindCSS
* Backend: NestJS + Socket.IO
* Database: MongoDB
* Authentication: JWT
* Real-time Communication: WebSocket / Socket.IO
* Operational Transformation (OT): Đồng bộ chỉnh sửa tài liệu thời gian thực

---

# Tính năng chính

* Đăng ký tài khoản
* Đăng nhập bằng JWT Authentication
* Tạo tài liệu mới
* Chỉnh sửa tài liệu thời gian thực
* Đồng bộ nội dung giữa nhiều người dùng
* Theo dõi trạng thái online/offline
* Xem tài liệu
* WebSocket realtime
* Hệ thống OT (Operational Transformation)

---

# Cấu trúc thư mục

```bash
Collaborative-Document-Editing-System/
│
├── frontend-app/          # React Frontend
│   ├── src/
│   ├── public/
│   └── build/
│
├── backend-sever/         # NestJS Backend
│   ├── src/
│   ├── dist/
│   └── test/
│
└── README.md
```

---

# Công nghệ sử dụng

## Frontend

* ReactJS
* React Hooks
* TailwindCSS
* Axios
* Socket.IO Client

## Backend

* NestJS
* TypeScript
* Socket.IO
* JWT Authentication
* MongoDB + Mongoose
* WebSocket Gateway

---

# Yêu cầu môi trường

Trước khi chạy dự án cần cài đặt:

| Công cụ | Phiên bản đề xuất |
| ------- | ----------------- |
| Node.js | >= 18             |
| npm     | >= 9              |
| MongoDB | >= 6              |
| Git     | Mới nhất          |

Kiểm tra phiên bản:

```bash
node -v
npm -v
mongod --version
```

---

# Clone dự án

```bash
git clone <repository-url>
```

Hoặc giải nén file rar nếu đã có source code.

Sau đó di chuyển vào thư mục project:

```bash
cd Collaborative-Document-Editing-System
```

---

# HƯỚNG DẪN CÀI ĐẶT LẦN ĐẦU

## Bước 1: Cài dependencies cho Backend

```bash
cd backend-sever
npm install
```

---

## Bước 2: Cài dependencies cho Frontend

Mở terminal mới:

```bash
cd frontend-app
npm install
```

---

# Cấu hình môi trường Backend

Trong thư mục `backend-sever` tạo file:

```bash
.env
```

Ví dụ:

```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/collaborative-editor
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

---

# Khởi động MongoDB

## Windows

Nếu dùng MongoDB Community Server:

```bash
mongod
```

Hoặc mở MongoDB Compass nếu dùng Compass.

---

## Linux

```bash
sudo systemctl start mongod
```

Kiểm tra trạng thái:

```bash
sudo systemctl status mongod
```

---

# Chạy dự án lần đầu

## Chạy Backend

Mở terminal:

```bash
cd backend-sever
npm run start:dev
```

Backend mặc định chạy tại:

```bash
http://localhost:3001
```

---

## Chạy Frontend

Mở terminal khác:

```bash
cd frontend-app
npm start
```

Frontend mặc định chạy tại:

```bash
http://localhost:3000
```

---

# HƯỚNG DẪN CHẠY NHỮNG LẦN SAU

Sau khi đã cài dependencies rồi thì KHÔNG cần chạy lại `npm install`.

Chỉ cần:

## Bước 1: Khởi động MongoDB

```bash
mongod
```

Hoặc:

```bash
sudo systemctl start mongod
```

---

## Bước 2: Chạy Backend

```bash
cd backend-sever
npm run start:dev
```

---

## Bước 3: Chạy Frontend

```bash
cd frontend-app
npm start
```

---

# Build Production

## Frontend

```bash
cd frontend-app
npm run build
```

Sau khi build xong sẽ tạo thư mục:

```bash
frontend-app/build
```

---

## Backend

```bash
cd backend-sever
npm run build
```

Sau khi build sẽ tạo thư mục:

```bash
backend-sever/dist
```

---

# Scripts thường dùng

## Frontend

```bash
npm start          # Chạy development
npm run build      # Build production
npm test           # Chạy test
```


## Backend

```bash
npm run start:dev  # Chạy development
npm run build      # Build production
npm run start      # Chạy production
npm run test       # Chạy test
```


# Kiến trúc hệ thống

## Frontend

Frontend chịu trách nhiệm:

* Giao diện người dùng
* Authentication
* Editor UI
* Kết nối WebSocket
* Hiển thị tài liệu realtime


## Backend

Backend chịu trách nhiệm:

* Authentication API
* Quản lý người dùng
* Quản lý tài liệu
* WebSocket Gateway
* Đồng bộ realtime
* OT Engine


# Các module Backend

## Auth Module

Xử lý:

* Đăng nhập
* Đăng ký
* JWT
* Authorization


## Document Module

Xử lý:

* CRUD tài liệu
* Đồng bộ dữ liệu
* Lưu tài liệu


## Socket Gateway

Xử lý:

* WebSocket connection
* Real-time editing
* Broadcast dữ liệu


## OT Engine

Xử lý:

* Operational Transformation
* Resolve conflict khi nhiều user cùng sửa
* Đồng bộ nội dung


# Các component Frontend

| Component       | Chức năng              |
| --------------- | ---------------------- |
| Login.js        | Đăng nhập              |
| Register.js     | Đăng ký                |
| Editor.js       | Soạn thảo tài liệu     |
| ViewDocument.js | Xem tài liệu           |
| Header.js       | Thanh điều hướng       |
| AuthProvider.js | Quản lý authentication |

---

# Luồng hoạt động hệ thống

1. Người dùng đăng nhập
2. Frontend nhận JWT token
3. Kết nối WebSocket tới server
4. Người dùng mở tài liệu
5. Nội dung được đồng bộ realtime
6. OT Engine xử lý xung đột chỉnh sửa
7. Dữ liệu được lưu vào MongoDB


# Một số lỗi thường gặp

## 1. Port already in use

Lỗi:

```bash
EADDRINUSE
```

Cách xử lý:

Đổi PORT trong file `.env`

Hoặc kill process đang dùng port.


## 2. MongoDB connection failed

Kiểm tra:

* MongoDB đã chạy chưa
* URI trong `.env` đúng chưa

Ví dụ:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/collaborative-editor
```

## 3. npm install bị lỗi

Xóa:

```bash
node_modules
package-lock.json
```

Sau đó cài lại:

```bash
npm install
```


## 4. Frontend không kết nối được Backend

Kiểm tra:

* Backend đã chạy chưa
* URL API đúng chưa
* CORS đã bật chưa
* Port frontend/backend có đúng không


# Hướng phát triển tương lai

* Rich Text Editor
* Comment realtime
* Version history
* Chia sẻ tài liệu bằng link
* Permission editor/viewer
* Dark mode
* Export PDF/DOCX
* Collaborative cursor
* Google Docs style presence

Dự án được phát triển nhằm mục đích:

* Học tập
* Nghiên cứu hệ thống realtime
* Tìm hiểu Operational Transformation
* Tìm hiểu WebSocket
* Thực hành React + NestJS

