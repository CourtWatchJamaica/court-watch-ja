"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, Bell, Bookmark, Gavel, Mail } from "lucide-react";

const SECTIONS = [
  {
    id: "search",
    icon: Search,
    title: "Searching Cases",
    items: [
      {
        q: "How do I search for a specific case?",
        a: "Use the search bar at the top of the Cases page. You can search by case number, party name, judge name, or keywords from the judgment text. Enclose phrases in quotes for exact matches — for example, \"breach of contract\".",
      },
      {
        q: "Why does my search return no results?",
        a: "Try broadening your search. Very specific terms or legal jargon may not appear in the indexed text. If you're searching for a case number, ensure the format matches — for example, CL 2023/JM-001. Court filtering also applies, so check the active court tab.",
      },
      {
        q: "Can I filter by court and date?",
        a: "Yes. On the Cases page, use the court tabs (Supreme Court, Court of Appeal, Parish Court) and the date-range picker to narrow results. Your filter selections are preserved in the URL so you can bookmark or share a filtered view.",
      },
      {
        q: "What does the highlighted snippet under a result mean?",
        a: "When you perform a keyword search, CourtWatch JA highlights the matched text in green (for judgments) or gold (for sittings) so you can immediately see the context of your match without opening the full record.",
      },
    ],
  },
  {
    id: "tracking",
    icon: Bookmark,
    title: "Tracking Cases",
    items: [
      {
        q: "How do I track a case?",
        a: "Click the bookmark icon on any case card, or open the case detail page and press Track. Tracked cases appear in your dashboard and generate notifications whenever they are updated.",
      },
      {
        q: "Is there a limit to how many cases I can track?",
        a: "There is no hard limit. However, tracking a large number of cases will generate more notifications. You can remove cases from your tracked list at any time from your dashboard or the case detail page.",
      },
      {
        q: "How do I stop tracking a case?",
        a: "Click the bookmarked icon on a case you're already tracking — it will toggle back to untracked. You can also manage all tracked cases from your dashboard.",
      },
      {
        q: "What types of updates trigger a notification?",
        a: "Two events generate notifications: (1) a new judgment is filed for a case you're tracking, and (2) a court sitting schedule changes — the event date or time is updated. You'll be notified in-app, and optionally by email.",
      },
    ],
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Notifications",
    items: [
      {
        q: "Where do I see my notifications?",
        a: "The bell icon in the navigation bar shows your unread notification count. Click it to go to the Notifications page, where you can see all recent updates, mark individual items as read, or clear everything at once.",
      },
      {
        q: "Can I turn off email notifications?",
        a: "Yes. Go to Settings → Notification Preferences and toggle Email Notifications off. You can also customise per-case alert schedules under Settings → Notification Alerts.",
      },
      {
        q: "I'm not receiving notifications even though I track cases.",
        a: "First, check that your notification preferences are enabled in Settings. If you've just started tracking a case, notifications are generated after the next scraper run — typically within 24 hours. If problems persist, contact us at courtwatchjamaica@protonmail.com.",
      },
    ],
  },
  {
    id: "chambers",
    icon: Gavel,
    title: "Chambers Tools",
    items: [
      {
        q: "What is the Chambers panel?",
        a: "The Chambers panel is a quick-access side drawer for legal practitioners. It gives you rapid access to your most recently viewed cases, tracked matters, and today's sitting schedule — all without leaving your current page.",
      },
      {
        q: "How do I open Chambers?",
        a: "Tap the gavel icon in the mobile bottom navigation bar, or press the keyboard shortcut Cmd+K (Mac) / Ctrl+K (Windows) from any page.",
      },
      {
        q: "Can I customise what appears in Chambers?",
        a: "The Chambers panel currently shows your tracked cases and today's sittings. Customisation options — such as pinned searches and personal notes — are planned for a future release.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-32 md:pb-16">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Help Centre</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Answers to the most common questions about CourtWatch JA.
          </p>
        </div>

        {/* FAQ sections */}
        <div className="space-y-6">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.id}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                </div>

                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <Accordion type="multiple" className="divide-y divide-border">
                    {section.items.map((item, i) => (
                      <AccordionItem
                        key={i}
                        value={`${section.id}-${i}`}
                        className="border-0 px-5"
                      >
                        <AccordionTrigger className="py-4 text-left text-sm font-medium text-foreground hover:no-underline hover:text-primary transition-colors [&[data-state=open]]:text-primary">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 text-sm text-muted-foreground leading-relaxed">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </section>
            );
          })}
        </div>

        {/* Contact CTA */}
        <div className="mt-8 rounded-lg border border-border bg-card p-6 text-center">
          <h3 className="text-sm font-semibold text-foreground">Still need help?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Our team is happy to assist with any questions.
          </p>
          <Link
            href="mailto:courtwatchjamaica@protonmail.com"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Contact us
          </Link>
        </div>

      </main>
    </div>
  );
}
