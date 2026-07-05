import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import CandidateLog from "@/components/CandidateLog";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Py - AI Workflow Builder",
  description: "A premium workflow builder for LLMs powered by React Flow and Gemini.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${outfit.className} bg-[#fafafa] text-[#1a1a1a] antialiased`}>
          <CandidateLog />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
