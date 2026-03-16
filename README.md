# Apna Video Call (Zoom Clone)

A full-stack video conferencing web application built with React, Express, Socket.IO, WebRTC, and MongoDB.

This project supports:
- User registration/login
- Meeting code based room creation/joining
- Real-time video/audio calls (peer-to-peer via WebRTC)
- In-call chat
- Meeting history per authenticated user

## Tech Stack

### Frontend
- React 18 (Create React App)
- React Router v6
- Material UI (MUI)
- Axios
- Socket.IO Client
- WebRTC browser APIs (`RTCPeerConnection`, `getUserMedia`, `getDisplayMedia`)

### Backend
- Node.js + Express
- Socket.IO
- MongoDB + Mongoose
- bcrypt (password hashing)
- dotenv

## Project Structure

```text
Zoom/
	backend/
		src/
			app.js
			controllers/
				socketManager.js
				user.controller.js
			models/
				user.model.js
				meeting.model.js
			routes/
				users.routes.js
	frontend/
		src/
			App.js
			environment.js
			contexts/
				AuthContext.jsx
			pages/
				landing.jsx
				authentication.jsx
				home.jsx
				history.jsx
				VideoMeet.jsx
			utils/
				withAuth.jsx
```

## How It Works

1. User authenticates via `/api/v1/users/login` or `/api/v1/users/register`.
2. Backend stores a generated token on successful login in the `User` document.
3. Frontend stores token in `localStorage`.
4. Authenticated user creates or joins a meeting code.
5. Backend checks whether a meeting room currently exists (`/api/v1/meetings/check`).
6. Client joins Socket.IO room logic and establishes WebRTC peer connections.
7. Chat and signaling messages are relayed through Socket.IO.
8. Meeting code is saved to user history in MongoDB.

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=8000
MONGO_URI=<your_mongodb_connection_string>
```

### Frontend (`frontend/.env`)

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

`frontend/src/environment.js` reads `REACT_APP_BACKEND_URL` and exports it as the server base URL.

## Run Locally

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Start backend

```bash
cd backend
npm run dev
```

### 3. Start frontend

```bash
cd frontend
npm start
```

Frontend: `http://localhost:3000`

## Backend API Reference

Base URL: `http://localhost:8000`

### User Routes (`/api/v1/users`)

1. `POST /login`
- Body: `{ "username": string, "password": string }`
- Success: `{ "token": string }`

2. `POST /register`
- Body: `{ "name": string, "username": string, "password": string }`
- Success: `{ "message": "User Registered" }`

3. `POST /add_to_activity`
- Body: `{ "token": string, "meeting_code": string }`
- Success: `{ "message": "Added code to history" }`

4. `GET /get_all_activity`
- Query: `?token=<token>`
- Success: array of meeting documents

### Meeting Route

`GET /api/v1/meetings/check?meetingCode=<code>`
- Returns: `{ "exists": boolean }`
- `true` means there is at least one active socket currently in that meeting room.

## Socket Events

Implemented in `backend/src/controllers/socketManager.js` and consumed in `frontend/src/pages/VideoMeet.jsx`.

1. `join-call` (client -> server)
- Payload: `meetingCode`
- Server action: adds socket to in-memory room, broadcasts `user-joined`, replays prior room chat.

2. `user-joined` (server -> clients)
- Payload: `(newSocketId, clientsInRoom)`
- Client action: creates/updates RTCPeerConnections.

3. `signal` (bi-directional via server relay)
- Payload: SDP/ICE data
- Used to exchange WebRTC offers/answers/candidates.

4. `chat-message` (bi-directional)
- Payload: `(message, senderName, senderSocketId)`
- Server stores room chat in memory and broadcasts to room.

5. `user-left` (server -> clients)
- Payload: `socketId`
- Client action: remove disconnected participant video.

## Data Models

### `User` (`backend/src/models/user.model.js`)
- `name: String` (required)
- `username: String` (required, unique)
- `password: String` (required, bcrypt hash)
- `token: String` (session token)

