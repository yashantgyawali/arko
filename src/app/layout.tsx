import type { Metadata, Viewport } from "next";
import { Manrope, Patrick_Hand, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const patrickHand = Patrick_Hand({
  variable: "--font-patrick",
  subsets: ["latin"],
  weight: ["400"],
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "arko — everyone votes",
  description: "Everyone votes. The room decides what plays next.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // exposes env(safe-area-inset-*) so pinned controls clear the home indicator
  viewportFit: "cover",
  themeColor: "#FAF1E4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${patrickHand.variable} ${atkinson.variable}`}
    >
      <body>
        {children}
      </body>
    </html>
  );
}
