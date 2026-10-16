const API_BASE_URL =
  typeof window !== "undefined"
    ? ""
    : process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787";

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (typeof window !== "undefined") {
    // 1. Resolve stored token
    const token =
      localStorage.getItem("ipl_auction_auth_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("ipl_auction_token");

    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // 2. Resolve stored user profile
    try {
      const storedUser = localStorage.getItem("user") || localStorage.getItem("ipl_auction_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed?.role === "admin") {
          headers["X-User-Role"] = "admin";
        }
        if (parsed?.email) {
          headers["X-User-Email"] = parsed.email;
        }
      }
    } catch {}
  }

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error || `API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
