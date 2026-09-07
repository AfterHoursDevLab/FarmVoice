import express from "express";
import cors from "cors";
import { config } from "./config";
import { initDb } from "./db";
import { startSimulator } from "./simulator";
import { startAlertMonitor } from "./alerts";
import { farmRouter } from "./routes/farm";
import { voiceRouter } from "./routes/voice";

async function main(): Promise<void> {
  await initDb();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/farm", farmRouter);
  app.use("/api/voice", voiceRouter);

  startSimulator();
  startAlertMonitor();

  app.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
    console.log(`[api] health check at http://localhost:${config.port}/health`);
    if (!config.assemblyAiApiKey) {
      console.warn(
        "[api] ASSEMBLYAI_API_KEY not set - voice sessions will fail until .env is filled in.",
      );
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});