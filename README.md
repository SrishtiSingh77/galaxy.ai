# Galaxy.ai — Node-Based AI Workflow Builder

A visual, node-based workflow builder for chaining AI tasks. Drag nodes onto an infinite canvas, wire typed ports together, and hit **Run** — the engine resolves the graph as a DAG and executes every independent branch in parallel.

Built with Next.js 14 (App Router), React Flow, Zustand, Prisma + PostgreSQL, Clerk, Google Gemini, Trigger.dev, and a CDN-backed media pipeline.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Node Types](#node-types)
- [Execution Engine (DAG Semantics)](#execution-engine-dag-semantics)
- [Type-Safe Connection Validation](#type-safe-connection-validation)
- [Media / CDN Pipeline](#media--cdn-pipeline)
- [Response Node Output Contract](#response-node-output-contract)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Data Model](#data-model)
- [API Routes](#api-routes)
- [Verifying the Behaviour](#verifying-the-behaviour)
- [Known Constraints](#known-constraints)

---

## Features

| Area | What it does |
|---|---|
| **Visual canvas** | Infinite pan/zoom canvas, drag-and-drop nodes, box-select mode, minimap, auto-arrange, undo/redo |
| **DAG execution** | Independent branches dispatch simultaneously; dependent nodes wait only on their real upstream deps |
| **Type-safe wiring** | Every handle carries a datatype; incompatible connections are rejected mid-drag, before the edge exists |
| **Live run feedback** | The node currently running pulses a purple ring, driven by real execution state (not a client guess) |
| **Real-time history** | The history sidebar streams per-node status, duration, inputs, and outputs while the run is still going |
| **CDN media** | Uploads and cropped results are stored as CDN URLs — never base64, blobs, or local paths |
| **Persistence** | Debounced background auto-save of the graph, with an immediate flush before every run |
| **Auth + multi-tenancy** | Clerk-gated; every workflow and execution record is scoped to its owner |

---

## Architecture

```
Browser (React Flow canvas)
    │
    │  Zustand store = client source of truth
    │  debounced PATCH  ─────────────►  /api/workflows/[id]
    │
    │  POST /execute  ──────────────►  Orchestrator (background)
    │                                       │
    │                                       ├─► runCropImage()  ─► Cloudinary / Transloadit
    │                                       ├─► runGemini()     ─► Google Generative AI
    │                                       │
    │                                       └─► Postgres (node state + execution history)
    │
    └─ polls /run-status + /history  ◄──────┘
```

**Why polling instead of websockets:** the orchestrator persists node state to Postgres as it goes, so the canvas and the history sidebar both read the same durable source. A dropped connection or a page refresh mid-run loses nothing.

**State ownership:** the Zustand store owns the graph while you edit. The database owns it while a run is in flight. `saveNow()` flushes the client state to the DB immediately before a run starts, so the orchestrator never reads a stale graph.

---

## Node Types

### Request Inputs
The entry node. Define typed fields — text, number, boolean, image, audio, video, media, file. Each field becomes its own **source handle**, typed accordingly. Uploaded files go straight to the CDN; only the resulting URL is stored.

### Crop Image
Takes an image plus `x`, `y`, `width`, `height` (all percentages, 0–100). Each parameter can be driven either by its slider or by an incoming numeric connection — when connected, the slider greys out and locks.

Cropping runs as a **Cloudinary URL transformation**, not a local FFmpeg process. That matters: FFmpeg needs a spawnable binary and a writable temp directory, neither of which exists on serverless. The transformation approach behaves identically in local dev and in production. FFmpeg is retained only as a local-dev fallback when no CDN is configured.

The crop rectangle is clamped so `offset + size <= 100`, preventing the out-of-bounds rectangles that previously caused a silent pass-through of the uncropped source.

> **The task always takes at least 30 seconds.** This is a hard assignment requirement. The wait lives inside the task itself, *after* the crop and *before* the return. Because independent crop nodes run concurrently, two crops still complete in ~30s wall-clock total, not 60s.

### Gemini
Multimodal LLM node. Model selector (`gemini-3.1-pro`, `1.5-pro`, `1.5-flash`, `2.5-pro`), prompt, system prompt, temperature, max tokens, and image / video / audio / file inputs. Remote assets are fetched and passed to Gemini as base64 `inlineData`. Supports multiple images fanned into one vision call. Any input backed by a connection is disabled in the UI.

### Response
The terminal collector. Accepts any datatype and renders the final workflow outputs — see [Response Node Output Contract](#response-node-output-contract).

### Sticky Note
Canvas annotation. Not part of execution.

---

## Execution Engine (DAG Semantics)

Given this graph:

```
Request Inputs
    ├── Crop Image #1  ──┐
    ├── Crop Image #2  ──┤
    └── Gemini #1        │
            │            │
            └── Gemini #2┤
                         │
                   Final Gemini
```

The engine guarantees:

- **Crop #1, Crop #2, and Gemini #1 all start at T=0.** They share one dependency (Request Inputs) and nothing else, so nothing may stagger them.
- **Gemini #2 starts the moment Gemini #1 finishes.** It never waits on either crop node — they are not its ancestors.
- **Final Gemini starts only after all three of** Crop #1, Crop #2, and Gemini #2 complete.
- **Sibling nodes never block each other.** If N nodes become runnable at the same instant, all N are dispatched at that instant.

### How it works

Every node is scheduled up front as a promise:

```ts
nodesToExecuteIds.forEach((nodeId) => {
  executionPromises[nodeId] = Promise.resolve().then(() => executeNode(nodeId));
});
```

The `Promise.resolve().then(...)` deferral is load-bearing: it guarantees the full `executionPromises` map is populated before any node reads it. Without it, a node listed before its own dependency would read `undefined`, skip the wait, and execute against missing inputs.

Each node then awaits *only* its true upstream dependencies:

```ts
const dependencyIds = edges
  .filter((e) => e.target === nodeId)
  .map((e) => e.source)
  .filter((srcId) => nodesToExecuteIds.includes(srcId));

await Promise.all(dependencyIds.map((depId) => executionPromises[depId]));
```

Dependency resolution *is* the scheduler. There is no wave/level batching — a node runs the instant its own inputs are ready, regardless of what unrelated branches are still doing.

### Two things that were quietly breaking parallelism

**1. Awaited database writes before work began.** Marking a node as "running" used to `await` a Postgres round-trip before starting the actual task. With three siblings, that serialized their start times by tens of milliseconds each. Those writes are now queued rather than awaited, so the real work starts immediately.

**2. Concurrent writes clobbering each other.** The `nodes` column is one JSON blob. Two nodes finishing at once each wrote their own full copy, and the loser's output vanished — this is what made the Response node appear to capture nothing. All writes now go through a serialized queue that preserves ordering *without* making the nodes themselves wait on one another:

```ts
let writeQueue: Promise<any> = Promise.resolve();
const enqueueWrite = (fn: () => Promise<any>) => {
  writeQueue = writeQueue.then(fn).catch((e) => console.error("DB write failed:", e));
  return writeQueue;
};
```

The in-memory graph is mutated synchronously so the next reader sees fresh data instantly; only the durable write is deferred.

### Selective execution

Selecting a subset of nodes and running executes the full chain *through* them — ancestors (to produce their inputs) **and** descendants (to consume their outputs). Selecting only the input node previously ran that node alone and nothing downstream.

---

## Type-Safe Connection Validation

Every handle exposes a datatype:

```
text | number | boolean | image | audio | video | file | media | any
```

Compatibility rules:

| Rule | Example |
|---|---|
| Identical types connect | Image → Image (Vision) ✔ |
| `any` accepts everything | Gemini output → Response ✔ |
| Text sinks accept stringifiable scalars | Number → Prompt ✔ |
| `media` bridges concrete formats both ways | Media → Image ✔ |
| A file sink accepts any uploaded asset | Video → File ✔ |
| Everything else is rejected | Image → Prompt ✘ · Audio → Image ✘ · Video → Number ✘ · Image → Audio ✘ |

Enforcement happens in two places:

1. **`isValidConnection` on the canvas** — React Flow refuses to drop an invalid edge. The rejection is visual and happens *during the drag*, so an invalid edge is never created in the first place.
2. **`onConnect` in the store** — a second check before the edge is committed to state, covering programmatic connections.

Cycle detection runs alongside via DFS, so the graph is structurally guaranteed to stay a DAG — no feedback loops, no infinite execution.

**Connected inputs lock.** Whenever a handle has an incoming edge, its manual control (slider, textarea, upload button) is disabled and greyed, and the field displays "Connected". One field, one source of truth.

Edges are colour-coded by the datatype flowing through them, and rendered solid: text is orange, numeric is pink, image is blue, audio/video/media/file are violet, and anything terminating at the Response node is green.

---

## Media / CDN Pipeline

The rule: **no image ever touches the database as raw bytes.** Not base64, not blobs, not Buffers, not `localhost` paths — only CDN URLs.

This is not a style preference. Storing base64 in the `nodes` JSON meant every debounced auto-save, every status poll, and every history write shipped the entire image again. It exhausted a Neon data-transfer quota outright.

### Upload flow

```
User picks a file
   ↓ POST /api/upload  (Clerk-guarded, multipart)
Buffer → CDN provider
   ↓
Secure CDN URL returned
   ↓
URL stored in node data — the base64 preview stays in local component state only, never persisted
```

### Crop flow

```
Crop node receives an image URL
   ↓
Cropped via CDN transformation (bounds-clamped)
   ↓
Cropped CDN URL returned
```

### Provider resolution

`lib/storage.ts` is the single swap point. Providers are tried in order:

1. **Transloadit** — used when `TRANSLOADIT_AUTH_KEY` and `TRANSLOADIT_TEMPLATE_ID` are both set. Results are re-hosted so every image output in the graph is a Transloadit CDN URL.
2. **Cloudinary** — the working default. Handles both uploads and the crop transformation.
3. **Local disk** — dev-only last resort. Returns a `localhost` URL, so this path must never be used in production; configure a CDN provider instead.

Uploads retry with backoff, and downloads validate HTTP status, follow redirects, and reject empty bodies — a freshly uploaded CDN asset can briefly 302 or 404 before it propagates, which is what previously made crops succeed only on the third or fourth attempt.

---

## Response Node Output Contract

The Response node renders **only the actual workflow outputs**. No execution metadata, no node ids, no debug objects, no nested JSON wrappers.

Given a Gemini node returning marketing copy and a Crop node returning an image, the Response node shows:

```
TEXT
Your marketing copy appears here as plain text…

IMAGE
[ rendered image preview ]
https://res.cloudinary.com/…/galaxyai/cropped.png
```

Two guarantees back this:

- **`unwrapOutput()`** flattens any wrapped shape — `{ response: { text: "…" } }`, `{ output: … }`, `{ value: … }`, `{ url: … }` — down to the plain string a user expects. Arrays are joined; objects that match no known wrapper resolve to empty rather than leaking as JSON.
- **`isImageValue()`** classifies each output as text or image from its source port and URL shape, so images render as previews with their CDN URL shown as copyable plain text.

Node ids are not included in the payload the Response node receives at all — they cannot leak into the UI.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A PostgreSQL database (Neon works well)
- Clerk application
- Google Generative AI API key
- Cloudinary account (or Transloadit)

### Install

```bash
npm install
```

### Configure

Create `.env` in the project root — see [Environment Variables](#environment-variables). This file is gitignored and must never be committed.

### Push the schema

```bash
npx prisma db push
npx prisma generate
```

### Run

```bash
npm run dev
```

Open `http://localhost:3000`.

### Build

```bash
npm run build
npm start
```

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Google Gemini
GEMINI_API_KEY="..."

# Cloudinary (default media provider)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# Transloadit (optional — takes priority over Cloudinary when both keys are set)
TRANSLOADIT_AUTH_KEY="..."
TRANSLOADIT_TEMPLATE_ID="..."

# Trigger.dev (optional)
TRIGGER_SECRET_KEY="..."
```

> **Deploying:** set every one of these in your hosting provider's environment settings. A missing Cloudinary variable silently downgrades the app to the local-disk fallback, which cannot work on serverless — crops will appear to succeed while returning the uncropped source.

---

## Project Structure

```
app/
  api/
    upload/route.ts                    # Multipart upload → CDN URL
    workflows/route.ts                 # List / create (list omits heavy nodes+edges)
    workflows/[id]/route.ts            # Get / update / delete
    workflows/[id]/execute/route.ts    # DAG orchestrator
    workflows/[id]/run-status/route.ts # Live node state during a run
    workflows/[id]/history/route.ts    # Execution history
  dashboard/page.tsx                   # Workflow list, status badges, cached loads
  workflows/[id]/page.tsx              # The canvas
  not-found.tsx                        # Themed 404
components/
  nodes/                               # RequestInputs, CropImage, Gemini, Response, StickyNote
  HistorySidebar.tsx                   # Real-time run history
lib/
  storage.ts                           # Provider resolution + crop transformation
  transloadit.ts                       # Transloadit assembly upload + polling
  db.ts                                # Prisma singleton
store/
  useWorkflowStore.ts                  # Graph state, port types, validation, auto-save
trigger/
  cropImage.ts                         # Crop task (with the 30s floor)
  geminiTask.ts                        # Gemini multimodal task
prisma/
  schema.prisma
```

---

## Data Model

```prisma
model Workflow {
  id         String   @id @default(uuid())
  name       String
  userId     String
  nodes      Json     // node states: type, position, data, config
  edges      Json     // connection states
  executions ExecutionHistory[]
}

model ExecutionHistory {
  id         String   @id @default(uuid())
  workflowId String
  userId     String
  timestamp  DateTime @default(now())
  status     String   // RUNNING | SUCCESS | FAILED | PARTIAL
  duration   Float    // seconds
  scope      String   // FULL | PARTIAL | SINGLE_NODE
  details    Json     // per-node status, timings, inputs, outputs
}
```

`nodes` and `edges` are opaque JSON, so new node types need no migration.

Each entry in `details` carries `startedAtMs` and `endedAtMs` — offsets in milliseconds from the start of the run. These make parallelism directly auditable: siblings that ran concurrently share the same `startedAtMs`.

Any inline `data:` URL is replaced with a short marker before history is persisted, keeping records small.

---

## API Routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/workflows` | List workflows (metadata + latest run status only) |
| `POST` | `/api/workflows` | Create a workflow |
| `GET` | `/api/workflows/[id]` | Fetch the full graph |
| `PATCH` | `/api/workflows/[id]` | Persist nodes and edges |
| `DELETE` | `/api/workflows/[id]` | Delete a workflow and its history |
| `POST` | `/api/workflows/[id]/execute` | Start a run; returns a `runId` immediately |
| `GET` | `/api/workflows/[id]/run-status` | Poll live node state |
| `GET` | `/api/workflows/[id]/history` | Execution history |
| `POST` | `/api/upload` | Upload a file, get a CDN URL |

All routes are Clerk-guarded and verify record ownership before responding.

---

## Verifying the Behaviour

### Automated check

```bash
npm run verify:dag
```

Runs the reviewer's exact graph shape (Request Inputs → Crop ×2 + Gemini → Gemini → Final Gemini) against the **real** crop task, and asserts:

```
PASS  siblings start at T=0 — start spread 35ms (want <100ms)
PASS  crop-1 honours 30s floor — ran 30.0s (want >=30s)
PASS  crop-2 honours 30s floor — ran 30.0s (want >=30s)
PASS  crops run concurrently — both crops took 30.0s total (want ~30s, not ~60s)
PASS  gemini-2 does not wait on crops — started at T+1544ms
PASS  gemini-final waits for all three deps — started at T+30042ms
```

Gemini calls are stubbed so the check costs no API quota; the crop path is real and prints the CDN URL it produced. Takes ~32 seconds.

### Manual checks

**Parallel dispatch.** Run a workflow and watch the server log:

```
[T+412ms] Node crop-1 (cropImage) STARTED
[T+413ms] Node crop-2 (cropImage) STARTED
[T+415ms] Node gemini-1 (gemini) STARTED
```

Siblings start within a few milliseconds of one another. Cross-check `startedAtMs` in the history record. If a sibling starts thousands of milliseconds late, it has an unintended edge.

**The 30-second floor.** Every Crop node's duration in the history sidebar reads 30s or more. The log shows the wait explicitly:

```
Crop finished in 1180ms — waiting 28820ms to satisfy the 30s minimum.
```

Two parallel crops should still finish the run in roughly 30 seconds total — if it takes 60, they are running sequentially.

**CDN URLs.** Every image output starts with `https://` and points at a CDN host. Look for the log line `Cropped image CDN URL: …`. A `data:` prefix, a `blob:` prefix, or a `localhost` host all indicate a misconfigured provider.

**Type validation.** Drag from an image output to a Gemini prompt input — React Flow refuses the drop and no edge appears. The browser console explains the rejection.

**Locked inputs.** Connect anything to a Crop node's `width` handle: the slider greys out and stops responding.

**Response cleanliness.** After a run, the Response node shows only text and image URLs. No braces, no node ids, no `{ response: { text: … } }`.

---

## Known Constraints

- **Serverless timeouts.** The 30-second crop floor plus Gemini latency can exceed the default function timeout on some hosts. The orchestrator runs fire-and-forget after the HTTP response is sent, so a platform that freezes the process at response time will cut the run short. Raise the function's max duration accordingly.
- **Transloadit requires valid credentials.** With an invalid auth key, uploads fail with `GET_ACCOUNT_UNKNOWN_AUTH_KEY`. The provider is gated on config presence and falls through to Cloudinary, but an invalid-yet-present key will burn a failed attempt on each upload before falling back.
- **FFmpeg is dev-only.** It requires a spawnable binary and a writable temp directory. Configure a CDN provider for any deployed environment.
- **Local disk storage returns `localhost` URLs**, which are unreachable from the CDN and from other machines. It exists purely so the app runs without credentials during development.
- **Crop parameters are percentages.** `X=0, Y=0, W=100, H=100` is the full frame and produces output identical to the input — lower the width and height to see an actual crop.
