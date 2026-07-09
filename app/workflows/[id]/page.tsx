"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactFlow, {
  Background,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  Edge,
  Node,
  Connection,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
} from "reactflow";
import "reactflow/dist/style.css";

import { useWorkflowStore, willCreateCycle, isConnectionTypesCompatible } from "@/store/useWorkflowStore";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Clock,
  Download,
  Upload,
  Undo2,
  Redo2,
  Sparkles,
  HelpCircle,
  Folder,
  Layers,
  Bot,
  Settings,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  MousePointer,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid,
  Hand,
  Map,
  X,
  Square,
  Command,
} from "lucide-react";

// Import custom components
import RequestInputsNode from "@/components/nodes/RequestInputsNode";
import ResponseNode from "@/components/nodes/ResponseNode";
import CropImageNode from "@/components/nodes/CropImageNode";
import GeminiNode from "@/components/nodes/GeminiNode";
import StickyNoteNode from "@/components/nodes/StickyNoteNode";
import CustomEdge from "@/components/edges/CustomEdge";
import WorkflowToolbar from "@/components/WorkflowToolbar";
import HistorySidebar from "@/components/HistorySidebar";

// Define node types
const nodeTypes = {
  requestInputs: RequestInputsNode,
  response: ResponseNode,
  cropImage: CropImageNode,
  gemini: GeminiNode,
  stickyNote: StickyNoteNode,
};

// Define edge types
const edgeTypes = {
  default: CustomEdge,
};

