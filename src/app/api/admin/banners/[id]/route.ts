import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getViewerUser } from "@/server/user/user.service";

async function assertAdmin() {
  const user = await getViewerUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) return null;
  return user;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const banner = await prisma.promoBanner.update({
    where: { id },
    data: {
      ...(body.label !== undefined && { label: body.label }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.subtitle !== undefined && { subtitle: body.subtitle }),
      ...(body.cta !== undefined && { cta: body.cta }),
      ...(body.href !== undefined && { href: body.href }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.position !== undefined && { position: body.position }),
      ...(body.active !== undefined && { active: body.active }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.startAt !== undefined && { startAt: body.startAt ? new Date(body.startAt) : null }),
      ...(body.endAt !== undefined && { endAt: body.endAt ? new Date(body.endAt) : null }),
    },
  });
  return NextResponse.json(banner);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.promoBanner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
