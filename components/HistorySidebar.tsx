"use client";

import React, { useState, useEffect } from "react";
import { X, Clock, Play, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";

interface NodeDetail {
  nodeId: string;
  nodeName: string;
  status: string;
  duration: number;
  inputs?: any;
  outputs?: any;
  error?: string;
}

interface ExecutionRecord {
  id: string;
  timestamp: string;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  duration: number;
  scope: "FULL" | "PARTIAL" | "SINGLE_NODE";
  details: NodeDetail[];
}

export default function HistorySidebar() {
  const activeWorkflowId = useWorkflowStore((state) => state.activeWorkflowId);
  const isOpen = useWorkflowStore((state) => state.historySidebarOpen);
  const setOpen = useWorkflowStore((state) => state.setHistorySidebarOpen);
  const isExecuting = useWorkflowStore((state) => state.isExecuting);

  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!activeWorkflowId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workflows/${activeWorkflowId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Error fetching execution history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeWorkflowId) {
      fetchHistory();
    }
  }, [isOpen, activeWorkflowId, isExecuting]); // Refetch when history sidebar opens or execution completes

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedRunId(expandedRunId === id ? null : id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "FAILED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "PARTIAL":
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return "🟢";
      case "FAILED":
        return "🔴";
      case "PARTIAL":
      default:
        return "🟡";
    }
  };

  return (
    <div className="absolute right-0 top-0 z-40 h-full w-[420px] border-l border-zinc-200 bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-bold text-zinc-800">Workflow History</h2>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* History content list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && history.length === 0 ? (
          <div className="flex h-36 items-center justify-center text-xs text-zinc-400">
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            Fetching history...
          </div>
        ) : history.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center text-zinc-400 border border-dashed border-zinc-200 rounded-xl p-4 bg-zinc-50/50">
            <Play className="h-8 w-8 text-zinc-300 mb-1" />
            <span className="text-xs font-semibold text-zinc-500">No executions yet</span>
            <span className="text-[10px] text-zinc-400 mt-1 leading-normal max-w-[220px]">
              Run the workflow using the Play button to record executions.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((run) => {
              const dateStr = new Date(run.timestamp).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
              const isExpanded = expandedRunId === run.id;

              return (
                <div key={run.id} className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  {/* Summary Card bar */}
                  <div
                    onClick={() => toggleExpand(run.id)}
                    className="flex items-center justify-between p-3.5 hover:bg-zinc-50/80 cursor-pointer transition select-none"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-zinc-800">{dateStr}</span>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-semibold">
                        <span>Scope: {run.scope.replace("_", " ")}</span>
                        <span>•</span>
                        <span>Duration: {run.duration.toFixed(1)}s</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getStatusColor(run.status)}`}>
                        {getStatusDot(run.status)} {run.status}
                      </span>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
                    </div>
                  </div>

                  {/* Expanded node details */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 bg-zinc-50/50 p-3 flex flex-col gap-2.5">
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Execution Details</h4>
                      {run.details.map((node, nIdx) => (
                        <div key={nIdx} className="bg-white border border-zinc-150 rounded-lg p-2.5 shadow-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-zinc-800">{node.nodeName}</span>
                            <span className={`text-[10px] font-bold ${node.status === "SUCCESS" ? "text-emerald-600" : "text-rose-600"}`}>
                              {node.status === "SUCCESS" ? "✓ Success" : "✗ Failed"} ({node.duration.toFixed(2)}s)
                            </span>
                          </div>

                          {/* Node Inputs / Outputs display */}
                          <div className="mt-2 flex flex-col gap-1.5 border-t border-zinc-150 pt-2 text-[10px] text-zinc-600 font-medium">
                            {node.nodeName.toLowerCase().includes("crop") ? (
                              <div className="flex flex-col gap-1">
                                {node.inputs && (
                                  <>
                                    <div>
                                      <span className="font-bold text-zinc-400">Crop Parameters:</span>{" "}
                                      <span className="text-zinc-800">
                                        X: {node.inputs.x}%, Y: {node.inputs.y}%, W: {node.inputs.width}%, H: {node.inputs.height}%
                                      </span>
                                    </div>
                                    {node.inputs.inputImage && (
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="font-bold text-zinc-400">Input Image:</span>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={node.inputs.inputImage}
                                          alt="Input"
                                          className="w-10 h-10 object-cover rounded border border-zinc-200"
                                        />
                                      </div>
                                    )}
                                  </>
                                )}
                                {node.outputs?.outputImage && (
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-bold text-zinc-400">Output Image:</span>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={node.outputs.outputImage}
                                      alt="Output"
                                      className="w-10 h-10 object-cover rounded border border-zinc-200"
                                    />
                                  </div>
                                )}
                              </div>
                            ) : node.nodeName.toLowerCase().includes("gemini") ? (
                              <div className="flex flex-col gap-1">
                                {node.inputs && (
                                  <>
                                    {node.inputs.prompt && (
                                      <div>
                                        <span className="font-bold text-zinc-400">Prompt:</span>{" "}
                                        <span className="text-zinc-700 italic">"{node.inputs.prompt}"</span>
                                      </div>
                                    )}
                                    {node.inputs.systemPrompt && (
                                      <div>
                                        <span className="font-bold text-zinc-400">System Prompt:</span>{" "}
                                        <span className="text-zinc-700 italic">"{node.inputs.systemPrompt}"</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                {node.outputs?.response && (
                                  <div className="mt-1">
                                    <span className="font-bold text-zinc-400">Response:</span>{" "}
                                    <div className="bg-zinc-50 border border-zinc-150 rounded p-1.5 text-[9px] font-mono whitespace-pre-wrap max-h-24 overflow-y-auto mt-0.5 text-zinc-800">
                                      {node.outputs.response}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              // Fallback for general nodes
                              <div className="flex flex-col gap-1">
                                {node.inputs && Object.keys(node.inputs).length > 0 && (
                                  <div>
                                    <span className="font-bold text-zinc-400">Inputs:</span>
                                    <pre className="bg-zinc-50 border border-zinc-100 rounded p-1 text-[9px] font-mono whitespace-pre-wrap max-h-16 overflow-y-auto mt-0.5">
                                      {JSON.stringify(node.inputs, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {node.outputs && Object.keys(node.outputs).length > 0 && (
                                  <div>
                                    <span className="font-bold text-zinc-400">Outputs:</span>
                                    <pre className="bg-zinc-50 border border-zinc-100 rounded p-1 text-[9px] font-mono whitespace-pre-wrap max-h-16 overflow-y-auto mt-0.5">
                                      {JSON.stringify(node.outputs, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}

                            {node.error && (
                              <div className="mt-1 flex items-start gap-1 text-rose-600">
                                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                                <span>Error: {node.error}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
