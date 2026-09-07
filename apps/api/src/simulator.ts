import { getState, isSimulatorPaused, setState } from "./state";
import { appendSensorHistory } from "./db";
import { config } from "./config";

const round1 = (n: number) => Math.round(n * 10) / 10;
const round0 = (n: number) => Math.round(n);
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/**
 * Random-walk the fake farm readings so the dashboard and the voice agent
 * always have something live to report. Equipment state (AC/fan/irrigation)
 * is never changed here - only sensors drift. Each tick is persisted to
 * sensor_history for time-series views.
 *
 * When demo mode is paused, readings are frozen so recordings are predictable.
 */
export function startSimulator(): void {
  const intervalMs = config.simulatorIntervalMs;
  console.log(`[simulator] started (tick every ${intervalMs}ms)`);

  setInterval(() => {
    const s = getState();
    const next = {
      temperatureC: isSimulatorPaused()
        ? s.temperatureC
        : round1(clamp(s.temperatureC + (Math.random() - 0.5) * 0.6, 18, 42)),
      humidityPct: isSimulatorPaused()
        ? s.humidityPct
        : round0(clamp(s.humidityPct + (Math.random() - 0.5) * 2, 30, 95)),
      soilMoisturePct: isSimulatorPaused()
        ? s.soilMoisturePct
        : round0(clamp(s.soilMoisturePct + (Math.random() - 0.5) * 1, 10, 80)),
    };
    setState(next);
    void appendSensorHistory(next);
  }, intervalMs);
}