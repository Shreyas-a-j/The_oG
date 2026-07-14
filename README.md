# The_oG — Secure Real-Time Messaging App

## 1) Project Folder Structure (Step-by-Step)

```text
The_oG/
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── middleware/auth.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Room.js
│   │   │   └── Message.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── rooms.js
│   │   │   └── messages.js
│   │   ├── socket.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── .gitignore
├── package.json
└── README.md
```

## 2) Installation & Run Commands

```bash
# from repository root
cd /home/runner/work/The_oG/The_oG

# install dependencies
npm --prefix backend install
npm --prefix frontend install

# configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# run backend (terminal 1)
npm run dev:backend

# run frontend (terminal 2)
npm run dev:frontend
```

## 3) Architecture Blueprint

### Frontend
- React (Vite) + Tailwind CSS UI
- JWT-based auth flow (register/login)
- Room list + room creation (public/private)
- Real-time message stream, typing indicators, connection status

### Backend
- Express REST API for auth, rooms, message history
- Socket.io server for low-latency bi-directional events
- JWT validation for HTTP and WebSocket auth
- bcrypt password hashing for stored credentials

### Database (MongoDB + Mongoose)
- `User`: identity, hashed password, online/offline state
- `Room`: public/private room metadata + members
- `Message`: room-scoped persisted chat history with sender reference

## 4) Core Feature Coverage

- ✅ Secure registration/login (`/api/auth/register`, `/api/auth/login`) with JWT + bcrypt
- ✅ Rooms/channels + private room support (`/api/rooms`)
- ✅ Real-time messaging (`message:send` / `message:new`)
- ✅ Typing indicators (`typing:start`, `typing:stop`, `typing:update`)
- ✅ Online/offline presence (`presence:update`)
- ✅ Message persistence + history loading (`GET /api/messages/:roomId`)

## 5) Important Environment Variables

### Backend (`backend/.env`)
```env
PORT=4000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/the_og
JWT_SECRET=replace-with-a-long-random-secret
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```
