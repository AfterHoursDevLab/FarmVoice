"use client";

import { useFarmFeed } from "../hooks/useFarmFeed";
import { VoicePanel } from "../components/VoicePanel";
import { FarmHealthCard } from "../components/FarmHealthCard";
import { ActiveIssues } from "../components/ActiveIssues";
import { AIRecommendations } from "../components/AIRecommendations";
import { EquipmentRack } from "../components/EquipmentRack";
import { EventLog } from "../components/EventLog";
import "./globals.css";

export default function Home() {
  const { state, assessment, connected, error, latestAlert } = useFarmFeed();

  return (
    <main className="shell">
      <header className="header">
        <div>
          <h1>FarmVoice</h1>
          <p>AI Greenhouse Control</p>
        </div>
        <span className={`sys-status ${connected ? "ok" : "off"}`}>
          <span className="sys-dot" /> {connected ? "System Online" : "Offline"}
        </span>
      </header>

      {/* Top: Farm health (left) | Voice agent (right, dominant) */}
      <div className="top-grid">
        <div className="panel-col">
          {state && assessment && <FarmHealthCard state={state} assessment={assessment} />}
        </div>
        <VoicePanel latestAlert={latestAlert} />
      </div>

      {/* Middle: Active issues | AI recommendations */}
      <div className="two-grid">
        {state && assessment && <ActiveIssues state={state} assessment={assessment} />}
        <AIRecommendations assessment={assessment} />
      </div>

      {/* Bottom: Equipment then activity */}
      {state && <EquipmentRack state={state} />}
      <EventLog />

      {!state && error && <p className="error">{error}</p>}
    </main>
  );
}
