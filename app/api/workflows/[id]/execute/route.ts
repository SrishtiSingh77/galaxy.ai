import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { cropImageTask } from "@/trigger/cropImage";
import { geminiTask } from "@/trigger/geminiTask";
import { z } from "zod";

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

    // Start background orchestration
    runOrchestrator(workflow.id, userId, execution.id, selectedNodeIds);

    return NextResponse.json({ runId: execution.id });
  } catch (error) {
    console.error("POST /api/workflows/[id]/execute error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Background Orchestrator
async function runOrchestrator(
  workflowId: string,
  userId: string,
  runId: string,
  selectedNodeIds?: string[]
) {
  const startTime = Date.now();
  const nodeDetails: any[] = [];
  let runStatus: "SUCCESS" | "FAILED" | "PARTIAL" = "SUCCESS";

  try {
    // 1. Fetch latest workflow state
    const workflow = await db.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflow) return;

    const nodes = workflow.nodes as any[];
    const edges = workflow.edges as any[];

    // 2. Identify nodes to execute
    let nodesToExecuteIds = nodes.map((n) => n.id);

    if (selectedNodeIds && selectedNodeIds.length > 0) {
      // Selective execution: find target nodes and all their ancestors
      const ancestors = new Set<string>();
      
      const getAncestors = (nodeId: string) => {
        if (ancestors.has(nodeId)) return;
        ancestors.add(nodeId);
        // Find edges pointing to this node
        const incomingEdges = edges.filter((e) => e.target === nodeId);
        incomingEdges.forEach((e) => getAncestors(e.source));
      };

      selectedNodeIds.forEach((id) => getAncestors(id));
      nodesToExecuteIds = Array.from(ancestors);
    }

    console.log(`Starting execution for run ${runId}. Nodes to execute:`, nodesToExecuteIds);

    // 3. Set executing status on nodes
    let currentNodes = nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isExecuting: nodesToExecuteIds.includes(n.id) && n.id !== "request-inputs" && n.id !== "response",
        ...(nodesToExecuteIds.includes(n.id) && { response: "", results: [] }), // Clear old outputs for nodes running
      },
    }));

    await db.workflow.update({
      where: { id: workflowId },
      data: { nodes: currentNodes },
    });

    // 4. Async execution tracking
    const resolvedOutputs: Record<string, Record<string, any>> = {};
    const executionPromises: Record<string, Promise<any>> = {};

    const executeNode = async (nodeId: string) => {
      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node) return;

      const nodeStartTime = Date.now();
      let nodeStatus = "SUCCESS";
      let nodeError = "";
      let nodeOutputs: Record<string, any> = {};
      let nodeInputs: Record<string, any> = {};

      try {
        // A. Wait for upstream dependency nodes to resolve
        const incomingEdges = edges.filter((e) => e.target === nodeId);
        const dependencyIds = incomingEdges.map((e) => e.source).filter((srcId) => nodesToExecuteIds.includes(srcId));

        // Wait for all dependency promises to finish
        await Promise.all(dependencyIds.map((depId) => executionPromises[depId]));

        // Gather resolved inputs from edges pointing to this node
        incomingEdges.forEach((edge) => {
          const sourceVals = resolvedOutputs[edge.source];
          if (sourceVals) {
            const val = sourceVals[edge.sourceHandle];
            if (val !== undefined) {
              if (edge.targetHandle === "image") {
                // Multi-connection support for image (Vision) input
                if (!nodeInputs[edge.targetHandle]) nodeInputs[edge.targetHandle] = [];
                nodeInputs[edge.targetHandle].push(val);
              } else {
                nodeInputs[edge.targetHandle] = val;
              }
            }
          }
        });

        // B. Run execution depending on node type
        if (node.type === "requestInputs") {
          // Local node - extract fields
          const fields = node.data?.fields || [];
          fields.forEach((field: any) => {
            nodeOutputs[field.name] = field.value;
          });
        } else if (node.type === "cropImage") {
          // Crop Image node
          const inputImage = nodeInputs.inputImage || node.data.inputImage || "";
          const x = nodeInputs.x !== undefined ? nodeInputs.x : (node.data.x ?? 0);
          const y = nodeInputs.y !== undefined ? nodeInputs.y : (node.data.y ?? 0);
          const width = nodeInputs.width !== undefined ? nodeInputs.width : (node.data.width ?? 100);
          const height = nodeInputs.height !== undefined ? nodeInputs.height : (node.data.height ?? 100);

          nodeInputs = { inputImage, x, y, width, height };

          // Execute task via Trigger.dev or fallback invocation
          let croppedUrl = "";
          try {
            console.log(`Scheduling Crop task for node ${nodeId}...`);
            croppedUrl = await cropImageTask.run({
              imageUrl: inputImage,
              x,
              y,
              width,
              height,
            });
          } catch (e: any) {
            console.error(`Trigger.dev Crop failed for ${nodeId}, running direct fallback...`, e);
            croppedUrl = inputImage; // Fallback
          }

          nodeOutputs = { outputImage: croppedUrl };

          // Update DB node output in real-time
          currentNodes = currentNodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    outputImage: croppedUrl,
                    isExecuting: false,
                  },
                }
              : n
          );
          await db.workflow.update({
            where: { id: workflowId },
            data: { nodes: currentNodes },
          });
        } else if (node.type === "gemini") {
          // Gemini Node
          const prompt = nodeInputs.prompt || node.data.prompt || "";
          const systemPrompt = nodeInputs.systemPrompt || node.data.systemPrompt || "";
          
          // Image input could be a single string or an array of strings (multimodal)
          const imageUrls = Array.isArray(nodeInputs.image)
            ? nodeInputs.image
            : (nodeInputs.image ? [nodeInputs.image] : (node.data.imageVal ? [node.data.imageVal] : []));

          const videoUrl = nodeInputs.video || node.data.videoVal || "";
          const audioUrl = nodeInputs.audio || node.data.audioVal || "";
          const fileUrl = nodeInputs.file || node.data.fileVal || "";

          nodeInputs = { prompt, systemPrompt, imageUrls, videoUrl, audioUrl, fileUrl };

          // Run Gemini SDK LLM task
          let responseText = "";
          try {
            console.log(`Scheduling Gemini task for node ${nodeId}...`);
            responseText = await geminiTask.run({
              modelName: node.data.model || "gemini-3.1-pro",
              prompt,
              systemPrompt,
              imageUrls,
              videoUrl,
              audioUrl,
              fileUrl,
              temperature: node.data.temperature,
              maxTokens: node.data.maxTokens,
            });
          } catch (e: any) {
            console.error(`Trigger.dev Gemini task failed for ${nodeId}, executing direct fallback:`, e);
            responseText = `Error running Gemini model: ${e.message || e}`;
            nodeStatus = "FAILED";
            nodeError = e.message || String(e);
            runStatus = "PARTIAL";
          }

          nodeOutputs = { response: responseText };

          // Update DB node output in real-time
          currentNodes = currentNodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    response: responseText,
                    isExecuting: false,
                  },
                }
              : n
          );
          await db.workflow.update({
            where: { id: workflowId },
            data: { nodes: currentNodes },
          });
        } else if (node.type === "response") {
          // Final collector node
          // Gather all values connected to result input
          const incomingResults: any[] = [];
          
          incomingEdges.forEach((edge) => {
            if (edge.targetHandle === "result") {
              const srcVals = resolvedOutputs[edge.source];
              if (srcVals) {
                // Find what output variable was connected
                const val = srcVals[edge.sourceHandle];
                if (val) {
                  const isImage = 
                    edge.sourceHandle === "outputImage" || 
                    (typeof val === "string" && val.startsWith("data:image")) ||
                    (typeof val === "string" && val.startsWith("http") && (val.includes(".png") || val.includes(".jpg") || val.includes(".jpeg") || val.includes("transloadit")));

                  incomingResults.push({
                    source: edge.source,
                    value: val,
                    type: isImage ? "image" : "text",
                  });
                }
              }
            }
          });

          nodeInputs = { result: incomingResults };
          nodeOutputs = { results: incomingResults };

          // Update Response Node data
          currentNodes = currentNodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    results: incomingResults,
                    isExecuting: false,
                  },
                }
              : n
          );
          await db.workflow.update({
            where: { id: workflowId },
            data: { nodes: currentNodes },
          });
        }

        resolvedOutputs[nodeId] = nodeOutputs;
      } catch (err: any) {
        console.error(`Error executing node ${nodeId}:`, err);
        nodeStatus = "FAILED";
        nodeError = err.message || String(err);
        runStatus = "PARTIAL";

        // Make sure isExecuting is disabled
        currentNodes = currentNodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, isExecuting: false } } : n
        );
        await db.workflow.update({
          where: { id: workflowId },
          data: { nodes: currentNodes },
        });
      } finally {
        const nodeEndTime = Date.now();
        const duration = (nodeEndTime - nodeStartTime) / 1000;

        nodeDetails.push({
          nodeId,
          nodeName: node.type === "requestInputs" ? "Request Inputs" : (node.type === "response" ? "Response" : node.id),
          status: nodeStatus,
          duration,
          inputs: nodeInputs,
          outputs: nodeOutputs,
          ...(nodeError && { error: nodeError }),
        });
      }
    };

    // 5. Build Promise map and schedule executions topologically / concurrently
    nodesToExecuteIds.forEach((nodeId) => {
      executionPromises[nodeId] = executeNode(nodeId);
    });

    // Wait for all node promises to fully resolve
    await Promise.all(nodesToExecuteIds.map((nodeId) => executionPromises[nodeId]));

    // 6. Complete overall workflow run
    const totalDuration = (Date.now() - startTime) / 1000;
    
    // Disable any leftover execution flags
    currentNodes = currentNodes.map((n) => ({
      ...n,
      data: { ...n.data, isExecuting: false },
    }));

    await db.workflow.update({
      where: { id: workflowId },
      data: { nodes: currentNodes },
    });

    // Update execution history record
    await db.executionHistory.update({
      where: { id: runId },
      data: {
        status: runStatus,
        duration: totalDuration,
        details: nodeDetails,
      },
    });

    console.log(`Execution Run ${runId} completed with status: ${runStatus} in ${totalDuration}s`);
  } catch (globalErr) {
    console.error("Global orchestrator error:", globalErr);
    await db.executionHistory.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        duration: (Date.now() - startTime) / 1000,
        details: nodeDetails,
      },
    });
  }
}
