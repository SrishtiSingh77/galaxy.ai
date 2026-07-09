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
  temperature?: number;
  maxTokens?: number;
  imageVal?: string;
  videoVal?: string;
  audioVal?: string;
  fileVal?: string;
  // Sticky note fields
  text?: string;
  color?: string;
  isBold?: boolean;
  fontSize?: number;
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

  // Background auto-save to the DB (fire-and-forget) after any mutation
  updateDatabase: () => Promise<void>;
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

// Datatype carried by a node handle
type PortType =
  | "text"
  | "number"
  | "boolean"
  | "image"
  | "audio"
  | "video"
  | "file"
  | "media"
  | "any";

// Map a Request-Inputs field type to its port datatype
const fieldTypeToPort = (t?: string): PortType => {
  switch (t) {
    case "image_field":
      return "image";
    case "audio_field":
      return "audio";
    case "video_field":
      return "video";
    case "file_field":
      return "file";
    case "media_field":
      return "media";
    case "number_field":
      return "number";
    case "boolean_field":
      return "boolean";
    case "text_field":
    default:
      return "text";
  }
};

// Datatype produced by a source handle
const getSourcePortType = (node: Node<NodeData> | undefined, handle: string | null): PortType => {
  if (!node) return "any";
  if (node.type === "requestInputs") {
    const field = node.data.fields?.find((f) => f.id === handle || f.name === handle);
    return fieldTypeToPort(field?.type);
  }
  if (node.type === "cropImage") return "image"; // outputImage
  if (node.type === "gemini") return "text"; // response
  return "any";
};

// Datatype accepted by a target handle
const getTargetPortType = (node: Node<NodeData> | undefined, handle: string | null): PortType => {
  if (!node) return "any";
  if (node.type === "cropImage") {
    if (handle === "inputImage") return "image";
    if (handle === "x" || handle === "y" || handle === "width" || handle === "height") return "number";
    return "any";
  }
  if (node.type === "gemini") {
    switch (handle) {
      case "image":
        return "image";
      case "video":
        return "video";
      case "audio":
        return "audio";
      case "file":
        return "file";
      case "prompt":
      case "systemPrompt":
      default:
        return "text";
    }
  }
  if (node.type === "response") return "any"; // collects every format
  return "any";
};

// Whether a source datatype can feed a target datatype
const arePortsCompatible = (src: PortType, tgt: PortType): boolean => {
  if (src === "any" || tgt === "any") return true;
  if (src === tgt) return true;
  // A text sink accepts stringifiable scalars
  if (tgt === "text" && (src === "number" || src === "boolean")) return true;
  // "media" bridges the concrete visual/audio formats both directions
  if (tgt === "media" && (src === "image" || src === "audio" || src === "video")) return true;
  if (src === "media" && (tgt === "image" || tgt === "audio" || tgt === "video")) return true;
  // A file sink accepts any uploaded asset
  if (tgt === "file") return true;
  return false;
};

// Enforces connection type-safety across node handles
export const isConnectionTypesCompatible = (
  sourceNode: Node<NodeData> | undefined,
  sourceHandle: string | null,
  targetNode: Node<NodeData> | undefined,
  targetHandle: string | null
): boolean => {
  if (!sourceNode || !targetNode || !sourceHandle || !targetHandle) return false;
  const sourceType = getSourcePortType(sourceNode, sourceHandle);
  const targetType = getTargetPortType(targetNode, targetHandle);
  return arePortsCompatible(sourceType, targetType);
};

// Port datatype → edge color (shared by live connections and load-time normalization)
const PORT_COLORS: Record<PortType, string> = {
  text: "#f97316",
  number: "#ec4899",
  boolean: "#ec4899",
  image: "#3b82f6",
  audio: "#8b5cf6",
  video: "#8b5cf6",
  media: "#8b5cf6",
  file: "#8b5cf6",
  any: "#71717a",
};

const edgeStroke = (
  sourceNode: Node<NodeData> | undefined,
  sourceHandle: string | null | undefined,
  targetNode: Node<NodeData> | undefined,
  targetHandle: string | null | undefined
): string => {
  if (targetHandle === "result" || targetNode?.type === "response") return "#22c55e";
  return PORT_COLORS[getSourcePortType(sourceNode, sourceHandle ?? null)];
};

// Force every edge solid and colored by datatype (fixes legacy dashed/animated edges)
const normalizeEdges = (edges: Edge[], nodes: Node<NodeData>[]): Edge[] =>
  edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    return {
      ...edge,
      animated: false,
      style: {
        ...edge.style,
        stroke: edgeStroke(sourceNode, edge.sourceHandle, targetNode, edge.targetHandle),
        strokeWidth: 3,
      },
    };
  });

// Debounce handle for background DB auto-save (see updateDatabase)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

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
      edges: normalizeEdges(edges, nodes),
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

    // Edge color follows the datatype flowing through it (green into Response).
    const stroke = edgeStroke(sourceNode, connection.sourceHandle, targetNode, connection.targetHandle);

    const newEdge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
      animated: false, // solid line, not moving dashes
      style: { stroke, strokeWidth: 3 },
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

  // Debounced background auto-save. Coalesces rapid edits (slider drags,
  // typing) into a single PATCH ~800ms after the last change, so we don't
  // ship the full (image-heavy) nodes JSON to the DB on every keystroke.
  updateDatabase: async () => {
    const { activeWorkflowId } = get();
    if (!activeWorkflowId) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const { activeWorkflowId: id, nodes, edges } = get();
      if (!id) return;
      try {
        await fetch(`/api/workflows/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes, edges }),
        });
      } catch (err) {
        console.error("Failed to auto-save workflow to database:", err);
      }
    }, 800);
  },
}));
