import { useCallback, useRef, useState } from "react";
import { ControlArgs, FarmToolName, FARM_TOOLS, SYSTEM_PROMPT } from "@farmvoice/shared";
import { api } from "@/lib/api";

export type VoiceStatus = "idle" | "connecting" | "ready" | "error";

export type AgentState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "ACTING"
  | "VERIFYING"
  | "DONE";

export interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
}

export interface VerifiedAction {
  device: "AC" | "Fan" | "Irrigation";
  state: "on" | "off";
}

const CONTROL_TOOLS: FarmToolName[] = [
  "control_ac",
  "control_fan",
  "control_irrigation",
];
const isControl = (n: string) =>
  (CONTROL_TOOLS as string[]).includes(n);

const CONTROL_DEVICE: Partial<Record<FarmToolName, VerifiedAction["device"]>> = {
  control_ac: "AC",
  control_fan: "Fan",
  control_irrigation: "Irrigation",
};

const WS_URL = "wss://agents.assemblyai.com/v1/ws";
const SAMPLE_RATE = 24000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function rmsLevel(pcm: Int16Array): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const v = pcm[i] / 32768;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / pcm.length);
  return Math.min(100, Math.round(rms * 400));
}

/**
 * Decodes a base64 PCM16 chunk and schedules it for playback on a shared
 * AudioContext. `playbackTime` is advanced so buffers queue seamlessly, and is
 * reset on barge-in so stale audio stops.
 */
