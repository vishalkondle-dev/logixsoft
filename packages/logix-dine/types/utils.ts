/**
 * Type-level assertion helpers used to enforce that derived schemas
 * stay in sync with their source of truth (DB tables) at compile time.
 */

export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

export type Expect<T extends true> = T;

/**
 * Mutual-assignability check — a more robust variant of `Equal` for
 * structurally identical types where one side is an intersection or a
 * drizzle mapped type (strict `Equal` can spuriously report false there).
 * Wrap with `Expect<...>` at the call site to fail the build.
 */
export type AssertSame<X, Y> = [X] extends [Y] ? ([Y] extends [X] ? true : false) : false;