import { Router } from "express";
import { ControlArgs, FarmToolName } from "@farmvoice/shared";
import { getState, setSimulatorPaused, setState } from "../state";
import { subscribeEvents } from "../events";
import { runTool } from "../tools";
import { appendVoiceTranscript, listAlerts, listEquipmentEvents } from "../db";

export const farmRouter = Router();

farmRouter.get("/", (_req, res) => {
  res.json(getState());
});

/**
 * Server-Sent Events stream: pushes every farm state change (simulator ticks,
 * equipment controls) and autonomous alerts so the dashboard updates live.
 */
farmRouter.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  send({ type: "state", state: getState() });

  const unsubscribe = subscribeEvents(send);
  req.on("close", unsubscribe);
});

farmRouter.get("/history", async (_req, res) => {
  res.json(await listEquipmentEvents(20));
});

farmRouter.get("/alerts", async (_req, res) => {
  res.json(await listAlerts(10));
});

/**
 * Demo mode: pause the random drift and pin the greenhouse to an exact,
 * repeatable starting scenario so recordings are predictable. Pass ?on=1 to
 * enable, ?on=0 to resume live simulation.
 */
farmRouter.post("/demo", (req, res) => {
  const body = (req.body ?? {}) as {
    on?: boolean;
    temperatureC?: number;
    humidityPct?: number;
    soilMoisturePct?: number;
  };
  const on = body.on ?? true;

  if (on) {
    setSimulatorPaused(true);
    setState({
      temperatureC: body.temperatureC ?? 34,
      humidityPct: body.humidityPct ?? 81,
      soilMoisturePct: body.soilMoisturePct ?? 24,
      ac: "off",
      fan: "off",
      irrigation: "off",
    });
    res.json({ ok: true, demo: true, state: getState() });
  } else {
    setSimulatorPaused(false);
    res.json({ ok: true, demo: false, state: getState() });
  }
});

farmRouter.post("/tools/:name", async (req, res) => {
  const name = req.params.name as FarmToolName;
  const body = (req.body ?? {}) as ControlArgs & { minutes?: number; source?: string };
  const result = await runTool(
    name,
    { state: body.state, confirmed: body.confirmed === true, minutes: body.minutes },
    body.source === "dashboard" ? "dashboard" : "voice",
  );
  res.json(result);
});

farmRouter.post("/transcript", async (req, res) => {
  const body = req.body as { role?: string; text?: string; sessionId?: string };
  await appendVoiceTranscript({
    role: body.role ?? "user",
    text: body.text ?? "",
    sessionId: body.sessionId,
  });
  res.json({ ok: true });
});