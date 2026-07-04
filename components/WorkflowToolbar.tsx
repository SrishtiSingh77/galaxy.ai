"use client";

import React, { useState, useMemo } from "react";
import { Plus, Search, Image as ImageIcon, Bot, Video, Music, Layers, Copy, Undo2, Redo2 } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";

interface NodePickerProps {
  onSelect: (type: "cropImage" | "gemini") => void;
  onClose: () => void;
}

function NodePicker({ onSelect, onClose }: NodePickerProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", "Recent", "Image", "Video", "Audio", "Others"];

  const items = useMemo(() => {
    return [
      {
        name: "Crop Image",
        type: "cropImage" as const,
        category: "Image",
        icon: ImageIcon,
        desc: "Crop an input image using custom percentage coordinates.",
      },
      {
        name: "Gemini 3.1 Pro",
        type: "gemini" as const,
        category: "Others",
        icon: Bot,
        desc: "Run Google Gemini LLM with text, prompt, and image assets.",
      },
    ];
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || item.category === activeCategory || (activeCategory === "Recent" && item.type === "gemini");
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="absolute bottom-20 left-1/2 z-50 w-[500px] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 mb-3">
        <Search className="h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm text-zinc-950 placeholder-zinc-400 focus:outline-none"
          autoFocus
        />
      </div>

      <div className="flex h-56 gap-4">
        {/* Sidebar */}
        <div className="flex w-32 flex-col gap-1 border-r border-zinc-100 pr-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                activeCategory === cat
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-zinc-400">
              <Layers className="h-8 w-8 text-zinc-200 mb-1" />
              <span className="text-xs font-semibold">No nodes found</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => {
                      onSelect(item.type);
                      onClose();
                    }}
                    className="flex w-full items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-2.5 text-left hover:bg-indigo-50/30 hover:border-indigo-100 transition group"
                  >
                    <div className="rounded-lg bg-white p-2 border border-zinc-200 text-zinc-600 group-hover:text-indigo-600 group-hover:border-indigo-200 transition">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-800 group-hover:text-indigo-950">{item.name}</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkflowToolbar() {
  const addNode = useWorkflowStore((state) => state.addNode);
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const undoStack = useWorkflowStore((state) => state.undoStack);
  const redoStack = useWorkflowStore((state) => state.redoStack);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSelectNode = (type: "cropImage" | "gemini") => {
    const existingNodes = useWorkflowStore.getState().nodes;
    
    // Auto-position in nearest empty space
    let x = 400;
    let y = 300;
    const boxWidth = 320;
    const boxHeight = 350;
    const padding = 40;
    let overlaps = true;

    while (overlaps) {
      overlaps = false;
      for (const node of existingNodes) {
        const nx = node.position.x;
        const ny = node.position.y;
        const xOverlap = Math.abs(x - nx) < (boxWidth + padding);
        const yOverlap = Math.abs(y - ny) < (boxHeight + padding);
        if (xOverlap && yOverlap) {
          x += 350;
          if (x > 1500) {
            x = 400;
            y += 200;
          }
          overlaps = true;
          break;
        }
      }
    }

    const id = `${type}-${Date.now()}`;
    const newNode = {
      id,
      type,
      position: { x, y },
      data:
        type === "cropImage"
          ? { x: 0, y: 0, width: 100, height: 100, inputImage: "", outputImage: "" }
          : { model: "gemini-3.1-pro", prompt: "", systemPrompt: "", response: "" },
    };

    addNode(newNode);
  };

  return (
    <div className="absolute bottom-6 left-1/2 z-40 -translate-x-1/2">
      {pickerOpen && <NodePicker onSelect={handleSelectNode} onClose={() => setPickerOpen(false)} />}

      <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl">
        {/* Undo / Redo */}
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950 transition-all disabled:opacity-40"
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={redo}
          disabled={redoStack.length === 0}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950 transition-all disabled:opacity-40"
          title="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="h-5 border-r border-zinc-200 mx-1" />

        {/* Categories / Template Toggle */}
        <button
          onClick={() => alert("Ready to customize canvas.")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950 transition-all"
        >
          <Copy className="h-4 w-4" />
        </button>

        {/* Floating Add Button */}
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 transition-all shadow-md"
          title="Add Node"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
