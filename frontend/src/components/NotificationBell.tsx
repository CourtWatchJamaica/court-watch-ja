"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { count } = await apiClient.getNotificationsUnreadCount();
        setUnread(count);
      } catch {
        // silently ignore
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {unread > 99 ? "99+" : unread}
        </Badge>
      )}
    </div>
  );
}
