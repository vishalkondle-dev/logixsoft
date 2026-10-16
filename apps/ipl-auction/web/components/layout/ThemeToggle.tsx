"use client";

import React, { useEffect, useState } from "react";
import { ActionIcon, Tooltip, useMantineColorScheme, useComputedColorScheme } from "@mantine/core";
import { Sun, Moon } from "@phosphor-icons/react";

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className }) => {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("dark", { getInitialValueInEffect: true });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <ActionIcon variant="default" size="md" radius="md" disabled />;
  }

  const isDark = computedColorScheme === "dark";

  return (
    <Tooltip label={isDark ? "Switch to light mode" : "Switch to dark mode"} withArrow position="bottom">
      <ActionIcon
        variant="default"
        size="md"
        radius="md"
        onClick={() => setColorScheme(isDark ? "light" : "dark")}
        aria-label="Toggle theme"
        className={className}
      >
        {isDark ? (
          <Sun size={18} weight="bold" color="#ffd43b" />
        ) : (
          <Moon size={18} weight="bold" color="#4c6ef5" />
        )}
      </ActionIcon>
    </Tooltip>
  );
};
