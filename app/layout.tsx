import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Libre_Franklin } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"] });
const sans = Libre_Franklin({ variable: "--font-sans", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "600"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  const description = "An endless AI-generated menu of absurd, surreal, and suspiciously specific restaurant dishes.";
  return {
    title: "The Infinite Cheesecake Factory",
    description,
    icons: { icon: imageUrl },
    openGraph: {
      title: "The Infinite Cheesecake Factory",
      description,
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "An impossible cheesecake with a moon in orbit" }],
    },
    twitter: { card: "summary_large_image", title: "The Infinite Cheesecake Factory", description, images: [imageUrl] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
