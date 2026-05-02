"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { notifications } = await apiClient.getNotifications();
        setCount(notifications.length);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {count}
        </Badge>
      )}
    </div>
  );
}
