# MockSocket

Two-part WebSocket test app:
- `server/` Node.js WebSocket server
- `ui/` Vite + React + Tailwind UI

## Requirements
- Node.js 18+ (tested on 22)

## Setup

### 1) Server
```
cd server
npm install
npm run dev
```
Server listens on `ws://0.0.0.0:8080` and accepts JSON messages.

### 2) UI
```
cd ui
npm install
npm run dev
```
Open the UI in your browser (default `http://<host>:5173`).

## UI Flow
- First screen is a **Connect** page.
- Enter the WebSocket URL and connect.
- On successful connection, you are taken to **WebSocket Test Console**.
- On disconnect, you return to the Connect page with the URL prefilled.

## Protocol

### Client ? Server
Subscribe:
```json
{ "type": "subscribe", "channel": "orders" }
```

Send:
```json
{ "type": "send", "channel": "orders", "message": "New order created: ORD-101" }
```

Unsubscribe:
```json
{ "type": "unsubscribe", "channel": "orders" }
```

Identify UI (sent automatically by the UI on connect):
```json
{ "type": "identify", "role": "ui" }
```

### Server ? Client
Acks:
```json
{ "type": "ack", "action": "subscribe", "channel": "orders", "status": "ok" }
```
```json
{ "type": "ack", "action": "send", "channel": "orders", "status": "delivered" }
```
```json
{ "type": "ack", "action": "unsubscribe", "channel": "orders", "status": "ok" }
```

## Raw Message Handling
- The UI **does not parse or format** WebSocket messages.
- Messages are shown exactly as sent/received (raw string).
- Copy button preserves all spacing and special characters.

## Broadcasting Behavior
- Any client message is **mirrored (raw)** to UI clients only.
- When a client sends a `type: "send"` message, the **raw payload** is broadcast to all subscribers of that channel.

## Build Output
- UI build output is `ui/doc/`.
- Static assets in `ui/public/` are copied to `ui/doc/` on build.

## Config
Default WebSocket host/port lives in:
```
ui/src/config.js
```

Update those values to change the default connection URL.
