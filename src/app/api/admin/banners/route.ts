import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getViewerUser } from "@/server/user/user.service";

async function assertAdmin() {
  const user = await getViewerUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return null;
  }
  return user;
}

export async function GET() {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const banners = await prisma.promoBanner.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json(banners);
}

export async function POST(req: Request) {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const banner = await prisma.promoBanner.create({
    data: {
      label: body.label ?? null,
      title: body.title,
      subtitle: body.subtitle ?? null,
      cta: body.cta ?? null,
      href: body.href,
      color: body.color ?? "#d81b60",
      position: body.position ?? "bottom-left",
      active: body.active ?? true,
      sortOrder: body.sortOrder ?? 0,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
    },
  });
  return NextResponse.json(banner, { status: 201 });
}
