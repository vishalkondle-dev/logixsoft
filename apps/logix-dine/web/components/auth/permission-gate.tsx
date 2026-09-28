"use client";

import React, { ReactNode } from "react";
import { usePermission } from "@/lib/restaurant-context";

interface PermissionGateProps {
  permission: string | string[];
  mode?: "all" | "any";
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders content if the active restaurant user has the required permission(s).
 */
export function PermissionGate({
  permission,
  mode = "all",
  fallback = null,
  children,
}: PermissionGateProps) {
  const allowed = usePermission(permission, mode);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
