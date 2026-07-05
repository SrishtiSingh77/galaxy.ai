"use client";

import React, { useState, useEffect } from "react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { Bold } from "lucide-react";

export default function StickyNoteNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [text, setText] = useState(data.text || "");
  const [color, setColor] = useState(data.color || "yellow");
  const [fontSize, setFontSize] = useState(data.fontSize || 14);
  const [isBold, setIsBold] = useState(data.isBold || false);

  useEffect(() => {
    setText(data.text || "");
    setColor(data.color || "yellow");
    setFontSize(data.fontSize || 14);
    setIsBold(data.isBold || false);
  }, [data.text, data.color, data.fontSize, data.isBold]);

  const handleTextChange = (val: string) => {
    setText(val);
    updateNodeData(id, { text: val });
  };

  const handleColorChange = (colName: string) => {
    setColor(colName);
    updateNodeData(id, { color: colName });
  };

  const toggleBold = () => {
    const nextBold = !isBold;
    setIsBold(nextBold);
    updateNodeData(id, { isBold: nextBold });
  };

  const incrementFont = () => {
    const nextSize = Math.min(fontSize + 2, 32);
    setFontSize(nextSize);
    updateNodeData(id, { fontSize: nextSize });
  };

  const decrementFont = () => {
    const nextSize = Math.max(fontSize - 2, 10);
    setFontSize(nextSize);
    updateNodeData(id, { fontSize: nextSize });
  };

  // Color schemes lookup
  const colorMap: Record<string, { bg: string; border: string; select: string }> = {
    yellow: { bg: "bg-[#fef9c3]", border: "border-[#fef08a]", select: "#fef08a" },
    blue: { bg: "bg-[#dbeafe]", border: "border-[#bfdbfe]", select: "#bfdbfe" },
    green: { bg: "bg-[#dcfce7]", border: "border-[#bbf7d0]", select: "#bbf7d0" },
    pink: { bg: "bg-[#fce7f3]", border: "border-[#fbcfe8]", select: "#fbcfe8" },
    purple: { bg: "bg-[#f3e8ff]", border: "border-[#e9d5ff]", select: "#e9d5ff" },
    orange: { bg: "bg-[#ffedd5]", border: "border-[#fed7aa]", select: "#fed7aa" },
  };

  const currentColors = colorMap[color] || colorMap.yellow;

  return (
    <div className="relative group/note select-none">
      {/* Sticky Note Container */}
      <div
        className={`w-[190px] h-[190px] p-4 flex flex-col rounded-xl border transition-all duration-200 ${
          currentColors.bg
        } ${currentColors.border} ${
          selected
            ? "ring-2 ring-indigo-500/50 shadow-lg scale-[1.02]"
            : "shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        }`}
      >
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Type a note..."
          className="w-full h-full bg-transparent resize-none border-none outline-none focus:ring-0 text-zinc-700 leading-normal p-0 placeholder:text-zinc-400"
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: isBold ? "bold" : "normal",
          }}
        />
      </div>

      {/* Floating Toolbar Panel (visible on selection/hover) */}
      {(selected || selected === undefined) && (
        <div className="absolute left-[103%] top-0 flex flex-col gap-2.5 bg-white border border-zinc-200 shadow-xl rounded-full p-2 items-center justify-start z-50 animate-in fade-in slide-in-from-left-2 duration-200 min-w-[36px]">
          {/* Colors Selection Dots */}
          <div className="flex flex-col gap-1.5">
            {Object.entries(colorMap).map(([name, schema]) => (
              <button
                key={name}
                onClick={() => handleColorChange(name)}
                className={`h-5 w-5 rounded-full border transition hover:scale-110 ${
                  color === name ? "border-zinc-800 scale-105" : "border-zinc-300"
                }`}
                style={{ backgroundColor: schema.select }}
                title={`Set note color to ${name}`}
              />
            ))}
          </div>

          <div className="w-5 border-b border-zinc-200" />

          {/* Bold Toggle */}
          <button
            onClick={toggleBold}
            className={`h-6 w-6 rounded flex items-center justify-center transition ${
              isBold ? "bg-zinc-800 text-white" : "text-zinc-500 hover:bg-zinc-100"
            }`}
            title="Toggle Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>

          <div className="w-5 border-b border-zinc-200" />

          {/* Size controls */}
          <button
            onClick={incrementFont}
            className="h-6 w-6 rounded flex items-center justify-center text-zinc-500 hover:bg-zinc-100 font-bold text-xs"
            title="Increase Size"
          >
            A+
          </button>
          <span className="text-[10px] font-bold text-zinc-500">{fontSize}</span>
          <button
            onClick={decrementFont}
            className="h-6 w-6 rounded flex items-center justify-center text-zinc-500 hover:bg-zinc-100 font-bold text-xs"
            title="Decrease Size"
          >
            A-
          </button>
        </div>
      )}
    </div>
  );
}
