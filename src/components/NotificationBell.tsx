"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Notification = {
  id: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const POLL_INTERVAL_MS = 20000;

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // tiho preskačemo, probaćemo opet na sledećem pollu
    }
  }

  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);

    function onFocus() {
      fetchNotifications();
    }
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleOpen() {
    const next = !open;
    setOpen(next);

    if (next && unreadCount > 0) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

      try {
        await fetch("/api/notifications/mark-read", {
          method: "PATCH",
          credentials: "include",
        });
      } catch {
        // ako padne, sledeći poll vraća tačno stanje sa servera
      }
    }
  }

  if (!user) return null;

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <button
        className="btn"
        onClick={handleOpen}
        style={{ position: "relative" }}
        aria-label="Notifikacije"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#e11d48",
              color: "white",
              borderRadius: "9999px",
              fontSize: "11px",
              lineHeight: "1",
              padding: "3px 5px",
              minWidth: "16px",
              textAlign: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "320px",
            maxHeight: "400px",
            overflowY: "auto",
            background: "white",
            border: "1px solid #d7dbe2",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            zIndex: 50,
          }}
        >
          {notifications.length === 0 ? (
            <div style={{ padding: "16px", color: "#888" }}>
              Nemate notifikacija.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #eee",
                  background: n.isRead ? "white" : "#f5f8ff",
                }}
              >
                <div style={{ fontSize: "14px" }}>{n.message}</div>
                <div
                  style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}
                >
                  {new Date(n.createdAt).toLocaleString("sr-RS")}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