### `Meeting` (`backend/src/models/meeting.model.js`)
- `user_id: String` (username reference)
- `meetingCode: String` (required)
- `date: Date` (default: now)

## Function-by-Function Reference

### Backend

#### `backend/src/app.js`

1. `connectToSocket(server)`
- Imported function called once to attach Socket.IO to HTTP server.

2. `GET /api/v1/meetings/check` handler
- Reads `meetingCode` from query.
- Calls `isRoomExists(meetingCode)`.
- Responds with `{ exists }`.

3. `start()`
- Connects to MongoDB with `mongoose.connect(process.env.MONGO_URI)`.
- Starts HTTP server on `PORT` (default 8000).

#### `backend/src/controllers/socketManager.js`

In-memory stores:
- `connections`: `{ [roomCode]: socketId[] }`
- `messages`: `{ [roomCode]: chatMessage[] }`
- `timeOnline`: `{ [socketId]: Date }`

1. `isRoomExists(path)`
- Returns `true` when room exists and has at least one active socket.

2. `connectToSocket(server)`
- Creates Socket.IO server and registers socket handlers:

3. `socket.on("join-call", path)`
- Creates room entry if needed.
- Adds current socket to room.
- Broadcasts `user-joined` to all sockets in room.
- Sends old chat history to newly joined socket.

4. `socket.on("signal", toId, message)`
- Relays signaling payload to target peer.

5. `socket.on("chat-message", data, sender)`
- Finds the room containing current socket.
- Persists chat in in-memory room message list.
- Broadcasts message to all room participants.

6. `socket.on("disconnect")`
- Finds and removes socket from any room.
- Broadcasts `user-left` to remaining room users.
- Deletes room when empty.

#### `backend/src/controllers/user.controller.js`

1. `login(req, res)`
- Validates username/password.
- Finds user by username.
- Compares password using `bcrypt.compare`.
- Generates token using `crypto.randomBytes(20).toString("hex")`.
- Stores token on user document and returns it.

2. `register(req, res)`
- Reads `name`, `username`, `password`.
- Prevents duplicate username.
- Hashes password using `bcrypt.hash(password, 10)`.
- Creates and saves `User` document.

3. `getUserHistory(req, res)`
- Reads `token` from query.
- Finds user by token.
- Returns all `Meeting` docs for `user.username`.

4. `addToHistory(req, res)`
- Reads `token` and `meeting_code` from body.
- Finds user by token.
- Creates a `Meeting` record with `meetingCode`.

#### `backend/src/routes/users.routes.js`

1. `POST /login -> login`
2. `POST /register -> register`
3. `POST /add_to_activity -> addToHistory`
4. `GET /get_all_activity -> getUserHistory`

### Frontend

#### `frontend/src/App.js`

1. `App()`
- Sets up router and `AuthProvider`.
- Route mapping:
	- `/` -> `LandingPage`
	- `/auth` -> `Authentication`
	- `/home` -> `HomeComponent` (note: current code has a typo in route prop)
	- `/history` -> `History`
	- `/:url` -> `VideoMeetComponent`

#### `frontend/src/contexts/AuthContext.jsx`

1. `AuthProvider({ children })`
- Creates auth context state and exposes auth/history methods.

2. `handleRegister(name, username, password)`
- Calls backend register endpoint.
- Returns success message.

3. `handleLogin(username, password)`
- Calls login endpoint.
- Stores returned token in `localStorage`.
- Navigates to `/home`.

4. `getHistoryOfUser()`
- Calls `/get_all_activity` with stored token.
- Returns meetings array.

5. `addToUserHistory(meetingCode)`
- Calls `/add_to_activity` with token + meeting code.

#### `frontend/src/utils/withAuth.jsx`

1. `withAuth(WrappedComponent)`
- Higher-order component enforcing local token check.
- Redirects unauthenticated users to `/auth`.

#### `frontend/src/pages/landing.jsx`

1. `LandingPage()`
- Renders marketing/entry view.
- Navigation handlers route user to guest meeting (`/aljk23`) or auth screen.

#### `frontend/src/pages/authentication.jsx`

