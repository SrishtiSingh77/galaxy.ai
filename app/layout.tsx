import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import CandidateLog from "@/components/CandidateLog";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

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
        <body className={`${inter.className} bg-[#fafafa] text-[#333333] antialiased`}>
          <CandidateLog />
          <SmoothScroll>
            {children}
          </SmoothScroll>
        </body>
      </html>
    </ClerkProvider>
  );
}