function FlowEditor({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const reactFlowInstance = useReactFlow();

  // Zustand Store Actions & State
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const initWorkflow = useWorkflowStore((state) => state.initWorkflow);
  const activeWorkflowName = useWorkflowStore((state) => state.activeWorkflowName);
  
  const isExecuting = useWorkflowStore((state) => state.isExecuting);
  const setWorkflowExecuting = useWorkflowStore((state) => state.setWorkflowExecuting);
  const setNodeExecuting = useWorkflowStore((state) => state.setNodeExecuting);
  const setNodeResult = useWorkflowStore((state) => state.setNodeResult);
  
  const historyOpen = useWorkflowStore((state) => state.historySidebarOpen);
  const setHistoryOpen = useWorkflowStore((state) => state.setHistorySidebarOpen);
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const undoStack = useWorkflowStore((state) => state.undoStack);
  const redoStack = useWorkflowStore((state) => state.redoStack);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);

  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState("5085.54");
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  // false = free-pan (left-drag moves canvas); true = box-select on left-drag.
  // Nodes stay draggable and selectable in both modes.
  const [isSelectMode, setIsSelectMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { zoom } = useViewport();

  // Validate connections visually during drag
  const isValidConnection = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    
    if (willCreateCycle(edges, connection.source || "", connection.target || "")) {
      return false;
    }
    
    return isConnectionTypesCompatible(
      sourceNode,
      connection.sourceHandle,
      targetNode,
      connection.targetHandle
    );
  }, [nodes, edges]);

  // Layered auto-arrange algorithm with animated viewport fitting
  const autoArrange = useCallback(() => {
    const newNodes = [...nodes];
    if (newNodes.length === 0) return;

    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    newNodes.forEach((n) => {
      adj[n.id] = [];
      inDegree[n.id] = 0;
    });
    edges.forEach((e) => {
      if (adj[e.source]) adj[e.source].push(e.target);
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    });

    const queue: string[] = [];
    const levels: Record<string, number> = {};
    newNodes.forEach((n) => {
      if (inDegree[n.id] === 0) {
        queue.push(n.id);
        levels[n.id] = 0;
      }
    });

    if (queue.length === 0 && newNodes.length > 0) {
      queue.push(newNodes[0].id);
      levels[newNodes[0].id] = 0;
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currLevel = levels[curr] || 0;
      (adj[curr] || []).forEach((nxt) => {
        levels[nxt] = Math.max(levels[nxt] || 0, currLevel + 1);
        queue.push(nxt);
      });
    }

    const levelGroups: Record<number, string[]> = {};
    newNodes.forEach((n) => {
      const lvl = levels[n.id] || 0;
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(n.id);
    });

    const colWidth = 340;
    const rowHeight = 360;
    const arrangedNodes = newNodes.map((n) => {
      const lvl = levels[n.id] || 0;
      const group = levelGroups[lvl] || [n.id];
      const index = group.indexOf(n.id);
      const x = 100 + lvl * colWidth;
      const y = 100 + index * rowHeight;
      return {
        ...n,
        position: { x, y },
      };
    });

    setNodes(arrangedNodes);
    
    // Auto center the whole workflow zoomed in/out
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.15, duration: 650 });
    }, 50);
  }, [nodes, edges, setNodes, reactFlowInstance]);

  // Fetch workflow state on mount
  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (res.ok) {
          const data = await res.json();
          initWorkflow(data.id, data.name, data.nodes || [], data.edges || []);
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Failed to load workflow:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkflow();
  }, [workflowId, initWorkflow, router]);

  // Polling helper during execution
  const pollExecutionStatus = useCallback((runId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/run-status?runId=${runId}`);
        if (res.ok) {
          const data = await res.json();
          
          // Update nodes in Zustand store in real-time
          if (data.nodes) {
            setNodes(data.nodes);
          }

          // Check if execution completed
          if (data.status !== "RUNNING") {
            clearInterval(interval);
            setWorkflowExecuting(false);
            
            // Map finished indicators
            const execDetails = data.nodes || [];
            execDetails.forEach((node: any) => {
              setNodeExecuting(node.id, false);
            });

            // Adjust simulated balance
            setBalance((prev) => (parseFloat(prev) - 0.05).toFixed(2));
          } else {
            // Apply pulsating glow animation to active running nodes
            const activeNodes = data.nodes || [];
            activeNodes.forEach((node: any) => {
              setNodeExecuting(node.id, !!node.data?.isExecuting);
            });
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
        clearInterval(interval);
        setWorkflowExecuting(false);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [workflowId, setNodes, setWorkflowExecuting, setNodeExecuting]);

  // Trigger Execution
  const triggerRun = async () => {
    if (isExecuting) return;

    // Get selected nodes for Selective Execution
    const selectedNodes = reactFlowInstance.getNodes().filter((n) => n.selected);
    const selectedNodeIds = selectedNodes.map((n) => n.id);

    setWorkflowExecuting(true);

    try {
      // Flush any pending debounced auto-save so the orchestrator reads the
      // latest state (e.g. a just-uploaded image URL), not stale DB data.
      await useWorkflowStore.getState().saveNow();

      const res = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedNodeIds }),
      });

      if (res.ok) {
        const data = await res.json();
        pollExecutionStatus(data.runId);
      } else {
        setWorkflowExecuting(false);
      }
    } catch (err) {
      console.error("Execution failed:", err);
      setWorkflowExecuting(false);
    }
  };

  // Keyboard Shortcuts (Undo, Redo, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName);
      if (isInput) return;

      // Delete Node shortcuts
      if (e.key === "Delete" || e.key === "Backspace") {
        const selectedNodes = reactFlowInstance.getNodes().filter((n) => n.selected);
        selectedNodes.forEach((node) => {
          deleteNode(node.id);
        });
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }

      // Auto-arrange Shift+A
      if (e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        autoArrange();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reactFlowInstance, deleteNode, undo, redo, autoArrange]);

  // Export JSON
  const handleExportJson = () => {
    const workflowData = {
      name: activeWorkflowName,
      nodes,
      edges,
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(workflowData));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${activeWorkflowName.replace(/\s+/g, "_")}_config.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workflowJson = JSON.parse(event.target?.result as string);
        if (workflowJson.nodes) {
          setNodes(workflowJson.nodes);
          setEdges(workflowJson.edges || []);
          
          // Auto sync database
          setTimeout(() => {
            const storeState = useWorkflowStore.getState();
            storeState.updateDatabase();
          }, 100);
        }
      } catch (err) {
        alert("Failed to parse JSON configuration file.");
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#fafafa] text-sm text-zinc-500">
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        Loading workspace canvas...
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen bg-[#fafafa] overflow-hidden select-none">
      {/* Mini Sidebar to match Dashboard aesthetics */}
      <div className="flex w-[68px] flex-col items-center justify-between border-r border-[#e4e4e7] bg-white py-6 z-10 shrink-0">
        <div className="flex flex-col items-center gap-6 w-full">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white shadow-md transition hover:scale-105"
            title="Go to Dashboard"
          >
            <svg viewBox="0 0 100 100" className="w-5 h-5 fill-none stroke-current" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 75 V28 Q20 22 25 24 L45 52" />
              <path d="M80 75 V28 Q80 22 75 24 L55 52" />
              <path d="M50 55 Q50 65 60 65 Q50 65 50 75 Q50 65 40 65 Q50 65 50 55 Z" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <div className="w-8 border-b border-[#f4f4f5]" />
          <button
            onClick={() => router.push("/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition-all"
            title="All Workflows"
          >
            <Folder className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-6">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Editor Canvas Area */}
      <div className="flex-1 relative h-full flex flex-col">
        {/* Top Control Bar */}
        <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
          {/* Left Arrow & Workflow Name */}
          <div className="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl px-4 py-2 shadow-lg pointer-events-auto">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-zinc-800 tracking-tight">{activeWorkflowName}</span>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2.5 bg-white border border-zinc-200 rounded-xl p-1.5 shadow-lg pointer-events-auto">
            {/* JSON Actions */}
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import JSON"
              className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition"
            >
              <Upload className="h-4 w-4" />
            </button>
            <button
              onClick={handleExportJson}
              title="Export JSON"
              className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition"
            >
              <Download className="h-4 w-4" />
            </button>

            <div className="h-5 border-r border-zinc-200 mx-0.5" />

            {/* Simulated cost blocks */}
            <div className="flex items-center gap-1.5 rounded-lg bg-zinc-50 border border-zinc-150 px-2.5 py-1 text-[11px] font-bold text-zinc-600">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Est 0.01 M</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg bg-zinc-50 border border-zinc-150 px-2.5 py-1 text-[11px] font-bold text-zinc-600">
              <span>Bal {balance} M</span>
            </div>

            {/* Run Button */}
            <button
              onClick={triggerRun}
              disabled={isExecuting}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold text-white shadow-md transition-all ${
                isExecuting
                  ? "bg-zinc-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 active:scale-95"
              }`}
            >
              {isExecuting ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-white" />
                  Run
                </>
              )}
            </button>

            {/* History Toggle */}
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className={`rounded-lg p-2 transition ${
                historyOpen ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
              title="Toggle History Sidebar"
            >
              <Clock className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* React Flow Editor */}
        <div className="flex-1 w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          maxZoom={1.5}
          minZoom={0.2}
          isValidConnection={isValidConnection}
          nodesDraggable
          elementsSelectable
          selectionOnDrag={isSelectMode}
          selectionKeyCode="Shift"
          panOnDrag={isSelectMode ? [1, 2] : true}
          className={isSelectMode ? "" : "cursor-grab active:cursor-grabbing"}
        >
          <Background color="#a1a1aa" gap={16} size={1.2} />
          
          {/* Custom Bottom-Left Controls Panel */}
          {!controlsExpanded ? (
            <Panel position="bottom-left" className="pointer-events-auto">
              <button
                onClick={() => setControlsExpanded(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 shadow-sm transition"
                title="Expand Controls"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </Panel>
          ) : (
            <Panel position="bottom-left" className="pointer-events-auto">
              <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl">
                {/* Collapse */}
                <button
                  onClick={() => setControlsExpanded(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-zinc-50 text-zinc-500 transition"
                  title="Collapse Controls"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <div className="h-4 w-[1px] bg-zinc-200 mx-0.5" />

                {/* Undo */}
                <button
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                  title="Undo"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>

                {/* Redo */}
                <button
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                  title="Redo"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>

                {/* Command Shortcuts */}
                <button
                  onClick={() => alert("Keyboard shortcuts:\n• Zoom: Mouse wheel / Pinch\n• Pan: Drag background\n• Arrange: Shift+A\n• Delete Connection: Hover and click ✕\n• Delete Node: Select and press Delete")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition"
                  title="Keyboard Shortcuts"
                >
                  <Command className="h-3.5 w-3.5" />
                </button>

                <div className="h-4 w-[1px] bg-zinc-200 mx-0.5" />

                {/* Zoom Out */}
                <button
                  onClick={() => reactFlowInstance.zoomOut()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-zinc-50 text-zinc-500 hover:text-zinc-800 transition"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                
                <span className="text-[11px] font-bold text-zinc-500 min-w-[32px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                
                {/* Zoom In */}
                <button
                  onClick={() => reactFlowInstance.zoomIn()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-zinc-50 text-zinc-500 hover:text-zinc-800 transition"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>

                <div className="h-4 w-[1px] bg-zinc-200 mx-0.5" />

                {/* Fit View */}
                <button
                  onClick={() => reactFlowInstance.fitView({ padding: 0.15, duration: 600 })}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-zinc-50 text-zinc-500 hover:text-zinc-800 transition"
                  title="Fit View"
                >
                  <Maximize className="h-3.5 w-3.5" />
                </button>

                {/* Auto Arrange */}
                <button
                  onClick={autoArrange}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-zinc-50 text-zinc-500 hover:text-zinc-800 transition relative group"
                  title="Auto-arrange"
                >
                  <Grid className="h-3.5 w-3.5" />
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] py-1 px-2.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition shadow-lg flex items-center gap-1.5 font-semibold">
                    <span>Auto-arrange</span>
                    <span className="bg-zinc-700 px-1 py-0.5 rounded text-[8px]">Shift+A</span>
                  </div>
                </button>

                {/* Pan/Select Mode toggle */}
                <button
                  onClick={() => setIsSelectMode(!isSelectMode)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                    isSelectMode
                      ? "bg-zinc-800 text-white shadow-sm hover:bg-zinc-900"
                      : "hover:bg-zinc-50 text-zinc-500 hover:text-zinc-800"
                  }`}
                  title={isSelectMode ? "Select Mode (Move nodes freely)" : "Switch to Select Mode"}
                >
                  {isSelectMode ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Hand className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </Panel>
          )}

            {/* Custom Bottom-Right MiniMap Trigger and Widget */}
            <Panel position="bottom-right" className="pointer-events-auto flex flex-col items-end gap-2">
              {minimapOpen && (
                <div className="relative rounded-xl border border-zinc-800 bg-[#18181b] p-1.5 shadow-2xl animate-in fade-in duration-200">
                  <button
                    onClick={() => setMinimapOpen(false)}
                    className="absolute -top-2 -left-2 z-[9999] rounded-full border border-zinc-700 bg-zinc-900 p-1 text-zinc-400 hover:text-white shadow-md transition"
                    title="Minimize"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <MiniMap
                    nodeColor={(node) => {
                      if (node.type === "cropImage") return "#3b82f6";
                      if (node.type === "gemini") return "#10b981";
                      return "#71717a";
                    }}
                    maskColor="rgba(24, 24, 27, 0.4)"
                    style={{
                      position: "static",
                      width: 140,
                      height: 100,
                      margin: 0,
                      borderRadius: "8px",
                      backgroundColor: "#18181b",
                    }}
                  />
                </div>
              )}
              
              <button
                onClick={() => setMinimapOpen(!minimapOpen)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 shadow-sm transition ${
                  minimapOpen ? "bg-zinc-950 text-white border-zinc-950" : "bg-white hover:bg-zinc-50 text-zinc-500"
                }`}
                title="Toggle MiniMap"
              >
                <Map className="h-4 w-4" />
              </button>
            </Panel>

            <WorkflowToolbar />
          </ReactFlow>
        </div>

        {/* History Right Sidebar */}
        <HistorySidebar />
      </div>
    </div>
  );
}

export default function Page({ params }: { params: { id: string } }) {
  return (
    <ReactFlowProvider>
      <FlowEditor workflowId={params.id} />
    </ReactFlowProvider>
  );
}
