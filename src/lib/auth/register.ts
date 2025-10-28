import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function registerUser(
  email: string,
  password: string,
  name?: string
) {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name: name || null,
    })
    .returning();

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
  };
}
