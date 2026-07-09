"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Folder,
  Settings,
  Trash2,
  Edit2,
  Upload,
  BookOpen,
  Clock,
  ExternalLink,
  MessageSquare,
  Library,
  GitBranch,
  Boxes,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: any;
  edges: any;
  executions?: Array<{ status: string; timestamp: string }>;
}

// Small status badge for a workflow's most recent run
const StatusBadge = ({ status }: { status?: string }) => {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    SUCCESS: { label: "Success", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    FAILED: { label: "Failed", cls: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
    PARTIAL: { label: "Partial", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    RUNNING: { label: "Running", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500 animate-pulse" },
  };
  const meta = status ? map[status] : undefined;
  if (!meta) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
        Never run
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cacheKey = user ? `flow_workflows_${user.id}` : null;

  // Fetch workflows and refresh the cache
  const fetchWorkflows = async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
        if (cacheKey) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch {}
        }
      }
    } catch (err) {
      console.error("Error fetching workflows:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && user) {
      // Paint the last-known list instantly, then revalidate in the background
      if (cacheKey) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            setWorkflows(JSON.parse(cached));
            setLoading(false);
          }
        } catch {}
      }
      fetchWorkflows();
    }
  }, [isLoaded, user]);

  // Create new workflow
  const createNewWorkflow = async (name = "Untitled Workflow", customData?: { nodes: any; edges: any }) => {
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const newWorkflow = await res.json();
        if (customData) {
          // If we want to seed template data
          await fetch(`/api/workflows/${newWorkflow.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nodes: customData.nodes,
              edges: customData.edges,
            }),
          });
        }
        router.push(`/workflows/${newWorkflow.id}`);
      }
    } catch (err) {
      console.error("Error creating workflow:", err);
    }
  };

  // Create standard reference workflow (AI Racing Car Generator template clicked)
  const createReferenceWorkflow = () => {
    const name = "AI Racing Car Generator (Sample)";
    const nodes = [
      {
        id: "request-inputs",
        type: "requestInputs",
        position: { x: 100, y: 350 },
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
        id: "crop-image-1",
        type: "cropImage",
        position: { x: 450, y: 150 },
        data: {
          x: 20,
          y: 20,
          width: 60,
          height: 60,
          inputImage: "",
        },
      },
      {
        id: "crop-image-2",
        type: "cropImage",
        position: { x: 450, y: 550 },
        data: {
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          inputImage: "",
        },
      },
      {
        id: "gemini-1",
        type: "gemini",
        position: { x: 450, y: -200 },
        data: {
          model: "gemini-2.5-pro",
          prompt: "",
          systemPrompt: "You are a marketing copywriter. Write a one-paragraph product description.",
        },
      },
      {
        id: "gemini-2",
        type: "gemini",
        position: { x: 800, y: -200 },
        data: {
          model: "gemini-2.5-pro",
          prompt: "",
          systemPrompt: "Condense the following product description into a tweet-length hook (under 240 characters).",
        },
      },
      {
        id: "gemini-3",
        type: "gemini",
        position: { x: 1150, y: 150 },
        data: {
          model: "gemini-2.5-pro",
          prompt: "",
          systemPrompt: "You are a social media manager. Combine the tweet hook and the two product crops into a final marketing post.",
        },
      },
      {
        id: "response",
        type: "response",
        position: { x: 1500, y: 350 },
        data: {
          results: [],
        },
        deletable: false,
      },
    ];

    const edges = [
      // Request-Inputs.text_field -> Gemini 1
      {
        id: "edge-1",
        source: "request-inputs",
        sourceHandle: "field-1",
        target: "gemini-1",
        targetHandle: "prompt",
        animated: true,
        style: { stroke: "#fb923c" }, // Orange connection for text
      },
      // Request-Inputs.image_field -> Crop Image 1
      {
        id: "edge-2",
        source: "request-inputs",
        sourceHandle: "field-2",
        target: "crop-image-1",
        targetHandle: "inputImage",
        animated: true,
        style: { stroke: "#3b82f6" }, // Blue connection for image
      },
      // Request-Inputs.image_field -> Crop Image 2
      {
        id: "edge-3",
        source: "request-inputs",
        sourceHandle: "field-2",
        target: "crop-image-2",
        targetHandle: "inputImage",
        animated: true,
        style: { stroke: "#3b82f6" },
      },
      // Gemini 1.response -> Gemini 2
      {
        id: "edge-4",
        source: "gemini-1",
        sourceHandle: "response",
        target: "gemini-2",
        targetHandle: "prompt",
        animated: true,
        style: { stroke: "#fb923c" },
      },
      // Gemini 2.response -> Gemini 3 (Final)
      {
        id: "edge-5",
        source: "gemini-2",
        sourceHandle: "response",
        target: "gemini-3",
        targetHandle: "prompt",
        animated: true,
        style: { stroke: "#fb923c" },
      },
      // Crop Image 1.output -> Gemini 3 (Final)
      {
        id: "edge-6",
        source: "crop-image-1",
        sourceHandle: "outputImage",
        target: "gemini-3",
        targetHandle: "image",
        animated: true,
        style: { stroke: "#3b82f6" },
      },
      // Crop Image 2.output -> Gemini 3 (Final)
      {
        id: "edge-7",
        source: "crop-image-2",
        sourceHandle: "outputImage",
        target: "gemini-3",
        targetHandle: "image",
        animated: true,
        style: { stroke: "#3b82f6" },
      },
      // Gemini 3 (Final).response -> Response.result
      {
        id: "edge-8",
        source: "gemini-3",
        sourceHandle: "response",
        target: "response",
        targetHandle: "result",
        animated: true,
        style: { stroke: "#fb923c" },
      },
      // Crop Image 2.output -> Response.result (second output connection)
      {
        id: "edge-9",
        source: "crop-image-2",
        sourceHandle: "outputImage",
        target: "response",
        targetHandle: "result",
        animated: true,
        style: { stroke: "#3b82f6" },
      },
    ];

    createNewWorkflow(name, { nodes, edges });
  };

  // Delete workflow (confirmed via modal)
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workflows/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      }
    } catch (err) {
      console.error("Error deleting workflow:", err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Rename workflow
  const startRename = (w: Workflow) => {
    setRenameId(w.id);
    setRenameName(w.name);
  };

  const saveRename = async () => {
    if (!renameId || !renameName.trim()) return;
    try {
      const res = await fetch(`/api/workflows/${renameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName }),
      });
      if (res.ok) {
        setWorkflows(
          workflows.map((w) => (w.id === renameId ? { ...w, name: renameName } : w))
        );
        setRenameId(null);
      }
    } catch (err) {
      console.error("Error renaming workflow:", err);
    }
  };

  // Export JSON — the list is lightweight, so pull the full graph on demand
  const exportWorkflow = async (w: Workflow) => {
    let full: any = w;
    try {
      const res = await fetch(`/api/workflows/${w.id}`);
      if (res.ok) full = await res.json();
    } catch (err) {
      console.error("Error fetching workflow for export:", err);
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(full));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${w.name.replace(/\s+/g, "_")}_workflow.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const workflowJson = JSON.parse(event.target?.result as string);
        if (!workflowJson.nodes || !workflowJson.name) {
          alert("Invalid workflow JSON file.");
          return;
        }

        // Create new workflow with name from JSON
        const name = `${workflowJson.name} (Imported)`;
        const res = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });

        if (res.ok) {
          const newWorkflow = await res.json();
          // Update nodes/edges
          await fetch(`/api/workflows/${newWorkflow.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nodes: workflowJson.nodes,
              edges: workflowJson.edges || [],
            }),
          });
          fetchWorkflows();
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const navItems = [
    { label: "New task", icon: Plus, onClick: () => createNewWorkflow() },
    { label: "Search tasks", icon: Search },
    { label: "Tasks", icon: MessageSquare },
    { label: "Projects", icon: Folder },
    { label: "Library", icon: Library },
    { label: "Flow", icon: GitBranch, active: true },
    { label: "Tools", icon: Boxes },
    { label: "API and MCP", icon: BookOpen },
  ];

  return (
    <div className="flex h-screen w-screen flex-col bg-[#f7f7f7]">
      {/* PROMO BANNER */}
      {/* <div className="flex items-center justify-center gap-3 bg-[#e11d1d] px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">
        <span>Pay once, get a LIFETIME deal forever — for only $199</span>
        <span className="hidden sm:inline">· 32K+ users</span>
        <button className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#e11d1d] hover:bg-zinc-100 transition">
          Click here
        </button>
      </div> */}

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div
          className={`flex flex-col justify-between border-r border-[#e4e4e7] bg-white shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${
            sidebarOpen ? "w-[240px]" : "w-[72px]"
          }`}
        >
          <div className="flex flex-col">
            {/* Brand */}
            <div className={`flex items-center py-4 ${sidebarOpen ? "justify-between px-5" : "justify-center px-2"}`}>
              {sidebarOpen && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src="/galaxy.png" alt="Galaxy" className="h-6 w-auto object-contain" />
              )}
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition"
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
            </div>

            {/* Nav */}
            <nav className="flex flex-col gap-0.5 px-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    title={item.label}
                    className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition ${
                      sidebarOpen ? "px-3" : "px-0 justify-center"
                    } ${
                      item.active
                        ? "bg-zinc-100 text-zinc-950"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
                  </button>
                );
              })}
            </nav>

            {sidebarOpen && <p className="px-5 pt-10 text-center text-xs text-zinc-400">No tasks yet</p>}
          </div>

          {/* Footer */}
          <div className={`flex items-center border-t border-[#f4f4f5] py-4 ${sidebarOpen ? "justify-between px-5" : "flex-col gap-3 px-2"}`}>
            <button
              title="Settings"
              className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition"
            >
              <Settings className="h-4 w-4 shrink-0" />
              {sidebarOpen && "Settings"}
            </button>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 overflow-y-auto px-10 py-8">
          {/* HEADER SECTION */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Flow</h1>
              <p className="text-sm text-zinc-500 mt-1">Build workflows or run models directly.</p>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleImportJson}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-[#e4e4e7] bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition shadow-sm"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>

              <button
                onClick={() => createNewWorkflow()}
                title="Create workflow"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* SYSTEM WORKFLOWS SECTION */}
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-zinc-900">System Workflows</h2>
            <p className="text-sm text-zinc-500 mt-0.5 mb-5">Prebuilt workflow templates - click to open and start using.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div
                onClick={createReferenceWorkflow}
                className="group w-full max-w-[320px] cursor-pointer rounded-xl bg-zinc-50/60 p-2 transition-all hover:bg-zinc-100"
              >
                <div className="relative h-44 w-full overflow-hidden rounded-lg bg-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/car.jpg"
                    alt="AI Racing Car Generator"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <h3 className="py-3 text-center text-sm font-semibold text-zinc-800">AI Racing Car Generator</h3>
              </div>
            </div>
          </div>

          {/* USER WORKFLOWS SECTION */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Your Workflows</h2>
                <p className="text-sm text-zinc-500 mt-0.5">Open one to edit, run, and review history.</p>
              </div>

              {/* Search workflows */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-[#e4e4e7] bg-white pl-10 pr-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-white">
                <div className="flex items-center gap-2 text-zinc-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  Loading workflows...
                </div>
              </div>
            ) : filteredWorkflows.length === 0 ? (
              /* EMPTY STATE */
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/40 px-8 py-10">
                <h3 className="text-base font-semibold text-zinc-900">No workflows yet</h3>
                <p className="mt-1 text-sm text-zinc-500">Create your first workflow to start building.</p>
                <button
                  onClick={() => createNewWorkflow()}
                  className="mt-5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition shadow-sm"
                >
                  Create workflow
                </button>
              </div>
            ) : (
            /* WORKFLOW LIST */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWorkflows.map((w) => {
                const lastEdited = new Date(w.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={w.id}
                    className="group relative flex flex-col justify-between rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        {renameId === w.id ? (
                          <div className="flex items-center gap-2 w-full pr-4">
                            <input
                              type="text"
                              value={renameName}
                              onChange={(e) => setRenameName(e.target.value)}
                              className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:border-zinc-500 w-full"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRename();
                                if (e.key === "Escape") setRenameId(null);
                              }}
                            />
                            <button
                              onClick={saveRename}
                              className="text-xs bg-indigo-500 text-white rounded px-2 py-1 hover:bg-indigo-600"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <h3
                            onClick={() => router.push(`/workflows/${w.id}`)}
                            className="font-semibold text-zinc-900 text-sm hover:underline cursor-pointer break-all pr-4"
                          >
                            {w.name}
                          </h3>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-4">
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <Clock className="h-3 w-3" />
                          <span>Edited {lastEdited}</span>
                        </div>
                        <StatusBadge status={w.executions?.[0]?.status} />
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4">
                      <button
                        onClick={() => router.push(`/workflows/${w.id}`)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                      >
                        Open Editor
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => exportWorkflow(w)}
                          title="Export JSON"
                          className="p-1.5 rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
                        >
                          <Upload className="h-3.5 w-3.5 rotate-180" />
                        </button>

                        <button
                          onClick={() => startRename(w)}
                          title="Rename"
                          className="p-1.5 rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteTarget(w)}
                          title="Delete"
                          className="p-1.5 rounded text-zinc-400 hover:bg-zinc-100 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Delete workflow?</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  <span className="font-semibold text-zinc-700">{deleteTarget.name}</span> will be permanently
                  removed, along with its run history. This can&apos;t be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-60"
              >
                {deleting && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
