"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Folder,
  MessageSquare,
  Link2,
  Library,
  BookOpen,
  ArrowRight,
  LogIn,
  Search,
  Plus,
  Zap,
  Play,
  Sparkles,
  GitBranch,
  Boxes,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { label: "New task", icon: Plus },
    { label: "Search tasks", icon: Search },
    { label: "Tasks", icon: MessageSquare },
    { label: "Projects", icon: Folder },
    { label: "Library", icon: Library },
    { label: "Flow", icon: GitBranch, active: true },
    { label: "Tools", icon: Boxes },
    { label: "API and MCP", icon: BookOpen },
  ];

  // If user is already signed in, redirect them directly to dashboard
  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  const templates = [
    {
      title: "AI Image Generator",
      desc: "Generate stunning images from text prompts using state-of-the-art models.",
      icon: Sparkles,
      highlighted: false,
    },
    {
      title: "Video Creator",
      desc: "Create AI-powered videos from scripts, images, or text descriptions.",
      icon: Sparkles,
      highlighted: true,
    },
    {
      title: "Content Writer",
      desc: "Generate blog posts, marketing copy, and social media content.",
      icon: Sparkles,
      highlighted: false,
    },
    {
      title: "Audio Transcriber",
      desc: "Transcribe audio files to text with high accuracy using Whisper.",
      icon: Sparkles,
      highlighted: false,
    },
    {
      title: "Image Upscaler",
      desc: "Enhance and upscale images up to 4x while preserving detail.",
      icon: Sparkles,
      highlighted: false,
    },
    {
      title: "Generate Audio",
      desc: "Generate audio — speech, music, sound effects, and more.",
      icon: Sparkles,
      highlighted: false,
    },
  ];

  return (
    <div className="relative flex h-screen w-screen bg-[#fafafa] overflow-hidden select-none">
      {/* Left Sidebar */}
      <div
        className={`flex flex-col justify-between border-r border-[#e4e4e7] bg-white shrink-0 overflow-hidden z-10 transition-[width] duration-300 ease-in-out ${
          sidebarOpen ? "w-[240px]" : "w-[72px]"
        }`}
      >
        <div className="flex flex-col">
          {/* Brand */}
          <div className={`flex items-center py-4 ${sidebarOpen ? "justify-between px-5" : "justify-center px-2"}`}>
            {sidebarOpen && (
              <Link href="/" title="Galaxy">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/galaxy.png" alt="Galaxy" className="h-6 w-auto object-contain" />
              </Link>
            )}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          </div>

          {/* Nav — links to sign-in on the landing page */}
          <nav className="flex flex-col gap-0.5 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href="/sign-in"
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
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sign In at bottom */}
        <div className="border-t border-[#f4f4f5] p-3">
          <Link
            href="/sign-in"
            title="Sign In"
            className={`flex items-center gap-3 rounded-lg py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition ${
              sidebarOpen ? "px-3" : "px-0 justify-center"
            }`}
          >
            <LogIn className="h-[18px] w-[18px] shrink-0" />
            {sidebarOpen && "Sign In"}
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-10 overflow-y-auto bg-white/40">
        <div className="max-w-5xl mx-auto w-full">
          
          {/* Header Bar */}
          <div className="flex justify-between items-center w-full border-b border-zinc-100 pb-5">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-zinc-800">Flow</h1>
              <p className="text-xs text-zinc-400 mt-0.5">Build workflows or run models directly.</p>
            </div>
            {/* Top Right Header Login shortcut */}
            <Link
              href="/sign-in"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#333333] text-white hover:bg-[#444444] transition shadow-sm"
              title="Sign In"
            >
              <LogIn className="h-4 w-4" />
            </Link>
          </div>

          {/* Hero Banner Card */}
          <div className="relative rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm flex flex-col justify-center items-start mt-6 w-full overflow-hidden min-h-[220px]">
            {/* Dot Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-2.5 max-w-3xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-indigo-150 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-600 shadow-sm">
                <span className="text-indigo-400">✨</span> All-in-One AI Platform
              </div>

              {/* Title */}
              <h2 className="text-3xl md:text-[44px] font-bold tracking-[-0.03em] text-zinc-700 mt-2 leading-tight md:leading-[1.05]">
                Build AI workflows,<br />run models instantly
              </h2>

              {/* Subtitle */}
              <p className="text-xs text-zinc-500 leading-relaxed max-w-lg mt-1 font-medium">
                Connect AI models into powerful automated workflows. Text, image, video, audio — all in one place with no code required.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-4">
                <Link
                  href="/sign-in"
                  className="flex items-center gap-1.5 rounded-lg bg-[#333333] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#444444] transition active:scale-98"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign in to get started
                </Link>
                <Link
                  href="/sign-up"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:bg-zinc-50 transition active:scale-98"
                >
                  Create free account
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Three Column Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {/* Visual Workflow Builder */}
            <div className="flex flex-col p-5 bg-white border border-zinc-150 rounded-2xl shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
                <Link2 className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xs font-extrabold text-zinc-800 mt-4">Visual Workflow Builder</h3>
              <p className="text-[10.5px] text-zinc-500 mt-1.5 leading-relaxed font-medium">
                Drag-and-drop canvas to chain AI models together. No coding needed.
              </p>
            </div>

            {/* Run Models Directly */}
            <div className="flex flex-col p-5 bg-white border border-zinc-150 rounded-2xl shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
                <Play className="h-4 w-4 fill-indigo-600" />
              </div>
              <h3 className="text-xs font-extrabold text-zinc-800 mt-4">Run Models Directly</h3>
              <p className="text-[10.5px] text-zinc-500 mt-1.5 leading-relaxed font-medium">
                Access 100+ AI models for text, image, video, and audio — all from one playground.
              </p>
            </div>

            {/* API Access */}
            <div className="flex flex-col p-5 bg-white border border-zinc-150 rounded-2xl shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
                <Zap className="h-4 w-4 fill-indigo-600 text-indigo-600" />
              </div>
              <h3 className="text-xs font-extrabold text-zinc-800 mt-4">API Access</h3>
              <p className="text-[10.5px] text-zinc-500 mt-1.5 leading-relaxed font-medium">
                Run any workflow via API. Manage keys and rate limits.
              </p>
            </div>
          </div>

          {/* Popular Workflows templates */}
          <div className="mt-10 mb-8">
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-zinc-800">Popular Workflows</h3>
              <p className="text-[10.5px] text-zinc-400 mt-0.5">Sign in to explore and use pre-built templates.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-5">
              {templates.map((tmpl) => {
                const Icon = tmpl.icon;
                return (
                  <Link
                    key={tmpl.title}
                    href="/sign-in"
                    className={`flex flex-col p-5 bg-white border rounded-2xl transition cursor-pointer shadow-sm hover:-translate-y-0.5 hover:shadow-md duration-200 ${
                      tmpl.highlighted
                        ? "border-zinc-150 hover:border-indigo-600 hover:ring-2 hover:ring-indigo-500/10"
                        : "border-zinc-150 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-600">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <h4 className="text-xs font-extrabold text-zinc-800 mt-4">{tmpl.title}</h4>
                    <p className="text-[10.5px] text-zinc-500 mt-1.5 leading-relaxed font-medium">
                      {tmpl.desc}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
