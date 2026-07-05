"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Folder,
  Layers,
  Bot,
  Settings,
  HelpCircle,
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
} from "lucide-react";

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

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
      <div className="flex w-[68px] flex-col items-center justify-between border-r border-[#e4e4e7] bg-white py-6 z-10 shrink-0">
        <div className="flex flex-col items-center gap-6 w-full">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white shadow-md transition hover:scale-105"
            title="Magica logo"
          >
            <svg viewBox="0 0 100 100" className="w-5 h-5 fill-none stroke-current" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 75 V28 Q20 22 25 24 L45 52" />
              <path d="M80 75 V28 Q80 22 75 24 L55 52" />
              <path d="M50 55 Q50 65 60 65 Q50 65 50 75 Q50 65 40 65 Q50 65 50 55 Z" fill="currentColor" stroke="none" />
            </svg>
          </Link>
          <div className="w-8 border-b border-[#f4f4f5]" />
          
          {/* Navigation Icons (styled but disabled on landing) */}
          <div className="flex flex-col gap-5 text-zinc-400">
            <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-50 hover:text-zinc-600 transition" disabled>
              <Plus className="h-5 w-5" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-50 hover:text-zinc-600 transition" disabled>
              <Search className="h-5 w-5" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-50 hover:text-zinc-600 transition" disabled>
              <MessageSquare className="h-5 w-5" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-50 hover:text-zinc-600 transition" disabled>
              <Folder className="h-5 w-5" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-50 hover:text-zinc-600 transition" disabled>
              <Library className="h-5 w-5" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-50 hover:text-zinc-600 transition" disabled>
              <Layers className="h-5 w-5" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-50 hover:text-zinc-600 transition" disabled>
              <BookOpen className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sign In Trigger Icon at bottom */}
        <Link
          href="/sign-in"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 transition-all"
          title="Sign In"
        >
          <LogIn className="h-5 w-5" />
        </Link>
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
