"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box, Title, Text, Table, Badge, Button, Loader, Center, Select,
  ScrollArea, Group, Stack, Card, SimpleGrid, TextInput, ActionIcon,
  Modal, Drawer, Menu, Alert, Divider, Textarea, Tooltip, Paper,
  NumberInput, Switch, AppShell, Burger, NavLink, Avatar,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingStore, IconUsers, IconShieldLock, IconPlus, IconRefresh,
  IconEdit, IconTrash, IconLogin, IconCheck, IconAlertCircle, IconChartBar,
  IconReceipt, IconCurrencyRupee, IconSearch, IconDotsVertical, IconPower,
  IconDatabase, IconUserPlus, IconTableAlias, IconToolsKitchen2,
  IconBook, IconPackages, IconMotorbike, IconTruckDelivery,
  IconStar, IconCalendarEvent, IconUserCheck, IconReceiptTax,
  IconCreditCard, IconLayoutDashboard, IconEye, IconBan, IconArrowLeft,
  IconLogout, IconDeviceFloppy,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

export type AdminTab =
  | "overview"
  | "restaurants"
  | "outlets"
  | "users"
  | "subscriptions"
  | "orders"
  | "menu"
  | "tables"
  | "inventory"
  | "delivery"
  | "customers"
  | "reservations"
  | "feedback"
  | "system";

