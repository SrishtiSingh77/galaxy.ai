import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { runOrchestrator } from "@/lib/orchestrator";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";

// The orchestrator runs in the background after the response is sent, and the
// Crop task alone holds for 30s. Without a raised limit the platform kills the
// function mid-run and the delay looks like it never happened.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const executeWorkflowSchema = z.object({
  selectedNodeIds: z.array(z.string()).optional(), // For selective execution
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflowId = params.id;
    const workflow = await db.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if (workflow.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = executeWorkflowSchema.safeParse(body);
    const selectedNodeIds = parseResult.success ? parseResult.data.selectedNodeIds : undefined;

    // Create execution history entry in RUNNING state
    const execution = await db.executionHistory.create({
      data: {
        workflowId,
        userId,
        status: "RUNNING",
        duration: 0,
        scope: selectedNodeIds && selectedNodeIds.length > 0 
          ? (selectedNodeIds.length === 1 ? "SINGLE_NODE" : "PARTIAL")
          : "FULL",
        details: [],
      },
    });

    // Start background orchestration.
    //
    // The response is returned immediately so the client can begin polling
    // run-status, but a serverless platform freezes the function the moment the
    // response is sent — which killed the orchestrator before a single node ran
    // and left the history row stuck at status RUNNING / duration 0.
    // waitUntil keeps the invocation alive until the run settles.
    const orchestration = runOrchestrator(
      workflow.id,
      userId,
      execution.id,
      selectedNodeIds
    ).catch((e) => console.error("Orchestrator crashed:", e));

    // Outside a Vercel request context there is nothing to extend, and the Node
    // process stays alive on its own — so a failure here is not fatal.
    try {
      waitUntil(orchestration);
    } catch (e) {
      console.warn("waitUntil unavailable (not on Vercel) — relying on the host process:", e);
    }

    return NextResponse.json({ runId: execution.id });
  } catch (error) {
    console.error("POST /api/workflows/[id]/execute error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
