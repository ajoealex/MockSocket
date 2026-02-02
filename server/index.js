import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

const channels = new Map(); // channel -> Set<ws>
let clientSeq = 1;

function ensureChannel(name) {
  if (!channels.has(name)) channels.set(name, new Set());
  return channels.get(name);
}

function sendJson(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(channel, payload) {
  const set = channels.get(channel);
  if (!set) return;
  for (const client of set) sendJson(client, payload);
}

function broadcastRawToChannel(channel, raw) {
  const set = channels.get(channel);
  if (!set) return;
  for (const client of set) {
    if (client.readyState === client.OPEN) {
      client.send(raw);
    }
  }
}

function broadcastRaw(raw, sender) {
  for (const client of wss.clients) {
    if (client === sender) continue;
    if (!client.isUi) continue;
    if (client.readyState === client.OPEN) {
      client.send(raw);
    }
  }
}

wss.on("connection", (ws) => {
  ws.id = `client-${clientSeq++}`;
  ws.subscriptions = new Set();
  ws.isUi = false;

  console.log(`[connect] ${ws.id}`);

  ws.on("message", (data) => {
    const raw = data.toString();
    broadcastRaw(raw, ws);
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      sendJson(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    const { type, channel, message } = msg || {};

    if (type === "identify" && msg.role === "ui") {
      ws.isUi = true;
      console.log(`[identify] ${ws.id} -> ui`);
      sendJson(ws, { type: "ack", action: "identify", role: "ui", status: "ok" });
      return;
    }

    if (type === "subscribe" && channel) {
      ensureChannel(channel).add(ws);
      ws.subscriptions.add(channel);
      console.log(`[subscribe] ${ws.id} -> ${channel}`);
      sendJson(ws, { type: "ack", action: "subscribe", channel, status: "ok" });
      return;
    }

    if (type === "unsubscribe" && channel) {
      const set = channels.get(channel);
      if (set) set.delete(ws);
      ws.subscriptions.delete(channel);
      console.log(`[unsubscribe] ${ws.id} -> ${channel}`);
      sendJson(ws, { type: "ack", action: "unsubscribe", channel, status: "ok" });
      return;
    }

    if (type === "send" && channel && typeof message === "string") {
      console.log(`[send] ${ws.id} -> ${channel}: ${message}`);
      sendJson(ws, { type: "ack", action: "send", channel, status: "delivered" });
      broadcastRawToChannel(channel, raw);
      return;
    }

    sendJson(ws, { type: "error", message: "Unknown message format" });
  });

  ws.on("close", () => {
    for (const channel of ws.subscriptions) {
      const set = channels.get(channel);
      if (set) set.delete(ws);
    }
    console.log(`[disconnect] ${ws.id}`);
  });
});

const KEEP_ALIVE_INTERVAL = 30_000;

setInterval(() => {
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      sendJson(client, { type: "keep-alive", timestamp: Date.now() });
    }
  }
}, KEEP_ALIVE_INTERVAL);

console.log(`WebSocket server listening on ws://0.0.0.0:${PORT}`);
