"use client";

import React, { useEffect, useState } from "react";
import { Handle, Position } from "reactflow";
import { CheckCircle2, Award, Clipboard, Check, Image as ImageIcon } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";

/** Render the small, safe subset of Markdown returned by text models. */
function renderInlineMarkdown(text: string) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return tokens.map((token, index) => {
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-zinc-200/80 px-1 py-0.5 font-mono text-[0.9em] text-zinc-800">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={index} className="font-bold text-zinc-900">{token.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{token}</React.Fragment>;
  });
}

function MarkdownResult({ value }: { value: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex].trim();
    if (!line) {
      lineIndex += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push(<h3 key={lineIndex} className="mt-2 first:mt-0 text-[11px] font-bold leading-snug text-zinc-900">{renderInlineMarkdown(heading[2])}</h3>);
      lineIndex += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      const listKey = lineIndex;
      while (lineIndex < lines.length && /^[-*+]\s+/.test(lines[lineIndex].trim())) {
        items.push(lines[lineIndex].trim().replace(/^[-*+]\s+/, ""));
        lineIndex += 1;
      }
      blocks.push(<ul key={listKey} className="ml-4 list-disc space-y-1 marker:text-zinc-400">{items.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>)}</ul>);
      continue;
    }

    const paragraph: string[] = [line];
    lineIndex += 1;
    while (lineIndex < lines.length && lines[lineIndex].trim() && !/^(#{1,3})\s+|^[-*+]\s+/.test(lines[lineIndex].trim())) {
      paragraph.push(lines[lineIndex].trim());
      lineIndex += 1;
    }
    blocks.push(<p key={lineIndex}>{renderInlineMarkdown(paragraph.join(" "))}</p>);
  }

  return <div className="space-y-2 text-xs font-medium leading-[1.45] text-zinc-700">{blocks}</div>;
}

export default function ResponseNode({ id, data }: { id: string; data: any }) {
  const edges = useWorkflowStore((state) => state.edges);
  const isResultConnected = edges.some((e) => e.target === id && e.targetHandle === "result");
  const [results, setResults] = useState<Array<{ value: string; type: string }>>(data.results || []);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    setResults(data.results || []);
  }, [data.results]);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500);
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
          title="Accepts type: ANY"
          data-porttype="any"
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
                const isImage = res.type === "image";
                return (
                  <div key={index} className="flex flex-col gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg p-2.5">
                    {/* Only the output itself is shown — no node ids or run metadata */}
                    <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <span>{isImage ? "Image" : "Text"}</span>
                      <button
                        onClick={() => copyToClipboard(res.value, index)}
                        title={copiedIndex === index ? "Copied" : "Copy to clipboard"}
                        className={`flex items-center gap-1 p-0.5 rounded transition ${
                          copiedIndex === index ? "text-green-600" : "hover:text-zinc-600"
                        }`}
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span className="text-[9px] font-bold">Copied</span>
                          </>
                        ) : (
                          <Clipboard className="h-3.5 w-3.5" />
                        )}
                      </button>
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
                      <div className="max-h-52 overflow-y-auto pr-1">
                        <MarkdownResult value={res.value} />
                      </div>
                    )}
                    {/* Image outputs also expose their CDN URL as plain text */}
                    {isImage && (
                      <p className="text-[10px] text-zinc-500 break-all font-mono">{res.value}</p>
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