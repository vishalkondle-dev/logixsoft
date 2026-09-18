"use client";

import React, { ReactNode } from "react";

export default function KitchenLayout({ children }: { children: ReactNode }) {
  // Full-screen dedicated layout — no AppShell nav/header. KDS is meant to
  // run on a tablet mounted in the kitchen, always on this one screen.
  return <div style={{ minHeight: "100dvh", background: "#1a1a1a" }}>{children}</div>;
}
