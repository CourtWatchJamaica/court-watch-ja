"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/api";
import { Judgment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  FileText,
  Calendar,
  User,
  Building,
  Download,
  Bookmark,
} from "lucide-react";

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    const fetchJudgment = async () => {
      try {
        const { judgment: data } = await apiClient.getJudgment(
          params.id as string,
        );
        setJudgment(data);
      } catch (error) {
        console.error("Failed to fetch judgment:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJudgment();
  }, [params.id]);

  const handleTrackCase = async () => {
    if (!judgment) return;
    setTracking(true);
    try {
      await apiClient.addUserCase(judgment.id);
      alert("Case tracked successfully!");
    } catch (error) {
      console.error("Failed to track case:", error);
      alert("Failed to track case");
    } finally {
      setTracking(false);
    }
  };

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

  if (!judgment) {
    return (
      <AuthGuard>
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-center text-gray-500">Case not found</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl mb-2">
                  {judgment.title || judgment.case_number}
                </CardTitle>
                <Badge variant="outline" className="text-sm">
                  {judgment.case_number}
                </Badge>
              </div>
              <Button onClick={handleTrackCase} disabled={tracking}>
                <Bookmark className="h-4 w-4 mr-2" />
                {tracking ? "Tracking..." : "Track Case"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {judgment.judge_name && (
                <div className="flex items-start">
                  <User className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Judge</p>
                    <p className="text-base">{judgment.judge_name}</p>
                  </div>
                </div>
              )}
              {judgment.court && (
                <div className="flex items-start">
                  <Building className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Court</p>
                    <p className="text-base">{judgment.court}</p>
                  </div>
                </div>
              )}
              {judgment.date && (
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Date</p>
                    <p className="text-base">
                      {new Date(judgment.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {judgment.summary_text && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Summary</h3>
                <p className="text-gray-700 leading-relaxed">
                  {judgment.summary_text}
                </p>
              </div>
            )}

            {judgment.pdf_url && (
              <div>
                <Button variant="outline" asChild>
                  <a
                    href={judgment.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </a>
                </Button>
              </div>
            )}

            <div className="text-xs text-gray-500 pt-4 border-t">
              <p>
                Created: {new Date(judgment.created_at).toLocaleString()} • Last
                updated: {new Date(judgment.updated_at).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </AuthGuard>
  );
}
