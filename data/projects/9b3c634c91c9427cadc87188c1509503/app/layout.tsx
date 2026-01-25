import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "World Clock | Precise Global Time",
  description: "A beautiful world clock application showing time across different zones.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
