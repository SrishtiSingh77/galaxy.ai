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

    const workflowId = params.id;
    const history = await db.executionHistory.findMany({
      where: {
        workflowId,
        userId,
      },
      orderBy: { timestamp: "desc" },
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error("GET /api/workflows/[id]/history error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
