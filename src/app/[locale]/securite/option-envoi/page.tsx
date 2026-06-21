import { setRequestLocale } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { ShippingOptionPicker } from "@/components/security/shipping-option-picker";

export const dynamic = "force-dynamic";

export default async function OptionEnvoiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAuthViewer(`/${locale}/securite/option-envoi`);

  return <ShippingOptionPicker />;
}
