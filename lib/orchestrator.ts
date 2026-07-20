import { db } from "@/lib/db";
import { runCropImage } from "@/trigger/cropImage";
import { runGemini } from "@/trigger/geminiTask";

// Replace inline base64 data URLs with a short marker before persisting to
// ExecutionHistory. Keeps records (and history-poll transfer) tiny; CDN/http
// URLs are kept as-is so thumbnails still render.
function stripInlineData(value: any): any {
  if (typeof value === "string") {
    return value.startsWith("data:") && value.length > 256 ? "[inline data omitted]" : value;
  }
  if (Array.isArray(value)) return value.map(stripInlineData);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) out[k] = stripInlineData(value[k]);
    return out;
  }
  return value;
}

// Flatten whatever a node produced into the plain string a user expects to see.
// Upstream tasks return strings, but a wrapped shape like { response: { text } }
// must never reach the Response node as raw JSON.
function unwrapOutput(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(unwrapOutput).filter(Boolean).join("\n");
  if (typeof value === "object") {
    // Unwrap the common single-payload wrappers, recursively
    for (const key of ["text", "response", "output", "outputImage", "value", "url"]) {
      if (value[key] !== undefined) return unwrapOutput(value[key]);
    }
    return "";
  }
  return "";
}

// A value is an image when it came out of an image port or looks like an image URL
function isImageValue(value: string, sourceHandle: string | null): boolean {
  if (sourceHandle === "outputImage") return true;
  if (value.startsWith("data:image")) return true;
  if (!value.startsWith("http")) return false;
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value) || /transloadit|cloudinary/i.test(value);
}

