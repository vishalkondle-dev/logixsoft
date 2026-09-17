"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  Button,
  Stack,
  Text,
  Group,
  PinInput,
  ThemeIcon,
  ActionIcon,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBrandWhatsapp,
  IconArrowLeft,
  IconCheck,
  IconAlertCircle,
  IconDeviceMobile,
  IconUser,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { sendOtp, verifyOtp } from "@/lib/auth-client";
import { PhoneNumberSchema } from "@logixsoft/logix-dine/schemas/auth";

export function LoginModal() {
  const { isLoginModalOpen, closeLoginModal, setUser } = useAuth();

  // Modal Flow Step: 1 = Phone number input, 2 = OTP + Name (if new user)
  const [step, setStep] = useState<1 | 2>(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [userExists, setUserExists] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Reset state on modal close
  const handleClose = () => {
    closeLoginModal();
    setTimeout(() => {
      setStep(1);
      setPhoneNumber("");
      setName("");
      setOtp("");
      setErrorMessage(null);
      setIsLoading(false);
    }, 200);
  };

  // Step 1: Send OTP via WhatsApp
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    // Format phone number
    const trimmed = phoneNumber.trim();
    const digits = trimmed.replace(/\D/g, "");
    const formatted = digits.length === 10 ? `+91${digits}` : trimmed.startsWith("+") ? trimmed : `+${digits}`;

    const validation = PhoneNumberSchema.safeParse(formatted);
    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || "Invalid phone number");
      return;
    }

    setIsLoading(true);
    try {
      const res = await sendOtp(formatted);
      setUserExists(res.userExists);
      setPhoneNumber(formatted);
      setStep(2);
      setResendCooldown(30);

      notifications.show({
        title: "OTP Dispatched",
        message: "A 6-digit code has been sent to your WhatsApp",
        color: "green",
        icon: <IconBrandWhatsapp size={18} />,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to dispatch WhatsApp OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (otp.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code");
      return;
    }

    if (!userExists && !name.trim()) {
      setErrorMessage("Please enter your name to complete registration");
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyOtp({
        phoneNumber,
        otp,
        name: name.trim() ? name.trim() : undefined,
      });

      setUser(res.user);
      handleClose();

      notifications.show({
        title: userExists ? "Welcome Back!" : "Registration Complete!",
        message: `Signed in as ${res.user.name || phoneNumber}`,
        color: "dinePrimary",
        icon: <IconCheck size={18} />,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || "Invalid or expired verification code");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      opened={isLoginModalOpen}
      onClose={handleClose}
      centered
      size="sm"
      withCloseButton
      title={
        <Group gap="xs">
          <ThemeIcon size={30} radius="md" color="dinePrimary" variant="light">
            <IconBrandWhatsapp size={18} />
          </ThemeIcon>
          <Text fw={700} size="md">
            Logix Dine
          </Text>
        </Group>
      }
    >
      {errorMessage && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          variant="light"
          mb="md"
          title="Error"
          withCloseButton
          onClose={() => setErrorMessage(null)}
        >
          {errorMessage}
        </Alert>
      )}

      {step === 1 ? (
        <form onSubmit={handleSendOtp}>
          <Stack gap="md">
            <div>
              <Text fw={600} size="lg">
                Enter Mobile Number
              </Text>
              <Text size="xs" c="dimmed">
                We will send an OTP via WhatsApp for instant verification
              </Text>
            </div>

            <TextInput
              leftSection={<IconDeviceMobile size={18} />}
              placeholder="e.g. 9876543210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.currentTarget.value)}
              disabled={isLoading}
              required
              autoFocus
              label="Phone Number"
              description="Enter 10-digit mobile number"
            />

            <Button
              type="submit"
              color="dinePrimary"
              fullWidth
              loading={isLoading}
              leftSection={<IconBrandWhatsapp size={18} />}
            >
              Continue
            </Button>
          </Stack>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp}>
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="xs">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => {
                    setStep(1);
                    setOtp("");
                    setErrorMessage(null);
                  }}
                  disabled={isLoading}
                >
                  <IconArrowLeft size={16} />
                </ActionIcon>
                <Text fw={600} size="md">
                  {userExists ? "Enter OTP" : "Create Account"}
                </Text>
              </Group>
            </Group>

            <Text size="xs" c="dimmed">
              Code sent to WhatsApp on <b>{phoneNumber}</b>
            </Text>

            {/* Name is required if user does not exist yet */}
            {!userExists && (
              <TextInput
                label="Full Name"
                placeholder="Enter your name"
                leftSection={<IconUser size={18} />}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                disabled={isLoading}
                required
                autoFocus
              />
            )}

            <div>
              <Text size="sm" fw={500} mb={6}>
                Verification Code
              </Text>
              <Group justify="center">
                <PinInput
                  length={6}
                  type="number"
                  value={otp}
                  onChange={setOtp}
                  disabled={isLoading}
                  autoFocus={userExists}
                  size="md"
                />
              </Group>
            </div>

            <Button
              type="submit"
              color="dinePrimary"
              fullWidth
              loading={isLoading}
              disabled={otp.length !== 6 || (!userExists && !name.trim())}
            >
              Verify & Continue
            </Button>

            <Group justify="center">
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                onClick={() => handleSendOtp()}
                disabled={isLoading || resendCooldown > 0}
              >
                {resendCooldown > 0
                  ? `Resend OTP in ${resendCooldown}s`
                  : "Resend OTP via WhatsApp"}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
