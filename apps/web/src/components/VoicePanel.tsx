"use client";

import { useEffect, useRef } from "react";
import { FarmAlert } from "@farmvoice/shared";
import {
  AgentState,
  useVoiceAgent,
  VerifiedAction,
  VoiceStatus,
} from "../hooks/useVoiceAgent";

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Idle",
  connecting: "Connecting...",
  ready: "Listening",
  error: "Error",
};

const AGENT_STATUS_TEXT: Record<AgentState, string> = {
  IDLE: "IDLE",
  LISTENING: "● LISTENING",
  THINKING: "● THINKING",
  ACTING: "● ACTING",
  VERIFYING: "● VERIFYING",
  DONE: "✓ VERIFIED",
};

const LAST_ACTION: Record<AgentState, string> = {
  IDLE: "Standby",
  LISTENING: "Listening for your command...",
  THINKING: "Analyzing the greenhouse...",
  ACTING: "Sending equipment command...",
  VERIFYING: "Checking the real equipment state...",
  DONE: "Verified — equipment state confirmed",
};

const WORKFLOW_STEPS = [
  "Assess farm",
  "Identify problems",
  "Recommend action",
  "Await confirmation",
  "Execute",
  "Verify",
];

function stepStates(
  agentState: AgentState,
  lastVerified: VerifiedAction | null,
  engaged: boolean,
): Array<"done" | "active" | "pending"> {
  if (lastVerified) {
    return WORKFLOW_STEPS.map(() => "done");
  }
  const activeIdx =
    agentState === "THINKING"
      ? 2
      : agentState === "ACTING"
        ? 4
        : agentState === "VERIFYING"
          ? 5
          : agentState === "DONE" || (agentState === "LISTENING" && engaged)
            ? 3
            : -1;
  return WORKFLOW_STEPS.map((_, i) =>
    i < activeIdx ? "done" : i === activeIdx ? "active" : "pending",
  );
}

interface VoicePanelProps {
  latestAlert: FarmAlert | null;
}

export function VoicePanel({ latestAlert }: VoicePanelProps) {
  const { status, agentState, error, transcripts, lastVerified, micLevel, start, stop, speak } =
    useVoiceAgent();
  const active = status === "connecting" || status === "ready";
  const lastAlertIdRef = useRef<string | null>(null);

  const lastAgentEntry = [...transcripts].reverse().find((t) => t.role === "agent");
  const lastUserEntry = [...transcripts].reverse().find((t) => t.role === "user");

  useEffect(() => {
    if (!latestAlert || status !== "ready") return;
    const id = latestAlert.id !== undefined ? String(latestAlert.id) : latestAlert.createdAt;
    if (lastAlertIdRef.current === id) return;
    lastAlertIdRef.current = id;
    speak(
      `Alert the farmer immediately. ${latestAlert.title}. ${latestAlert.message}`,
    );
  }, [latestAlert, status, speak]);

  const isActing = agentState === "ACTING" || agentState === "VERIFYING";
  const finalVerified = agentState === "DONE" && !!lastVerified;
  const steps = stepStates(agentState, lastVerified, transcripts.length > 0);
  const showVerified =
    lastVerified && (agentState === "DONE" || agentState === "LISTENING");
  const statusText =
    agentState === "DONE"
      ? lastVerified
        ? "✓ VERIFIED"
        : "● WAITING"
      : AGENT_STATUS_TEXT[agentState];
  const lastActionText =
    agentState === "DONE"
      ? lastVerified
        ? "Verified — equipment state confirmed"
        : "Waiting for your confirmation..."
      : LAST_ACTION[agentState];

  return (
    <section className={`card voice-panel voice-${agentState.toLowerCase()}`}>
      <header className="voice-head">
        <div>
          <h2>AI Assistant</h2>
          <p className="muted voice-tagline">
            Talk to your greenhouse. <b>FarmVoice</b> understands, acts, and
            verifies.
          </p>
        </div>
        <span className="badge voice-status">{statusText}</span>
      </header>

      <div className="voice-stage">
        <div className={`agent-orb ${active ? "orb-active" : "orb-idle"}`}>
          {finalVerified ? "✓" : active ? "◉" : "○"}
        </div>
        {active && (
          <div className="mic-meter" aria-label="Mic level">
            <span
              className={`meter-bar ${micLevel > 40 ? "meter-hot" : ""}`}
              style={{ width: `${Math.max(3, micLevel)}%` }}
            />
          </div>
        )}
        <p className="agent-subturn">{lastActionText}</p>
      </div>

      <div className="last-action">
        <span className="la-label">LAST ACTION</span>
        <span className="la-text">
          {isActing
            ? agentState === "VERIFYING"
              ? "Checking the real state..."
              : "Executing..."
            : lastActionText}
        </span>
      </div>

      <div className="voice-transcript">
        {lastUserEntry && (
          <div className="chat-line chat-user">
            <span className="chat-role">Farmer</span>
            <span className="chat-text">"{lastUserEntry.text}"</span>
          </div>
        )}
        {lastAgentEntry && (
          <div className="chat-line chat-agent">
            <span className="chat-role">FarmVoice</span>
            <span className="chat-text">"{lastAgentEntry.text}"</span>
          </div>
        )}
        {!lastAgentEntry && !lastUserEntry && (
          <p className="muted">No conversation yet. Press Talk to begin.</p>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="mic big-mic"
        disabled={status === "connecting"}
        onClick={active ? stop : start}
      >
        <span className="mic-ring">🎙</span>
        {status === "connecting"
          ? "Connecting..."
          : active
            ? isActing
              ? "Working..."
              : "Stop"
            : "Talk"}
      </button>

      <div className="workflow">
        <span className="wf-label">AGENT WORKFLOW</span>
        <ul className="wf-list">
          {WORKFLOW_STEPS.map((label, i) => {
            const s = steps[i];
            return (
              <li key={label} className={`wf-${s}`}>
                <span className="wf-mark">
                  {s === "done" ? "✓" : s === "active" ? "●" : "○"}
                </span>
                <span className="wf-step">{label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {showVerified && lastVerified && (
        <div className="verified-banner">
          <span className="vb-badge">✓ VERIFIED</span>
          <span className="vb-text">
            {lastVerified.device} is {lastVerified.state.toUpperCase()}.
          </span>
        </div>
      )}

      {!active && (
        <p className="hint">
          Press Talk, then say e.g. <em>"Check my greenhouse"</em> or{" "}
          <em>"Fix my greenhouse"</em>.
        </p>
      )}
    </section>
  );
}