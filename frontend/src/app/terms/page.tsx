import Link from "next/link";
import { Scale, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service — CourtWatch JA",
  description:
    "Terms of Service for CourtWatch JA, Jamaica's free Jamaican court case tracker. Court information provided for convenience only — not legal advice.",
  alternates: { canonical: "https://courtwatchjamaica.com/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.05] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#009B3A]" />
            <span className="text-sm font-bold">CourtWatch JA</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#009B3A]">
            Legal
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold">Terms of Service</h1>
          <p className="mt-3 text-sm text-white/40">Last updated: May 15, 2026</p>
        </div>

        <div className="space-y-8 text-white/65 leading-relaxed text-sm">

          <section>
            <h2 className="text-base font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using CourtWatch JA (&quot;the Service&quot;), you agree
              to be bound by these Terms of Service. If you do not agree, do
              not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">2. Not Legal Advice</h2>
            <p>
              CourtWatch JA provides public court information sourced from
              official Jamaican court websites for informational and
              convenience purposes only. The information available through this
              Service{" "}
              <strong className="text-white/85">
                does not constitute legal advice
              </strong>{" "}
              and should not be relied upon as such. For legal advice, please
              consult a qualified attorney.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">3. Accuracy of Information</h2>
            <p>
              Court information is scraped from official sources and may
              contain errors or may not reflect the most current state of a
              case. CourtWatch JA makes no warranty as to the accuracy,
              completeness, or timeliness of any information displayed. Always
              verify important information directly with the relevant court.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">4. Use of the Service</h2>
            <p>You agree to use the Service only for lawful purposes. You may not:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-white/55">
              <li>Scrape or bulk-download data from the Service in an automated manner.</li>
              <li>Use the Service in any way that could damage, disable, or impair it.</li>
              <li>Attempt to gain unauthorised access to any part of the Service.</li>
              <li>Use the Service to harass or harm any individual.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">5. Accounts</h2>
            <p>
              You are responsible for maintaining the security of your account
              credentials. CourtWatch JA is not liable for any loss resulting
              from unauthorised use of your account. Notify us immediately if
              you suspect unauthorised access.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">6. Notifications</h2>
            <p>
              Case-tracking notifications are provided as a convenience.
              CourtWatch JA does not guarantee that all court listings will be
              captured or that notifications will be delivered without delay.
              Reliance on notifications for time-sensitive legal matters is
              done at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">7. Intellectual Property</h2>
            <p>
              The CourtWatch JA application, design, and original content are
              owned by CourtWatch JA. Court judgments and case data are public
              records of the Government of Jamaica and are not owned by
              CourtWatch JA.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, CourtWatch JA shall not
              be liable for any indirect, incidental, or consequential damages
              arising out of or in connection with the Service, including any
              reliance on information provided herein.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">9. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of
              the Service after changes constitutes acceptance of the new
              Terms. The date of the most recent update is shown above.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">10. Governing Law</h2>
            <p>
              These Terms are governed by the laws of Jamaica. Any disputes
              shall be subject to the exclusive jurisdiction of the courts of
              Jamaica.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">11. Contact</h2>
            <p>
              Questions about these Terms? Email{" "}
              <a
                href="mailto:courtwatchjamaica@protonmail.com"
                className="text-[#009B3A] hover:underline"
              >
                courtwatchjamaica@protonmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/[0.05] py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-4 text-xs text-white/30">
          <span>© 2026 CourtWatch JA</span>
          <Link href="/privacy" className="hover:text-white/55 transition-colors">Privacy Policy</Link>
          <Link href="/about" className="hover:text-white/55 transition-colors">About</Link>
        </div>
      </footer>
    </div>
  );
}
