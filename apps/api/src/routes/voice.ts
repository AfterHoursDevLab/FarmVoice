import { Router } from "express";
import { config } from "../config";

export const voiceRouter = Router();

interface TokenResponse {
  token: string;
  expires_in_seconds: number;
}

/**
 * Mints a short-lived, single-use AssemblyAI token for ONE browser voice
 * session. The permanent API key never leaves this server.
 */
voiceRouter.post("/token", async (_req, res) => {
  if (!config.assemblyAiApiKey) {
    return res
      .status(500)
      .json({ error: "ASSEMBLYAI_API_KEY is not set on the server" });
  }

  try {
    const url = new URL("/v1/token", config.assemblyAiOrigin);
    url.searchParams.set("expires_in_seconds", String(config.tokenExpiresInSeconds));
    url.searchParams.set(
      "max_session_duration_seconds",
      String(config.maxSessionDurationSeconds),
    );

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.assemblyAiApiKey}` },
    });

    if (!response.ok) {
      const text = await response.text();
      return res
        .status(response.status)
        .json({ error: text || "voice token request failed" });
    }

    const data = (await response.json()) as TokenResponse;
    res.json(data);
  } catch (err) {
    console.error("[voice] token error:", err);
    res.status(502).json({ error: "could not reach AssemblyAI" });
  }
});