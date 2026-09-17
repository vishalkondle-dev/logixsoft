import { AuthSessionSchema, AuthUserSchema } from '../schemas/auth';
import type { AuthSession, AuthUser } from '../types/auth';
import type { SessionRow, UserRow } from '../types/auth-schema';

/**
 * Better-auth flavored user/session objects (may carry Date instances
 * and omit fields). Cast loosely here — the schema validates the result.
 */
type SessionLike = Partial<Record<keyof SessionRow, unknown>> & {
  id?: unknown;
  userId?: unknown;
  expiresAt?: unknown;
};
type UserLike = Partial<Record<keyof UserRow, unknown>> & {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  emailVerified?: unknown;
  phoneNumber?: unknown;
  phoneNumberVerified?: unknown;
  image?: unknown;
  role?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/**
 * Build an AuthUser payload (validated against AuthUserSchema) from a DB
 * user row with optional better-auth session user + request overrides.
 * SSOT: every field name comes from the shared schema — no hand-rolled
 * response shapes in route handlers.
 */
export function toAuthUser(
  row: UserRow | null | undefined,
  sessionUser?: UserLike | null,
  overrides?: { name?: string; phoneNumber?: string }
): AuthUser {
  const s = sessionUser ?? {};
  return AuthUserSchema.parse({
    id: str(row?.id ?? s.id, ''),
    name: overrides?.name ?? str(row?.name ?? s.name, 'Guest User'),
    email: nullableStr(row?.email ?? s.email),
    emailVerified: bool(row?.emailVerified ?? s.emailVerified, false),
    phoneNumber: overrides?.phoneNumber ?? nullableStr(row?.phoneNumber ?? s.phoneNumber),
    phoneNumberVerified: bool(row?.phoneNumberVerified ?? s.phoneNumberVerified, false),
    image: nullableStr(row?.image ?? s.image),
    role: str(row?.role ?? s.role, 'CUSTOMER'),
    createdAt: toIso(row?.createdAt ?? s.createdAt),
    updatedAt: toIso(row?.updatedAt ?? s.updatedAt),
  });
}

/**
 * Build the full AuthSession payload. The session is a deliberate
 * projection — the raw session token never crosses the wire.
 */
export function toAuthSession(
  user: AuthUser,
  session?: SessionLike | null
): AuthSession {
  return AuthSessionSchema.parse({
    user,
    session: {
      id: str(session?.id, ''),
      userId: str(session?.userId, ''),
      expiresAt: toIso(session?.expiresAt),
    },
  });
}