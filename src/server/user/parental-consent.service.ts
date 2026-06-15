import "server-only";
import { prisma } from "@/lib/prisma";

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function requestParentalConsent(
  userId: string,
  guardianEmail: string,
  guardianName?: string,
): Promise<{ token: string }> {
  const token = randomToken();
  await prisma.parentalConsent.upsert({
    where: { userId },
    create: { userId, guardianEmail, guardianName: guardianName ?? null, token, method: "email" },
    update: { guardianEmail, guardianName: guardianName ?? null, token, verifiedAt: null },
  });
  return { token };
}

export async function verifyParentalConsent(token: string): Promise<boolean> {
  const consent = await prisma.parentalConsent.findUnique({ where: { token } });
  if (!consent) return false;

  await prisma.parentalConsent.update({
    where: { id: consent.id },
    data: { verifiedAt: new Date() },
  });
  await prisma.user.update({
    where: { id: consent.userId },
    data: { status: "ACTIVE" },
  });
  return true;
}
