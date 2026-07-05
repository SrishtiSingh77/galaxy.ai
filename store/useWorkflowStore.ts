import { create } from "zustand";
import {
  Connection,
  Edge,
  Node,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";

// Custom node data types
export interface RequestInputField {
  id: string;
  name: string;
  type: string; // "text_field" | "number_field" | "boolean_field" | "image_field" | "audio_field" | "video_field" | "media_field" | "file_field"
  value: string;
}

export interface NodeData {
  fields?: RequestInputField[];
  x?: number; // Crop parameter
  y?: number; // Crop parameter
  width?: number; // Crop parameter
  height?: number; // Crop parameter
  inputImage?: string;
  outputImage?: string;
  model?: string;
  prompt?: string;
  systemPrompt?: string;
  response?: string;
  results?: Array<{ source: string; value: string; type: string }>;
  isExecuting?: boolean;
}

interface WorkflowState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  undoStack: { nodes: Node<NodeData>[]; edges: Edge[] }[];
  redoStack: { nodes: Node<NodeData>[]; edges: Edge[] }[];
  isExecuting: boolean;
  executingNodeIds: string[];
  historySidebarOpen: boolean;
  activeWorkflowId: string | null;
  activeWorkflowName: string;

  // Actions
  initWorkflow: (id: string, name: string, nodes: Node<NodeData>[], edges: Edge[]) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  
  // Undo / Redo
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Execution States
  setNodeExecuting: (nodeId: string, isExecuting: boolean) => void;
  setNodeResult: (nodeId: string, resultData: Partial<NodeData>) => void;
  setWorkflowExecuting: (isExecuting: boolean) => void;
  setHistorySidebarOpen: (isOpen: boolean) => void;
}

// DFS cycle detection to guarantee DAG structure
export const willCreateCycle = (edges: Edge[], source: string, target: string): boolean => {
  if (source === target) return true;
  const adj: Record<string, string[]> = {};
  edges.forEach((edge) => {
    if (!adj[edge.source]) adj[edge.source] = [];
    adj[edge.source].push(edge.target);
  });

  // Temporarily add candidate edge
  if (!adj[source]) adj[source] = [];
  adj[source].push(target);

  const visited: Record<string, boolean> = {};
  const recStack: Record<string, boolean> = {};

  const dfs = (node: string): boolean => {
    if (recStack[node]) return true;
    if (visited[node]) return false;

    visited[node] = true;
    recStack[node] = true;

    const neighbors = adj[node] || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    recStack[node] = false;
    return false;
  };

  // Perform DFS starting from the target to check if we can reach back to the source
  const nodes = Array.from(new Set(edges.flatMap((e) => [e.source, e.target]).concat([source, target])));
  for (const node of nodes) {
    if (dfs(node)) return true;
  }

  return false;
};

