import type { Metadata } from "next";
import { Anton, Hanken_Grotesk, Noto_Sans_JP } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Auth0Provider } from "@auth0/nextjs-auth0";
import { routing } from "@/i18n/routing";
import { AppShell } from "@/components/layout/app-shell";
import { ConnectionLogger } from "@/components/auth/connection-logger";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/JsonLd";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";
import "../globals.css";

// Titres : lettrage condensé JDM (Anton)
const display = Anton({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

// Corps : lisible
const sans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Japonais (touches JDM + option multilingue)
const jp = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "The Park — Trading Card Game",
    template: "%s | The Park",
  },
  description:
    "Plateforme de collection, d'échange et de marketplace communautaire dédiée au TCG The Park (univers drift / JDM).",
  keywords: [
    "The Park TCG",
    "trading card game",
    "cartes à collectionner",
    "marketplace cartes",
    "échange cartes",
    "JDM drift",
    "collection TCG",
  ],
  authors: [{ name: "The Park" }],
  openGraph: {
    type: "website",
    siteName: "The Park",
    title: "The Park — Trading Card Game",
    description:
      "Collectionnez, échangez et vendez vos cartes The Park. Marketplace, enchères et classements communautaires.",
    images: [{ url: DEFAULT_OG_IMAGE, alt: "The Park TCG" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Park — Trading Card Game",
    description: "Collection, échanges et marketplace pour le TCG The Park.",
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <head>
        <OrganizationJsonLd />
        <WebSiteJsonLd />
      </head>
      <body className={`${display.variable} ${sans.variable} ${jp.variable} antialiased`}>
        <Auth0Provider>
          <NextIntlClientProvider>
            <ConnectionLogger />
            <AppShell>{children}</AppShell>
          </NextIntlClientProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}
