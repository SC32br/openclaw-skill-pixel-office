import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pixel Office — Live",
};

export default function StreamLayout({ children }: { children: React.ReactNode }) {
  return children;
}
