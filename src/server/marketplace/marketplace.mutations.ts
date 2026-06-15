import "server-only";
import { prisma } from "@/lib/prisma";
import type { ListingType } from "@/generated/prisma/client";

/** Publie une annonce marketplace — uniquement sur une variante possédée. */
export async function publishListing(
  sellerId: string,
  input: {
    variantId: string;
    type: ListingType;
    price?: number;
    description?: string;
  },
): Promise<string> {
  const item = await prisma.collectionItem.findFirst({
    where: { userId: sellerId, variantId: input.variantId, quantity: { gt: 0 } },
    select: { id: true, quantity: true, reservedQuantity: true, condition: true },
  });
  if (!item) throw new Error("NOT_OWNED");
  if (item.reservedQuantity >= item.quantity) throw new Error("ALL_RESERVED");

  const listing = await prisma.$transaction(async (tx) => {
    await tx.collectionItem.update({
      where: { id: item.id },
      data: { reservedQuantity: { increment: 1 }, forSale: true },
    });

    return tx.listing.create({
      data: {
        sellerId,
        variantId: input.variantId,
        type: input.type,
        status: "ACTIVE",
        price: input.price ?? null,
        condition: item.condition,
        quantity: 1,
        description: input.description ?? null,
      },
    });
  });

  return listing.id;
}
