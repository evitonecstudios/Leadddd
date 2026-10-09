import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    let existing = await db.query.users.findFirst({
      where: eq(users.uid, uid),
    });

    if (existing) return existing;

    // Check by email in case UID changed or account is shared
    existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      const [updated] = await db.update(users)
        .set({ uid, name: name || existing.name })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }

    // Link owner email variants (evitonecstudios@gmail.com / evitonec1@gmail.com) to account 12
    if (email && (email.startsWith('evitonec') || email.includes('evitonec'))) {
      const ownerUser = await db.query.users.findFirst({
        where: eq(users.id, 12),
      });
      if (ownerUser) {
        const [updated] = await db.update(users)
          .set({ uid, email, name: name || ownerUser.name })
          .where(eq(users.id, 12))
          .returning();
        return updated;
      }
    }

    const [newUser] = await db.insert(users).values({
      uid,
      email,
      name,
    }).returning();

    return newUser;
  } catch (error) {
    console.error('Failed to get or create user:', error);
    throw error;
  }
}
