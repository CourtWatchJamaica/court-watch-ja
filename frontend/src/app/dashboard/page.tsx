"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Scale,
  Gavel,
  Bell,
  BookOpen,
  ArrowRight,
  Calendar,
  Search,
  User,
  TrendingUp,
  Clock,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { Judgment, UserCase } from "@/lib/types";

export default function DashboardPage() {
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [trackedCases, setTrackedCases] = useState<UserCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCases: 0,
    activeJudges: 0,
    notifications: 0,
    tracked: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      const [judgmentsData, trackedData] = await Promise.all([
        apiClient.getJudgments(),
        apiClient.getUserCases(),
      ]);

      const recentJudgments = judgmentsData.judgments.slice(0, 5);
      const tracked = trackedData.cases;

      setJudgments(recentJudgments);
      setTrackedCases(tracked);
      setStats({
        totalCases: judgmentsData.total,
        activeJudges: [
          ...new Set(recentJudgments.map((j) => j.judge_name).filter(Boolean)),
        ].length,
        notifications: 0,
        tracked: tracked.length,
      });
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  function formatDate(dateString: string | null) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-JM", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a1a2e] to-[#0d2818]">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#009B3A] via-[#006B3F] to-[#002B14] text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FED100] rounded-full filter blur-[128px] opacity-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#009B3A] rounded-full filter blur-[96px] opacity-30" />

        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-2">
            <Scale className="w-8 h-8 text-[#FED100]" />
            <span className="text-sm font-medium text-[#FED100] uppercase tracking-wider">
              Jamaican Law Tracker
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Welcome Back, <span className="text-[#FED100]">Counsel</span>
          </h1>
          <p className="text-lg text-white/80 max-w-2xl">
            Track your cases, follow judgments, and stay updated with the latest
            decisions from Jamaican courts.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-8 relative z-10">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Cases",
              value: stats.totalCases,
              icon: Scale,
              color: "from-[#009B3A] to-[#006B3F]",
            },
            {
              label: "Active Judges",
              value: stats.activeJudges,
              icon: Gavel,
              color: "from-[#FED100] to-[#e6b800]",
            },
            {
              label: "Notifications",
              value: stats.notifications,
              icon: Bell,
              color: "from-[#1a1a1a] to-[#333333]",
            },
            {
              label: "Tracked Cases",
              value: stats.tracked,
              icon: BookOpen,
              color: "from-[#009B3A] to-[#FED100]",
            },
          ].map((stat, index) => (
            <Card
              key={index}
              className="border-0 bg-black/40 backdrop-blur-xl shadow-2xl hover:shadow-[#009B3A]/20 transition-all duration-300 hover:-translate-y-1"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-white/60 mb-1">{stat.label}</p>
                    {loading ? (
                      <Skeleton className="h-10 w-16 bg-white/10" />
                    ) : (
                      <p className="text-3xl font-bold text-white">
                        {stat.value}
                      </p>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className={`mt-4 h-1 rounded-full bg-gradient-to-r ${stat.color} opacity-50`} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Recent Judgments */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-[#009B3A]" />
                  Recent Judgments
                </h2>
                <p className="text-white/60 text-sm mt-1">
                  Latest decisions from Jamaican courts
                </p>
              </div>
              <Link href="/cases">
                <Button
                  variant="outline"
                  className="border-[#009B3A]/30 text-[#009B3A] hover:bg-[#009B3A]/10 hover:border-[#009B3A]"
                >
                  View All <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border-0 bg-black/30">
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-3/4 bg-white/10 mb-4" />
                      <Skeleton className="h-4 w-1/2 bg-white/10 mb-2" />
                      <Skeleton className="h-4 w-full bg-white/10" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {judgments.map((judgment) => (
                  <Link href={`/cases/${judgment.id}`} key={judgment.id}>
                    <Card className="border-0 bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-all duration-300 group cursor-pointer hover:shadow-lg hover:shadow-[#009B3A]/10">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className="bg-[#009B3A]/20 text-[#009B3A] border-[#009B3A]/30">
                                {judgment.case_number}
                              </Badge>
                              {judgment.court && (
                                <span className="text-xs text-white/70 flex items-center gap-1">
                                  <Gavel className="w-3 h-3" />
                                  {judgment.court}
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-white group-hover:text-[#FED100] transition-colors">
                              {judgment.title || "Untitled Case"}
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-white/50 mb-3">
                          {judgment.judge_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {judgment.judge_name}
                            </span>
                          )}
                          {judgment.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(judgment.date)}
                            </span>
                          )}
                        </div>

                        {judgment.summary_text && (
                          <p className="text-white/60 text-sm line-clamp-2">
                            {judgment.summary_text}
                          </p>
                        )}

                        <div className="mt-4 flex items-center text-[#009B3A] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Read full judgment <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="border-0 bg-black/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-[#FED100]" />
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-white/50">
                  What would you like to do?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/cases">
                  <Button className="w-full bg-gradient-to-r from-[#009B3A] to-[#006B3F] hover:from-[#00B344] hover:to-[#008049] text-white border-0">
                    <Search className="w-4 h-4 mr-2" />
                    Search Cases
                  </Button>
                </Link>
                <Link href="/judges">
                  <Button variant="outline" className="w-full border-[#FED100]/30 text-[#FED100] hover:bg-[#FED100]/10">
                    <Gavel className="w-4 h-4 mr-2" />
                    Browse Judges
                  </Button>
                </Link>
                <Link href="/notifications">
                  <Button variant="outline" className="w-full border-white/10 text-white/70 hover:bg-white/5">
                    <Bell className="w-4 h-4 mr-2" />
                    Notifications
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-0 bg-black/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#009B3A]" />
                  Tracked Cases
                </CardTitle>
                <CardDescription className="text-white/50">
                  Cases you&apos;re following
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trackedCases.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-white/50 mx-auto mb-3" />
                    <p className="text-white/50 text-sm">No tracked cases yet</p>
                    <Link href="/cases">
                      <Button variant="link" className="text-[#009B3A] mt-2">
                        Start tracking cases
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trackedCases.map((tc) => (
                      <div
                        key={tc.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/20"
                      >
                        <div className="flex items-center gap-2">
                          <Badge className="bg-[#009B3A]/20 text-[#009B3A] border-0">
                            #{tc.case_id}
                          </Badge>
                          <span className="text-sm text-white/70">
                            {tc.case_type === "sitting" ? "Sitting" : "Case"} {tc.case_id}
                          </span>
                        </div>
                        <Badge variant="outline" className="border-[#009B3A]/30 text-[#009B3A]">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
