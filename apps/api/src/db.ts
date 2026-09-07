import { Pool } from "pg";
import { config } from "./config";
import {
  EquipmentEvent,
  FarmAlert,
  FarmAssessment,
  FarmState,
  SensorSample,
} from "@farmvoice/shared";

let pool: Pool | null = null;

export function isDbEnabled(): boolean {
  return Boolean(config.databaseUrl);
}

export async function initDb(): Promise<void> {
  if (!config.databaseUrl) {
    console.warn(
      "[db] DATABASE_URL not set - no persistence (transcripts, alerts, history lost).",
    );
    return;
  }
  pool = new Pool({ connectionString: config.databaseUrl });

  const tables = [
    `CREATE TABLE IF NOT EXISTS sensor_history (
      id BIGSERIAL PRIMARY KEY,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      temperature_c NUMERIC(4,1) NOT NULL,
      humidity_pct NUMERIC(4,1) NOT NULL,
      soil_moisture_pct NUMERIC(4,1) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS equipment_events (
      id BIGSERIAL PRIMARY KEY,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      device TEXT NOT NULL,
      action TEXT NOT NULL,
      source TEXT NOT NULL,
      confirmed BOOLEAN NOT NULL DEFAULT false
    )`,
    `CREATE TABLE IF NOT EXISTS voice_transcripts (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      session_id TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS agent_decisions (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      tool TEXT NOT NULL,
      args JSONB NOT NULL DEFAULT '{}',
      result JSONB NOT NULL DEFAULT '{}',
      impact TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS alerts (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      level TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      issue_keys TEXT[] NOT NULL DEFAULT '{}'
    )`,
  ];

  try {
    for (const t of tables) {
      await pool.query(t);
    }
    console.log("[db] connected, schema ready (sensor_history, equipment_events, voice_transcripts, agent_decisions, alerts)");
  } catch (err) {
    console.warn("[db] could not init schema, continuing in-memory:", err);
    pool = null;
  }
}

async function run(query: string, params: unknown[]): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(query, params);
  } catch (err) {
    console.warn("[db] query failed:", (err as Error).message);
  }
}

export function appendSensorHistory(s: {
  temperatureC: number;
  humidityPct: number;
  soilMoisturePct: number;
}): Promise<void> {
  return run(
    `INSERT INTO sensor_history (temperature_c, humidity_pct, soil_moisture_pct) VALUES ($1,$2,$3)`,
    [s.temperatureC, s.humidityPct, s.soilMoisturePct],
  );
}

export function appendEquipmentEvent(
  e: Omit<EquipmentEvent, "id" | "occurredAt">,
): Promise<void> {
  return run(
    `INSERT INTO equipment_events (device, action, source, confirmed) VALUES ($1,$2,$3,$4)`,
    [e.device, e.action, e.source, e.confirmed ?? false],
  );
}

export function appendVoiceTranscript(p: {
  role: string;
  text: string;
  sessionId?: string;
}): Promise<void> {
  if (!p.text) return Promise.resolve();
  return run(
    `INSERT INTO voice_transcripts (role, text, session_id) VALUES ($1,$2,$3)`,
    [p.role, p.text, p.sessionId ?? null],
  );
}

export function appendAgentDecision(p: {
  tool: string;
  args: unknown;
  result: unknown;
  impact?: string;
}): Promise<void> {
  return run(
    `INSERT INTO agent_decisions (tool, args, result, impact) VALUES ($1,$2,$3,$4)`,
    [p.tool, JSON.stringify(p.args ?? {}), JSON.stringify(p.result), p.impact ?? null],
  );
}

export async function appendAlert(
  a: Omit<FarmAlert, "id">,
): Promise<{ id: number } | undefined> {
  if (!pool) return undefined;
  try {
    const { rows } = await pool.query(
      `INSERT INTO alerts (level, title, message, issue_keys) VALUES ($1,$2,$3,$4) RETURNING id`,
      [a.level, a.title, a.message, a.issueKeys],
    );
    return { id: rows[0].id as number };
  } catch (err) {
    console.warn("[db] failed to append alert:", (err as Error).message);
    return undefined;
  }
}

export async function listEquipmentEvents(limit = 20): Promise<EquipmentEvent[]> {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `SELECT id, device, action, source, confirmed, occurred_at AS "occurredAt"
         FROM equipment_events ORDER BY id DESC LIMIT $1`,
      [limit],
    );
    return rows as EquipmentEvent[];
  } catch (err) {
    console.warn("[db] failed to list equipment events:", (err as Error).message);
    return [];
  }
}

export async function listAlerts(limit = 10): Promise<FarmAlert[]> {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `SELECT id, level, title, message, issue_keys AS "issueKeys", created_at AS "createdAt"
         FROM alerts ORDER BY id DESC LIMIT $1`,
      [limit],
    );
    return rows as FarmAlert[];
  } catch (err) {
    console.warn("[db] failed to list alerts:", (err as Error).message);
    return [];
  }
}

export async function listSensorHistory(
  minutes = 15,
  limit = 120,
): Promise<SensorSample[]> {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `SELECT recorded_at AS "timestamp",
              temperature_c AS "temperatureC",
              humidity_pct AS "humidityPct",
              soil_moisture_pct AS "soilMoisturePct"
         FROM sensor_history
        WHERE recorded_at >= now() - ($1 || ' minutes')::interval
        ORDER BY id DESC
        LIMIT $2`,
      [minutes, limit],
    );
    return (rows as Array<{
      timestamp: string;
      temperatureC: number;
      humidityPct: number;
      soilMoisturePct: number;
    }>).map((r) => ({
      timestamp: r.timestamp,
      temperatureC: Number(r.temperatureC),
      humidityPct: Number(r.humidityPct),
      soilMoisturePct: Number(r.soilMoisturePct),
    }));
  } catch (err) {
    console.warn("[db] failed to list sensor history:", (err as Error).message);
    return [];
  }
}

export type { FarmState, FarmAssessment };