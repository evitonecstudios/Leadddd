import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.uid, uid),
    });

    if (existing) return existing;

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
