"use client";

import React from "react";
import Link from "next/link";
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Group,
  Stack,
  Button,
  Badge,
  ThemeIcon,
  Box,
  Divider,
} from "@mantine/core";
import {
  IconBrandWindows,
  IconBrandApple,
  IconBrandUbuntu,
  IconBrandAndroid,
  IconDownload,
  IconArrowLeft,
  IconCheck,
  IconDeviceDesktop,
  IconDeviceMobile,
} from "@tabler/icons-react";

interface DownloadOption {
  os: string;
  icon: React.ComponentType<{ size?: number | string }>;
  color: string;
  tag: string;
  description: string;
  downloads: {
    label: string;
    sublabel: string;
    size: string;
    url: string;
    badge?: string;
  }[];
}

const DOWNLOAD_OPTIONS: DownloadOption[] = [
  {
    os: "Windows",
    icon: IconBrandWindows,
    color: "blue",
    tag: "Windows 10 / 11",
    description: "Desktop POS Terminal with local receipt printing, thermal kitchen routing, and cashier shift management.",
    downloads: [
      {
        label: "Download for Windows 64-bit",
        sublabel: "Intel & AMD Processors (x64)",
        size: "108 MB",
        url: "https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/windows/LogixDine-Windows-x64.zip",
        badge: "Most Popular",
      },
      {
        label: "Download for Windows ARM64",
        sublabel: "Surface Pro & Snapdragon Windows PCs",
        size: "112 MB",
        url: "https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/windows/LogixDine-Windows-arm64.zip",
      },
    ],
  },
  {
    os: "macOS",
    icon: IconBrandApple,
    color: "gray",
    tag: "macOS 12+",
    description: "Native macOS application designed for high-resolution Retina displays, Mac mini counter setups, and MacBook managers. (Note: Run 'xattr -cr /Applications/Logix\\ Dine.app' in Terminal if macOS Gatekeeper flags it on first launch).",
    downloads: [
      {
        label: "Download for Apple Silicon",
        sublabel: "M1, M2, M3, M4 Macs",
        size: "224 MB",
        url: "https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/macos/LogixDine-macOS-AppleSilicon-arm64.zip",
        badge: "Apple Silicon",
      },
      {
        label: "Download for Intel Mac",
        sublabel: "Legacy Intel-based Macs (x64)",
        size: "230 MB",
        url: "https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/macos/LogixDine-macOS-Intel-x64.zip",
      },
    ],
  },
  {
    os: "Linux",
    icon: IconBrandUbuntu,
    color: "orange",
    tag: "Universal Linux & Raspberry Pi",
    description: "AppImage standalone binaries and native Debian/Ubuntu packages for POS kiosks and touchscreen counter setups.",
    downloads: [
      {
        label: "Download AppImage (x64)",
        sublabel: "Universal standalone binary for all 64-bit Linux distros",
        size: "103 MB",
        url: "https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/linux/LogixDine-Linux-x64.AppImage",
        badge: "AppImage",
      },
      {
        label: "Download AppImage (ARM64)",
        sublabel: "For Raspberry Pi 4/5 & ARM64 Linux touch kiosks",
        size: "104 MB",
        url: "https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/linux/LogixDine-Linux-arm64.AppImage",
      },
      {
        label: "Download Debian / Ubuntu (amd64 .deb)",
        sublabel: "Native package installable via dpkg / apt",
        size: "81 MB",
        url: "https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/linux/LogixDine-Ubuntu-Debian-amd64.deb",
      },
      {
        label: "Download Debian / Ubuntu (arm64 .deb)",
        sublabel: "Native package for ARM64 Ubuntu / Debian",
        size: "80 MB",
        url: "https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/linux/LogixDine-Ubuntu-Debian-arm64.deb",
      },
    ],
  },
  {
    os: "Android",
    icon: IconBrandAndroid,
    color: "teal",
    tag: "Android 8.0+",
    description: "Native mobile and tablet APK for Waiter order taking, Kitchen KDS displays, and Handheld POS terminals.",
    downloads: [
      {
        label: "Download Android APK",
        sublabel: "Direct installable APK for Phones, Tablets & POS Hardware",
        size: "30 MB",
        url: "https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/android/LogixDine-Android-debug.apk",
        badge: "Universal APK",
      },
    ],
  },
];

