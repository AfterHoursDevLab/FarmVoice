"use client";

import { useEffect, useState } from "react";
import { FarmAlert, EquipmentEvent } from "@farmvoice/shared";
import { api } from "../lib/api";

type LogEntry = {
  id: string;
  time: string;
  kind: "action" | "monitor" | "system";
  icon: string;
  actor: string;
  title: string;
  sub?: string;
};

const DEVICE_PRETTY: Record<string, string> = {
  AC: "AC",
  Fan: "Fan",
  Irrigation: "Irrigation",
};

const VISIBLE = 5;

const ACTOR: Record<string, string> = {
  voice: "FarmVoice",
  dashboard: "Dashboard",
};

const ISSUE_DETAIL: Record<
  string,
  { title: string; re: RegExp; fmt: (m: RegExpMatchArray) => string }
> = {
  temperature_high: {
    title: "High temperature detected",
    re: /Temperature is ([\d.]+)°C, above the ([\d.]+)°C target/,
    fmt: (m) => `${m[1]}°C · Above ${m[2]}°C threshold`,
  },
  soil_moisture_low: {
    title: "Low soil moisture detected",
    re: /Soil moisture is ([\d.]+)%, below ([\d.]+)%/,
    fmt: (m) => `${m[1]}% · Below ${m[2]}% threshold`,
  },
  humidity_low: {
    title: "Low humidity detected",
    re: /Humidity is only ([\d.]+)%, below ([\d.]+)%/,
    fmt: (m) => `${m[1]}% · Below ${m[2]}% threshold`,
  },
  humidity_high: {
    title: "High humidity detected",
    re: /Humidity is ([\d.]+)%, above ([\d.]+)%/,
    fmt: (m) => `${m[1]}% · Above ${m[2]}% threshold`,
  },
};

function monitorEntries(alerts: FarmAlert[]): LogEntry[] {
  const latest = new Map<string, LogEntry>();
  for (const a of alerts) {
    if (a.level === "info") continue;
    const keys = a.issueKeys?.length ? a.issueKeys : ["conditions"];
    for (const key of keys) {
      const meta = ISSUE_DETAIL[key];
      if (!meta) continue;
      const m = meta.re.exec(a.message);
      const entry: LogEntry = {
        id: `${key}-${a.createdAt}`,
        time: a.createdAt,
        kind: "monitor",
        icon: "⚠",
        actor: "Monitor",
        title: meta.title,
        sub: m ? meta.fmt(m) : undefined,
      };
      const prev = latest.get(key);
      if (!prev || new Date(entry.time).getTime() > new Date(prev.time).getTime()) {
        latest.set(key, entry);
      }
    }
  }
  return [...latest.values()];
}

export function EventLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.getHistory(), api.getAlerts()])
      .then(([events, alerts]) => {
        if (!active) return;
        const entries: LogEntry[] = [];

        for (const e of events as EquipmentEvent[]) {
          const actor = ACTOR[e.source] ?? "Dashboard";
          entries.push({
            id: `c${e.id ?? Math.random()}`,
            time: e.occurredAt,
            kind: "action",
            icon: "✓",
            actor,
            title: `${DEVICE_PRETTY[e.device] ?? e.device} turned ${e.action.toUpperCase()}`,
            sub: e.confirmed
              ? `${actor} · Confirmed · Verified`
              : `${actor} · Executed`,
          });
        }

        for (const a of alerts as FarmAlert[]) {
          if (a.level === "info") {
            entries.push({
              id: `a${a.id ?? Math.random()}`,
              time: a.createdAt,
              kind: "system",
              icon: "ℹ",
              actor: "System",
              title: "Conditions back to normal",
            });
          }
        }

        entries.push(...monitorEntries(alerts as FarmAlert[]));

        setEntries(
          [...entries]
            .sort((x, y) => new Date(y.time).getTime() - new Date(x.time).getTime())
            .slice(0, 14),
        );
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const shown = expanded ? entries : entries.slice(0, VISIBLE);
  const hasMore = entries.length > VISIBLE;

  return (
    <section className="card">
      <h3 className="sub">
        Recent activity
        {hasMore && (
          <button
            type="button"
            className="view-all"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show less" : "View all →"}
          </button>
        )}
      </h3>
      {shown.length === 0 ? (
        <p className="muted">
          No activity yet. Turn equipment on/off or talk to the agent.
        </p>
      ) : (
        <ul className="events">
          {shown.map((e) => (
            <li key={e.id} className={`event-${e.kind}`}>
              <span className={`event-icon icon-${e.kind}`}>{e.icon}</span>
              <div className="event-body">
                <div className="event-title">{e.title}</div>
                {e.sub && <div className="event-sub">{e.sub}</div>}
              </div>
              <div className="event-meta">
                <span className="event-actor">{e.actor}</span>
                <span className="time">{new Date(e.time).toLocaleTimeString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}