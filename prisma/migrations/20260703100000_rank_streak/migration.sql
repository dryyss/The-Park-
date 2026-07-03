-- Présence quotidienne au top 3 du classement (succès « Roi de la Glisse »).
CREATE TABLE IF NOT EXISTS "RankStreak" (
    "userId" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "lastDayKey" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankStreak_pkey" PRIMARY KEY ("userId")
);
