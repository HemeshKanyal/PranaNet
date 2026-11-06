"use client";
// Live state for the whole app: device statuses, latest readings, flags and an event feed.
// Source: WS /live when a relayer URL is configured, otherwise a replay of mocks/live.json.
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { Device, Flag, LiveMessage, Reading } from "@/lib/types";

export type Conn = "replay" | "connecting" | "live" | "reconnecting";
export type LiveEvent = LiveMessage & { id: number };

interface State {
  devices: Device[];
  flags: Flag[];
  events: LiveEvent[];
  /** readings received since page load, per device address */
  fresh: Record<string, Reading[]>;
  conn: Conn;
  seq: number;
}

type Action = { kind: "msg"; msg: LiveMessage } | { kind: "conn"; conn: Conn } | { kind: "reset"; init: State };

function reducer(s: State, a: Action): State {
  if (a.kind === "conn") return { ...s, conn: a.conn };
  if (a.kind === "reset") return { ...a.init, conn: s.conn };
  const { msg } = a;
  const seq = s.seq + 1;
  const events = [{ ...msg, id: seq } as LiveEvent, ...s.events].slice(0, 60);
  if (msg.type === "reading") {
    const r = msg.data;
    return {
      ...s,
      seq,
      events,
      devices: s.devices.map((d) => (d.device === r.device ? { ...d, last_reading: r } : d)),
      fresh: { ...s.fresh, [r.device]: [...(s.fresh[r.device] ?? []), r].slice(-200) },
    };
  }
  if (msg.type === "flag") {
    const f = msg.data;
    return {
      ...s,
      seq,
      events,
      flags: [...s.flags, f],
      devices: s.devices.map((d) => (d.device === f.device && d.status === "active" ? { ...d, status: "flagged" } : d)),
    };
  }
  const x = msg.data;
  return {
    ...s,
    seq,
    events,
    devices: s.devices.map((d) => (d.device === x.device ? { ...d, status: "slashed", stake_wei: "0" } : d)),
  };
}

const Ctx = createContext<State | null>(null);

export function useLive() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLive outside LiveProvider");
  return v;
}

const REPLAY_MS = 1400;

export function LiveProvider({ initialDevices, initialFlags, relayerUrl, wsUrl, children }: {
  initialDevices: Device[];
  initialFlags: Flag[];
  relayerUrl: string;
  wsUrl: string;
  children: ReactNode;
}) {
  const init = useMemo<State>(
    () => ({ devices: initialDevices, flags: initialFlags, events: [], fresh: {}, conn: relayerUrl ? "connecting" : "replay", seq: 0 }),
    [initialDevices, initialFlags, relayerUrl],
  );
  const [state, dispatch] = useReducer(reducer, init);

  // Mock mode: replay mocks/live.json on a timer, then loop from the initial snapshot.
  useEffect(() => {
    if (relayerUrl) return;
    let msgs: LiveMessage[] = [];
    let i = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (stopped) return;
      if (i >= msgs.length) {
        i = 0;
        dispatch({ kind: "reset", init });
        timer = setTimeout(tick, REPLAY_MS * 3);
        return;
      }
      dispatch({ kind: "msg", msg: msgs[i++] });
      timer = setTimeout(tick, REPLAY_MS);
    };
    import("@/mocks/live.json").then((m) => {
      msgs = m.default as LiveMessage[];
      timer = setTimeout(tick, REPLAY_MS);
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [relayerUrl, init]);

  // Real mode: WS /live with exponential-backoff reconnect.
  useEffect(() => {
    if (!relayerUrl) return;
    const url = wsUrl || `${relayerUrl.replace(/^http/, "ws")}/live`;
    let ws: WebSocket | null = null;
    let retry = 0;
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(url);
      ws.onopen = () => {
        retry = 0;
        dispatch({ kind: "conn", conn: "live" });
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as LiveMessage;
          if (msg && (msg.type === "reading" || msg.type === "flag" || msg.type === "slash")) dispatch({ kind: "msg", msg });
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (closed) return;
        dispatch({ kind: "conn", conn: "reconnecting" });
        timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [relayerUrl, wsUrl]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
