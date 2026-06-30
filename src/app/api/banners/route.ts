import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const banners = await prisma.promoBanner.findMany({
    where: {
      active: true,
      OR: [{ startAt: null }, { startAt: { lte: now } }],
      AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      label: true,
      title: true,
      subtitle: true,
      cta: true,
      href: true,
      color: true,
      position: true,
    },
  });
  return NextResponse.json(banners);
}
