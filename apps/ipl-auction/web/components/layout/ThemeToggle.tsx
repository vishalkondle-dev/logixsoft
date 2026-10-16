"use client";

import React, { useEffect, useState } from "react";
import { ActionIcon, Tooltip, useMantineColorScheme, useComputedColorScheme } from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";

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
          <IconSun size={18} stroke={1.5} color="#ffd43b" />
        ) : (
          <IconMoon size={18} stroke={1.5} color="#4c6ef5" />
        )}
      </ActionIcon>
    </Tooltip>
  );
};
