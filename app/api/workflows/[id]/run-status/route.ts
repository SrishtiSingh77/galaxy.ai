import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json({ error: "Missing runId parameter" }, { status: 400 });
    }

    const workflowId = params.id;
    const workflow = await db.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow || workflow.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const execution = await db.executionHistory.findUnique({
      where: { id: runId },
    });

    if (!execution) {
      return NextResponse.json({ error: "Execution run not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: execution.status,
      duration: execution.duration,
      nodes: workflow.nodes,
      edges: workflow.edges,
    });
  } catch (error) {
    console.error("GET /api/workflows/[id]/run-status error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