// Enforces connection type-safety
export const isConnectionTypesCompatible = (
  sourceNode: Node<NodeData> | undefined,
  sourceHandle: string | null,
  targetNode: Node<NodeData> | undefined,
  targetHandle: string | null
): boolean => {
  if (!sourceNode || !targetNode || !sourceHandle || !targetHandle) return false;

  // Find source type
  let sourceType: "text" | "image" | "any" = "any";
  if (sourceNode.type === "requestInputs") {
    const field = sourceNode.data.fields?.find((f) => f.id === sourceHandle || f.name === sourceHandle);
    sourceType = field?.type === "image_field" ? "image" : "text";
  } else if (sourceNode.type === "cropImage") {
    sourceType = "image";
  } else if (sourceNode.type === "gemini") {
    sourceType = "text";
  }

  // Find target type
  let targetType: "text" | "image" | "any" = "any";
  if (targetNode.type === "cropImage") {
    targetType = "image";
  } else if (targetNode.type === "gemini") {
    if (targetHandle === "image" || targetHandle === "video" || targetHandle === "audio" || targetHandle === "file") {
      targetType = "image"; // handles media
    } else {
      targetType = "text"; // prompt or systemPrompt
    }
  } else if (targetNode.type === "response") {
    targetType = "any"; // Response node collects all formats
  }

  if (sourceType === "any" || targetType === "any") return true;
  return sourceType === targetType;
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  undoStack: [],
  redoStack: [],
  isExecuting: false,
  executingNodeIds: [],
  historySidebarOpen: false,
  activeWorkflowId: null,
  activeWorkflowName: "",

  initWorkflow: (id, name, nodes, edges) => {
    set({
      activeWorkflowId: id,
      activeWorkflowName: name,
      nodes,
      edges,
      undoStack: [],
      redoStack: [],
      executingNodeIds: [],
      isExecuting: false,
    });
  },

  setNodes: (nodes) => {
    set({ nodes });
  },

  setEdges: (edges) => {
    set({ edges });
  },

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    const { nodes, edges, takeSnapshot } = get();
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);

    // 1. DAG Validation
    if (willCreateCycle(edges, connection.source || "", connection.target || "")) {
      console.warn("Rejected: Connection would introduce a feedback loop/cycle.");
      return;
    }

    // 2. Type-Safe Connections
    if (
      !isConnectionTypesCompatible(
        sourceNode,
        connection.sourceHandle,
        targetNode,
        connection.targetHandle
      )
    ) {
      console.warn("Rejected: Incompatible handle types connected (Text vs. Image mismatch).");
      return;
    }

    takeSnapshot();
    
    // Setup beautiful edge styles depending on datatype
    let edgeStyle = { stroke: "#f97316" }; // default to orange text/prompt
    const field = sourceNode?.data.fields?.find((f) => f.id === connection.sourceHandle || f.name === connection.sourceHandle);

    const isStandardOutput = 
      connection.sourceHandle === "response" || 
      connection.sourceHandle === "outputImage";

    const isImageOrNumeric = 
      field?.type === "image_field" || 
      field?.type === "numeric_field";

    const isPurpleOrBlue =
      field?.type === "video_field" ||
      field?.type === "audio_field" ||
      field?.type === "media_field" ||
      field?.type === "file_field" ||
      field?.type === "boolean_field";

    if (isStandardOutput) {
      edgeStyle = { stroke: "#27272a" }; // Solid gray/black for standard outputs
    } else if (isImageOrNumeric) {
      edgeStyle = { stroke: "#ec4899" }; // Pink/magenta for image and numeric fields
    } else if (isPurpleOrBlue) {
      edgeStyle = { stroke: "#8b5cf6" }; // Purple/blue for media/booleans
    } else {
      edgeStyle = { stroke: "#f97316" }; // Orange for text/prompts
    }

    const newEdge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
      animated: true,
      style: edgeStyle,
    } as Edge;

    set({
      edges: addEdge(newEdge, edges),
    });

    // Auto save to DB in background
    get().updateDatabase();
  },

  addNode: (node) => {
    get().takeSnapshot();
    set({
      nodes: [...get().nodes, node],
    });
    get().updateDatabase();
  },

  deleteNode: (nodeId) => {
    if (nodeId === "request-inputs" || nodeId === "response") return; // cannot delete
    get().takeSnapshot();
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
    get().updateDatabase();
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...data,
            },
          };
        }
        return node;
      }),
    });
    get().updateDatabase();
  },

  takeSnapshot: () => {
    const { nodes, edges, undoStack } = get();
    // Deep copy current state for snapshot
    const nodesCopy = JSON.parse(JSON.stringify(nodes));
    const edgesCopy = JSON.parse(JSON.stringify(edges));
    set({
      undoStack: [...undoStack, { nodes: nodesCopy, edges: edgesCopy }],
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, redoStack, nodes, edges } = get();
    if (undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    const nodesCopy = JSON.parse(JSON.stringify(nodes));
    const edgesCopy = JSON.parse(JSON.stringify(edges));

    set({
      nodes: previous.nodes,
      edges: previous.edges,
      undoStack: newUndoStack,
      redoStack: [...redoStack, { nodes: nodesCopy, edges: edgesCopy }],
    });
    get().updateDatabase();
  },

  redo: () => {
    const { undoStack, redoStack, nodes, edges } = get();
    if (redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    const nodesCopy = JSON.parse(JSON.stringify(nodes));
    const edgesCopy = JSON.parse(JSON.stringify(edges));

    set({
      nodes: next.nodes,
      edges: next.edges,
      undoStack: [...undoStack, { nodes: nodesCopy, edges: edgesCopy }],
      redoStack: newRedoStack,
    });
    get().updateDatabase();
  },

  setNodeExecuting: (nodeId, isExecuting) => {
    const { executingNodeIds } = get();
    set({
      executingNodeIds: isExecuting
        ? [...executingNodeIds, nodeId]
        : executingNodeIds.filter((id) => id !== nodeId),
    });
  },

  setNodeResult: (nodeId, resultData) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...resultData,
            },
          };
        }
        return node;
      }),
    });
  },

  setWorkflowExecuting: (isExecuting) => {
    set({ isExecuting });
  },

  setHistorySidebarOpen: (isOpen) => {
    set({ historySidebarOpen: isOpen });
  },

  // Helper function to sync with db in background
  updateDatabase: async () => {
    const { activeWorkflowId, nodes, edges } = get();
    if (!activeWorkflowId) return;
    try {
      await fetch(`/api/workflows/${activeWorkflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      });
    } catch (err) {
      console.error("Failed to auto-save workflow to database:", err);
    }
  },
}));
