import { useEffect, useState } from "react";
import { FarmAlert, FarmAssessment, FarmState } from "@farmvoice/shared";
import { API_URL, api } from "@/lib/api";

export interface FarmFeed {
  state: FarmState | null;
  assessment: FarmAssessment | null;
  connected: boolean;
  error: string | null;
  alerts: FarmAlert[];
  latestAlert: FarmAlert | null;
}

/**
 * One SSE connection drives the whole dashboard: live farm state, the freshest
 * health assessment, and autonomous alerts raised by the backend monitor.
 */
export function useFarmFeed(): FarmFeed {
  const [state, setState] = useState<FarmState | null>(null);
  const [assessment, setAssessment] = useState<FarmAssessment | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<FarmAlert[]>([]);

  useEffect(() => {
    let active = true;

    api
      .getFarm()
      .then((s) => {
        if (active) setState(s);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });

    api
      .assess()
      .then((a) => {
        if (active) setAssessment(a);
      })
      .catch(() => {});

    api
      .getAlerts()
      .then((list) => {
        if (!active) return;
        setAlerts(list);
        // Reconcile against the fresh assessment so stale historical alerts
        // (raised before a recovery event) never surface as current problems.
        return api.assess();
      })
      .then((a) => {
        if (!active || !a) return;
        const activeKeys = new Set((a.issues ?? []).map((i) => i.key));
        if (a.issues.length === 0) {
          setAlerts((prev) => prev.filter((p) => p.issueKeys.length === 0));
        } else {
          setAlerts((prev) =>
            prev.filter(
              (p) =>
                p.issueKeys.length === 0 ||
                p.issueKeys.some((k) => activeKeys.has(k)),
            ),
          );
        }
      })
      .catch(() => {});

    const es = new EventSource(`${API_URL}/api/farm/events`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          type: string;
          state?: FarmState;
          assessment?: FarmAssessment;
          alert?: FarmAlert;
        };
        if (msg.type === "state" && msg.state) {
          setState(msg.state);
        } else if (msg.type === "assessment" && msg.assessment) {
          setAssessment(msg.assessment);
        } else if (msg.type === "alert" && msg.alert) {
          setAlerts((prev) => {
            const alert = msg.alert as FarmAlert;
            // A resolved alert (empty issueKeys) clears all earlier active alerts.
            if (alert.issueKeys.length === 0) {
              return [alert, ...prev.filter((p) => p.issueKeys.length === 0)].slice(0, 3);
            }
            return [alert, ...prev].slice(0, 10);
          });
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      active = false;
      es.close();
    };
  }, []);

  return {
    state,
    assessment,
    connected,
    error,
    alerts,
    latestAlert: alerts.find((a) => a.issueKeys.length > 0) ?? null,
  };
}