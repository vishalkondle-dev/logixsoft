import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

export async function linkGuestToUser(
  d1: D1Database,
  guestSessionToken: string,
  authenticatedUserId: string
): Promise<{ success: boolean; linkedRoomsCount: number }> {
  const db = drizzle(d1, { schema });

  // 1. Find guest identity
  const guestRecords = await db
    .select()
    .from(schema.guestIdentities)
    .where(eq(schema.guestIdentities.sessionToken, guestSessionToken))
    .limit(1);

  if (guestRecords.length === 0) {
    return { success: false, linkedRoomsCount: 0 };
  }

  const guest = guestRecords[0];

  // 2. Transfer room creator ownership
  const roomsUpdated = await db
    .update(schema.roomMetadata)
    .set({
      creatorId: authenticatedUserId,
      creatorIsGuest: false,
    })
    .where(eq(schema.roomMetadata.creatorId, guest.id));

  // 3. Mark guest linked
  await db
    .update(schema.guestIdentities)
    .set({
      linkedUserId: authenticatedUserId,
    })
    .where(eq(schema.guestIdentities.id, guest.id));

  return {
    success: true,
    linkedRoomsCount: 1,
  };
}
