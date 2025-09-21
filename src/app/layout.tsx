import type { Metadata } from "next";
import { GeistSans, GeistMono } from "geist/font";
import { Providers } from "./providers";
import AutoActivationChecker from "@/components/AutoActivationChecker";
import PageTransition from "@/components/PageTransition"; // Import the new component
import "./globals.css";

const geistSans = GeistSans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = GeistMono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zuno - NFT Launchpad",
  description: "Launch NFTs in minutes with Zuno's no-code NFT launchpad platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <AutoActivationChecker />
          {/* Site wrapper card to match mock: white panel with rounded corners */}
          <div className="m-4 md:m-6 lg:m-8 lg:mx-14">
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
              <PageTransition>{children}</PageTransition> {/* Wrap children with PageTransition */}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