export default function DownloadPage() {
  return (
    <Box bg="#0a0a0f" style={{ minHeight: "100vh", color: "white" }} py={60}>
      <Container size="lg">
        {/* Back Link */}
        <Group mb={36}>
          <Button
            component={Link}
            href="/"
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<IconArrowLeft size={16} />}
            style={{ color: "#adb5bd" }}
          >
            Back to Home
          </Button>
        </Group>

        {/* Header */}
        <Box ta="center" mb={56}>
          <Badge
            size="lg"
            variant="filled"
            color="violet"
            radius="xl"
            mb="md"
            style={{ textTransform: "uppercase", letterSpacing: "1px" }}
          >
            Native Desktop & Mobile Apps
          </Badge>
          <Title
            order={1}
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              letterSpacing: "-1px",
              lineHeight: 1.15,
            }}
          >
            Download Logix Dine for Your Operating System
          </Title>
          <Text size="lg" c="#adb5bd" mt="md" style={{ maxWidth: 680, margin: "16px auto 0" }}>
            Ultra-fast keyboard POS, background thermal printer routing, and offline-resilient dining operations on any hardware device.
          </Text>
        </Box>

        {/* Download Grid */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          {DOWNLOAD_OPTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.os}
                p="xl"
                radius="lg"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(20px)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <Group justify="space-between" align="center" mb="md">
                    <Group gap="sm">
                      <ThemeIcon size={46} radius="md" color={item.color} variant="light">
                        <Icon size={26} />
                      </ThemeIcon>
                      <div>
                        <Title order={3} c="white" style={{ fontSize: 20 }}>
                          {item.os}
                        </Title>
                        <Text size="xs" c="#868e96">
                          {item.tag}
                        </Text>
                      </div>
                    </Group>
                  </Group>

                  <Text size="sm" c="#ced4da" mb="xl" style={{ lineHeight: 1.6 }}>
                    {item.description}
                  </Text>
                </div>

                <Stack gap="sm">
                  {item.downloads.map((dl) => (
                    <Button
                      key={dl.label}
                      component="a"
                      href={dl.url}
                      download
                      size="md"
                      radius="md"
                      color={item.color}
                      variant={dl.badge ? "filled" : "light"}
                      fullWidth
                      leftSection={<IconDownload size={18} />}
                      style={{
                        height: 52,
                        justifyContent: "flex-start",
                        textAlign: "left",
                      }}
                    >
                      <Group justify="space-between" style={{ width: "100%" }} wrap="nowrap">
                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Text size="sm" fw={600} lineClamp={1}>
                            {dl.label}
                          </Text>
                          <Text size="11px" opacity={0.8} lineClamp={1}>
                            {dl.sublabel}
                          </Text>
                        </Box>
                        <Badge size="xs" variant="outline" color={dl.badge ? "white" : item.color} ml="xs">
                          {dl.size}
                        </Badge>
                      </Group>
                    </Button>
                  ))}
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>

        {/* Feature Highlights */}
        <Box mt={64} p="xl" style={{ borderRadius: 16, backgroundColor: "rgba(175, 115, 215, 0.08)", border: "1px solid rgba(175, 115, 215, 0.2)" }}>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon size={32} radius="xl" color="violet" variant="light">
                <IconCheck size={18} />
              </ThemeIcon>
              <div>
                <Text fw={700} size="sm" c="white">Zero Cloud Disconnects</Text>
                <Text size="xs" c="#adb5bd" mt={2}>
                  Runs sub-second local order queues and caches live tables even when internet flutters.
                </Text>
              </div>
            </Group>
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon size={32} radius="xl" color="violet" variant="light">
                <IconDeviceDesktop size={18} />
              </ThemeIcon>
              <div>
                <Text fw={700} size="sm" c="white">Thermal Printing Engine</Text>
                <Text size="xs" c="#adb5bd" mt={2}>
                  Direct ESC/POS network and USB thermal printing with auto-cut and split KOT routing.
                </Text>
              </div>
            </Group>
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon size={32} radius="xl" color="violet" variant="light">
                <IconDeviceMobile size={18} />
              </ThemeIcon>
              <div>
                <Text fw={700} size="sm" c="white">Syncs Across All Devices</Text>
                <Text size="xs" c="#adb5bd" mt={2}>
                  Instant live order synchronization between desktop counters, waiter phones, and kitchen displays.
                </Text>
              </div>
            </Group>
          </SimpleGrid>
        </Box>
      </Container>
    </Box>
  );
}
