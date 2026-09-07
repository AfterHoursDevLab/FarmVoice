# FarmVoice — Tech Stack

FarmVoice is a monorepo (npm workspaces) with two apps and one shared package. Everything is TypeScript.

## Stack overview

| Layer       | Technology                                        | Why                                           |
| ----------- | ------------------------------------------------- | --------------------------------------------- |
| Frontend    | Next.js 15 (App Router) + React + TypeScript       | Fast build, SSR shell, easy deploy to Vercel  |
| Backend     | Node.js (>=20) + Express + TypeScript             | Small, explicit server for state + tool calls |
| Voice       | AssemblyAI Voice Agent API (realtime WebSocket)   | Hosted STT → LLM → TTS in one stream          |
| Rules engine| Custom `assess.ts` severity/fissue/recommendation logic | Deterministic, testable health classification |
| Tool layer  | AssemblyAI client-side function tools → REST      | LLM calls live tools, executed server-side    |
| Realtime    | SSE (Server-Sent Events)                          | Live dashboard updates from farm state        |
| Database    | PostgreSQL (Docker, optional)                     | Event/history persistence                     |
| Audio       | Web Audio API + AudioWorklet (PCM16)              | Mic capture at ~24 kHz in-browser             |

## Monorepo layout

```
farmvoice/
├── apps/
│   ├── web/          # Next.js dashboard + voice agent client (port 3000)
│   └── api/          # Express: state, tools, token minting, SSE (port 4000)
├── packages/
│   └── shared/       # types, tool schemas (FARM_TOOLS), SYSTEM_PROMPT
├── docker-compose.yml  # Postgres
└── package.json        # npm workspaces orchestration
```

## Voice agent architecture
- The permanent `ASSEMBLYAI_API_KEY` lives **only on the server**.
- Browser asks `POST /api/voice/token` → server mints a short-lived, single-use temp token.
- Browser opens `wss://agents.assemblyai.com/v1/ws?token=...` with a `session.update` that carries:
  - `system_prompt` (the FarmVoice behavior rules),
  - `greeting` (first spoken line),
  - `output.voice` (TTS voice),
  - `tools` (six function-tool schemas).
- Realtime mic audio is captured by an AudioWorklet, sent as `input.audio`.
- When the hosted LLM wants data or an action it emits `tool.call`; the client executes it against our REST API and returns `tool.result`. This is *interactive execution* — the browser is the middle-man, so the permanent key never reaches it.

## Tools
| Tool                    | Kind      | Description                              |
| ------------------------| --------- | ---------------------------------------- |
| `get_farm_status`       | read-only | Current readings + equipment state       |
| `get_farm_assessment`   | read-only | Severity, issues, recommendations        |
| `get_farm_history`      | read-only | Time series + trend deltas for a window  |
| `control_ac`            | action    | Toggle AC (medium impact)                |
| `control_fan`           | action    | Toggle fan (low impact)                  |
| `control_irrigation`    | action    | Toggle irrigation (high impact)          |

## Safety & verification model
- **Impact matrix** (in `assess.ts`): irrigation ON = high, AC = medium, fan = low.
- **Confirmation:** high-impact actions are refused by the backend unless `confirmed: true`; the prompt requires asking the farmer for one confirmation at a time.
- **Verify-after-every-action:** after any `control_*`, the agent must call `get_farm_status` and only report the *verified* state ("AC is on.") — never "Done".
- **Only recommended actions:** the agent may only propose actions present in the assessment's recommendations.

## Persistence
- State is in-memory (`state.ts`); on restart it resets but Postgres persists:
  - `sensor_history`, `equipment_events`, `voice_transcripts`, `agent_decisions`, `alerts`.
- Local stack uses `docker compose` for Postgres on port 5434.

## Deterministic demo
- `POST /api/farm/demo { on, temperatureC, humidityPct, soilMoisturePct }` pins a scenario and **freezes the simulator**, so the hero demo is repeatable and never drifts mid-recording.

## Testing
- `npm run test:assess` → `apps/api/tests/assess.test.js`: 17 assertions on severity boundaries (28 °C → normal, 32 °C → warning, 38 °C → critical) and the safety matrix (AC medium, irrigation high).
- `npm run test:workflow` → `apps/api/tests/workflow.test.js`: 11 assertions covering the 3 hero cases (healthy, temp-only, temp+soil) including the confirm-before-high-impact and verify-after-action guarantees. Needs the api running on :4000.
- `npm run typecheck` passes for shared / api / web.
