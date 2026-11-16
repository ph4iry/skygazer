import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Fraunces, Space_Grotesk } from "next/font/google";
import React from 'react';

// self-hosted by next/font at build time, exposed as CSS variables for tailwind's font-display / font-body
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", style: ["normal", "italic"] });
const body = Space_Grotesk({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${display.variable} ${body.variable} font-body`}>
      <Component {...pageProps} />
    </div>
  );
}
