"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { Notification } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, FileText } from "lucide-react";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { notifications: data } = await apiClient.getNotifications();
        setNotifications(data);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  if (loading) {
    return (
      <AuthGuard>
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center">
            <Bell className="h-8 w-8 mr-3" />
            Notifications
          </h1>
          <p className="text-gray-600">Updates on your tracked cases</p>
        </div>

        <div className="space-y-4">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/cases/${notification.case_id}`)}
              >
                <CardContent className="flex items-start p-4">
                  <FileText className="h-5 w-5 mr-3 mt-1 text-blue-600" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {notification.type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(notification.sent_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Update for Case ID {notification.case_id}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12 text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No notifications yet</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}