1. `Authentication()`
- Sign in / sign up UI with MUI.

2. `handleAuth()`
- If sign-in mode: calls `handleLogin`.
- If sign-up mode: calls `handleRegister`, resets form state, shows snackbar.

#### `frontend/src/pages/home.jsx`

1. `HomeComponent()`
- Main dashboard for creating/joining meetings.

2. `handleJoinVideoCall()`
- Validates meeting code input.
- Calls `/api/v1/meetings/check`.
- If active room exists: stores code in history and navigates to room.

3. `handleCreateMeeting()`
- Creates random 5-char meeting code.
- Saves it to history and navigates to room.

#### `frontend/src/pages/history.jsx`

1. `History()`
- Fetches current user meeting history and renders cards.

2. `useEffect(fetchHistory)`
- Invokes `getHistoryOfUser` on first render.

3. `formatDate(dateString)`
- Converts date to `DD/MM/YYYY` display format.

#### `frontend/src/pages/VideoMeet.jsx`

Key constants/helpers:
- `peerConfigConnections`: STUN config for WebRTC.
- `connections`: in-module map of peer connections.

Main functions:

1. `VideoMeetComponent()`
- Core call screen component for lobby, media controls, participants, and chat.

2. `getPermissions()`
- Requests camera/mic permissions.
- Determines screen-share capability.
- Initializes local media stream when available.

3. `getMedia()`
- Sets current video/audio state and starts socket connection.

4. `getUserMedia()`
- Requests user media based on toggles.
- Uses `getUserMediaSuccess` callback.

5. `getUserMediaSuccess(stream)`
- Replaces local stream.
- Adds stream to all active peers.
- Sends updated offers.
- Handles stream end by falling back to black/silent track.

6. `getDislayMedia()`
- Starts screen-share capture when enabled.

7. `getDislayMediaSuccess(stream)`
- Replaces local stream with display stream.
- Renegotiates peers.
- On share end, returns to camera/mic flow.

8. `gotMessageFromServer(fromId, message)`
- Processes signaling message.
- Applies remote SDP.
- Creates answer for offers.
- Adds ICE candidates.

9. `connectToSocketServer()`
- Connects to Socket.IO backend.
- Joins call room.
- Handles signaling and user join/leave events.
- Creates `RTCPeerConnection` instances per participant.

10. `silence()`
- Returns disabled audio track via `AudioContext`.

11. `black({ width, height })`
- Returns disabled video track from a canvas stream.

12. `handleVideo()`
- Toggles video enabled state.

13. `handleAudio()`
- Toggles audio enabled state.

14. `handleScreen()`
- Toggles screen sharing state.

15. `handleEndCall()`
- Stops local tracks and redirects to `/home`.

16. `openChat()` / `closeChat()`
- Controls chat modal visibility.

17. `handleMessage(e)`
- Updates chat input state.

18. `addMessage(data, sender, socketIdSender)`
- Appends message to chat log.
- Increments unread count when message is from another user.

19. `sendMessage()`
- Emits chat message to socket room and clears input.

20. `connect()`
- Leaves lobby screen and starts media/socket workflow.

## Scripts

### Backend (`backend/package.json`)
- `npm run dev`: start with nodemon
- `npm start`: start with node
- `npm run prod`: start with pm2 command

### Frontend (`frontend/package.json`)
- `npm start`: run dev server
- `npm run build`: production build
- `npm test`: test runner

## Notes / Current Limitations

1. Socket room state (`connections`, `messages`) is in-memory; restarting backend clears active rooms/messages.
2. Login token is stored in plain `localStorage` and also persisted in DB without expiry.
3. Route definition currently contains a typo in `App.js` (`path='/home's`).
4. Some imported values are unused in a few files (safe to clean in refactor).

## Suggested Improvements

1. Replace custom token with JWT + expiry and auth middleware.
2. Persist chat/room history in database if long-term history is needed.
3. Add validation (Joi/Zod) for request payloads.
4. Add tests for controllers, routes, and critical frontend flows.
5. Improve WebRTC cleanup and edge-case handling for reconnection.
