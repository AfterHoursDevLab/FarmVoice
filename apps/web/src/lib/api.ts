import {
  ControlArgs,
  EquipmentEvent,
  FarmAlert,
  FarmState,
  FarmToolName,
  FarmAssessment,
} from "@farmvoice/shared";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getFarm: () => request<FarmState>("/api/farm"),
  getHistory: () => request<EquipmentEvent[]>("/api/farm/history"),
  getAlerts: () => request<FarmAlert[]>("/api/farm/alerts"),
  runTool: (name: FarmToolName, args?: ControlArgs, source = "voice") =>
    request<unknown>("/api/farm/tools/" + name, {
      method: "POST",
      body: JSON.stringify({ ...args, source }),
    }),
  voiceToken: () =>
    request<{ token: string; expires_in_seconds: number }>("/api/voice/token", {
      method: "POST",
    }),
  assess: () =>
    request<FarmAssessment>("/api/farm/tools/get_farm_assessment", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  voiceTranscript: (payload: {
    role: "user" | "agent";
    text: string;
    sessionId?: string;
  }) =>
    request<{ ok: boolean }>("/api/farm/transcript", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export type { FarmAssessment };