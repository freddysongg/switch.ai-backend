import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').unique().notNull(),
  name: text('name'),
  hashedPassword: text('hashed_password'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const conversations = pgTable('conversations', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title'),
  category: text('category'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const messages = pgTable('messages', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  role: text('role').notNull(),
  category: text('category'),
  metadata: jsonb('metadata').default({}).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Vector embeddings for semantic search
export const messageEmbeddings = pgTable('message_embeddings', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  messageId: uuid('message_id')
    .notNull()
    .references(() => messages.id),
  embedding: jsonb('embedding').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Mechanical switch data table
export const switches = pgTable('switches', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  manufacturer: text('manufacturer').notNull(),
  type: text('type'),
  topHousing: text('top_housing'),
  bottomHousing: text('bottom_housing'),
  stem: text('stem'),
  mount: text('mount'),
  spring: text('spring'),
  actuationForce: real('actuation_force'),
  bottomForce: real('bottom_force'),
  preTravel: real('pre_travel'),
  totalTravel: real('total_travel'),
  embedding: jsonb('embedding').notNull(),
  fts: text('fts').$type<'tsvector'>()
});

export const vectorFromJson = (data: number[]) => sql`cast(${JSON.stringify(data)} as vector)`;

export const rateLimits = pgTable('rate_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  endpoint: text('endpoint').notNull(),
  count: integer('count').notNull().default(0),
  resetAt: timestamp('reset_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  eventType: text('event_type').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const health = pgTable('health', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: text('status').notNull().default('ok'),
  lastChecked: timestamp('last_checked').defaultNow().notNull()
});

export const arrayToVector = (arr: number[]) => sql`cast(${JSON.stringify(arr)} as vector)`;
export const jsonToVector = (jsonArr: string) => sql`cast(${jsonArr} as vector)`;
export const textToVector = (text: string) => sql`${text}::vector`;

export const cosineSimilarity = (embedding1: AnyPgColumn, embedding2: AnyPgColumn) =>
  sql`1 - (${embedding1}::vector <=> ${embedding2}::vector)`;
