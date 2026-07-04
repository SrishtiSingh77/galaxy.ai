import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
        <SignUp appearance={{
          elements: {
            formButtonPrimary: "bg-zinc-900 hover:bg-zinc-800 text-sm normal-case",
            card: "shadow-none border-none",
          }
        }} />
      </div>
    </div>
  );
}
