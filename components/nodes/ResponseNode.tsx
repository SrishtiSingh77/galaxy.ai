"use client";

import React, { useEffect, useState } from "react";
import { Handle, Position } from "reactflow";
import { CheckCircle2, Award, Clipboard, Image as ImageIcon } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";

export default function ResponseNode({ id, data }: { id: string; data: any }) {
  const edges = useWorkflowStore((state) => state.edges);
  const isResultConnected = edges.some((e) => e.target === id && e.targetHandle === "result");
  const [results, setResults] = useState<Array<{ source: string; value: string; type: string }>>(data.results || []);

  useEffect(() => {
    setResults(data.results || []);
  }, [data.results]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  return (
    <div className="w-[270px] rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-[0_12px_38px_-4px_rgba(0,0,0,0.08)] hover:shadow-[0_16px_48px_-6px_rgba(0,0,0,0.12)] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="rounded bg-green-50 p-1 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">Response</span>
        </div>
      </div>

      <div className="relative flex flex-col gap-3">
        <Handle
          type="target"
          position={Position.Left}
          id="result"
          style={{
            width: "8px",
            height: "8px",
            backgroundColor: isResultConnected ? "#f97316" : "#ffffff",
            borderColor: "#f97316",
            borderWidth: "2px",
          }}
          className="hover:scale-125 transition-transform"
        />

        {/* Connection status */}
        {!isResultConnected && (
          <div className="text-[11px] text-zinc-400 italic text-center py-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
            Connect outputs here to capture results.
          </div>
        )}

        {/* Results List */}
        {isResultConnected && (
          <div className="flex flex-col gap-3">
            {results.length === 0 ? (
              <div className="text-[11px] text-zinc-400 italic text-center py-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                Awaiting run completion...
              </div>
            ) : (
              results.map((res, index) => {
                const isImage = res.type === "image" || res.value.startsWith("http") && (res.value.includes(".png") || res.value.includes(".jpg") || res.value.includes(".jpeg") || res.value.includes("blob:") || res.value.includes("transloadit"));
                return (
                  <div key={index} className="flex flex-col gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg p-2.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <span>Source: {res.source}</span>
                      {!isImage && (
                        <button
                          onClick={() => copyToClipboard(res.value)}
                          className="hover:text-zinc-600 p-0.5 rounded transition"
                        >
                          <Clipboard className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {isImage ? (
                      <div className="rounded-lg border border-zinc-250 bg-white overflow-hidden max-h-36 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={res.value}
                          alt={`Output Result ${index}`}
                          className="max-h-32 object-contain w-full"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-700 font-medium whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {res.value}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
