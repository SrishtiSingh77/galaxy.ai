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
  ExternalLink,
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

  return (
    <div className="relative flex h-screen w-screen bg-[#fafafa] overflow-hidden select-none font-sans">
      {/* Left Sidebar */}
      <div className="flex w-[68px] flex-col items-center justify-between border-r border-[#e4e4e7] bg-white py-6 z-10 shrink-0">
        <div className="flex flex-col items-center gap-6 w-full">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white font-extrabold text-lg shadow-md transition hover:scale-105"
            title="Magica logo"
          >
            M
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
          
          {/* Hero Banner Card */}
          <div className="relative rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center overflow-hidden bg-gradient-to-br from-cyan-50/40 via-emerald-50/10 to-white min-h-[220px]">
            {/* Dot Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:16px_16px] opacity-60 pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-3 max-w-xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-bold text-zinc-600 shadow-sm">
                <span className="text-zinc-400">✨</span> All-in-One AI Platform
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-950">
                Welcome to Magica
              </h1>

              {/* Subtitle */}
              <p className="text-xs md:text-sm text-zinc-500 leading-relaxed max-w-md">
                Pick where you want to start — chat with an AI agent, build workflows, run models, or browse your library.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-3">
                <Link
                  href="/sign-in"
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-950 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-zinc-800 transition active:scale-98"
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

              {/* Bottom tag pill representation */}
              <div className="flex items-center gap-1.5 self-start mt-1 text-[10px] font-semibold bg-[#e8f5e9]/55 border border-[#c8e6c9] text-emerald-800 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Flow
              </div>
            </div>

            {/* Decorative Floating Nodes Widget on Right */}
            <div className="hidden md:block relative w-[280px] h-[160px] self-stretch select-none">
              {/* Connected Lines Grid SVG */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <line x1="200" y1="35" x2="110" y2="105" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="110" y1="105" x2="35" y2="35" stroke="#e2e8f0" strokeWidth="1.5" />
                <line x1="110" y1="105" x2="35" y2="135" stroke="#e2e8f0" strokeWidth="1.5" />
              </svg>

              {/* Chat pill */}
              <div className="absolute right-6 top-6 flex items-center gap-1 rounded-full border border-blue-100 bg-white px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Chat
              </div>

              {/* Flow pill */}
              <div className="absolute left-10 top-6 flex items-center gap-1 rounded-full border border-emerald-100 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-800 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Flow
              </div>

              {/* Library pill */}
              <div className="absolute right-12 bottom-6 flex items-center gap-1 rounded-full border border-pink-100 bg-white px-2 py-0.5 text-[10px] font-bold text-pink-800 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
                Library
              </div>

              {/* Model pill */}
              <div className="absolute left-16 bottom-6 flex items-center gap-1 rounded-full border border-amber-100 bg-white px-2 py-0.5 text-[10px] font-bold text-amber-800 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Model
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8 mt-12 max-w-4xl">
            {/* Chat */}
            <div className="flex flex-col gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
                <MessageSquare className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Chat</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Talk to an AI super-agent that runs workflows, generates content, and gets things done.
                </p>
              </div>
            </div>

            {/* Flow */}
            <div className="flex flex-col gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 shadow-sm">
                <Link2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Flow</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Build AI workflows visually — chain models, no code required.
                </p>
              </div>
            </div>

            {/* Nodes */}
            <div className="flex flex-col gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 border border-amber-100 text-amber-600 shadow-sm">
                <Layers className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Nodes</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Run any model directly — text, image, video, audio.
                </p>
              </div>
            </div>

            {/* Library */}
            <div className="flex flex-col gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-50 border border-pink-100 text-pink-600 shadow-sm">
                <Library className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Library</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Browse your generated images, videos, audio, and files.
                </p>
              </div>
            </div>

            {/* API · MCP */}
            <div className="flex flex-col gap-2.5 border-t border-zinc-100 pt-6 mt-2 col-span-1 md:col-span-2">
              <div className="flex items-start justify-between w-full">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600 shadow-sm shrink-0">
                    <BookOpen className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-950">API · MCP</h3>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      Use Magica from your code or an MCP-aware agent. Opens docs.
                    </p>
                  </div>
                </div>

                <a
                  href="https://github.com/SrishtiSingh77/galaxy.ai.git"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-zinc-700 transition self-center mr-2"
                >
                  External
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
