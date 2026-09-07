import dotenv from "dotenv";
import path from "path";

// The API runs from apps/api via npm workspaces, but the .env lives at the
// repo root. Load both: any apps/api/.env first, then fill gaps from the root.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  tokenExpiresInSeconds: Number(process.env.TOKEN_EXPIRES_IN_SECONDS ?? 300),
  maxSessionDurationSeconds: Number(
    process.env.MAX_SESSION_DURATION_SECONDS ?? 3600,
  ),
  simulatorIntervalMs: Number(process.env.SIMULATOR_INTERVAL_MS ?? 5000),
  alertIntervalMs: Number(process.env.ALERT_INTERVAL_MS ?? 5000),

  /** Base URL for the AssemblyAI Voice Agent API. */
  assemblyAiOrigin: "https://agents.assemblyai.com",
};