import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GRC Platform",
  description: "AI-native GRC platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
