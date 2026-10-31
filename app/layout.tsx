import type { Metadata } from "next";
import type { ReactNode } from "react";
import Navbar from "../components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Peer-to-Peer Micro-Scholarship Hub",
    template: "%s | Peer-to-Peer Micro-Scholarship Hub",
  },
  description:
    "Connect Sri Lankan students with micro-scholarship support and skill mentorship.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
