import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WS_HOST, DEFAULT_WS_PORT } from "./config.js";


const WS_HOST = DEFAULT_WS_HOST;
const WS_PORT = DEFAULT_WS_PORT;
const DEFAULT_WS_URL = `ws://${WS_HOST}:${WS_PORT}`;

export default function App() {
  const [view, setView] = useState("connect");
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [status, setStatus] = useState("disconnected");
  const [channel, setChannel] = useState("orders");
  const [rawMessage, setRawMessage] = useState(
    "{\"type\":\"send\",\"channel\":\"orders\",\"message\":\"New order created: ORD-110\"}"
  );
  const [events, setEvents] = useState([]);
  const [toast, setToast] = useState(null);
  const [orderId, setOrderId] = useState(() => {
    const match = /ORD-(\d+)/i.exec(
      "{\"type\":\"send\",\"channel\":\"orders\",\"message\":\"New order created: ORD-110\"}"
    );
    if (match) return Number(match[1]);
    return Math.floor(1000 + Math.random() * 9000);
  });
  const wsRef = useRef(null);

  const pushEvent = (source, payload) => {
    setEvents((prev) => [
      {
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ts: new Date().toLocaleTimeString(),
        source,
        payload
      },
      ...prev
    ]);
  };

  const connect = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      pushEvent("system", "Connected");
      sendRaw("{\"type\":\"identify\",\"role\":\"ui\"}");
      setView("console");
    };

    ws.onmessage = (event) => {
      pushEvent("server", event.data);
    };

    ws.onclose = () => {
      setStatus("disconnected");
      pushEvent("system", "Disconnected");
      setView("connect");
    };

    ws.onerror = () => {
      pushEvent("system", "WebSocket error");
    };
  };

  const disconnect = () => {
    if (wsRef.current) wsRef.current.close();
  };

  const sendRaw = (payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      pushEvent("system", "Not connected");
      return;
    }
    ws.send(payload);
    pushEvent("client", payload);
  };

  const onSubscribe = () => {
    sendRaw(`{\"type\":\"subscribe\",\"channel\":\"${channel}\"}`);
  };

  const onUnsubscribe = () => {
    sendRaw(`{\"type\":\"unsubscribe\",\"channel\":\"${channel}\"}`);
  };

  const onSend = () => {
    sendRaw(rawMessage);
    setOrderId((prev) => {
      const next = prev + 1;
      setRawMessage((current) => {
        if (/ORD-\d+/i.test(current)) {
          return current.replace(/ORD-\d+/i, `ORD-${next}`);
        }
        return current;
      });
      return next;
    });
  };

  const copyPayload = async (payload) => {
    try {
      await navigator.clipboard.writeText(payload);
      showToast("Copied to clipboard");
    } catch {
      showToast("Copy failed");
    }
  };

  const showToast = (message) => {
    setToast({ id: Date.now(), message });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 1600);
  };

  useEffect(() => {
    return () => disconnect();
  }, []);

  const statusBadge = useMemo(() => {
    return status === "connected" ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700";
  }, [status]);

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        {toast ? (
          <div className="pointer-events-none fixed right-6 top-6 z-50">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-lg">
              {toast.message}
            </div>
          </div>
        ) : null}
        {view === "connect" ? (
          <div className="mx-auto mt-12 max-w-xl rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-sm">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">MockSocket</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">Connect to WebSocket</h1>
            <p className="mt-2 text-sm text-slate-600">
              Enter the WebSocket URL you want to test. You will be redirected to the console after a
              successful connection.
            </p>

            <label className="mt-8 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              WebSocket URL
            </label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
              value={wsUrl}
              onChange={(event) => setWsUrl(event.target.value)}
              placeholder="ws://192.168.0.241:8080"
            />

            <button
              className="mt-6 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
              onClick={connect}
            >
              Connect
            </button>
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-slate-500">MockSocket</p>
                <h1 className="mt-2 text-4xl font-semibold text-ink">WebSocket Test Console</h1>
                <p className="mt-2 max-w-xl text-slate-600">
                  Subscribe to channels, send events, and watch acknowledgements and broadcasts in real time.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge}`}>
                  {status}
                </span>
                <button
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    status === "connected"
                      ? "cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-600 opacity-70"
                      : "border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                  onClick={connect}
                  disabled={status === "connected"}
                >
                  Connect
                </button>
                <button
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    status === "disconnected"
                      ? "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-600 opacity-70"
                      : "border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                  onClick={disconnect}
                  disabled={status === "disconnected"}
                >
                  Disconnect
                </button>
              </div>
            </header>

            <main className="mt-10 grid gap-6 lg:grid-cols-[360px_1fr]">
              <section className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800">Composer</h2>
                <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Channel
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                  placeholder="orders"
                />

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
                    onClick={onSubscribe}
                  >
                    Subscribe
                  </button>
                  <button
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    onClick={onUnsubscribe}
                  >
                    Unsubscribe
                  </button>
                </div>

                <label className="mt-8 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Raw Message
                </label>
                <textarea
                  className="mt-2 h-32 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                  value={rawMessage}
                  onChange={(event) => setRawMessage(event.target.value)}
                />

                <button
                  className="mt-4 w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-500"
                  onClick={onSend}
                >
                  Send To Channel
                </button>

                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600">
                  WebSocket URL: <span className="font-semibold">{wsUrl}</span>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800">Live Event Feed</h2>
                  <span className="text-xs text-slate-500">Newest on top</span>
                </div>
                <div className="mt-4 grid gap-4">
                  {events.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      Events will appear here once you connect and send messages.
                    </div>
                  ) : (
                    events.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                          <div className="flex items-center gap-3">
                            <span className="uppercase tracking-[0.2em]">{entry.source}</span>
                            <span>{entry.ts}</span>
                          </div>
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                            onClick={() => copyPayload(entry.payload)}
                            type="button"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-700">
                          {entry.payload}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </main>
          </>
        )}
      </div>
    </div>
  );
}
