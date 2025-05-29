import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { users } from '../db/schema';

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type UserColumns = Partial<User>;

export interface UserCreatePayload {
  email: string;
  name?: string | null;
}

export interface UserUpdatePayload {
  email?: string;
  name?: string | null;
}
