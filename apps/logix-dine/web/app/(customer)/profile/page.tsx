"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Stack,
  TextInput,
  Group,
  Button,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuth } from "@/lib/auth-context";
import { useCustomer } from "@/lib/customer-context";
import { useUpdateCustomerProfile } from "@/lib/queries";
import { PortalProfileView } from "@/components/portal/views/portal-profile-view";

export default function CustomerProfilePage() {
  const { user, signOut } = useAuth();
  const { data, refetch } = useCustomer();
  const updateProfileMutation = useUpdateCustomerProfile();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const customer = data?.customer;

  useEffect(() => {
    if (customer) {
      setEditName(customer.name || "");
      setEditEmail(customer.email || "");
    } else if (user) {
      setEditName(user.name || "");
      setEditEmail(user.email || "");
    }
  }, [customer, user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfileMutation.mutateAsync({
        name: editName.trim(),
        email: editEmail.trim() || undefined,
      });
      notifications.show({
        title: "Profile Updated",
        message: "Your dining profile details have been saved.",
        color: "teal",
      });
      setIsEditModalOpen(false);
      refetch();
    } catch (err: any) {
      notifications.show({
        title: "Update Failed",
        message: err?.message || "Failed to update profile",
        color: "red",
      });
    }
  };

  return (
    <>
      <PortalProfileView
        data={data}
        onOpenEditModal={() => setIsEditModalOpen(true)}
        onSignOut={signOut}
      />

      {/* Edit Profile Modal */}
      <Modal
        opened={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={<Text fw={700}>Edit Customer Profile</Text>}
        radius="md"
        centered
        zIndex={1500}
      >
        <form onSubmit={handleUpdateProfile}>
          <Stack gap="md">
            <TextInput
              label="Full Name"
              placeholder="e.g. Vishal Kondle"
              required
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
            />
            <TextInput
              label="Email Address (Optional)"
              placeholder="e.g. name@example.com"
              type="email"
              description="For receiving digital invoices and billing updates."
              value={editEmail}
              onChange={(e) => setEditEmail(e.currentTarget.value)}
            />
            <TextInput
              label="Phone Number"
              disabled
              value={customer?.phone || user?.phoneNumber || ""}
              description="Phone number is verified and tied to your WhatsApp account."
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" size="xs" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button color="dinePrimary" size="xs" type="submit" loading={updateProfileMutation.isPending}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
