# FarmVoice

**Talk to your greenhouse.** A voice-controlled greenhouse dashboard built on the
[AssemblyAI Voice Agent API](https://www.assemblyai.com/docs/voice-agents/voice-agent-api) —
realtime STT → hosted LLM → client-side function tools → simulated hardware → spoken
confirmation. FarmVoice reads live state, understands problems, acts safely (with
confirmation), and verifies its own results.

```
MIC → AudioWorklet (PCM16) → wss://agents.assemblyai.com/v1/ws?token=...
     → Realtime STT → hosted LLM → tool.call → REST tool execution
     → tool.result → LLM → TTS → speaker
```

## Stack

| Layer     | Stack                                     |
| --------- | ----------------------------------------- |
| Frontend  | Next.js 15 (App Router) + React + TypeScript |
| Backend   | Node.js (>=20) + Express + TypeScript     |
| Voice     | AssemblyAI Voice Agent API (realtime, client tools) |
| Rules     | Custom assessment engine (severity / issues / recommendations) |
| Realtime  | SSE for dashboard updates                 |
| Database  | PostgreSQL (optional, Docker)             |

## Quickstart

```bash
npm install
cp .env.example .env          # set ASSEMBLYAI_API_KEY (https://www.assemblyai.com/app)
docker compose up -d          # optional: Postgres
npm run dev                   # api :4000, web :3000
```

Open http://localhost:3000, allow the mic, press **Talk**, then try
*"Check my greenhouse."* or *"Turn the AC on."*

### Deterministic demo (for recordings)

```bash
curl -X POST http://localhost:4000/api/farm/demo \
  -H "Content-Type: application/json" -d '{"on":true}'
# pins 34 °C / 81 % / 24 %, all equipment OFF, freezes the simulator
```

## Repo layout

```
apps/
  web/       # Next.js dashboard + voice agent client
  api/       # Express: farm state, tool execution, token minting, SSE
packages/
  shared/    # types, tool schemas, system prompt
docs/
  TECH_STACK.md   # architecture breakdown
  PITCH_DECK.md   # pitch slides
  DEMO_SCRIPT.md  # hero demo recording script
  diagrams/       # architecture diagram (Mermaid)
```

## Tests

```bash
npm run test:assess           # assessment engine unit tests (needs dist build)
npm run test:workflow         # integration tests against a running api (:4000)
npm run typecheck             # shared + api + web
```

## Security notes

- `ASSEMBLYAI_API_KEY` is **server-side only**; browsers get short-lived, single-use
  temp tokens minted by `POST /api/voice/token`.
- Control endpoints should sit behind real auth before driving physical hardware.

See [`docs/TECH_STACK.md`](docs/TECH_STACK.md) for the architecture and
[`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) for the hero demo recording script.