import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Journal de connexion (obligation LCEN, CDC §5.3). Best-effort : une panne de
 * journalisation ne doit jamais casser le parcours utilisateur.
 */
export async function recordConnection(input: {
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  action?: string;
}): Promise<void> {
  try {
    await prisma.connectionLog.create({
      data: {
        userId: input.userId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        action: input.action ?? "LOGIN",
      },
    });
  } catch (err) {
    console.error("[connection-log] insert échoué", err);
  }
}

/** Purge LCEN : conservation 1 an des journaux de connexion (appelée par le cron). */
export async function purgeExpiredConnectionLogs(retentionDays = 365): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86400 * 1000);
  const { count } = await prisma.connectionLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
