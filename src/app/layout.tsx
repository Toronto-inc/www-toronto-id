import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AgentProvider } from "./context/agent";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TorontoID",
  description: "Explore your city, connect with community, & own your digital presence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AgentProvider>
          {children}
        </AgentProvider>
      </body>
    </html>
  );
}
