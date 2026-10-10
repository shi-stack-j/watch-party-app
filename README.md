# YouTube Watch Party — Production Ready Full-Stack Web Application

A full-stack, production-hardened, real-time synchronized YouTube Watch Party web application built with **React, TypeScript, Vite, Tailwind CSS v4, Express, Socket.IO, Prisma ORM, and MySQL**.

---

## Live Demo

[Open Watch Party Application](https://watch-party-app-ck1v.onrender.com/)

---

## 1. Project Overview & Key Features

The YouTube Watch Party application enables users to watch YouTube videos together in synchronized real-time rooms with role-based access control, persistent party chat, live emoji reactions, and host approval workflows.

### Key Features
* **Authentication & Session Security**: Email & password signup/login, bcrypt password hashing, server-side express-session in MySQL (`express-mysql-session`), cookie session security (`httpOnly`, `sameSite`, `secure`), and rate-limited auth routes.
* **Room Management & Authorization**: Create public/private rooms, invite via unique 6-character room codes or shareable links, assigned roles (**Host**, **Moderator**, **Participant**), and server-enforced access boundaries.
* **Real-Time Synchronized YouTube Playback**: Host-controlled playback (Play, Pause, Seek, Video URL change), authoritative server playback state versioning, drift correction threshold ($2.0\text{s}$), feedback-loop prevention, late-join state snapshots, and browser autoplay block detection.
* **Persistent Real-Time Chat**: MySQL-persisted chat messages (`ChatMessage` model), history fetching, auto-scrolling, rate-limiting, and server-side input validation.
* **Transient Emoji Reactions**: Real-time floating reaction animations (`😂`, `❤️`, `👍`, `😮`, `🎉`, `🔥`) with user tags and rate limiting.
* **Participant Approval Workflow**: Private room access request creation (`JoinRequest` model), pending state blocking, and real-time Host/Moderator approval/rejection panel.

---

## 2. Technology Stack & Architecture

### Frontend Stack
* **Framework**: React 19 + TypeScript + Vite
* **Styling**: Tailwind CSS v4 + lucide-react icons
* **Routing**: React Router v7
* **Real-Time**: Socket.IO Client v4
* **HTTP Client**: Axios

### Backend Stack
* **Runtime**: Node.js + Express v4 + TypeScript
* **Database & ORM**: MySQL 8.0 + Prisma ORM v6
* **Real-Time**: Socket.IO v4
* **Session Store**: `express-session` + `express-mysql-session`
* **Security & Auth**: `bcryptjs`, `express-rate-limit`, security headers middleware

```mermaid
graph TD
    Client["React + TypeScript + Vite (Port 5173)"]
    Server["Express + Socket.IO Server (Port 5000)"]
    MySQL[("MySQL Database (watchparty_db)")]
    YT["YouTube IFrame Player API"]

    Client -- "HTTP Requests (Cookies)" --> Server
    Client -- "WebSocket Connection (Session Auth)" --> Server
    Server -- "Prisma ORM Queries" --> MySQL
    Client -- "Embedded Video Stream" --> YT
```

---

## 3. Prerequisites

* **Node.js**: `v18.0.0` or higher
* **npm**: `v9.0.0` or higher
* **MySQL**: `v8.0` or higher (running locally or accessible on network)

---

## 4. Environment Variable Setup

Copy `.env.example` templates to `.env`:

### Root / Server Environment (`server/.env`)
```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
DATABASE_URL=mysql://root:password@localhost:3306/watchparty_db
SESSION_SECRET=super_secret_watch_party_session_key
```

### Client Environment (`client/.env`)
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 5. Database Setup & Prisma Synchronization

1. Create target MySQL database:
   ```sql
   CREATE DATABASE IF NOT EXISTS watchparty_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Apply database schema and generate Prisma client:
   ```bash
   cd server
   npx prisma db push
   npx prisma generate
   ```

---

## 6. Installation & Execution

### Install All Dependencies
From the repository root:
```bash
npm run install:all
```

### Development Mode
Run server and client concurrently in separate terminals:
```bash
# Terminal 1: Backend Server
npm run dev:server

# Terminal 2: Frontend Client
npm run dev:client
```
* Client will be accessible at: `http://localhost:5173`
* Backend API & Health Check at: `http://localhost:5000/health`

---

## 7. Testing, Type-Checking & Production Building

### Run Automated Jest Tests
Runs all 53 automated integration & unit test suites (`auth`, `room`, `youtubeUrl`, `video`, `playback`, `chat`, `reaction`, `approval`):
```bash
npm --prefix server test
```

### TypeScript Type-Checking
```bash
# Root monorepo script
npm run type-check
```

### Production Build
```bash
# Root build script for client & server
npm run build

# Start production backend
npm --prefix server run start
```

---

## 8. API & Socket.IO Event Overview

### REST API Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health & uptime check | No |
| `POST` | `/api/auth/signup` | Register new user account | No |
| `POST` | `/api/auth/login` | Log in user session | No |
| `POST` | `/api/auth/logout` | Destroy session & clear cookie | Yes |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes |
| `POST` | `/api/rooms` | Create new watch room | Yes |
| `GET` | `/api/rooms` | List user's rooms | Yes |
| `POST` | `/api/rooms/join` | Join room via invite code | Yes |
| `GET` | `/api/rooms/:roomId` | Get room details & membership | Yes |
| `PATCH` | `/api/rooms/:roomId/video` | Update room YouTube video | Host Only |
| `DELETE` | `/api/rooms/:roomId` | Delete watch room | Host Only |
| `POST` | `/api/rooms/:roomId/request-access` | Request access to private room | Yes |
| `GET` | `/api/rooms/:roomId/requests` | List pending join requests | Host/Mod Only |
| `PATCH` | `/api/rooms/requests/:requestId` | Approve/Reject join request | Host/Mod Only |

### Socket.IO Events
* `join_room`: Authenticates session, validates DB membership, subscribes socket to room.
* `host_playback_play`: Host emits play command with position.
* `host_playback_pause`: Host emits pause command with position.
* `host_playback_seek`: Host emits seek command with validated position.
* `playback_state_updated`: Server broadcasts state update to room members.
* `playback_snapshot`: Server pushes current snapshot on join or reconnect.
* `chat_send_message` / `chat_new_message`: Send and receive real-time chat messages.
* `reaction_send` / `reaction_new`: Send and receive transient emoji reactions.
* `room_request_join` / `room_join_request_new`: Submit and notify pending join requests.
* `room_decide_join_request` / `room_join_request_status`: Decide and notify request decisions.

---

## 9. Architectural Limitations

1. **Single-Instance In-Memory Playback State**: Authoritative active playback state (`position`, `isPlaying`, `version`) is managed in Node.js memory (`Map<string, RoomPlaybackState>`). On server restart, state safely re-initializes from MySQL room video data at `0.0s`.
2. **Browser Autoplay Policies**: Modern browsers block un-muted iframe autoplay without prior user interaction. The frontend detects autoplay blockage and displays a user action overlay to unmute and play.

---

## 10. Production Deployment Checklist

* [ ] Set `NODE_ENV=production` in production environment.
* [ ] Configure a strong, random `SESSION_SECRET` (e.g. 64 random bytes).
* [ ] Serve backend over HTTPS so session cookies set `secure: true`.
* [ ] Set `CLIENT_URL` to exact production frontend domain for CORS.
* [ ] Run `npx prisma db push` or migrations on target MySQL database.
* [ ] Ensure reverse proxy (e.g. Nginx, Caddy) passes WebSocket upgrade headers for Socket.IO (`Upgrade` and `Connection`).
