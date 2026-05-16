"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import ThemeToggle from "@/components/ThemeToggle";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Palette, Bell, ChevronRight, HelpCircle, Mail } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await apiClient.updatePreferences(emailNotifications, pushNotifications);
      setMessage("Settings saved successfully!");
    } catch (error) {
      setMessage("Failed to save settings");
      console.error(error);
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-12">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-[#009B3A]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#009B3A]">
                Preferences
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Manage your account preferences and appearance
            </p>
          </div>

          <div className="space-y-5">
            {/* Appearance */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[#009B3A]" />
                  <CardTitle className="text-base">Appearance</CardTitle>
                </div>
                <CardDescription>Switch between dark and light mode</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Theme</p>
                    <p className="text-xs text-muted-foreground">
                      Toggle between dark (default) and light mode
                    </p>
                  </div>
                  <ThemeToggle className="h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50" />
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings — link card */}
            <button
              onClick={() => router.push("/settings/notifications")}
              className="w-full text-left group"
            >
              <Card className="border-border bg-card transition-colors group-hover:border-[#009B3A]/30">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#009B3A]/10">
                      <Bell className="h-4 w-4 text-[#009B3A]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Notification Alerts</p>
                      <p className="text-xs text-muted-foreground">
                        Set custom alert schedules for your tracked cases
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </CardContent>
              </Card>
            </button>

            {/* Global Notification Preferences */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Notification Preferences</CardTitle>
                <CardDescription>
                  Global notification delivery settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications" className="text-sm font-medium">
                      Email Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Receive case updates via email
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-notifications" className="text-sm font-medium">
                      Push Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Receive push notifications for case updates
                    </p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#009B3A] hover:bg-[#009B3A]/85 text-white w-full sm:w-auto"
                  >
                    {saving ? "Saving…" : "Save Preferences"}
                  </Button>
                  {message && (
                    <p
                      className={`mt-2 text-xs ${
                        message.includes("success")
                          ? "text-[#009B3A]"
                          : "text-red-500"
                      }`}
                    >
                      {message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            {/* Help & Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/help" className="group">
                <Card className="border-border bg-card h-full transition-colors group-hover:border-[#009B3A]/30">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#009B3A]/10">
                        <HelpCircle className="h-4 w-4 text-[#009B3A]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Help Centre</p>
                        <p className="text-xs text-muted-foreground">FAQs &amp; guides</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="mailto:courtwatchjamaica@protonmail.com" className="group">
                <Card className="border-border bg-card h-full transition-colors group-hover:border-[#009B3A]/30">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#009B3A]/10">
                        <Mail className="h-4 w-4 text-[#009B3A]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Contact Us</p>
                        <p className="text-xs text-muted-foreground">courtwatchjamaica@protonmail.com</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            </div>

          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
