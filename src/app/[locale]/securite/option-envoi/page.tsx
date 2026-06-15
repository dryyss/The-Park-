import { renderSecurityPage } from "@/lib/security-page";

export const dynamic = "force-dynamic";

export default function OptionEnvoiPage({ params }: { params: Promise<{ locale: string }> }) {
  return renderSecurityPage(params, "option-envoi");
}
