"use client";

import React from "react";
import { Box } from "@mantine/core";

export interface VegNonVegIconProps {
  isNonVeg?: boolean;
  size?: number;
}

/**
 * Standard Indian FSSAI Veg / Non-Veg Indicator Icon
 * Matching the exact icon used across POS and Owner components:
 * - Veg: Green square border with solid green circular dot
 * - Non-Veg: Red square border with solid red circular dot
 */
export function VegNonVegIcon({ isNonVeg = false, size = 14 }: VegNonVegIconProps) {
  const color = isNonVeg ? "#c62828" : "#2e7d32";
  const dotSize = Math.max(5, Math.round(size * 0.42));

  return (
    <Box
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 3,
        border: `1.5px solid ${color}`,
        backgroundColor: "#ffffff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      title={isNonVeg ? "Non-Vegetarian" : "Vegetarian"}
      aria-label={isNonVeg ? "Non-Vegetarian" : "Vegetarian"}
    >
      <Box
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
    </Box>
  );
}
