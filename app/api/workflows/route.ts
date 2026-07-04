import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createWorkflowSchema } from "@/lib/validations";

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflows = await db.workflow.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(workflows);
  } catch (error) {
    console.error("GET /api/workflows error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = createWorkflowSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    // Default pre-placed nodes
    const initialNodes = [
      {
        id: "request-inputs",
        type: "requestInputs",
        position: { x: 100, y: 300 },
        data: {
          fields: [
            {
              id: "field-1",
              name: "text_field",
              type: "text_field",
              value: "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
            },
            {
              id: "field-2",
              name: "image_field",
              type: "image_field",
              value: "",
            },
          ],
        },
        deletable: false,
      },
      {
        id: "response",
        type: "response",
        position: { x: 1100, y: 350 },
        data: {
          results: [],
        },
        deletable: false,
      },
    ];

    const workflow = await db.workflow.create({
      data: {
        name: result.data.name,
        userId,
        nodes: initialNodes,
        edges: [],
      },
    });

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("POST /api/workflows error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
