"use client";

import React, { useState, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Bot, Sliders, ChevronDown, ChevronUp, FileCode, Upload, Trash2 } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import Uppy from "@uppy/core";
import Transloadit from "@uppy/transloadit";

export default function GeminiNode({ id, data }: { id: string; data: any }) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const edges = useWorkflowStore((state) => state.edges);
  const executingNodeIds = useWorkflowStore((state) => state.executingNodeIds);

  const isExecuting = executingNodeIds.includes(id);

  // Connection check helpers
  const isPromptConnected = edges.some((e) => e.target === id && e.targetHandle === "prompt");
  const isSystemPromptConnected = edges.some((e) => e.target === id && e.targetHandle === "systemPrompt");
  const isImageConnected = edges.some((e) => e.target === id && e.targetHandle === "image");
  const isVideoConnected = edges.some((e) => e.target === id && e.targetHandle === "video");
  const isAudioConnected = edges.some((e) => e.target === id && e.targetHandle === "audio");
  const isFileConnected = edges.some((e) => e.target === id && e.targetHandle === "file");

  // State
  const [model, setModel] = useState(data.model || "gemini-3.1-pro");
  const [prompt, setPrompt] = useState(data.prompt || "");
  const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || "");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [temperature, setTemperature] = useState(data.temperature !== undefined ? data.temperature : 0.7);
  const [maxTokens, setMaxTokens] = useState(data.maxTokens !== undefined ? data.maxTokens : 2048);

  const [imageVal, setImageVal] = useState(data.imageVal || "");
  const [videoVal, setVideoVal] = useState(data.videoVal || "");
  const [audioVal, setAudioVal] = useState(data.audioVal || "");
  const [fileVal, setFileVal] = useState(data.fileVal || "");

  const [uploadingType, setUploadingType] = useState<string | null>(null);

  useEffect(() => {
    setModel(data.model || "gemini-3.1-pro");
    setPrompt(data.prompt || "");
    setSystemPrompt(data.systemPrompt || "");
    setTemperature(data.temperature !== undefined ? data.temperature : 0.7);
    setMaxTokens(data.maxTokens !== undefined ? data.maxTokens : 2048);
    setImageVal(data.imageVal || "");
    setVideoVal(data.videoVal || "");
    setAudioVal(data.audioVal || "");
    setFileVal(data.fileVal || "");
  }, [data]);

  const handleUpdate = (updates: any) => {
    updateNodeData(id, updates);
  };

  const handleFileUpload = (type: string, file: File) => {
    setUploadingType(type);

    const uppyInstance = new Uppy({
      restrictions: { maxNumberOfFiles: 1 },
      autoProceed: true,
    }).use(Transloadit, {
      params: {
        auth: { key: process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY || "srish011" },
        template_id: process.env.NEXT_PUBLIC_TRANSLOADIT_TEMPLATE_ID || "b11d22eefc3b42ab9a9685710e74b9f9",
      },
      waitForResults: true,
    });

    uppyInstance.addFile({
      name: file.name,
      type: file.type,
      data: file,
    });

    uppyInstance.on("transloadit:complete", (assembly) => {
      const fileUrl = assembly.results?.export?.[0]?.ssl_url || assembly.results?.[":original"]?.[0]?.ssl_url;
      if (fileUrl) {
        handleUpdate({ [`${type}Val`]: fileUrl });
      }
      setUploadingType(null);
    });

    uppyInstance.on("error", (error) => {
      console.error("Gemini Asset Upload Error:", error);
      const mockUrl = URL.createObjectURL(file);
      handleUpdate({ [`${type}Val`]: mockUrl });
      setUploadingType(null);
    });
  };

  return (
    <div
      className={`w-[300px] rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm hover:shadow-md transition-all ${
        isExecuting ? "executing-glow" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="rounded bg-indigo-50 p-1 text-indigo-600">
            <Bot className="h-4 w-4" />
          </div>
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              handleUpdate({ model: e.target.value });
            }}
            className="text-xs font-bold text-zinc-700 bg-transparent border-none focus:outline-none cursor-pointer"
          >
            <option value="gemini-3.1-pro">Gemini 3.1 Pro</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          </select>
        </div>

        {isExecuting && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {/* Prompt */}
        <div className="relative flex flex-col gap-1">
          <Handle
            type="target"
            position={Position.Left}
            id="prompt"
            className="!bg-white !border-zinc-400"
          />
          <span className="text-[11px] font-bold text-zinc-500">Prompt*</span>
          <textarea
            value={isPromptConnected ? "" : prompt}
            disabled={isPromptConnected}
            onChange={(e) => {
              setPrompt(e.target.value);
              handleUpdate({ prompt: e.target.value });
            }}
            placeholder={isPromptConnected ? "Linked to upstream text source" : "Enter prompt..."}
            className="min-h-[50px] w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none resize-none disabled:bg-zinc-50 disabled:text-zinc-400"
          />
        </div>

        {/* System Prompt */}
        <div className="relative flex flex-col gap-1">
          <Handle
            type="target"
            position={Position.Left}
            id="systemPrompt"
            className="!bg-white !border-zinc-400"
          />
          <span className="text-[11px] font-bold text-zinc-500">System Prompt</span>
          <textarea
            value={isSystemPromptConnected ? "" : systemPrompt}
            disabled={isSystemPromptConnected}
            onChange={(e) => {
              setSystemPrompt(e.target.value);
              handleUpdate({ systemPrompt: e.target.value });
            }}
            placeholder={isSystemPromptConnected ? "Linked to system prompt source" : "You are a helpful assistant..."}
            className="min-h-[50px] w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none resize-none disabled:bg-zinc-50 disabled:text-zinc-400"
          />
        </div>

        {/* Media Inputs (Image, Video, Audio, File) */}
        <div className="flex flex-col gap-2">
          {/* Image handle */}
          <div className="relative flex items-center justify-between bg-zinc-50/50 rounded p-1.5 border border-zinc-100">
            <Handle
              type="target"
              position={Position.Left}
              id="image"
              className="!bg-white !border-zinc-400"
            />
            <span className="text-[11px] font-semibold text-zinc-600">Image (Vision)</span>
            {isImageConnected ? (
              <span className="text-[10px] text-indigo-600 font-bold">Connected</span>
            ) : imageVal ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 truncate max-w-[80px]">Uploaded</span>
                <button
                  onClick={() => handleUpdate({ imageVal: "" })}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-1 cursor-pointer bg-white border border-zinc-200 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-semibold hover:bg-zinc-50">
                {uploadingType === "image" ? "..." : <><Upload className="h-3 w-3" /> Upload</>}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload("image", f);
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Video handle */}
          <div className="relative flex items-center justify-between bg-zinc-50/50 rounded p-1.5 border border-zinc-100">
            <Handle
              type="target"
              position={Position.Left}
              id="video"
              className="!bg-white !border-zinc-400"
            />
            <span className="text-[11px] font-semibold text-zinc-600">Video</span>
            {isVideoConnected ? (
              <span className="text-[10px] text-indigo-600 font-bold">Connected</span>
            ) : videoVal ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 truncate max-w-[80px]">Uploaded</span>
                <button
                  onClick={() => handleUpdate({ videoVal: "" })}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-1 cursor-pointer bg-white border border-zinc-200 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-semibold hover:bg-zinc-50">
                {uploadingType === "video" ? "..." : <><Upload className="h-3 w-3" /> Upload</>}
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload("video", f);
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Audio handle */}
          <div className="relative flex items-center justify-between bg-zinc-50/50 rounded p-1.5 border border-zinc-100">
            <Handle
              type="target"
              position={Position.Left}
              id="audio"
              className="!bg-white !border-zinc-400"
            />
            <span className="text-[11px] font-semibold text-zinc-600">Audio</span>
            {isAudioConnected ? (
              <span className="text-[10px] text-indigo-600 font-bold">Connected</span>
            ) : audioVal ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 truncate max-w-[80px]">Uploaded</span>
                <button
                  onClick={() => handleUpdate({ audioVal: "" })}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-1 cursor-pointer bg-white border border-zinc-200 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-semibold hover:bg-zinc-50">
                {uploadingType === "audio" ? "..." : <><Upload className="h-3 w-3" /> Upload</>}
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload("audio", f);
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* File handle */}
          <div className="relative flex items-center justify-between bg-zinc-50/50 rounded p-1.5 border border-zinc-100">
            <Handle
              type="target"
              position={Position.Left}
              id="file"
              className="!bg-white !border-zinc-400"
            />
            <span className="text-[11px] font-semibold text-zinc-600">File</span>
            {isFileConnected ? (
              <span className="text-[10px] text-indigo-600 font-bold">Connected</span>
            ) : fileVal ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 truncate max-w-[80px]">Uploaded</span>
                <button
                  onClick={() => handleUpdate({ fileVal: "" })}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-1 cursor-pointer bg-white border border-zinc-200 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-semibold hover:bg-zinc-50">
                {uploadingType === "file" ? "..." : <><Upload className="h-3 w-3" /> Upload</>}
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload("file", f);
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Settings section */}
        <div className="border-t border-zinc-100 pt-2">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex w-full items-center justify-between text-xs font-semibold text-zinc-500 hover:text-zinc-700 py-1"
          >
            <span className="flex items-center gap-1">
              <Sliders className="h-3 w-3" />
              Settings
            </span>
            {settingsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {settingsOpen && (
            <div className="flex flex-col gap-2 mt-2 p-2 bg-zinc-50 rounded-lg border border-zinc-150 text-[11px] text-zinc-600">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-semibold">
                  <span>Temperature</span>
                  <span>{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => {
                    setTemperature(parseFloat(e.target.value));
                    handleUpdate({ temperature: parseFloat(e.target.value) });
                  }}
                  className="h-1 w-full bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between font-semibold">
                  <span>Max Tokens</span>
                  <span>{maxTokens}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8192"
                  step="64"
                  value={maxTokens}
                  onChange={(e) => {
                    setMaxTokens(parseInt(e.target.value));
                    handleUpdate({ maxTokens: parseInt(e.target.value) });
                  }}
                  className="h-1 w-full bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>
          )}
        </div>

        {/* Response / Output Handle */}
        <div className="relative flex flex-col gap-1.5 border-t border-zinc-100 pt-3">
          <span className="text-[11px] font-bold text-zinc-500">Response</span>
          <div className="min-h-[50px] max-h-[140px] w-full rounded-lg bg-zinc-50 border border-zinc-200 p-2 text-xs text-zinc-700 overflow-y-auto whitespace-pre-wrap">
            {data.response || <span className="text-zinc-400 italic">No output yet</span>}
          </div>

          <Handle
            type="source"
            position={Position.Right}
            id="response"
            className="!bg-white !border-zinc-400 hover:!border-indigo-500 hover:!bg-indigo-500"
          />
        </div>
      </div>
    </div>
  );
}
