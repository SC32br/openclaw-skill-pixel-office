import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pixel Office — Live",
  description: "Виртуальный пиксельный офис AI-агентов проекта «Pixel Office».",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className="antialiased min-h-screen bg-[#0f1117] text-[#e4e6f0]">
        {children}
      </body>
    </html>
  );
}
