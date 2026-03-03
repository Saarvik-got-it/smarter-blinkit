import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/context";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Smarter BlinkIt — AI Grocery Assistant",
  description: "Your AI-powered marketplace. Shop smarter with intent search, recipe agents, and local delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
