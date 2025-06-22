import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { users } from '../db/schema.js';

export type User = InferSelectModel<typeof users>;

export interface NewUserPayload
  extends Omit<
    InferInsertModel<typeof users>,
    'id' | 'createdAt' | 'updatedAt' | 'hashedPassword'
  > {
  password?: string;
}

export interface NewUserWithHashedPassword
  extends Omit<InferInsertModel<typeof users>, 'id' | 'createdAt' | 'updatedAt'> {
  hashedPassword: string;
  role?: string;
}

export type UserColumns = Partial<User>;

export interface UserCreatePayload {
  email: string;
  name?: string | null;
  role?: string;
}

export interface UserUpdatePayload {
  email?: string;
  name?: string | null;
  role?: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  role?: string;
  name?: string | null;
}

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
}