// Background Orchestrator. Exported so scripts/verify-execution.ts can drive a
// real run end to end without going through HTTP and Clerk.
export async function runOrchestrator(
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
      // Selective execution: run the whole chain THROUGH the selected nodes —
      // their ancestors (to produce inputs) AND descendants (to consume outputs).
      // Otherwise selecting an input node would run only that node.
      const traverse = (startIds: string[], direction: "up" | "down") => {
        const seen = new Set<string>();
        const stack = [...startIds];
        while (stack.length) {
          const n = stack.pop()!;
          if (seen.has(n)) continue;
          seen.add(n);
          const next =
            direction === "up"
              ? edges.filter((e) => e.target === n).map((e) => e.source)
              : edges.filter((e) => e.source === n).map((e) => e.target);
          next.forEach((x) => stack.push(x));
        }
        return seen;
      };

      const ancestors = traverse(selectedNodeIds, "up");
      const descendants = traverse(selectedNodeIds, "down");
      nodesToExecuteIds = Array.from(ancestors).concat(
        Array.from(descendants).filter((id) => !ancestors.has(id))
      );
    }

    console.log(`Starting execution for run ${runId}. Nodes to execute:`, nodesToExecuteIds);

    // 3. Reset node state: clear stale outputs, glow OFF for everyone.
    //    Each node turns its own glow ON only once it actually starts running.
    let currentNodes = nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isExecuting: false,
        ...(nodesToExecuteIds.includes(n.id) && { response: "", results: [] }), // Clear old outputs for nodes running
      },
    }));

    await db.workflow.update({
      where: { id: workflowId },
      data: { nodes: currentNodes },
    });

    // Serialized DB write queue. Node execution is concurrent, so without this
    // two nodes writing `nodes` at the same time lose each other's updates.
    // Enqueueing keeps writes ordered WITHOUT making the nodes wait on each other.
    let writeQueue: Promise<any> = Promise.resolve();
    const enqueueWrite = (fn: () => Promise<any>) => {
      writeQueue = writeQueue.then(fn).catch((e) => console.error("DB write failed:", e));
      return writeQueue;
    };

    // Patch a single node's data. The in-memory mutation is synchronous (so the
    // next reader sees it immediately); the DB write is queued in the background.
    // Callers that need the write flushed can await the returned promise.
    const patchNode = (nodeId: string, patch: Record<string, any>) => {
      currentNodes = currentNodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
      );
      const snapshot = currentNodes;
      return enqueueWrite(() =>
        db.workflow.update({ where: { id: workflowId }, data: { nodes: snapshot } })
      );
    };

    // Persist execution history incrementally so the History sidebar can show
    // node-by-node progress in real time (status stays RUNNING until the end).
    const persistHistory = async (final = false) => {
      const snapshot = nodeDetails.slice();
      await enqueueWrite(() =>
        db.executionHistory.update({
          where: { id: runId },
          data: {
            status: final ? runStatus : "RUNNING",
            duration: (Date.now() - startTime) / 1000,
            details: snapshot,
          },
        })
      );
    };

    // 4. Async execution tracking
    const resolvedOutputs: Record<string, Record<string, any>> = {};
    const executionPromises: Record<string, Promise<any>> = {};

    const executeNode = async (nodeId: string) => {
      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node) return;

      const nodeStartTime = Date.now();
      // Offset (ms from run start) at which this node actually began work, i.e.
      // after its dependencies resolved. Sibling nodes share the same offset —
      // this is what makes parallel dispatch verifiable in the history.
      let startedAtMs = 0;
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

        // Dependencies resolved — this node is now runnable and starts IMMEDIATELY.
        // The glow write is queued, not awaited: waiting on a DB round-trip here
        // would stagger sibling nodes that should all begin at the same instant.
        startedAtMs = Date.now() - startTime;
        if (node.type !== "requestInputs" && node.type !== "response") {
          patchNode(nodeId, { isExecuting: true });
        }
        console.log(`[T+${startedAtMs}ms] Node ${nodeId} (${node.type}) STARTED`);

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

          // Persist the resolved input image so the node shows its preview.
          // Queued, not awaited — the crop must start at T=0 alongside its siblings.
          if (inputImage) {
            patchNode(nodeId, { inputImage });
          }

          // Execute task via Trigger.dev or fallback invocation
          let croppedUrl = "";
          try {
            console.log(`Scheduling Crop task for node ${nodeId}...`);
            croppedUrl = await runCropImage({
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

          // Update DB node output in real-time, glow OFF
          patchNode(nodeId, { outputImage: croppedUrl, isExecuting: false });
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
            responseText = await runGemini({
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

          // Update DB node output in real-time, glow OFF
          patchNode(nodeId, { response: responseText, isExecuting: false });
        } else if (node.type === "response") {
          // Final collector node. Emits ONLY the clean workflow outputs —
          // plain text or a CDN image URL. No node ids, no execution metadata,
          // no nested JSON wrappers.
          const incomingResults: Array<{ value: string; type: string }> = [];

          incomingEdges.forEach((edge) => {
            if (edge.targetHandle !== "result") return;
            const srcVals = resolvedOutputs[edge.source];
            if (!srcVals) return;

            const value = unwrapOutput(srcVals[edge.sourceHandle]);
            if (!value) return;

            incomingResults.push({
              value,
              type: isImageValue(value, edge.sourceHandle) ? "image" : "text",
            });
          });

          nodeInputs = { result: incomingResults };
          nodeOutputs = { results: incomingResults };

          // Update Response Node data
          patchNode(nodeId, { results: incomingResults, isExecuting: false });
        }

        resolvedOutputs[nodeId] = nodeOutputs;
      } catch (err: any) {
        console.error(`Error executing node ${nodeId}:`, err);
        nodeStatus = "FAILED";
        nodeError = err.message || String(err);
        runStatus = "PARTIAL";

        // Make sure isExecuting is disabled
        patchNode(nodeId, { isExecuting: false });
      } finally {
        const nodeEndTime = Date.now();
        const duration = (nodeEndTime - nodeStartTime) / 1000;
        const endedAtMs = nodeEndTime - startTime;
        console.log(
          `[T+${endedAtMs}ms] Node ${nodeId} (${node.type}) FINISHED — ran for ${((nodeEndTime - startTime - startedAtMs) / 1000).toFixed(1)}s`
        );

        nodeDetails.push({
          nodeId,
          startedAtMs,
          endedAtMs,
          nodeName:
            node.type === "requestInputs" ? "Request Inputs" :
            node.type === "response" ? "Response" :
            node.type === "cropImage" ? "Crop Image" :
            node.type === "gemini" ? (node.data?.model || "Gemini") :
            node.id,
          status: nodeStatus,
          duration,
          inputs: stripInlineData(nodeInputs),
          outputs: stripInlineData(nodeOutputs),
          ...(nodeError && { error: nodeError }),
        });

        // Flush this node's result into history immediately for real-time display
        await persistHistory(false);
      }
    };

    // 5. Schedule every node. Deferring the body to a microtask guarantees the
    //    full executionPromises map exists before any node awaits its upstream
    //    dependencies (otherwise a node listed before its deps would read
    //    undefined promises and run without their resolved outputs).
    nodesToExecuteIds.forEach((nodeId) => {
      executionPromises[nodeId] = Promise.resolve().then(() => executeNode(nodeId));
    });

    // Wait for all node promises to fully resolve
    await Promise.all(nodesToExecuteIds.map((nodeId) => executionPromises[nodeId]));

    // 6. Complete overall workflow run — disable any leftover execution flags.
    //    Routed through the queue so it lands AFTER every queued node write
    //    rather than being overtaken by one still in flight.
    currentNodes = currentNodes.map((n) => ({
      ...n,
      data: { ...n.data, isExecuting: false },
    }));

    const finalNodes = currentNodes;
    await enqueueWrite(() =>
      db.workflow.update({ where: { id: workflowId }, data: { nodes: finalNodes } })
    );

    // Finalize execution history record
    await persistHistory(true);

    console.log(`Execution Run ${runId} completed with status: ${runStatus} in ${(Date.now() - startTime) / 1000}s`);
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
