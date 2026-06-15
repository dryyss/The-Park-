import type { Metadata } from "next";
import { Oswald, Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

// Titres : condensé/bold (esprit lettrage JDM)
const display = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Corps : lisible
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Japonais (option multilingue)
const jp = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "The Park — Trading Card Game",
  description:
    "Plateforme de collection, d'échange et de marketplace communautaire dédiée au TCG The Park (univers drift / JDM).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${display.variable} ${sans.variable} ${jp.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
