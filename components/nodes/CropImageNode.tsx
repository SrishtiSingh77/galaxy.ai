"use client";

import React, { useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Image as ImageIcon, Sliders } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";

export default function CropImageNode({ id, data }: { id: string; data: any }) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const edges = useWorkflowStore((state) => state.edges);

  // Glow reflects the live DB state synced into node data during a run
  const isExecuting = !!data.isExecuting;

  // Connection check helpers
  const isInputImageConnected = edges.some((e) => e.target === id && e.targetHandle === "inputImage");
  const isXConnected = edges.some((e) => e.target === id && e.targetHandle === "x");
  const isYConnected = edges.some((e) => e.target === id && e.targetHandle === "y");
  const isWidthConnected = edges.some((e) => e.target === id && e.targetHandle === "width");
  const isHeightConnected = edges.some((e) => e.target === id && e.targetHandle === "height");

  // Default values
  const x = data.x !== undefined ? data.x : 0;
  const y = data.y !== undefined ? data.y : 0;
  const width = data.width !== undefined ? data.width : 100;
  const height = data.height !== undefined ? data.height : 100;
  const outputImage = data.outputImage || "";

  const handleSliderChange = (param: string, value: number) => {
    updateNodeData(id, { [param]: value });
  };

  return (
    <div
      className={`w-[270px] rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-[0_12px_38px_-4px_rgba(0,0,0,0.08)] hover:shadow-[0_16px_48px_-6px_rgba(0,0,0,0.12)] transition-all ${
        isExecuting ? "executing-glow" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="rounded bg-indigo-50 p-1 text-indigo-600">
            <ImageIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">Crop Image</span>
        </div>
        {isExecuting && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {/* Input Image Handle & Indicator */}
        <div className="relative flex items-center justify-between bg-zinc-50 rounded-lg p-2 border border-zinc-200">
          <Handle
            type="target"
            position={Position.Left}
            id="inputImage"
            style={{ width: "8px", height: "8px", backgroundColor: "#ec4899", borderColor: "#ec4899" }}
            className="hover:scale-125 transition-transform"
          />
          <span className="text-xs font-medium text-zinc-500">Input Image</span>
          <span className="text-[10px] text-zinc-400 italic">
            {isInputImageConnected ? "Connected" : "No Input"}
          </span>
        </div>

        {/* Input image preview (populated from the connected upstream image at run time) */}
        {data.inputImage && (
          <div className="rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50 max-h-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.inputImage} alt="Input Preview" className="w-full object-contain h-24" />
          </div>
        )}

        {/* Sliders */}
        <div className="flex flex-col gap-2">
          {/* X Position */}
          <div className={`relative flex flex-col gap-1 rounded p-2 border transition ${isXConnected ? "bg-zinc-100 opacity-60 border-zinc-200" : "bg-zinc-50/50 border-zinc-100"}`}>
            <Handle
              type="target"
              position={Position.Left}
              id="x"
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: isXConnected ? "#ec4899" : "#ffffff",
                borderColor: "#ec4899",
                borderWidth: "2px",
              }}
              className="hover:scale-125 transition-transform"
            />
            <div className="flex justify-between text-[11px] font-semibold text-zinc-600">
              <span>X Position (%)</span>
              <span>{x}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={x}
              disabled={isXConnected}
              onChange={(e) => handleSliderChange("x", parseInt(e.target.value))}
              className="nodrag nopan h-1 w-full bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
            />
          </div>

          {/* Y Position */}
          <div className={`relative flex flex-col gap-1 rounded p-2 border transition ${isYConnected ? "bg-zinc-100 opacity-60 border-zinc-200" : "bg-zinc-50/50 border-zinc-100"}`}>
            <Handle
              type="target"
              position={Position.Left}
              id="y"
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: isYConnected ? "#ec4899" : "#ffffff",
                borderColor: "#ec4899",
                borderWidth: "2px",
              }}
              className="hover:scale-125 transition-transform"
            />
            <div className="flex justify-between text-[11px] font-semibold text-zinc-600">
              <span>Y Position (%)</span>
              <span>{y}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={y}
              disabled={isYConnected}
              onChange={(e) => handleSliderChange("y", parseInt(e.target.value))}
              className="nodrag nopan h-1 w-full bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
            />
          </div>

          {/* Width */}
          <div className={`relative flex flex-col gap-1 rounded p-2 border transition ${isWidthConnected ? "bg-zinc-100 opacity-60 border-zinc-200" : "bg-zinc-50/50 border-zinc-100"}`}>
            <Handle
              type="target"
              position={Position.Left}
              id="width"
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: isWidthConnected ? "#ec4899" : "#ffffff",
                borderColor: "#ec4899",
                borderWidth: "2px",
              }}
              className="hover:scale-125 transition-transform"
            />
            <div className="flex justify-between text-[11px] font-semibold text-zinc-600">
              <span>Width (%)</span>
              <span>{width}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={width}
              disabled={isWidthConnected}
              onChange={(e) => handleSliderChange("width", parseInt(e.target.value))}
              className="nodrag nopan h-1 w-full bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
            />
          </div>

          {/* Height */}
          <div className={`relative flex flex-col gap-1 rounded p-2 border transition ${isHeightConnected ? "bg-zinc-100 opacity-60 border-zinc-200" : "bg-zinc-50/50 border-zinc-100"}`}>
            <Handle
              type="target"
              position={Position.Left}
              id="height"
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: isHeightConnected ? "#ec4899" : "#ffffff",
                borderColor: "#ec4899",
                borderWidth: "2px",
              }}
              className="hover:scale-125 transition-transform"
            />
            <div className="flex justify-between text-[11px] font-semibold text-zinc-600">
              <span>Height (%)</span>
              <span>{height}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={height}
              disabled={isHeightConnected}
              onChange={(e) => handleSliderChange("height", parseInt(e.target.value))}
              className="nodrag nopan h-1 w-full bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Output preview */}
        <div className="relative flex flex-col gap-1.5 border-t border-zinc-100 pt-3">
          <span className="text-[11px] font-semibold text-zinc-500">Output Image</span>
          {outputImage ? (
            <div className="rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50 max-h-36">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={outputImage}
                alt="Cropped Preview"
                className="w-full object-contain h-28"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 bg-zinc-50 rounded-lg border border-dashed border-zinc-200 text-[10px] text-zinc-400 font-semibold">
              No output yet
            </div>
          )}

          <Handle
            type="source"
            position={Position.Right}
            id="outputImage"
            style={{ width: "8px", height: "8px", backgroundColor: "#18181b", borderColor: "#18181b" }}
            className="hover:scale-125 transition-transform"
          />
        </div>
      </div>
    </div>
  );
}
