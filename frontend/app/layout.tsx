import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/context";
import SmoothScroll from "@/components/SmoothScroll";
import FloatingAIBubble from "@/components/FloatingAIBubble";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Smarter BlinkIt — AI Grocery Assistant",
  description: "Your AI-powered marketplace. Shop smarter with intent search, recipe agents, and local delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AppProvider>
          <SmoothScroll>
            {children}
            <FloatingAIBubble />
          </SmoothScroll>
        </AppProvider>
      </body>
    </html>
  );
}