function schedulePlayback(
  audioCtx: AudioContext,
  data: string,
  playbackTimeRef: { current: number },
): void {
  if (!data) return;
  try {
    const raw = atob(data);
    if (raw.length < 2) return;
    const pcm16 = new Int16Array(raw.length / 2);
    for (let i = 0; i < pcm16.length; i += 1) {
      pcm16[i] = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
    }

    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i += 1) {
      float32[i] = pcm16[i] / 32768;
    }

    const buffer = audioCtx.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);

    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);

    const now = Math.max(audioCtx.currentTime, playbackTimeRef.current);
    void audioCtx.resume().catch(() => {});
    src.start(now);
    playbackTimeRef.current = now + buffer.duration;
  } catch (err) {
    console.warn("[voice] failed to play reply.audio chunk:", err);
  }
}

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [agentState, setAgentState] = useState<AgentState>("IDLE");
  const [lastVerified, setLastVerified] = useState<VerifiedAction | null>(null);
  const [micLevel, setMicLevel] = useState(0);

  const setAgent = useCallback((s: AgentState) => {
    agentStateRef.current = s;
    setAgentState(s);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const agentStateRef = useRef<AgentState>("IDLE");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const sessionReadyRef = useRef(false);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const playbackTimeRef = useRef(0);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const pendingVerifyRef = useRef(false);
  const lastControlRef = useRef<VerifiedAction | null>(null);
  const micLevelRef = useRef(0);
  const micLevelTimerRef = useRef<number | null>(null);

  const pushTranscript = useCallback((role: "user" | "agent", text: string) => {
    void api.voiceTranscript({ role, text, sessionId: sessionIdRef.current });
  }, []);

  const appendTranscript = useCallback((role: "user" | "agent", text: string) => {
    pushTranscript(role, text);
    transcriptRef.current = [...transcriptRef.current, { role, text }];
    setTranscripts(transcriptRef.current);
  }, [pushTranscript]);

  const teardown = useCallback(() => {
    workletRef.current?.disconnect();
    workletRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
    }
    wsRef.current = null;
    sessionReadyRef.current = false;
    sessionIdRef.current = undefined;
    playbackTimeRef.current = 0;
    pendingVerifyRef.current = false;
    micLevelRef.current = 0;
    if (micLevelTimerRef.current !== null) {
      window.clearTimeout(micLevelTimerRef.current);
      micLevelTimerRef.current = null;
    }
    setMicLevel(0);
    setAgent("IDLE");
  }, []);

  const start = useCallback(async () => {
    if (wsRef.current) return;

    setError(null);
    transcriptRef.current = [];
    setTranscripts([]);
    setLastVerified(null);
    setStatus("connecting");

    try {
      const { token } = await api.voiceToken();

      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      await audioCtx.audioWorklet.addModule(`${basePath}/pcm-processor.js`);
      await audioCtx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
        },
      });

      const source = audioCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioCtx, "pcm-processor");
      source.connect(worklet);
      worklet.connect(audioCtx.destination); // keep the graph alive

      audioCtxRef.current = audioCtx;
      workletRef.current = worklet;
      micStreamRef.current = stream;
      playbackTimeRef.current = audioCtx.currentTime;

      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              system_prompt: SYSTEM_PROMPT,
              greeting:
                "Hi, this is FarmVoice. What would you like to know about Greenhouse #1?",
              output: { voice: "ivy", volume: 100 },
              tools: FARM_TOOLS,
            },
          }),
        );
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as Record<string, any>;
        switch (msg.type) {
          case "session.ready":
            sessionReadyRef.current = true;
            sessionIdRef.current = (msg.session_id as string) ?? undefined;
            setStatus("ready");
            setAgent("LISTENING");
            worklet.port.onmessage = (e: MessageEvent) => {
              const buf = e.data as ArrayBuffer;
              const pcm = new Int16Array(buf);
              const level = rmsLevel(pcm);
              if (micLevelTimerRef.current === null) {
                micLevelTimerRef.current = window.setTimeout(() => {
                  micLevelTimerRef.current = null;
                  setMicLevel(micLevelRef.current);
                }, 90);
              }
              micLevelRef.current = level;
              if (
                sessionReadyRef.current &&
                ws.readyState === WebSocket.OPEN
              ) {
                ws.send(
                  JSON.stringify({
                    type: "input.audio",
                    audio: arrayBufferToBase64(buf),
                  }),
                );
              }
            };
            break;

          case "reply.audio":
            schedulePlayback(audioCtx, msg.data as string, playbackTimeRef);
            if (agentStateRef.current !== "ACTING") {
              setAgent("THINKING");
            }
            break;

          case "tool.call": {
            const name = msg.name as FarmToolName;
            const args = (msg.arguments ?? {}) as ControlArgs;
            if (isControl(name)) {
              lastControlRef.current = {
                device: CONTROL_DEVICE[name] as VerifiedAction["device"],
                state: args.state as VerifiedAction["state"],
              };
              setAgent("ACTING");
              pendingVerifyRef.current = true;
            } else if (pendingVerifyRef.current && name === "get_farm_status") {
              setAgent("VERIFYING");
              pendingVerifyRef.current = false;
              if (lastControlRef.current) {
                setLastVerified(lastControlRef.current);
              }
            } else {
              setAgent("THINKING");
            }
            api
              .runTool(name, args)
              .then((result) => {
                // Send right away - per AssemblyAI, do not wait for reply.done.
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: "tool.result",
                      call_id: msg.call_id as string,
                      result: JSON.stringify(result),
                    }),
                  );
                }
              })
              .catch((e) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: "tool.result",
                      call_id: msg.call_id as string,
                      result: JSON.stringify({ ok: false, error: String(e) }),
                    }),
                  );
                }
              });
            break;
          }

          case "reply.done": {
            if (msg.status === "interrupted") {
              playbackTimeRef.current = Math.max(
                audioCtx.currentTime,
                playbackTimeRef.current,
              );
            }
            setAgent("DONE");
            window.setTimeout(() => setAgent("LISTENING"), 1200);
            break;
          }

          case "transcript.user": {
            const text = (msg.text ?? "") as string;
            if (text) {
              appendTranscript("user", text);
              setAgent("THINKING");
            }
            break;
          }

          case "transcript.agent": {
            const text = (msg.text ?? "") as string;
            if (text) appendTranscript("agent", text);
            break;
          }

          case "session.error":
          case "error":
            setError((msg.message as string) ?? "Session error");
            setStatus("error");
            teardown();
            break;

          case "session.ended":
            teardown();
            setStatus("idle");
            break;
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          setStatus("idle");
        }
      };

      ws.onerror = () => {
        if (wsRef.current === ws) {
          setError("WebSocket error - check that ASSEMBLYAI_API_KEY is set on the server.");
          setStatus("error");
          teardown();
        }
      };
    } catch (err) {
      console.error(err);
      const name = (err as DOMException)?.name;
      const friendly =
        name === "OverconstrainedError"
          ? "Microphone unavailable - no audio input supports the required settings."
          : name === "NotAllowedError"
            ? "Microphone permission denied. Allow access and try again."
            : name === "NotFoundError"
              ? "No microphone found. Plug one in and try again."
              : err instanceof Error
                ? err.message
                : String(err);
      setError(friendly);
      setStatus("error");
      teardown();
    }
  }, [appendTranscript, teardown]);

  const stop = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "session.end" }));
    }
    teardown();
    setStatus("idle");
  }, [teardown]);

  /**
   * Proactively make the agent speak without the farmer saying anything, e.g.
   * to alert them about a condition the monitor just detected. Uses
   * reply.create, which composes a reply from one-shot instructions.
   */
  const speak = useCallback((instructions: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionReadyRef.current) {
      return;
    }
    ws.send(
      JSON.stringify({ type: "reply.create", instructions }),
    );
  }, []);

  return {
    status,
    agentState,
    error,
    transcripts,
    lastVerified,
    micLevel,
    start,
    stop,
    speak,
  };
}
