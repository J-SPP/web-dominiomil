import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import AnalyticsTracker from "../components/AnalyticsTracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SPP Labs | Specialized Platform Pipelines",
  description: "SaaS automation, containerization platforms, and high-performance cloud pipelines.",
};

export default function RootLayout({ children }) {
  const apiKey = process.env.API_KEY || "";
  const apiUrl = process.env.API_URL || "";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Script
          src="/tracker.js"
          strategy="afterInteractive"
          data-api-key={apiKey}
          data-api-url={apiUrl}
          data-auto-track="false"
        />
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
      </body>
    </html>
  );
}
