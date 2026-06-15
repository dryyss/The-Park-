import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function PanierRedirectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/boutique/panier", locale });
}
