import Link from "next/link";
import { ArrowLeft, LayoutDashboard, Workflow } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#fafafa] px-6 text-center select-none">
      {/* Dot grid backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:18px_18px] opacity-50 pointer-events-none" />
      {/* Soft indigo glow */}
      <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/galaxy.png" alt="Galaxy" className="mb-10 h-7 w-auto object-contain opacity-90" />

        {/* Big 404 */}
        <h1 className="bg-gradient-to-b from-zinc-800 to-zinc-400 bg-clip-text text-[120px] font-extrabold leading-none tracking-tighter text-transparent md:text-[160px]">
          404
        </h1>

        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-150 bg-indigo-50 px-3 py-1 text-[11px] font-extrabold text-indigo-600 shadow-sm">
          <span className="text-indigo-400">✦</span> Lost in the flow
        </div>

        <h2 className="mt-6 text-2xl font-bold tracking-tight text-zinc-800">This page drifted off the canvas</h2>
        <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-zinc-500">
          The workflow, node, or page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 active:scale-95"
          >
            <LayoutDashboard className="h-4 w-4" />
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>
        </div>

        {/* Footer hint */}
        <div className="mt-10 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <Workflow className="h-3.5 w-3.5" />
          Build AI workflows, run models instantly
        </div>
      </div>
    </div>
  );
}
