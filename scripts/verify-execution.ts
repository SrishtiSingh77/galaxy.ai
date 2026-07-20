/**
 * Full-stack execution test. Drives the REAL orchestrator against the REAL
 * database and the REAL crop task, bypassing only HTTP and Clerk auth.
 *
 * Covers what scripts/verify-dag.ts cannot:
 *   - node state actually persists to Postgres during the run
 *   - execution history advances from RUNNING to a terminal status
 *   - the crop node resolves its input from the connected upstream image
 *   - the Response node collects clean text / CDN URLs
 *
 * Creates a temporary workflow, runs it, asserts, then DELETES it.
 *
 * Run:  npx tsx --env-file=.env scripts/verify-execution.ts
 */
import { db } from "../lib/db";
import { runOrchestrator } from "../lib/orchestrator";

const TEST_USER = "verify-script-user";
const TEST_IMAGE = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

const nodes = [
  {
    id: "request-inputs",
    type: "requestInputs",
    position: { x: 100, y: 300 },
    data: {
      fields: [
        { id: "field-1", name: "text_field", type: "text_field", value: "hello" },
        { id: "field-2", name: "image_field", type: "image_field", value: TEST_IMAGE },
      ],
    },
  },
  {
    id: "crop-1",
    type: "cropImage",
    position: { x: 600, y: 200 },
    data: { x: 10, y: 10, width: 50, height: 50, inputImage: "", outputImage: "" },
  },
  {
    id: "crop-2",
    type: "cropImage",
    position: { x: 600, y: 500 },
    data: { x: 20, y: 20, width: 40, height: 40, inputImage: "", outputImage: "" },
  },
  {
    id: "response",
    type: "response",
    position: { x: 1100, y: 350 },
    data: { results: [] },
  },
];

// image_field -> both crops; both crop outputs -> response
const edges = [
  { id: "e1", source: "request-inputs", sourceHandle: "image_field", target: "crop-1", targetHandle: "inputImage" },
  { id: "e2", source: "request-inputs", sourceHandle: "image_field", target: "crop-2", targetHandle: "inputImage" },
  { id: "e3", source: "crop-1", sourceHandle: "outputImage", target: "response", targetHandle: "result" },
  { id: "e4", source: "crop-2", sourceHandle: "outputImage", target: "response", targetHandle: "result" },
];

let failed = 0;
const check = (label: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!ok) failed++;
};

async function main() {
  const workflow = await db.workflow.create({
    data: { name: "__verify_script_temp__", userId: TEST_USER, nodes, edges },
  });
  const execution = await db.executionHistory.create({
    data: {
      workflowId: workflow.id,
      userId: TEST_USER,
      status: "RUNNING",
      duration: 0,
      scope: "FULL",
      details: [],
    },
  });
  console.log(`Created temp workflow ${workflow.id}, run ${execution.id}\n`);

  try {
    // Poll mid-run to confirm state is visible while the run is still going
    let sawRunningGlow = false;
    let sawIncrementalHistory = false;
    const poller = setInterval(async () => {
      try {
        const w = await db.workflow.findUnique({ where: { id: workflow.id } });
        const ns = (w?.nodes as any[]) || [];
        if (ns.some((n) => n.data?.isExecuting)) sawRunningGlow = true;
        const h = await db.executionHistory.findUnique({ where: { id: execution.id } });
        if (((h?.details as any[]) || []).length > 0 && h?.status === "RUNNING") {
          sawIncrementalHistory = true;
        }
      } catch {
        /* transient */
      }
    }, 2000);

    const started = Date.now();
    await runOrchestrator(workflow.id, TEST_USER, execution.id);
    const wallClock = Date.now() - started;
    clearInterval(poller);

    const finalWorkflow = await db.workflow.findUnique({ where: { id: workflow.id } });
    const finalHistory = await db.executionHistory.findUnique({ where: { id: execution.id } });
    const finalNodes = (finalWorkflow?.nodes as any[]) || [];
    const byId = (id: string) => finalNodes.find((n) => n.id === id);

    console.log("\n--- RESULTS ---");

    check(
      "history reached a terminal status",
      finalHistory?.status === "SUCCESS",
      `status=${finalHistory?.status}`
    );
    check(
      "history duration advanced past 0",
      (finalHistory?.duration ?? 0) > 0,
      `duration=${finalHistory?.duration?.toFixed(1)}s`
    );
    check(
      "history recorded every node",
      ((finalHistory?.details as any[]) || []).length === 4,
      `${((finalHistory?.details as any[]) || []).length} node records`
    );
    check("history streamed DURING the run", sawIncrementalHistory, "observed partial details while RUNNING");
    check("glow state was visible mid-run", sawRunningGlow, "observed isExecuting=true on a node");

    for (const id of ["crop-1", "crop-2"]) {
      const n = byId(id);
      check(`${id} resolved its upstream image`, n?.data?.inputImage === TEST_IMAGE, `inputImage=${n?.data?.inputImage || "(empty)"}`);
      const out: string = n?.data?.outputImage || "";
      check(
        `${id} produced a CDN URL`,
        out.startsWith("https://") && !out.includes("localhost") && !out.startsWith("data:"),
        out || "(empty)"
      );
      check(`${id} output differs from its input`, out !== TEST_IMAGE, out === TEST_IMAGE ? "returned source unchanged" : "cropped");
    }

    const results = byId("response")?.data?.results || [];
    check("response collected both outputs", results.length === 2, `${results.length} results`);
    check(
      "response values are plain strings",
      results.every((r: any) => typeof r.value === "string" && r.value.length > 0),
      JSON.stringify(results.map((r: any) => typeof r.value))
    );
    check(
      "response exposes no node ids",
      results.every((r: any) => !("source" in r)),
      `keys: ${JSON.stringify(Object.keys(results[0] || {}))}`
    );
    check(
      "response classified outputs as images",
      results.every((r: any) => r.type === "image"),
      JSON.stringify(results.map((r: any) => r.type))
    );

    check(
      "crops ran concurrently under the 30s floor",
      wallClock < 45_000 && wallClock >= 30_000,
      `whole run took ${(wallClock / 1000).toFixed(1)}s (want ~30s, not ~60s)`
    );

    console.log("\nResponse node payload:");
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await db.executionHistory.deleteMany({ where: { workflowId: workflow.id } });
    await db.workflow.delete({ where: { id: workflow.id } });
    console.log(`\nCleaned up temp workflow ${workflow.id}`);
  }

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
