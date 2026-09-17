export * from '@logixsoft/helpers/db';
export * from '@logixsoft/logix-dine/schemas/auth-schema';
export * from '@logixsoft/logix-dine/schemas/pos-schema';

import { authSchema } from '@logixsoft/logix-dine/schemas/auth-schema';
import { posSchema } from '@logixsoft/logix-dine/schemas/pos-schema';

/** Combined drizzle schema for the entire app. */
export const appSchema = { ...authSchema, ...posSchema };
