import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Customer Service",
  description: "Customer service assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <span className="text-sm font-semibold text-gray-800">Customer Service</span>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Assistant
          </Link>
          <Link href="/cases" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Case Library
          </Link>
          <Link href="/ssys" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            SSYS
          </Link>
          <Link href="/pending" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Pending SKUs
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
