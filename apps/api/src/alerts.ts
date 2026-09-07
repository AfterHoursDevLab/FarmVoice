import { FarmAlert } from "@farmvoice/shared";
import { assess } from "./assess";
import { getState } from "./state";
import { appendAlert } from "./db";
import { config } from "./config";
import { emitEvent } from "./events";

let lastSignature = "";

/**
 * Autonomous monitoring: re-evaluates the farm rules on an interval and raises
 * a FarmVoice alert the first time a new set of issues is present. Alerts are
 * persisted, pushed over SSE (dashboard banner), and - while a voice session
 * is active - spoken to the farmer via reply.create.
 */
export function startAlertMonitor(): void {
  console.log(`[alerts] monitor started (tick every ${config.alertIntervalMs}ms)`);

  setInterval(() => {
    const a = assess(getState());
    // Always push the freshest assessment so the dashboard banner reflects
    // current conditions (live numbers), not the last time an alert fired.
    emitEvent({ type: "assessment", assessment: a });

    const signature = a.issues.map((i) => i.key).sort().join(",");

    if (signature === lastSignature) return;

    // Transition from a problem state back to normal: raise an info alert so
    // the timeline records the recovery and the dashboard clears the banner.
    if (signature === "") {
      const wasProblematic = lastSignature !== "";
      lastSignature = "";
      if (!wasProblematic) return;

      const alert: FarmAlert = {
        level: "info",
        title: "Conditions back to normal",
        message: `All monitored conditions are back to normal. Temperature ${a.readings.temperatureC}°C, humidity ${a.readings.humidityPct}%, soil moisture ${a.readings.soilMoisturePct}%.`,
        issueKeys: [],
        createdAt: new Date().toISOString(),
      };
      void appendAlert(alert).then((saved) => {
        if (saved) {
          emitEvent({ type: "alert", alert: { ...alert, id: saved.id } });
          console.log(`[alerts] resolved: ${alert.message}`);
        }
      });
      return;
    }

    lastSignature = signature;

    const level = a.issues.some((i) => i.severity === "critical")
      ? "critical"
      : "warning";
    const title =
      level === "critical"
        ? "Critical conditions detected"
        : "Conditions need attention";
    const recText = a.recommendations
      .map((r) => `${r.tool.replace("control_", "")} ${r.args.state}`)
      .join(", ");
    const message = `${a.issues.map((i) => i.message).join(". ")}. Recommended: ${recText}.`;

    const alert: FarmAlert = {
      level,
      title,
      message,
      issueKeys: a.issues.map((i) => i.key),
      createdAt: new Date().toISOString(),
    };

    void appendAlert(alert).then((saved) => {
      if (saved) {
        emitEvent({ type: "alert", alert: { ...alert, id: saved.id } });
        console.log(`[alerts] ${level} raised: ${title} - ${message}`);
      }
    });
  }, config.alertIntervalMs);
}