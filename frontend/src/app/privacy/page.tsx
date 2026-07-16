import Link from "next/link";
import { Scale, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — CourtWatch JA",
  description:
    "How CourtWatch JA, Jamaica's free court case tracker, collects and uses your personal data. We never sell your information.",
  alternates: { canonical: "https://courtwatchjamaica.com/privacy" },
};

export default function PrivacyPage() {
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
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold">Privacy Policy</h1>
          <p className="mt-3 text-sm text-white/70">Last updated: May 15, 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-white/65 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-white mb-3">What We Collect</h2>
            <p>
              CourtWatch JA collects only the information necessary to provide
              the service:
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-white/55">
              <li>
                <strong className="text-white/80">Email address</strong> — used
                to create your account and send you court notifications.
              </li>
              <li>
                <strong className="text-white/80">Display name</strong> —
                optional, shown on your dashboard.
              </li>
              <li>
                <strong className="text-white/80">Tracked case numbers</strong>{" "}
                — the case numbers you choose to follow, stored so we can alert
                you when they appear in court lists or new judgments.
              </li>
              <li>
                <strong className="text-white/80">Notification preferences</strong>{" "}
                — your settings for when and how you want to be notified.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">How We Use Your Data</h2>
            <p>
              We use your data solely to operate and improve CourtWatch JA:
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-white/55">
              <li>Sending email alerts when your tracked cases are listed or new judgments are published.</li>
              <li>Personalising your dashboard with your name and tracked cases.</li>
              <li>Diagnosing technical issues and improving performance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">We Never Sell Your Data</h2>
            <p>
              CourtWatch JA does not sell, rent, or share your personal
              information with third parties for their marketing purposes.
              Your email address will never be used for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">Data Storage & Security</h2>
            <p>
              Your data is stored in a secured PostgreSQL database. Passwords
              are hashed using bcrypt and are never stored in plain text.
              Authentication tokens expire and are invalidated on sign-out.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-white/55">
              <li>
                <strong className="text-white/80">Brevo (Sendinblue)</strong> —
                for sending transactional emails. Your email address is
                transmitted to Brevo only when sending a notification.
              </li>
              <li>
                <strong className="text-white/80">Google OAuth</strong> —
                optional sign-in method. We only receive your email and public
                profile when you choose to sign in with Google.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">Your Rights</h2>
            <p>
              You may request deletion of your account and all associated data
              at any time by contacting us at{" "}
              <a
                href="mailto:courtwatchjamaica@protonmail.com"
                className="text-[#009B3A] hover:underline"
              >
                courtwatchjamaica@protonmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions about this policy? Email{" "}
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
        <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-4 text-xs text-white/60">
          <span>© 2026 CourtWatch JA</span>
          <Link href="/terms" className="hover:text-white/55 transition-colors">Terms of Service</Link>
          <Link href="/about" className="hover:text-white/55 transition-colors">About</Link>
        </div>
      </footer>
    </div>
  );
}
