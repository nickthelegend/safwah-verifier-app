import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import "./globals.css";
import SuiProvider from "../providers/SuiProvider";
import { Toaster } from "sonner";

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: "Safwah Verifier - Airport Validation Gateway",
  description: "Validate exit claims, scan tourist NFTs, approve USDC refunds, and export compliance reports for Planet Tax Free officers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">
        <SuiProvider>
          {children}
        </SuiProvider>
        <Toaster richColors position="top-center" theme="dark" />
      </body>
    </html>
  );
}
