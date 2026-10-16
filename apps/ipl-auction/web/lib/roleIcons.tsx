import React from "react";
import { GiCricketBat, GiGloves } from "react-icons/gi";
import { FaBaseball } from "react-icons/fa6";

export function getRoleIcon(role?: string, size = 12) {
  if (!role) return <GiCricketBat size={size} />;
  const upper = role.toUpperCase();
  if (
    upper.includes("ALL-ROUNDER") ||
    upper.includes("ALL ROUNDER") ||
    upper.includes("ALL_ROUNDER") ||
    upper === "AR"
  ) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        <GiCricketBat size={size} />
        <FaBaseball size={Math.max(9, size - 2)} />
      </span>
    );
  }
  if (upper.includes("WICKET") || upper.includes("KEEPER") || upper === "WK") {
    return <GiGloves size={size} />;
  }
  if (upper.includes("BOWLER") || upper === "BOWL") {
    return <FaBaseball size={size} />;
  }
  return <GiCricketBat size={size} />;
}

export function getRoleMeta(role?: string) {
  if (!role) return { label: "BATTER", shortLabel: "BAT", color: "blue" };
  const upper = role.toUpperCase();
  if (
    upper.includes("ALL-ROUNDER") ||
    upper.includes("ALL ROUNDER") ||
    upper.includes("ALL_ROUNDER") ||
    upper === "AR"
  ) {
    return { label: "ALL-ROUNDER", shortLabel: "AR", color: "orange" };
  }
  if (upper.includes("WICKET") || upper.includes("KEEPER") || upper === "WK") {
    return { label: "WICKETKEEPER", shortLabel: "WK", color: "grape" };
  }
  if (upper.includes("BOWLER") || upper === "BOWL") {
    return { label: "BOWLER", shortLabel: "BOWL", color: "teal" };
  }
  return { label: "BATTER", shortLabel: "BAT", color: "blue" };
}
