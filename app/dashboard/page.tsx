"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Search,
  Folder,
  Settings,
  Trash2,
  Edit2,
  Upload,
  Sparkles,
  BookOpen,
  HelpCircle,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  MessageSquare,
  Compass,
  Library,
} from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: any;
  edges: any;
  executions?: Array<{ status: string }>;
}

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch workflows
  const fetchWorkflows = async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
      }
    } catch (err) {
      console.error("Error fetching workflows:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && user) {
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

  // Delete workflow
  const deleteWorkflow = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWorkflows(workflows.filter((w) => w.id !== id));
      }
    } catch (err) {
      console.error("Error deleting workflow:", err);
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

  // Export JSON
  const exportWorkflow = (w: Workflow) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(w));
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

  return (
    <div className="flex h-screen w-screen bg-[#fafafa]">
      {/* LEFT SIDEBAR */}
      <div className="flex w-[68px] flex-col items-center justify-between border-r border-[#e4e4e7] bg-white py-6">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Logo */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white font-extrabold text-lg shadow-md transition hover:scale-105">
            M
          </div>

          <div className="w-8 border-b border-[#f4f4f5]" />

          {/* Navigation Links */}
          <button
            onClick={() => createNewWorkflow()}
            className="group relative flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition-all"
            title="Create Workflow"
          >
            <Plus className="h-5 w-5" />
          </button>

          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
            <Search className="h-5 w-5" />
          </button>

          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
            <MessageSquare className="h-5 w-5" />
          </button>

          <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950 transition-all" title="Your Workflows">
            <Folder className="h-5 w-5" />
          </button>

          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
            <Compass className="h-5 w-5" />
          </button>

          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
            <Library className="h-5 w-5" />
          </button>

          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
            <BookOpen className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-6">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
            <Settings className="h-5 w-5" />
          </button>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto px-10 py-8">
        {/* HEADER SECTION */}
        <div className="flex items-center justify-between border-b border-[#e4e4e7] pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Flow</h1>
            <p className="text-sm text-zinc-500 mt-1">Build workflows or run models directly.</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Import Button */}
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

            {/* Create Button */}
            <button
              onClick={() => createNewWorkflow()}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create workflow
            </button>
          </div>
        </div>

        {/* SYSTEM WORKFLOWS SECTION */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-zinc-900">System Workflows</h2>
          </div>
          <p className="text-xs text-zinc-500 -mt-3 mb-4">Prebuilt workflow templates - click to open and start using.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              onClick={createReferenceWorkflow}
              className="group cursor-pointer rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
            >
              <div className="relative h-44 w-full bg-zinc-100">
                {/* Simulated template image */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/10" />
                <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-300">
                  <div className="text-center p-4">
                    <Play className="h-10 w-10 mx-auto text-indigo-400 group-hover:scale-110 transition" />
                    <span className="text-xs font-semibold tracking-wider block mt-2 text-zinc-400">RUN REFERENCE WORKFLOW</span>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-zinc-900 text-sm">AI Racing Car Generator</h3>
                <p className="text-xs text-zinc-500 mt-1">Multi-modal generation involving image crop processing and Google Gemini models.</p>
              </div>
            </div>
          </div>
        </div>

        {/* USER WORKFLOWS SECTION */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Your Workflows</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Open one to edit, run, and review history.</p>
            </div>

            {/* Search workflows */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[#e4e4e7] bg-white pl-9 pr-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none shadow-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white">
              <div className="flex items-center gap-2 text-zinc-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                Loading workflows...
              </div>
            </div>
          ) : filteredWorkflows.length === 0 ? (
            /* EMPTY STATE */
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-16 text-center">
              <Folder className="h-12 w-12 text-zinc-300" />
              <h3 className="mt-4 text-sm font-semibold text-zinc-900">No workflows yet</h3>
              <p className="mt-2 text-xs text-zinc-500 max-w-sm">Create your first workflow to start building. Chain images, text, and Gemini execution blocks.</p>
              <button
                onClick={() => createNewWorkflow()}
                className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition shadow-sm"
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

                      <div className="flex items-center gap-2 mt-4 text-xs text-zinc-400">
                        <Clock className="h-3 w-3" />
                        <span>Edited {lastEdited}</span>
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
                          onClick={() => deleteWorkflow(w.id)}
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
  );
}
