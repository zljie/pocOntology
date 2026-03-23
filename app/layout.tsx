import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ontology Design Simulator | Palantir-style Digital Twin Modeling",
  description: "A visual, graph-driven ontology design simulator that maps fragmented data assets into semantically logical digital twins.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
