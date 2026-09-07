# FarmVoice — Pitch Deck

> "Talk to your greenhouse."

---

## Slide 1 — Title

**FarmVoice**
*The voice-controlled greenhouse that understands, decides, and verifies.*

AssemblyAI demo submission · FarmVoice

---

## Slide 2 — The Problem

**Farmers can't watch temperatures around the clock.**

- A 2 °C miss or dry soil can stress or kill a crop.
- Manual checks are infrequent and unreliable.
- Dashboards require someone to constantly *look* and *interpret*.

**The result:** small problems become big losses before anyone notices.

---

## Slide 3 — The Idea

**FarmVoice turns the greenhouse into a conversation.**

Instead of watching a dashboard, the farmer just asks:

> "Check my greenhouse." / "Why is it getting hotter?"

FarmVoice reads the live state, understands the problem, and answers — or takes safe action.

---

## Slide 4 — The Demo Story (our differentiator)

```
Farmer            "Check my greenhouse."
FarmVoice         reads live state            →  UNDERSTAND
FarmVoice         identifies problems         →  REASON
FarmVoice         prioritizes actions         →  DECIDE
Safety            high-impact needs approval  →  CONFIRM
FarmVoice         controls equipment          →  ACT
FarmVoice         verifies the result         →  VERIFY
Farmer hears      "AC is on. Irrigation is running."  →  REPORT
```

**We don't just act — we check.** Every control is followed by reading the real state back, and FarmVoice only reports what it verifies.

---

## Slide 5 — Safety by Design

| Action      | Impact   | Requires confirmation?              |
| ----------- | -------- | ----------------------------------- |
| Fan on      | Low      | No — executes immediately          |
| AC on       | Medium   | Yes — asked one at a time          |
| Irrigation  | **High** | **Yes — backend refuses without it** |

The backend *enforces* the safety policy, not just the model. A hallucinating agent cannot switch irrigation on without explicit approval.

---

## Slide 6 — Proof: Dashboard + Voice in sync

- **Live readings:** temperature, humidity, soil moisture (updates via SSE).
- **Farm Health badge:** reflects the measured readings (Critical → Warning → Normal).
- **Active issues** and **AI recommendation** computed from live state.
- **Event log:** every device action tagged and attributed (by FarmVoice / dashboard · confirmed).
- The judge sees the exact same numbers the agent is talking about.

---

## Slide 7 — Tech at a Glance

| Component    | Technology                  |
| ------------ | --------------------------- |
| Voice        | AssemblyAI Voice Agent API  |
| Frontend     | Next.js + React + TS        |
| Backend      | Node + Express + TS         |
| Reasoning    | hosted LLM + function tools |
| Rules        | deterministic assessment    |
| Realtime     | SSE                        |
| Persistence  | PostgreSQL (optional)       |

---

## Slide 8 — Demo

*(2-minute live / recorded demo)*

1. **Critical scenario** loads (34 °C / 24 % soil, all off).
2. **"Check my greenhouse."** → FarmVoice reads and summarizes worst-first.
3. **"Fix my greenhouse."** → AC + irrigation recommended.
4. **"Yes."** → AC ON → verified.
5. **"Yes."** → Irrigation ON → verified.
6. **"AC is on. Irrigation is running."** → issues cleared, equipment shown ON (health badge stays Critical while the demo readings are frozen at 34 °C / 24 % — it reports the measured value, not the fix).

---

## Slide 9 — The Ask

- This demo proves a **voice-first, safety-aware** farm assistant.
- Next: real ESP32 sensors, anomaly alerts, multi-greenhouse.
- FarmVoice turns monitoring from a *chore* into a *conversation*.

**Thank you.**