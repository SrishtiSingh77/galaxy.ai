/**
 * Verifies the two behaviours the reviewer flagged, without needing the UI:
 *
 *   1. Independent sibling nodes all start at T=0.
 *   2. The Crop task never returns in under 30 seconds, and two concurrent
 *      crops still finish in ~30s total rather than ~60s.
 *
 * It exercises the REAL crop task (trigger/cropImage.ts) and mirrors the
 * orchestrator's dependency-resolution scheduler exactly.
 *
 * Run:  npx tsx scripts/verify-dag.ts
 */
import { runCropImage } from "../trigger/cropImage";

// A public test image, so the run does not depend on any local upload
const TEST_IMAGE = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

// The reviewer's graph shape
const EDGES: Array<{ source: string; target: string }> = [
  { source: "request-inputs", target: "crop-1" },
  { source: "request-inputs", target: "crop-2" },
  { source: "request-inputs", target: "gemini-1" },
  { source: "gemini-1", target: "gemini-2" },
  { source: "crop-1", target: "gemini-final" },
  { source: "crop-2", target: "gemini-final" },
  { source: "gemini-2", target: "gemini-final" },
];

const NODE_IDS = [
  "request-inputs",
  "crop-1",
  "crop-2",
  "gemini-1",
  "gemini-2",
  "gemini-final",
];

const start = Date.now();
const timeline: Record<string, { startedAtMs: number; endedAtMs: number }> = {};

// Stand-in for a Gemini call, so the test needs no API quota
const fakeGemini = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const promises: Record<string, Promise<any>> = {};

  const executeNode = async (nodeId: string) => {
    // Wait only on true upstream dependencies — this IS the scheduler
    const deps = EDGES.filter((e) => e.target === nodeId).map((e) => e.source);
    await Promise.all(deps.map((d) => promises[d]));

    const startedAtMs = Date.now() - start;
    console.log(`[T+${String(startedAtMs).padStart(6)}ms] ${nodeId} STARTED`);

    if (nodeId.startsWith("crop")) {
      await runCropImage({ imageUrl: TEST_IMAGE, x: 10, y: 10, width: 50, height: 50 });
    } else if (nodeId.startsWith("gemini")) {
      await fakeGemini(1500);
    }

    const endedAtMs = Date.now() - start;
    timeline[nodeId] = { startedAtMs, endedAtMs };
    console.log(`[T+${String(endedAtMs).padStart(6)}ms] ${nodeId} FINISHED`);
  };

  // Deferred so the full promise map exists before any node reads it
  NODE_IDS.forEach((id) => {
    promises[id] = Promise.resolve().then(() => executeNode(id));
  });
  await Promise.all(NODE_IDS.map((id) => promises[id]));

  // ---- Assertions --------------------------------------------------------
  console.log("\n--- RESULTS ---");
  let failed = 0;
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label} — ${detail}`);
    if (!ok) failed++;
  };

  const siblings = ["crop-1", "crop-2", "gemini-1"].map((id) => timeline[id].startedAtMs);
  const spread = Math.max(...siblings) - Math.min(...siblings);
  check("siblings start at T=0", spread < 100, `start spread ${spread}ms (want <100ms)`);

  for (const id of ["crop-1", "crop-2"]) {
    const dur = timeline[id].endedAtMs - timeline[id].startedAtMs;
    check(`${id} honours 30s floor`, dur >= 30_000, `ran ${(dur / 1000).toFixed(1)}s (want >=30s)`);
  }

  const cropsWallClock =
    Math.max(timeline["crop-1"].endedAtMs, timeline["crop-2"].endedAtMs) -
    Math.min(timeline["crop-1"].startedAtMs, timeline["crop-2"].startedAtMs);
  check(
    "crops run concurrently",
    cropsWallClock < 45_000,
    `both crops took ${(cropsWallClock / 1000).toFixed(1)}s total (want ~30s, not ~60s)`
  );

  check(
    "gemini-2 does not wait on crops",
    timeline["gemini-2"].startedAtMs < 10_000,
    `started at T+${timeline["gemini-2"].startedAtMs}ms (want before the crops finish)`
  );

  const lastDep = Math.max(
    timeline["crop-1"].endedAtMs,
    timeline["crop-2"].endedAtMs,
    timeline["gemini-2"].endedAtMs
  );
  check(
    "gemini-final waits for all three deps",
    timeline["gemini-final"].startedAtMs >= lastDep,
    `started at T+${timeline["gemini-final"].startedAtMs}ms, last dep finished T+${lastDep}ms`
  );

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
