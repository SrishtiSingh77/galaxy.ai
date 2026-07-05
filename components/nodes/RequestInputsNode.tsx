"use client";

import React, { useState, useEffect, useRef } from "react";
import { Handle, Position } from "reactflow";
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  X,
  AlignLeft,
  Hash,
  CheckSquare,
  Music,
  Video,
  FileText,
  Maximize2,
  Copy,
  HelpCircle,
} from "lucide-react";
import { useWorkflowStore, RequestInputField } from "@/store/useWorkflowStore";
import Uppy from "@uppy/core";
import Transloadit from "@uppy/transloadit";

export default function RequestInputsNode({ id, data }: { id: string; data: any }) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [fields, setFields] = useState<RequestInputField[]>(data.fields || []);
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFields(data.fields || []);
  }, [data.fields]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateFields = (newFields: RequestInputField[]) => {
    setFields(newFields);
    updateNodeData(id, { fields: newFields });
  };

  const addField = (type: string) => {
    const count = fields.filter((f) => f.type === type).length;
    let baseName = type.replace("_field", "");
    const name = `${baseName}_field_${count + 1}`;
    const newField: RequestInputField = {
      id: `field-${Date.now()}`,
      name,
      type,
      value: type === "boolean_field" ? "false" : "",
    };
    updateFields([...fields, newField]);
    setDropdownOpen(false);
  };

  const removeField = (fieldId: string) => {
    updateFields(fields.filter((f) => f.id !== fieldId));
    if (expandedFieldId === fieldId) {
      setExpandedFieldId(null);
    }
  };

  const handleFieldRename = (fieldId: string, newName: string) => {
    updateFields(
      fields.map((f) => (f.id === fieldId ? { ...f, name: newName } : f))
    );
  };

  const handleTextChange = (fieldId: string, text: string) => {
    updateFields(
      fields.map((f) => (f.id === fieldId ? { ...f, value: text } : f))
    );
  };

  const duplicateField = (field: RequestInputField) => {
    const count = fields.filter((f) => f.type === field.type).length;
    const baseName = field.name.replace(/_\d+$/, "");
    const name = `${baseName}_copy_${count + 1}`;
    const duplicated: RequestInputField = {
      id: `field-${Date.now()}`,
      name,
      type: field.type,
      value: field.value,
    };
    updateFields([...fields, duplicated]);
  };

  // Uppy + Transloadit upload
  const handleFileUpload = (fieldId: string, file: File, type: string) => {
    setUploadingFieldId(fieldId);
    setUploadProgress(0);

    const allowedTypes = type === "image_field" ? ["image/*"] : (type === "audio_field" ? ["audio/*"] : (type === "video_field" ? ["video/*"] : []));

    const uppyInstance = new Uppy({
      restrictions: { maxNumberOfFiles: 1, allowedFileTypes: allowedTypes.length > 0 ? allowedTypes : undefined },
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

    uppyInstance.on("upload-progress", (file, progress) => {
      const percentage = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
      setUploadProgress(percentage);
    });

    uppyInstance.on("transloadit:complete", (assembly) => {
      const fileUrl = assembly.results?.export?.[0]?.ssl_url || assembly.results?.[":original"]?.[0]?.ssl_url;
      if (fileUrl) {
        updateFields(
          fields.map((f) => (f.id === fieldId ? { ...f, value: fileUrl } : f))
        );
      }
      setUploadingFieldId(null);
      setUploadProgress(0);
    });

    uppyInstance.on("error", (error) => {
      console.error("Transloadit Upload Error:", error);
      const mockUrl = URL.createObjectURL(file);
      updateFields(
        fields.map((f) => (f.id === fieldId ? { ...f, value: mockUrl } : f))
      );
      setUploadingFieldId(null);
      setUploadProgress(0);
    });
  };

  const dropdownItems = [
    { label: "Text", type: "text_field", icon: AlignLeft },
    { label: "Number", type: "number_field", icon: Hash },
    { label: "Boolean", type: "boolean_field", icon: CheckSquare },
    { label: "Image", type: "image_field", icon: ImageIcon },
    { label: "Audio", type: "audio_field", icon: Music },
    { label: "Video", type: "video_field", icon: Video },
    { label: "Media", type: "media_field", icon: Music },
    { label: "File", type: "file_field", icon: FileText },
  ];

  const expandedField = fields.find((f) => f.id === expandedFieldId);

  return (
    <div className="w-[300px] rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-[0_12px_38px_-4px_rgba(0,0,0,0.08)] hover:shadow-[0_16px_48px_-6px_rgba(0,0,0,0.12)] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 mb-3 relative">
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-zinc-800">Request-Inputs</span>
          <HelpCircle className="h-3.5 w-3.5 text-zinc-400 cursor-pointer hover:text-zinc-600" />
        </div>

        {/* Dropdown Toggle Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition text-zinc-500 shadow-sm"
          >
            <Plus className="h-4 w-4" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-8 z-50 w-36 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl animate-in fade-in duration-100">
              {dropdownItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => addField(item.type)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition"
                  >
                    <Icon className="h-3.5 w-3.5 text-zinc-400" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fields List */}
      <div className="flex flex-col gap-4">
        {fields.length === 0 ? (
          <div className="text-[10px] text-zinc-400 italic text-center py-4 bg-zinc-50/50 rounded-lg border border-dashed border-zinc-200">
            No input fields. Click '+' to add fields.
          </div>
        ) : (
          fields.map((field) => {
            return (
              <div key={field.id} className="relative flex flex-col gap-1.5 border-t border-zinc-50 pt-3 first:border-none first:pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 w-2/3">
                    {/* Drag indicator representation */}
                    <div className="flex flex-col gap-0.5 cursor-grab text-zinc-300 hover:text-zinc-500">
                      <div className="flex gap-0.5"><span className="h-0.5 w-0.5 rounded-full bg-current" /><span className="h-0.5 w-0.5 rounded-full bg-current" /></div>
                      <div className="flex gap-0.5"><span className="h-0.5 w-0.5 rounded-full bg-current" /><span className="h-0.5 w-0.5 rounded-full bg-current" /></div>
                      <div className="flex gap-0.5"><span className="h-0.5 w-0.5 rounded-full bg-current" /><span className="h-0.5 w-0.5 rounded-full bg-current" /></div>
                    </div>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => handleFieldRename(field.id, e.target.value)}
                      className="border-none bg-transparent text-[11px] font-bold text-zinc-700 focus:outline-none focus:underline w-full"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => duplicateField(field)}
                      title="Duplicate"
                      className="rounded p-0.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeField(field.id)}
                      title="Delete"
                      className="rounded p-0.5 text-zinc-400 hover:bg-zinc-50 hover:text-red-500 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Input Fields Rendering by Type */}
                {field.type === "text_field" ? (
                  <div className="relative w-full">
                    <textarea
                      value={field.value}
                      onChange={(e) => handleTextChange(field.id, e.target.value)}
                      placeholder="Enter text..."
                      className="min-h-[60px] w-full rounded-lg border border-zinc-200 p-2 pr-8 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none resize-none bg-zinc-50/50"
                    />
                    <button
                      onClick={() => setExpandedFieldId(field.id)}
                      className="absolute right-2 bottom-2 p-1 rounded bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-700 shadow-sm"
                      title="Expand Prompt"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : field.type === "number_field" ? (
                  <input
                    type="number"
                    value={field.value}
                    onChange={(e) => handleTextChange(field.id, e.target.value)}
                    placeholder="Enter number..."
                    className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none bg-zinc-50/50"
                  />
                ) : field.type === "boolean_field" ? (
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={field.value === "true"}
                      onChange={(e) => handleTextChange(field.id, e.target.checked ? "true" : "false")}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-xs text-zinc-600 font-medium">{field.value === "true" ? "True" : "False"}</span>
                  </label>
                ) : (
                  /* Media Fields: Image, Audio, Video, Media, File */
                  <div className="flex flex-col gap-2">
                    {field.value ? (
                      <div className="relative rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50">
                        {field.type === "image_field" ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={field.value}
                            alt="Uploaded Preview"
                            className="h-28 w-full object-contain"
                          />
                        ) : (
                          <div className="flex items-center gap-2 p-3 text-xs text-zinc-600 font-semibold truncate bg-white">
                            <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                            <span className="truncate">{field.value.split("/").pop()}</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleTextChange(field.id, "")}
                          className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-20 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 hover:bg-zinc-100 cursor-pointer transition">
                        <div className="flex flex-col items-center justify-center p-2 text-center">
                          {uploadingFieldId === field.id ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                              <span className="text-[10px] text-zinc-500 mt-1 font-semibold">{uploadProgress}%</span>
                            </div>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 text-zinc-400 mb-1" />
                              <span className="text-[10px] text-zinc-500 font-bold">Upload {field.type.replace("_field", "")}</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          accept={field.type === "image_field" ? "image/*" : (field.type === "audio_field" ? "audio/*" : (field.type === "video_field" ? "video/*" : "*/*"))}
                          disabled={uploadingFieldId !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(field.id, file, field.type);
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* Expose output handle */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={field.name}
                  style={
                    field.type === "text_field"
                      ? { backgroundColor: "#f59e0b", borderColor: "#f59e0b", borderWidth: "2px" }
                      : field.type === "image_field"
                      ? { backgroundColor: "#ec4899", borderColor: "#ec4899", borderWidth: "2px" }
                      : { backgroundColor: "#8b5cf6", borderColor: "#8b5cf6", borderWidth: "2px" }
                  }
                  className="!w-2 !h-2 hover:scale-125 transition-transform"
                />
              </div>
            );
          })
        )}
      </div>

      {/* Expanded Prompt Overlay Modal */}
      {expandedField && (
        <div className="fixed inset-0 z-[9999] bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-[640px] max-w-full h-[420px] flex flex-col animate-in scale-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <span className="text-sm font-bold text-zinc-800">{expandedField.name}</span>
              <button
                onClick={() => setExpandedFieldId(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Modal Textarea */}
            <div className="flex-1 p-4">
              <textarea
                value={expandedField.value}
                onChange={(e) => handleTextChange(expandedField.id, e.target.value)}
                placeholder="Type your prompt here..."
                className="w-full h-full text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none resize-none border border-zinc-100 rounded-xl p-3 bg-zinc-50/50 focus:border-zinc-300 transition"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