export default function AdminPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { setActiveRestaurant, setActiveOutlet } = useRestaurant();
  const router = useRouter();

  // Navigation & Shell State
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedRestFilter, setSelectedRestFilter] = useState<string>("ALL");

  // Global Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data States
  const [metrics, setMetrics] = useState<any>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals & Drawers
  const [createRestOpened, setCreateRestOpened] = useState(false);
  const [editRestOpened, setEditRestOpened] = useState(false);
  const [selectedRest, setSelectedRest] = useState<any>(null);
  const [deleteRestModalOpened, setDeleteRestModalOpened] = useState(false);
  const [restToDelete, setRestToDelete] = useState<any>(null);

  const [createOutletOpened, setCreateOutletOpened] = useState(false);
  const [editOutletOpened, setEditOutletOpened] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<any>(null);

  const [createUserOpened, setCreateUserOpened] = useState(false);
  const [editUserOpened, setEditUserOpened] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [viewOrderOpened, setViewOrderOpened] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [voidOrderOpened, setVoidOrderOpened] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const [createItemOpened, setCreateItemOpened] = useState(false);
  const [editItemOpened, setEditItemOpened] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const [createTableOpened, setCreateTableOpened] = useState(false);
  const [editTableOpened, setEditTableOpened] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);

  const [createInvOpened, setCreateInvOpened] = useState(false);
  const [editInvOpened, setEditInvOpened] = useState(false);
  const [selectedInv, setSelectedInv] = useState<any>(null);

  const [createResvOpened, setCreateResvOpened] = useState(false);
  const [replyFeedbackOpened, setReplyFeedbackOpened] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [feedbackReplyText, setFeedbackReplyText] = useState("");

  const [purgeModalOpened, setPurgeModalOpened] = useState(false);
  const [purgeTargetRestId, setPurgeTargetRestId] = useState("");

  // SQL Runner State
  const [sqlQuery, setSqlQuery] = useState('SELECT id, name, "phoneNumber", role FROM "user" LIMIT 5;');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlRunning, setSqlRunning] = useState(false);

  // Forms
  const [createRestForm, setCreateRestForm] = useState({
    name: "", address: "", phone: "", currency: "INR", status: "ACTIVE",
    ownerPhone: "", ownerName: "", outletName: "Main Branch",
  });
  const [editRestForm, setEditRestForm] = useState({
    name: "", address: "", phone: "", currency: "INR", status: "ACTIVE", ownerPhone: "",
  });
  const [createOutletForm, setCreateOutletForm] = useState({
    restaurantId: "", name: "", address: "", phone: "", upiId: "",
  });
  const [createUserForm, setCreateUserForm] = useState({
    phoneNumber: "", name: "", email: "", role: "CUSTOMER",
  });
  const [editUserForm, setEditUserForm] = useState({
    name: "", phoneNumber: "", email: "", role: "CUSTOMER",
  });
  const [itemForm, setItemForm] = useState({
    restaurantId: "", categoryId: "", name: "", pricePaise: 25000, description: "", available: true,
  });
  const [tableForm, setTableForm] = useState({
    restaurantId: "", outletId: "", name: "", section: "Main Floor", capacity: 4,
  });
  const [invForm, setInvForm] = useState({
    restaurantId: "", outletId: "", name: "", sku: "", category: "GENERAL", baseUom: "kg",
    currentStock: 10, lowStockThreshold: 5, costPerBaseUnitPaise: 5000,
  });
  const [resvForm, setResvForm] = useState({
    restaurantId: "", outletId: "", guestName: "", guestPhone: "", partySize: 2,
    reservationDate: new Date().toISOString().split("T")[0], startTime: "19:00", notes: "",
  });

  // ─── Auth Guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (user as any)?.role !== "ADMIN") {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  // ─── Data Fetching ──────────────────────────────────────────────────────────
  const fetchAllData = useCallback(async (isSilent = false) => {
    if ((user as any)?.role !== "ADMIN") return;
    if (!isSilent) setRefreshing(true);
    try {
      const q = selectedRestFilter !== "ALL" ? `?restaurantId=${selectedRestFilter}` : "";
      const [
        mRes, rRes, oRes, uRes, ordRes, itRes, catRes, tblRes, invRes, delRes, custRes, resvRes, fbRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/admin/metrics`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/restaurants`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/outlets`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/users`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/orders${q}`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/menu/items${q}`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/menu/categories${q}`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/tables${q}`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/inventory${q}`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/delivery${q}`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/customers`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/reservations${q}`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/feedback${q}`, { credentials: "include" }),
      ]);

      if (mRes.ok) setMetrics(await mRes.json());
      if (rRes.ok) setRestaurants(await rRes.json());
      if (oRes.ok) setOutlets(await oRes.json());
      if (uRes.ok) setUsers(await uRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
      if (itRes.ok) setMenuItems(await itRes.json());
      if (catRes.ok) setMenuCategories(await catRes.json());
      if (tblRes.ok) setTables(await tblRes.json());
      if (invRes.ok) setInventory(await invRes.json());
      if (delRes.ok) setDeliveries(await delRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (resvRes.ok) setReservations(await resvRes.json());
      if (fbRes.ok) setFeedback(await fbRes.json());
    } catch (err: any) {
      notifications.show({ title: "Failed to load admin telemetry", message: err.message, color: "red" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedRestFilter]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ─── Quick Actions ──────────────────────────────────────────────────────────
  const handleEnterStore = (r: any) => {
    const storeOutlet = outlets.find((o) => o.restaurantId === r.id);
    setActiveRestaurant(r.id);
    if (storeOutlet) {
      setActiveOutlet(storeOutlet.id);
    }
    notifications.show({
      title: "Switched to Store",
      message: `Operating as Superadmin in store: ${r.name}`,
      color: "teal",
      icon: <IconCheck size={16} />,
    });
    router.push(`/pos${storeOutlet ? `?outletId=${storeOutlet.id}` : ""}`);
  };

  // ─── CRUD Handlers ──────────────────────────────────────────────────────────

  // Restaurant CRUD
  const handleCreateRestaurant = async () => {
    if (!createRestForm.name || !createRestForm.address || !createRestForm.ownerPhone) {
      notifications.show({ title: "Required Fields", message: "Name, address, and owner phone are required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(createRestForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Creation failed");
      notifications.show({ title: "Store Created", message: `Provisioned ${createRestForm.name}`, color: "teal", icon: <IconCheck size={16} /> });
      setCreateRestOpened(false);
      setCreateRestForm({ name: "", address: "", phone: "", currency: "INR", status: "ACTIVE", ownerPhone: "", ownerName: "", outletName: "Main Branch" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditRestaurant = async () => {
    if (!selectedRest) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants/${selectedRest.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(editRestForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Update failed");
      notifications.show({ title: "Updated", message: "Store details updated.", color: "teal" });
      setEditRestOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRestaurant = async () => {
    if (!restToDelete) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants/${restToDelete.id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message || "Delete failed");
      notifications.show({ title: "Deleted", message: `Store ${restToDelete.name} removed.`, color: "teal" });
      setDeleteRestModalOpened(false);
      setRestToDelete(null);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Outlet CRUD
  const handleCreateOutlet = async () => {
    if (!createOutletForm.restaurantId || !createOutletForm.name) {
      notifications.show({ title: "Required Fields", message: "Select restaurant and enter outlet name.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants/${createOutletForm.restaurantId}/outlets`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(createOutletForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Outlet creation failed");
      notifications.show({ title: "Outlet Added", message: `Added ${createOutletForm.name}`, color: "teal" });
      setCreateOutletOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOutlet = async (outletId: string) => {
    if (!confirm("Delete this outlet?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/outlets/${outletId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to delete");
      notifications.show({ title: "Deleted", message: "Outlet removed.", color: "teal" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // User CRUD
  const handleCreateUser = async () => {
    if (!createUserForm.phoneNumber) {
      notifications.show({ title: "Validation", message: "Phone number required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(createUserForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to create user");
      notifications.show({ title: "User Created", message: `Provisioned user ${createUserForm.phoneNumber}`, color: "teal" });
      setCreateUserOpened(false);
      setCreateUserForm({ phoneNumber: "", name: "", email: "", role: "CUSTOMER" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditUser = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${selectedUser.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(editUserForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Update failed");
      notifications.show({ title: "User Updated", message: "Profile saved.", color: "teal" });
      setEditUserOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (uId: string) => {
    if (!confirm("Permanently delete this user?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${uId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Delete failed");
      notifications.show({ title: "User Deleted", message: "User removed from platform.", color: "teal" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Order Void
  const handleVoidOrder = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${selectedOrder.id}/void`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ reason: voidReason }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to void order");
      notifications.show({ title: "Order Voided", message: `Order #${selectedOrder.orderNo} cancelled.`, color: "teal" });
      setVoidOrderOpened(false);
      setVoidReason("");
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Menu Items CRUD
  const handleCreateMenuItem = async () => {
    if (!itemForm.restaurantId || !itemForm.categoryId || !itemForm.name) {
      notifications.show({ title: "Validation", message: "Select restaurant, category and dish name.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/menu/items`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(itemForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to create dish");
      notifications.show({ title: "Dish Created", message: `Added ${itemForm.name}`, color: "teal" });
      setCreateItemOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDishStock = async (itemId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/menu/items/${itemId}/toggle-stock`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to toggle stock");
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    if (!confirm("Delete this menu item?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/menu/items/${itemId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
      notifications.show({ title: "Deleted", message: "Menu dish removed.", color: "teal" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Tables CRUD
  const handleCreateTable = async () => {
    if (!tableForm.restaurantId || !tableForm.outletId || !tableForm.name) {
      notifications.show({ title: "Validation", message: "Restaurant, outlet and table name required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tables`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(tableForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to create table");
      notifications.show({ title: "Table Created", message: `Table ${tableForm.name} added.`, color: "teal" });
      setCreateTableOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTable = async (tblId: string) => {
    if (!confirm("Delete this dining table?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/tables/${tblId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
      notifications.show({ title: "Deleted", message: "Table removed.", color: "teal" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Inventory CRUD
  const handleCreateInventory = async () => {
    if (!invForm.restaurantId || !invForm.outletId || !invForm.name) {
      notifications.show({ title: "Validation", message: "Restaurant, outlet and item name required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/inventory`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(invForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Creation failed");
      notifications.show({ title: "Inventory Item Added", message: `Added ${invForm.name}`, color: "teal" });
      setCreateInvOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInventory = async (invId: string) => {
    if (!confirm("Delete inventory item?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventory/${invId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
      notifications.show({ title: "Deleted", message: "Stock item removed.", color: "teal" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Reservations CRUD
  const handleCreateReservation = async () => {
    if (!resvForm.restaurantId || !resvForm.outletId || !resvForm.guestName || !resvForm.guestPhone) {
      notifications.show({ title: "Validation", message: "Required fields missing.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/reservations`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(resvForm),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to create reservation");
      notifications.show({ title: "Reservation Booked", message: `Booked for ${resvForm.guestName}`, color: "teal" });
      setCreateResvOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateReservationStatus = async (resId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/reservations/${resId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      notifications.show({ title: "Reservation Updated", message: `Marked as ${status}`, color: "teal" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleDeleteReservation = async (resId: string) => {
    if (!confirm("Delete this reservation?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/reservations/${resId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
      notifications.show({ title: "Deleted", message: "Reservation removed.", color: "teal" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Feedback Reply & Delete
  const handleReplyFeedback = async () => {
    if (!selectedFeedback || !feedbackReplyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/feedback/${selectedFeedback.id}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ reply: feedbackReplyText }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to submit reply");
      notifications.show({ title: "Reply Published", message: "Management response sent.", color: "teal" });
      setReplyFeedbackOpened(false);
      setFeedbackReplyText("");
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFeedback = async (fbId: string) => {
    if (!confirm("Delete review?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/feedback/${fbId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
      notifications.show({ title: "Deleted", message: "Review removed.", color: "teal" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Subscription Plan Update
  const handleUpdateSubscriptionStatus = async (restaurantId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/subscriptions/${restaurantId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      notifications.show({ title: "Subscription Updated", message: `Store marked as ${status}`, color: "teal" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // SQL Execution
  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setSqlRunning(true);
    setSqlResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/execute-sql`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ sql: sqlQuery }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "SQL Error");
      setSqlResult(data.result);
      notifications.show({ title: "Query Executed", message: "SQL executed successfully", color: "teal" });
    } catch (err: any) {
      setSqlResult({ error: err.message });
      notifications.show({ title: "SQL Execution Error", message: err.message, color: "red" });
    } finally {
      setSqlRunning(false);
    }
  };

  // Purge Orders
  const handlePurgeOrders = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/purge-orders`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ restaurantId: purgeTargetRestId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Purge failed");
      notifications.show({ title: "Purge Complete", message: data.message, color: "teal" });
      setPurgeModalOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Purge Failed", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Filtered Data Memos ────────────────────────────────────────────────────
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const matchesSearch =
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.ownerPhone?.includes(searchQuery) ||
        r.id?.includes(searchQuery);
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [restaurants, searchQuery, statusFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phoneNumber?.includes(searchQuery) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = statusFilter === "ALL" || u.role === statusFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, statusFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        String(o.orderNo).includes(searchQuery) ||
        o.customerPhone?.includes(searchQuery) ||
        o.restaurantName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || o.status === statusFilter || o.orderStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((i) => {
      const matchesSearch =
        i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.categoryName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.restaurantName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [menuItems, searchQuery]);

  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchesSearch =
        t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.section?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.restaurantName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [tables, searchQuery]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((inv) => {
      const matchesSearch =
        inv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.restaurantName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [inventory, searchQuery]);

  // Loading view
  if (authLoading || (loading && !metrics)) {
    return (
      <Center py={120}>
        <Stack align="center" gap="sm">
          <Loader color="dinePrimary" size="xl" />
          <Text size="sm" c="dimmed">Connecting to Superadmin Control Plane...</Text>
        </Stack>
      </Center>
    );
  }

  interface NavItem {
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ size?: number | string }>;
    count?: number;
    badge?: string | null;
  }
  interface NavSection {
    group: string;
    items: NavItem[];
  }

  // Navigation Items Catalog
  const NAV_SECTIONS: NavSection[] = [
    {
      group: "CONTROL PLANE",
      items: [
        { id: "overview", label: "Overview & Telemetry", icon: IconLayoutDashboard, badge: null },
      ],
    },
    {
      group: "TENANT GOVERNANCE",
      items: [
        { id: "restaurants", label: "Restaurants & Stores", icon: IconBuildingStore, count: restaurants.length },
        { id: "outlets", label: "All Outlets", icon: IconBuildingStore, count: outlets.length },
        { id: "users", label: "Users & Staff Directory", icon: IconUsers, count: users.length },
        { id: "subscriptions", label: "Subscriptions & Plans", icon: IconCreditCard, count: restaurants.length },
      ],
    },
    {
      group: "OPERATIONS & CATALOG",
      items: [
        { id: "orders", label: "Platform Orders", icon: IconReceipt, count: orders.length },
        { id: "menu", label: "Menu Catalogs", icon: IconBook, count: menuItems.length },
        { id: "tables", label: "Dining Tables", icon: IconTableAlias, count: tables.length },
        { id: "inventory", label: "Inventory & BOM", icon: IconPackages, count: inventory.length },
        { id: "delivery", label: "Delivery Fleet", icon: IconMotorbike, count: deliveries.length },
      ],
    },
    {
      group: "GUEST CRM & RELATIONS",
      items: [
        { id: "customers", label: "Customer Directory", icon: IconUserCheck, count: customers.length },
        { id: "reservations", label: "Table Reservations", icon: IconCalendarEvent, count: reservations.length },
        { id: "feedback", label: "Reviews & Feedback", icon: IconStar, count: feedback.length },
      ],
    },
    {
      group: "SYSTEM INFRASTRUCTURE",
      items: [
        { id: "system", label: "Operations, DB & SQL", icon: IconDatabase, badge: "Edge" },
      ],
    },
  ];

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 260,
        breakpoint: "md",
        collapsed: { mobile: !mobileOpen, desktop: !sidebarOpen },
      }}
      padding="md"
    >
      {/* ─── Dedicated Superadmin Header (ZERO staff paths) ───────────────── */}
      <AppShell.Header withBorder>
        <Group justify="space-between" h="100%" px="md">
          <Group gap="sm">
            <Burger opened={sidebarOpen} onClick={() => setSidebarOpen((o) => !o)} visibleFrom="md" size="sm" />
            <Burger opened={mobileOpen} onClick={() => setMobileOpen((o) => !o)} hiddenFrom="md" size="sm" />
            <Group gap="xs" style={{ cursor: "pointer" }} onClick={() => setActiveTab("overview")}>
              <Box p={6} style={{ background: "linear-gradient(135deg, #7950f2, #4c6ef5)", borderRadius: 8 }}>
                <IconShieldLock size={20} color="white" />
              </Box>
              <Box>
                <Group gap={6} align="center">
                  <Text fw={800} size="md" style={{ letterSpacing: "-0.5px" }}>
                    Logix <span style={{ color: "#7950f2" }}>Superadmin</span>
                  </Text>
                  <Badge color="violet" variant="filled" size="xs">PLATFORM</Badge>
                </Group>
                <Text size="10px" c="dimmed">Global Multi-Tenant Control Plane</Text>
              </Box>
            </Group>
          </Group>

          {/* Right Header: Store Filter & Profile */}
          <Group gap="xs">
            {/* Global Tenant Filter */}
            <Select
              size="xs"
              placeholder="Scope: All Stores"
              data={[
                { value: "ALL", label: "🌐 All Platform Stores" },
                ...restaurants.map((r) => ({ value: r.id, label: `🏪 ${r.name}` })),
              ]}
              value={selectedRestFilter}
              onChange={(v) => setSelectedRestFilter(v || "ALL")}
              w={{ base: 140, sm: 200 }}
            />

            <Tooltip label="Refresh Global Telemetry">
              <ActionIcon variant="light" color="dinePrimary" size="md" radius="md" loading={refreshing} onClick={() => fetchAllData()}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>

            {/* Quick Link back to dine */}
            {restaurants.length > 0 && (
              <Button
                variant="light"
                color="indigo"
                size="xs"
                leftSection={<IconLogin size={14} />}
                visibleFrom="sm"
                onClick={() => handleEnterStore(restaurants[0])}
              >
                Enter POS
              </Button>
            )}

            {/* Superadmin Menu */}
            <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg" radius="xl">
                  <Avatar size={32} color="violet" radius="xl">
                    <IconShieldLock size={18} />
                  </Avatar>
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Superadmin Profile</Menu.Label>
                <Menu.Item leftSection={<IconUserCheck size={16} />}>
                  <div>
                    <Text size="xs" fw={700}>{user?.name || "Superadmin"}</Text>
                    <Text size="10px" c="dimmed">{user?.phoneNumber || "Platform Root"}</Text>
                  </div>
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLogout size={16} />} color="red" onClick={() => signOut()}>
                  Sign Out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {/* ─── Dedicated Superadmin Sidebar ───────────────────────────────────── */}
      <AppShell.Navbar p="xs">
        <ScrollArea style={{ height: "calc(100vh - 80px)" }}>
          <Stack gap={14}>
            {NAV_SECTIONS.map((section) => (
              <Box key={section.group}>
                <Text size="10px" fw={700} c="dimmed" tt="uppercase" px="xs" mb={4}>
                  {section.group}
                </Text>
                <Stack gap={2}>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <NavLink
                        key={item.id}
                        active={isActive}
                        label={item.label}
                        leftSection={<Icon size={18} />}
                        rightSection={
                          item.badge ? (
                            <Badge size="xs" color="teal" variant="light">{item.badge}</Badge>
                          ) : item.count !== undefined ? (
                            <Badge size="xs" variant="light" color={isActive ? "dinePrimary" : "gray"}>
                              {item.count}
                            </Badge>
                          ) : null
                        }
                        onClick={() => {
                          setActiveTab(item.id as AdminTab);
                          setSearchQuery("");
                          setStatusFilter("ALL");
                          setMobileOpen(false);
                        }}
                        style={{ borderRadius: 6, fontWeight: isActive ? 600 : 400 }}
                      />
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      {/* ─── Main Content Canvas ────────────────────────────────────────────── */}
      <AppShell.Main>
        <Box style={{ maxWidth: 1400, margin: "0 auto" }}>
          {/* Header Bar for Active Tab */}
          <Group justify="space-between" align="center" mb="lg" wrap="wrap">
            <Box>
              <Group gap="xs" align="center">
                <Title order={2} style={{ letterSpacing: "-0.5px" }}>
                  {NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.id === activeTab)?.label}
                </Title>
                <Badge color="dinePrimary" size="sm" variant="light">
                  {selectedRestFilter === "ALL" ? "GLOBAL" : "FILTERED"}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Superadmin control and real-time synchronization across all tenant databases
              </Text>
            </Box>

            {/* Action Buttons Depending on Active Tab */}
            <Group gap="xs">
              {activeTab === "restaurants" && (
                <Button color="dinePrimary" size="xs" leftSection={<IconPlus size={16} />} onClick={() => setCreateRestOpened(true)}>
                  Add Restaurant
                </Button>
              )}
              {activeTab === "outlets" && (
                <Button color="dinePrimary" size="xs" leftSection={<IconPlus size={16} />} onClick={() => setCreateOutletOpened(true)}>
                  Add Outlet
                </Button>
              )}
              {activeTab === "users" && (
                <Button color="dinePrimary" size="xs" leftSection={<IconUserPlus size={16} />} onClick={() => setCreateUserOpened(true)}>
                  Add User
                </Button>
              )}
              {activeTab === "menu" && (
                <Button color="dinePrimary" size="xs" leftSection={<IconPlus size={16} />} onClick={() => setCreateItemOpened(true)}>
                  Add Menu Item
                </Button>
              )}
              {activeTab === "tables" && (
                <Button color="dinePrimary" size="xs" leftSection={<IconPlus size={16} />} onClick={() => setCreateTableOpened(true)}>
                  Add Table
                </Button>
              )}
              {activeTab === "inventory" && (
                <Button color="dinePrimary" size="xs" leftSection={<IconPlus size={16} />} onClick={() => setCreateInvOpened(true)}>
                  Add Inventory Item
                </Button>
              )}
              {activeTab === "reservations" && (
                <Button color="dinePrimary" size="xs" leftSection={<IconPlus size={16} />} onClick={() => setCreateResvOpened(true)}>
                  Add Reservation
                </Button>
              )}
            </Group>
          </Group>

          {/* ─── TAB 1: OVERVIEW & TELEMETRY ───────────────────────────────── */}
          {activeTab === "overview" && metrics && (
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
                <Card withBorder padding="md" radius="md">
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Text size="xs" c="dimmed" fw={600} tt="uppercase">Stores</Text>
                      <Text size="xl" fw={700} mt={4}>{metrics.totalRestaurants}</Text>
                    </Box>
                    <ActionIcon variant="light" color="indigo" radius="md" size="lg"><IconBuildingStore size={20} /></ActionIcon>
                  </Group>
                  <Group gap={6} mt="xs">
                    <Badge size="xs" color="green">{metrics.activeRestaurants} Active</Badge>
                    <Badge size="xs" color="blue">{metrics.trialRestaurants} Trial</Badge>
                  </Group>
                </Card>

                <Card withBorder padding="md" radius="md">
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Outlets</Text>
                      <Text size="xl" fw={700} mt={4}>{metrics.totalOutlets}</Text>
                    </Box>
                    <ActionIcon variant="light" color="cyan" radius="md" size="lg"><IconBuildingStore size={20} /></ActionIcon>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">Across all tenants</Text>
                </Card>

                <Card withBorder padding="md" radius="md">
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Text size="xs" c="dimmed" fw={600} tt="uppercase">Platform Users</Text>
                      <Text size="xl" fw={700} mt={4}>{metrics.totalUsers}</Text>
                    </Box>
                    <ActionIcon variant="light" color="teal" radius="md" size="lg"><IconUsers size={20} /></ActionIcon>
                  </Group>
                  <Group gap={6} mt="xs">
                    <Badge size="xs" color="indigo">{metrics.adminUsers} Admin</Badge>
                    <Badge size="xs" color="violet">{metrics.ownerUsers} Owners</Badge>
                  </Group>
                </Card>

                <Card withBorder padding="md" radius="md">
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Text size="xs" c="dimmed" fw={600} tt="uppercase">Platform Orders</Text>
                      <Text size="xl" fw={700} mt={4}>{metrics.totalOrders}</Text>
                    </Box>
                    <ActionIcon variant="light" color="orange" radius="md" size="lg"><IconReceipt size={20} /></ActionIcon>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">Today: {metrics.todayOrders} orders</Text>
                </Card>

                <Card withBorder padding="md" radius="md">
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Platform GMV</Text>
                      <Text size="xl" fw={700} mt={4}>₹{metrics.totalGmv?.toLocaleString("en-IN")}</Text>
                    </Box>
                    <ActionIcon variant="light" color="green" radius="md" size="lg"><IconCurrencyRupee size={20} /></ActionIcon>
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">Today: ₹{metrics.todayGmv?.toLocaleString("en-IN")}</Text>
                </Card>
              </SimpleGrid>

              {/* Quick Navigation Cards */}
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <Card withBorder padding="lg" radius="md" style={{ cursor: "pointer" }} onClick={() => setActiveTab("restaurants")}>
                  <Group justify="space-between">
                    <div>
                      <Text fw={700} size="md">Manage Tenants</Text>
                      <Text size="xs" c="dimmed">Provision new restaurants, modify scopes, manage ownership</Text>
                    </div>
                    <ActionIcon variant="light" color="indigo" size="lg"><IconBuildingStore size={20} /></ActionIcon>
                  </Group>
                </Card>
                <Card withBorder padding="lg" radius="md" style={{ cursor: "pointer" }} onClick={() => setActiveTab("orders")}>
                  <Group justify="space-between">
                    <div>
                      <Text fw={700} size="md">Live Orders Stream</Text>
                      <Text size="xs" c="dimmed">Audit bills, refunds, voided checks across outlets</Text>
                    </div>
                    <ActionIcon variant="light" color="orange" size="lg"><IconReceipt size={20} /></ActionIcon>
                  </Group>
                </Card>
                <Card withBorder padding="lg" radius="md" style={{ cursor: "pointer" }} onClick={() => setActiveTab("system")}>
                  <Group justify="space-between">
                    <div>
                      <Text fw={700} size="md">SQL Runner & Telemetry</Text>
                      <Text size="xs" c="dimmed">Direct Hyperdrive execution, KV telemetry, data wipe tools</Text>
                    </div>
                    <ActionIcon variant="light" color="teal" size="lg"><IconDatabase size={20} /></ActionIcon>
                  </Group>
                </Card>
              </SimpleGrid>
            </Stack>
          )}

          {/* ─── TAB 2: RESTAURANTS ────────────────────────────────────────── */}
          {activeTab === "restaurants" && (
            <Stack gap="md">
              <Card withBorder padding="sm" radius="md">
                <Group justify="space-between" wrap="wrap">
                  <Group gap="xs" style={{ flex: 1, minWidth: 260 }}>
                    <TextInput placeholder="Search store name, phone, address..." leftSection={<IconSearch size={16} />} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1 }} />
                    <Select value={statusFilter} onChange={(v) => setStatusFilter(v || "ALL")} data={[{ value: "ALL", label: "All Statuses" }, { value: "ACTIVE", label: "Active" }, { value: "TRIAL", label: "Trial" }, { value: "SUSPENDED", label: "Suspended" }]} w={130} />
                  </Group>
                  <Text size="xs" c="dimmed">Showing {filteredRestaurants.length} stores</Text>
                </Group>
              </Card>

              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Restaurant</Table.Th>
                      <Table.Th>Owner</Table.Th>
                      <Table.Th>Outlets</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>GMV & Orders</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredRestaurants.map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <ActionIcon variant="light" color="dinePrimary" size="md" radius="md"><IconBuildingStore size={18} /></ActionIcon>
                            <div>
                              <Text size="sm" fw={600}>{r.name}</Text>
                              <Text size="xs" c="dimmed">{r.address}</Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" fw={600}>{r.ownerName || "Unnamed"}</Text>
                          <Text size="xs" c="dimmed">{r.ownerPhone}</Text>
                        </Table.Td>
                        <Table.Td><Badge size="sm" variant="light" color="indigo">{r.outletsCount} Outlets</Badge></Table.Td>
                        <Table.Td><Badge size="sm" color={r.status === "ACTIVE" ? "green" : r.status === "TRIAL" ? "blue" : "red"}>{r.status}</Badge></Table.Td>
                        <Table.Td>
                          <Text size="xs" fw={600}>₹{r.totalGmv?.toLocaleString("en-IN") || 0}</Text>
                          <Text size="11px" c="dimmed">{r.ordersCount || 0} orders</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <Group gap="xs" justify="flex-end">
                            <Button size="xs" variant="filled" color="dinePrimary" leftSection={<IconLogin size={14} />} onClick={() => handleEnterStore(r)}>Enter</Button>
                            <Menu position="bottom-end" shadow="md">
                              <Menu.Target><ActionIcon variant="subtle"><IconDotsVertical size={16} /></ActionIcon></Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item leftSection={<IconEdit size={15} />} onClick={() => { setSelectedRest(r); setEditRestForm({ name: r.name, address: r.address, phone: r.phone || "", currency: r.currency || "INR", status: r.status, ownerPhone: r.ownerPhone || "" }); setEditRestOpened(true); }}>Edit Details</Menu.Item>
                                <Menu.Item leftSection={<IconPower size={15} />} onClick={() => handleUpdateSubscriptionStatus(r.id, r.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}>{r.status === "ACTIVE" ? "Suspend Store" : "Activate Store"}</Menu.Item>
                                <Menu.Divider />
                                <Menu.Item color="red" leftSection={<IconTrash size={15} />} onClick={() => { setRestToDelete(r); setDeleteRestModalOpened(true); }}>Delete Store</Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 3: OUTLETS ────────────────────────────────────────────── */}
          {activeTab === "outlets" && (
            <Stack gap="md">
              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Outlet Name</Table.Th>
                      <Table.Th>Restaurant ID</Table.Th>
                      <Table.Th>Address</Table.Th>
                      <Table.Th>Phone</Table.Th>
                      <Table.Th>UPI ID</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {outlets.map((o) => (
                      <Table.Tr key={o.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <Text size="sm" fw={600}>{o.name}</Text>
                            {o.isDefault && <Badge size="xs" color="teal">Default</Badge>}
                          </Group>
                        </Table.Td>
                        <Table.Td><Badge size="xs" variant="outline">{o.restaurantId}</Badge></Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">{o.address || "—"}</Text></Table.Td>
                        <Table.Td><Text size="xs">{o.phone || "—"}</Text></Table.Td>
                        <Table.Td><Text size="xs">{o.upiId || "—"}</Text></Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleDeleteOutlet(o.id)}><IconTrash size={16} /></ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 4: USERS & STAFF ──────────────────────────────────────── */}
          {activeTab === "users" && (
            <Stack gap="md">
              <Card withBorder padding="sm" radius="md">
                <Group justify="space-between" wrap="wrap">
                  <Group gap="xs" style={{ flex: 1, minWidth: 260 }}>
                    <TextInput placeholder="Search user name, phone, email..." leftSection={<IconSearch size={16} />} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1 }} />
                    <Select value={statusFilter} onChange={(v) => setStatusFilter(v || "ALL")} data={[{ value: "ALL", label: "All Roles" }, { value: "ADMIN", label: "Admin" }, { value: "OWNER", label: "Owner" }, { value: "CUSTOMER", label: "Customer" }]} w={130} />
                  </Group>
                  <Text size="xs" c="dimmed">Showing {filteredUsers.length} users</Text>
                </Group>
              </Card>

              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>User</Table.Th>
                      <Table.Th>Phone & Email</Table.Th>
                      <Table.Th>Platform Role</Table.Th>
                      <Table.Th>Joined Date</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredUsers.map((u) => (
                      <Table.Tr key={u.id}>
                        <Table.Td><Text size="sm" fw={600}>{u.name || "Guest"}</Text></Table.Td>
                        <Table.Td>
                          <Text size="xs" fw={600}>{u.phoneNumber || "—"}</Text>
                          <Text size="11px" c="dimmed">{u.email || "—"}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" color={u.role === "ADMIN" ? "indigo" : u.role === "OWNER" ? "violet" : "gray"}>
                            {u.role || "CUSTOMER"}
                          </Badge>
                        </Table.Td>
                        <Table.Td><Text size="xs">{new Date(u.createdAt).toLocaleDateString()}</Text></Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <Group gap="xs" justify="flex-end">
                            <ActionIcon variant="subtle" color="dinePrimary" size="sm" onClick={() => { setSelectedUser(u); setEditUserForm({ name: u.name || "", phoneNumber: u.phoneNumber || "", email: u.email || "", role: u.role || "CUSTOMER" }); setEditUserOpened(true); }}><IconEdit size={16} /></ActionIcon>
                            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteUser(u.id)}><IconTrash size={16} /></ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 5: SUBSCRIPTIONS ──────────────────────────────────────── */}
          {activeTab === "subscriptions" && (
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <Card withBorder padding="md" radius="md">
                  <Text size="xs" c="dimmed" fw={600}>ACTIVE SUBSCRIPTIONS</Text>
                  <Text size="xl" fw={700} mt={4}>{restaurants.filter((r) => r.status === "ACTIVE").length}</Text>
                  <Text size="xs" c="dimmed">Paid monthly/annual plans</Text>
                </Card>
                <Card withBorder padding="md" radius="md">
                  <Text size="xs" c="dimmed" fw={600}>FREE TRIALS</Text>
                  <Text size="xl" fw={700} mt={4}>{restaurants.filter((r) => r.status === "TRIAL").length}</Text>
                  <Text size="xs" c="dimmed">14-day onboarding trials</Text>
                </Card>
                <Card withBorder padding="md" radius="md">
                  <Text size="xs" c="dimmed" fw={600}>SUSPENDED / OVERDUE</Text>
                  <Text size="xl" fw={700} mt={4}>{restaurants.filter((r) => r.status === "SUSPENDED").length}</Text>
                  <Text size="xs" c="dimmed">Locked stores</Text>
                </Card>
              </SimpleGrid>

              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Restaurant</Table.Th>
                      <Table.Th>Current Status</Table.Th>
                      <Table.Th>Currency</Table.Th>
                      <Table.Th>Provisioned Date</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Subscription Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {restaurants.map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td><Text size="sm" fw={600}>{r.name}</Text></Table.Td>
                        <Table.Td><Badge size="sm" color={r.status === "ACTIVE" ? "green" : r.status === "TRIAL" ? "blue" : "red"}>{r.status}</Badge></Table.Td>
                        <Table.Td><Badge size="xs" variant="outline">{r.currency}</Badge></Table.Td>
                        <Table.Td><Text size="xs">{new Date(r.createdAt).toLocaleDateString()}</Text></Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <Group gap="xs" justify="flex-end">
                            <Button size="xs" variant="light" color="green" onClick={() => handleUpdateSubscriptionStatus(r.id, "ACTIVE")}>Activate</Button>
                            <Button size="xs" variant="light" color="blue" onClick={() => handleUpdateSubscriptionStatus(r.id, "TRIAL")}>Trial</Button>
                            <Button size="xs" variant="light" color="red" onClick={() => handleUpdateSubscriptionStatus(r.id, "SUSPENDED")}>Suspend</Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 6: ORDERS EXPLORER ────────────────────────────────────── */}
          {activeTab === "orders" && (
            <Stack gap="md">
              <Card withBorder padding="sm" radius="md">
                <Group justify="space-between" wrap="wrap">
                  <Group gap="xs" style={{ flex: 1, minWidth: 260 }}>
                    <TextInput placeholder="Search order #, customer phone..." leftSection={<IconSearch size={16} />} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1 }} />
                    <Select value={statusFilter} onChange={(v) => setStatusFilter(v || "ALL")} data={[{ value: "ALL", label: "All Statuses" }, { value: "PAID", label: "Paid" }, { value: "OPEN", label: "Open" }, { value: "VOID", label: "Void" }]} w={130} />
                  </Group>
                  <Text size="xs" c="dimmed">Showing {filteredOrders.length} orders</Text>
                </Group>
              </Card>

              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Order #</Table.Th>
                      <Table.Th>Restaurant</Table.Th>
                      <Table.Th>Table / Type</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Total</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredOrders.map((o) => (
                      <Table.Tr key={o.id}>
                        <Table.Td><Text size="sm" fw={700}>#{o.orderNo}</Text></Table.Td>
                        <Table.Td><Text size="xs" fw={600}>{o.restaurantName}</Text></Table.Td>
                        <Table.Td><Badge size="xs" variant="outline">{o.tableNo ? `Table ${o.tableNo}` : o.orderType}</Badge></Table.Td>
                        <Table.Td><Text size="xs">{o.customerPhone || "Walk-in"}</Text></Table.Td>
                        <Table.Td><Badge size="sm" color={o.status === "PAID" ? "green" : o.status === "OPEN" ? "blue" : "red"}>{o.status}</Badge></Table.Td>
                        <Table.Td><Text size="xs" fw={700}>₹{((o.paidPaise || o.subtotalPaise || 0) / 100).toLocaleString("en-IN")}</Text></Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <Group gap="xs" justify="flex-end">
                            <ActionIcon variant="light" color="indigo" size="sm" onClick={() => { setSelectedOrder(o); setViewOrderOpened(true); }}><IconEye size={16} /></ActionIcon>
                            {o.status !== "VOID" && (
                              <ActionIcon variant="light" color="red" size="sm" onClick={() => { setSelectedOrder(o); setVoidOrderOpened(true); }}><IconBan size={16} /></ActionIcon>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 7: MENU CATALOGS ──────────────────────────────────────── */}
          {activeTab === "menu" && (
            <Stack gap="md">
              <Card withBorder padding="sm" radius="md">
                <Group justify="space-between" wrap="wrap">
                  <TextInput placeholder="Search dish name, category, store..." leftSection={<IconSearch size={16} />} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1 }} />
                  <Text size="xs" c="dimmed">Showing {filteredMenuItems.length} dishes</Text>
                </Group>
              </Card>

              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Dish Name</Table.Th>
                      <Table.Th>Restaurant</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Price</Table.Th>
                      <Table.Th>86 Stock</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredMenuItems.map((it) => (
                      <Table.Tr key={it.id}>
                        <Table.Td><Text size="sm" fw={600}>{it.name}</Text></Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">{it.restaurantName}</Text></Table.Td>
                        <Table.Td><Badge size="xs" variant="light">{it.categoryName}</Badge></Table.Td>
                        <Table.Td><Text size="xs" fw={700}>₹{(it.pricePaise / 100).toFixed(2)}</Text></Table.Td>
                        <Table.Td>
                          <Switch
                            size="sm"
                            checked={it.available}
                            onChange={() => handleToggleDishStock(it.id)}
                            color="teal"
                          />
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteMenuItem(it.id)}><IconTrash size={16} /></ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 8: TABLES ─────────────────────────────────────────────── */}
          {activeTab === "tables" && (
            <Stack gap="md">
              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Table</Table.Th>
                      <Table.Th>Restaurant</Table.Th>
                      <Table.Th>Section</Table.Th>
                      <Table.Th>Capacity</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredTables.map((t) => (
                      <Table.Tr key={t.id}>
                        <Table.Td><Text size="sm" fw={700}>{t.name}</Text></Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">{t.restaurantName}</Text></Table.Td>
                        <Table.Td><Badge size="xs" variant="outline">{t.section}</Badge></Table.Td>
                        <Table.Td><Text size="xs">{t.capacity} Guests</Text></Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteTable(t.id)}><IconTrash size={16} /></ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 9: INVENTORY & BOM ────────────────────────────────────── */}
          {activeTab === "inventory" && (
            <Stack gap="md">
              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Item Name</Table.Th>
                      <Table.Th>Restaurant</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Stock Balance</Table.Th>
                      <Table.Th>Threshold</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredInventory.map((inv) => (
                      <Table.Tr key={inv.id}>
                        <Table.Td><Text size="sm" fw={600}>{inv.name}</Text></Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">{inv.restaurantName}</Text></Table.Td>
                        <Table.Td><Badge size="xs" variant="light">{inv.category}</Badge></Table.Td>
                        <Table.Td><Text size="xs" fw={700}>{inv.currentStock} {inv.baseUom}</Text></Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">{inv.lowStockThreshold} {inv.baseUom}</Text></Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteInventory(inv.id)}><IconTrash size={16} /></ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 10: DELIVERY FLEET ────────────────────────────────────── */}
          {activeTab === "delivery" && (
            <Stack gap="md">
              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Delivery ID</Table.Th>
                      <Table.Th>Customer Phone</Table.Th>
                      <Table.Th>Address</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Time</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {deliveries.length === 0 ? (
                      <Table.Tr><Table.Td colSpan={5} style={{ textAlign: "center", padding: 30 }}><Text c="dimmed">No deliveries logged.</Text></Table.Td></Table.Tr>
                    ) : (
                      deliveries.map((d) => (
                        <Table.Tr key={d.id}>
                          <Table.Td><Text size="xs" fw={700}>{d.id.slice(0, 10)}</Text></Table.Td>
                          <Table.Td><Text size="xs">{d.customerPhone}</Text></Table.Td>
                          <Table.Td><Text size="xs" c="dimmed">{d.addressLine1}, {d.city}</Text></Table.Td>
                          <Table.Td><Badge size="xs" color={d.status === "DELIVERED" ? "green" : "orange"}>{d.status}</Badge></Table.Td>
                          <Table.Td><Text size="xs">{new Date(d.createdAt).toLocaleTimeString()}</Text></Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 11: CUSTOMER DIRECTORY (CRM) ──────────────────────────── */}
          {activeTab === "customers" && (
            <Stack gap="md">
              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Phone</Table.Th>
                      <Table.Th>Orders Placed</Table.Th>
                      <Table.Th>Total Spent</Table.Th>
                      <Table.Th>Joined Date</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {customers.map((c) => (
                      <Table.Tr key={c.id}>
                        <Table.Td><Text size="sm" fw={600}>{c.name}</Text></Table.Td>
                        <Table.Td><Text size="xs">{c.phoneNumber}</Text></Table.Td>
                        <Table.Td><Badge size="xs" color="indigo">{c.ordersCount} Orders</Badge></Table.Td>
                        <Table.Td><Text size="xs" fw={700}>₹{c.totalSpend?.toLocaleString("en-IN")}</Text></Table.Td>
                        <Table.Td><Text size="xs">{new Date(c.createdAt).toLocaleDateString()}</Text></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 12: RESERVATIONS ──────────────────────────────────────── */}
          {activeTab === "reservations" && (
            <Stack gap="md">
              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Guest</Table.Th>
                      <Table.Th>Restaurant</Table.Th>
                      <Table.Th>Party Size</Table.Th>
                      <Table.Th>Date & Time</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {reservations.length === 0 ? (
                      <Table.Tr><Table.Td colSpan={6} style={{ textAlign: "center", padding: 30 }}><Text c="dimmed">No reservations registered.</Text></Table.Td></Table.Tr>
                    ) : (
                      reservations.map((r) => (
                        <Table.Tr key={r.id}>
                          <Table.Td>
                            <Text size="sm" fw={600}>{r.guestName}</Text>
                            <Text size="xs" c="dimmed">{r.guestPhone}</Text>
                          </Table.Td>
                          <Table.Td><Text size="xs">{r.restaurantName}</Text></Table.Td>
                          <Table.Td><Badge size="xs" color="indigo">{r.partySize} Guests</Badge></Table.Td>
                          <Table.Td><Text size="xs">{r.reservationDate} at {r.startTime}</Text></Table.Td>
                          <Table.Td><Badge size="xs" color={r.status === "SEATED" ? "green" : r.status === "CONFIRMED" ? "blue" : "red"}>{r.status}</Badge></Table.Td>
                          <Table.Td style={{ textAlign: "right" }}>
                            <Group gap="xs" justify="flex-end">
                              <Button size="xs" variant="light" color="green" onClick={() => handleUpdateReservationStatus(r.id, "SEATED")}>Seat</Button>
                              <Button size="xs" variant="light" color="red" onClick={() => handleUpdateReservationStatus(r.id, "CANCELLED")}>Cancel</Button>
                              <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteReservation(r.id)}><IconTrash size={16} /></ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 13: FEEDBACK & REVIEWS ────────────────────────────────── */}
          {activeTab === "feedback" && (
            <Stack gap="md">
              <Card withBorder padding={0} radius="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Rating</Table.Th>
                      <Table.Th>Comment</Table.Th>
                      <Table.Th>Store Reply</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {feedback.length === 0 ? (
                      <Table.Tr><Table.Td colSpan={5} style={{ textAlign: "center", padding: 30 }}><Text c="dimmed">No guest feedback entries yet.</Text></Table.Td></Table.Tr>
                    ) : (
                      feedback.map((fb) => (
                        <Table.Tr key={fb.id}>
                          <Table.Td><Text size="xs" fw={600}>{fb.customerPhone}</Text></Table.Td>
                          <Table.Td><Badge size="sm" color={fb.rating >= 4 ? "green" : fb.rating >= 3 ? "yellow" : "red"}>{fb.rating} ★</Badge></Table.Td>
                          <Table.Td><Text size="xs">{fb.comment || "—"}</Text></Table.Td>
                          <Table.Td><Text size="xs" c="dimmed">{fb.ownerReply || "No reply yet"}</Text></Table.Td>
                          <Table.Td style={{ textAlign: "right" }}>
                            <Group gap="xs" justify="flex-end">
                              <Button size="xs" variant="light" color="indigo" onClick={() => { setSelectedFeedback(fb); setReplyFeedbackOpened(true); }}>Reply</Button>
                              <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteFeedback(fb.id)}><IconTrash size={16} /></ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </Card>
            </Stack>
          )}

          {/* ─── TAB 14: SYSTEM & SQL RUNNER ───────────────────────────────── */}
          {activeTab === "system" && (
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                <Card withBorder padding="lg" radius="md">
                  <Group gap="xs" mb="xs">
                    <ActionIcon variant="light" color="red" size="lg" radius="md"><IconAlertCircle size={20} /></ActionIcon>
                    <Title order={4}>Order Purge Tool</Title>
                  </Group>
                  <Text size="xs" c="dimmed" mb="md">Safely wipe test orders, order items, and item audits from database before going live.</Text>
                  <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={() => setPurgeModalOpened(true)}>Open Purge Manager</Button>
                </Card>

                <Card withBorder padding="lg" radius="md">
                  <Group gap="xs" mb="xs">
                    <ActionIcon variant="light" color="teal" size="lg" radius="md"><IconDatabase size={20} /></ActionIcon>
                    <Title order={4}>Infrastructure Status</Title>
                  </Group>
                  <Stack gap="xs">
                    <Group justify="space-between"><Text size="xs" fw={600}>API Endpoint:</Text><Text size="xs" c="dimmed">{API_BASE}</Text></Group>
                    <Group justify="space-between"><Text size="xs" fw={600}>Hyperdrive DB:</Text><Badge size="xs" color="green">CONNECTED</Badge></Group>
                    <Group justify="space-between"><Text size="xs" fw={600}>KV Cache Layer:</Text><Badge size="xs" color="teal">ACTIVE</Badge></Group>
                    <Group justify="space-between"><Text size="xs" fw={600}>Tenancy Isolation:</Text><Badge size="xs" color="indigo">ENFORCED (RBAC)</Badge></Group>
                  </Stack>
                </Card>
              </SimpleGrid>

              {/* SQL Query Runner */}
              <Card withBorder padding="lg" radius="md">
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <ActionIcon variant="light" color="indigo" size="lg" radius="md"><IconDatabase size={20} /></ActionIcon>
                    <Title order={4}>Superadmin SQL Migration & Runner</Title>
                  </Group>
                  <Button size="xs" color="indigo" loading={sqlRunning} onClick={handleExecuteSql}>Execute SQL</Button>
                </Group>
                <Textarea value={sqlQuery} onChange={(e) => setSqlQuery(e.target.value)} minRows={3} maxRows={8} autosize style={{ fontFamily: "monospace" }} mb="md" />
                {sqlResult && (
                  <Box>
                    <Text size="xs" fw={600} mb={4}>Execution Result:</Text>
                    <Paper withBorder p="sm" radius="md" bg="#1e1e1e">
                      <ScrollArea style={{ maxHeight: 250 }}>
                        <pre style={{ margin: 0, color: "#69db7c", fontSize: 12, fontFamily: "monospace" }}>
                          {JSON.stringify(sqlResult, null, 2)}
                        </pre>
                      </ScrollArea>
                    </Paper>
                  </Box>
                )}
              </Card>
            </Stack>
          )}
        </Box>
      </AppShell.Main>

      {/* ─── MODALS ────────────────────────────────────────────────────────── */}

      {/* Modal: Create Restaurant */}
      <Modal opened={createRestOpened} onClose={() => setCreateRestOpened(false)} title={<Text fw={700}>Add New Restaurant Tenant</Text>} size="lg">
        <Stack gap="sm">
          <TextInput label="Restaurant Name" placeholder="e.g. Urban Diner & Bar" required value={createRestForm.name} onChange={(e) => setCreateRestForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Address" placeholder="e.g. 100 Feet Road, Indiranagar, Bengaluru" required value={createRestForm.address} onChange={(e) => setCreateRestForm((f) => ({ ...f, address: e.target.value }))} />
          <TextInput label="Contact Phone" placeholder="e.g. 9876543210" value={createRestForm.phone} onChange={(e) => setCreateRestForm((f) => ({ ...f, phone: e.target.value }))} />
          <TextInput label="Owner Phone Number (Login Key)" placeholder="+91..." required value={createRestForm.ownerPhone} onChange={(e) => setCreateRestForm((f) => ({ ...f, ownerPhone: e.target.value }))} />
          <TextInput label="Owner Full Name" placeholder="e.g. Ramesh Kumar" value={createRestForm.ownerName} onChange={(e) => setCreateRestForm((f) => ({ ...f, ownerName: e.target.value }))} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateRestOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateRestaurant}>Create & Provision Store</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit Restaurant */}
      <Modal opened={editRestOpened} onClose={() => setEditRestOpened(false)} title={<Text fw={700}>Edit Restaurant Details</Text>}>
        <Stack gap="sm">
          <TextInput label="Restaurant Name" value={editRestForm.name} onChange={(e) => setEditRestForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Address" value={editRestForm.address} onChange={(e) => setEditRestForm((f) => ({ ...f, address: e.target.value }))} />
          <TextInput label="Contact Phone" value={editRestForm.phone} onChange={(e) => setEditRestForm((f) => ({ ...f, phone: e.target.value }))} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditRestOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleSaveEditRestaurant}>Save Changes</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Delete Restaurant */}
      <Modal opened={deleteRestModalOpened} onClose={() => setDeleteRestModalOpened(false)} title={<Text fw={700} c="red">Delete Restaurant Confirmation</Text>}>
        <Stack gap="sm">
          <Alert color="red" icon={<IconAlertCircle size={16} />}>Permanently delete store {restToDelete?.name}?</Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setDeleteRestModalOpened(false)}>Cancel</Button>
            <Button color="red" loading={submitting} onClick={handleDeleteRestaurant}>Permanently Delete Store</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Create Outlet */}
      <Modal opened={createOutletOpened} onClose={() => setCreateOutletOpened(false)} title={<Text fw={700}>Add New Outlet</Text>}>
        <Stack gap="sm">
          <Select label="Restaurant" placeholder="Select Restaurant" required data={restaurants.map((r) => ({ value: r.id, label: r.name }))} value={createOutletForm.restaurantId} onChange={(v) => setCreateOutletForm((f) => ({ ...f, restaurantId: v || "" }))} />
          <TextInput label="Outlet Name" placeholder="e.g. Indiranagar Branch" required value={createOutletForm.name} onChange={(e) => setCreateOutletForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Address" placeholder="Physical outlet address" value={createOutletForm.address} onChange={(e) => setCreateOutletForm((f) => ({ ...f, address: e.target.value }))} />
          <TextInput label="Phone" placeholder="Contact number" value={createOutletForm.phone} onChange={(e) => setCreateOutletForm((f) => ({ ...f, phone: e.target.value }))} />
          <TextInput label="UPI ID" placeholder="store@upi" value={createOutletForm.upiId} onChange={(e) => setCreateOutletForm((f) => ({ ...f, upiId: e.target.value }))} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateOutletOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateOutlet}>Create Outlet</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Create User */}
      <Modal opened={createUserOpened} onClose={() => setCreateUserOpened(false)} title={<Text fw={700}>Add Platform User</Text>}>
        <Stack gap="sm">
          <TextInput label="Phone Number" placeholder="+91..." required value={createUserForm.phoneNumber} onChange={(e) => setCreateUserForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
          <TextInput label="Full Name" placeholder="Name" value={createUserForm.name} onChange={(e) => setCreateUserForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Email" placeholder="user@logixsoft.in" value={createUserForm.email} onChange={(e) => setCreateUserForm((f) => ({ ...f, email: e.target.value }))} />
          <Select label="Platform Role" value={createUserForm.role} onChange={(v) => setCreateUserForm((f) => ({ ...f, role: v || "CUSTOMER" }))} data={["CUSTOMER", "OWNER", "ADMIN"]} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateUserOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateUser}>Create User</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit User */}
      <Modal opened={editUserOpened} onClose={() => setEditUserOpened(false)} title={<Text fw={700}>Edit User & Role</Text>}>
        <Stack gap="sm">
          <TextInput label="Full Name" value={editUserForm.name} onChange={(e) => setEditUserForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Phone Number" value={editUserForm.phoneNumber} onChange={(e) => setEditUserForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
          <TextInput label="Email" value={editUserForm.email} onChange={(e) => setEditUserForm((f) => ({ ...f, email: e.target.value }))} />
          <Select label="Platform Role" value={editUserForm.role} onChange={(v) => setEditUserForm((f) => ({ ...f, role: v || "CUSTOMER" }))} data={["CUSTOMER", "OWNER", "ADMIN"]} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditUserOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleSaveEditUser}>Save Profile</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Create Menu Item */}
      <Modal opened={createItemOpened} onClose={() => setCreateItemOpened(false)} title={<Text fw={700}>Add Menu Item</Text>}>
        <Stack gap="sm">
          <Select label="Restaurant" placeholder="Select Restaurant" required data={restaurants.map((r) => ({ value: r.id, label: r.name }))} value={itemForm.restaurantId} onChange={(v) => setItemForm((f) => ({ ...f, restaurantId: v || "" }))} />
          <Select label="Category" placeholder="Select Category" required data={menuCategories.filter((c) => !itemForm.restaurantId || c.restaurantId === itemForm.restaurantId).map((c) => ({ value: c.id, label: c.name }))} value={itemForm.categoryId} onChange={(v) => setItemForm((f) => ({ ...f, categoryId: v || "" }))} />
          <TextInput label="Dish Name" placeholder="e.g. Butter Chicken" required value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} />
          <NumberInput label="Price (₹)" min={0} value={itemForm.pricePaise / 100} onChange={(v) => setItemForm((f) => ({ ...f, pricePaise: Math.round(Number(v || 0) * 100) }))} />
          <TextInput label="Description" placeholder="Dish ingredients and preparation notes" value={itemForm.description} onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateItemOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateMenuItem}>Add Item</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Create Dining Table */}
      <Modal opened={createTableOpened} onClose={() => setCreateTableOpened(false)} title={<Text fw={700}>Add Dining Table</Text>}>
        <Stack gap="sm">
          <Select label="Restaurant" placeholder="Select Restaurant" required data={restaurants.map((r) => ({ value: r.id, label: r.name }))} value={tableForm.restaurantId} onChange={(v) => setTableForm((f) => ({ ...f, restaurantId: v || "" }))} />
          <Select label="Outlet" placeholder="Select Outlet" required data={outlets.filter((o) => !tableForm.restaurantId || o.restaurantId === tableForm.restaurantId).map((o) => ({ value: o.id, label: o.name }))} value={tableForm.outletId} onChange={(v) => setTableForm((f) => ({ ...f, outletId: v || "" }))} />
          <TextInput label="Table Name / Number" placeholder="e.g. Table 5" required value={tableForm.name} onChange={(e) => setTableForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Dining Section" placeholder="e.g. Terrace / AC Hall" value={tableForm.section} onChange={(e) => setTableForm((f) => ({ ...f, section: e.target.value }))} />
          <NumberInput label="Guest Capacity" min={1} value={tableForm.capacity} onChange={(v) => setTableForm((f) => ({ ...f, capacity: Number(v || 2) }))} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateTableOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateTable}>Add Table</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Create Inventory Item */}
      <Modal opened={createInvOpened} onClose={() => setCreateInvOpened(false)} title={<Text fw={700}>Add Inventory Item</Text>}>
        <Stack gap="sm">
          <Select label="Restaurant" placeholder="Select Restaurant" required data={restaurants.map((r) => ({ value: r.id, label: r.name }))} value={invForm.restaurantId} onChange={(v) => setInvForm((f) => ({ ...f, restaurantId: v || "" }))} />
          <Select label="Outlet" placeholder="Select Outlet" required data={outlets.filter((o) => !invForm.restaurantId || o.restaurantId === invForm.restaurantId).map((o) => ({ value: o.id, label: o.name }))} value={invForm.outletId} onChange={(v) => setInvForm((f) => ({ ...f, outletId: v || "" }))} />
          <TextInput label="Item Name" placeholder="e.g. Basmati Rice" required value={invForm.name} onChange={(e) => setInvForm((f) => ({ ...f, name: e.target.value }))} />
          <Group grow>
            <TextInput label="Unit of Measure" placeholder="kg / liters / pcs" required value={invForm.baseUom} onChange={(e) => setInvForm((f) => ({ ...f, baseUom: e.target.value }))} />
            <NumberInput label="Current Stock" min={0} value={invForm.currentStock} onChange={(v) => setInvForm((f) => ({ ...f, currentStock: Number(v || 0) }))} />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateInvOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateInventory}>Add Stock Item</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Create Reservation */}
      <Modal opened={createResvOpened} onClose={() => setCreateResvOpened(false)} title={<Text fw={700}>Add Guest Reservation</Text>}>
        <Stack gap="sm">
          <Select label="Restaurant" placeholder="Select Restaurant" required data={restaurants.map((r) => ({ value: r.id, label: r.name }))} value={resvForm.restaurantId} onChange={(v) => setResvForm((f) => ({ ...f, restaurantId: v || "" }))} />
          <Select label="Outlet" placeholder="Select Outlet" required data={outlets.filter((o) => !resvForm.restaurantId || o.restaurantId === resvForm.restaurantId).map((o) => ({ value: o.id, label: o.name }))} value={resvForm.outletId} onChange={(v) => setResvForm((f) => ({ ...f, outletId: v || "" }))} />
          <TextInput label="Guest Name" placeholder="Guest Name" required value={resvForm.guestName} onChange={(e) => setResvForm((f) => ({ ...f, guestName: e.target.value }))} />
          <TextInput label="Guest Mobile" placeholder="+91..." required value={resvForm.guestPhone} onChange={(e) => setResvForm((f) => ({ ...f, guestPhone: e.target.value }))} />
          <Group grow>
            <NumberInput label="Party Size" min={1} value={resvForm.partySize} onChange={(v) => setResvForm((f) => ({ ...f, partySize: Number(v || 2) }))} />
            <TextInput label="Date" placeholder="YYYY-MM-DD" value={resvForm.reservationDate} onChange={(e) => setResvForm((f) => ({ ...f, reservationDate: e.target.value }))} />
            <TextInput label="Time" placeholder="19:00" value={resvForm.startTime} onChange={(e) => setResvForm((f) => ({ ...f, startTime: e.target.value }))} />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateResvOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateReservation}>Book Table</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Reply to Feedback */}
      <Modal opened={replyFeedbackOpened} onClose={() => setReplyFeedbackOpened(false)} title={<Text fw={700}>Reply to Customer Review</Text>}>
        <Stack gap="sm">
          <Text size="sm">Customer Comment: <em>"{selectedFeedback?.comment || "No comment"}"</em></Text>
          <Textarea label="Management Response" placeholder="Thank you for dining with us..." required value={feedbackReplyText} onChange={(e) => setFeedbackReplyText(e.target.value)} minRows={3} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setReplyFeedbackOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleReplyFeedback}>Publish Reply</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Order Purge */}
      <Modal opened={purgeModalOpened} onClose={() => setPurgeModalOpened(false)} title={<Text fw={700} c="red">Purge Orders Confirmation</Text>}>
        <Stack gap="sm">
          <Text size="sm">Select target store or wipe platform-wide:</Text>
          <Select label="Target Scope" value={purgeTargetRestId} onChange={(v) => setPurgeTargetRestId(v || "")} data={[{ value: "", label: "ALL Restaurants (Platform-wide Purge)" }, ...restaurants.map((r) => ({ value: r.id, label: r.name }))]} />
          <Alert color="red" icon={<IconAlertCircle size={16} />}>This action permanently deletes orders, items, and audit trails.</Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setPurgeModalOpened(false)}>Cancel</Button>
            <Button color="red" loading={submitting} onClick={handlePurgeOrders}>Confirm Purge</Button>
          </Group>
        </Stack>
      </Modal>
    </AppShell>
  );
}
