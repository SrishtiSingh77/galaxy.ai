import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import CandidateLog from "@/components/CandidateLog";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
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
        <body className={`${jakarta.className} bg-[#fafafa] text-[#333333] antialiased`}>
          <CandidateLog />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
