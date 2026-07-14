import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">

          {/* Brand */}
          <div>
            <p className="font-heading font-bold text-base text-foreground mb-1">
              CourtWatch JA<span className="text-primary">.</span>
            </p>
            <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-[220px]">
              Free, open access to Jamaican court records. Built for transparency.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40 mb-3">
              Project
            </p>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/CourtWatchJamaica/court-watch-ja"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  Open Source on GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/CourtWatchJamaica/court-watch-ja/blob/main/CONTRIBUTING.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  Contribute
                </a>
              </li>
              <li>
                <Link href="/about" className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>

          {/* Donate */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40 mb-3">
              Support the Project
            </p>
            <p className="text-xs text-muted-foreground/60 leading-relaxed mb-3">
              CourtWatch JA is free and always will be. If it helps you, consider supporting hosting costs.
            </p>
            <a
              href="https://ko-fi.com/F8J6237MQQ"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF5E5B]/10 border border-[#FF5E5B]/25 px-4 py-2.5 text-xs font-semibold text-[#FF5E5B] hover:bg-[#FF5E5B]/20 transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
              </svg>
              Buy us a coffee
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground/40">
            © {new Date().getFullYear()} CourtWatch Jamaica. Licensed under{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-muted-foreground/70 transition-colors"
            >
              AGPL-3.0
            </a>
            .
          </p>
          <p className="text-[11px] text-muted-foreground/30">
            Data sourced from{" "}
            <a
              href="https://supremecourt.gov.jm"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-muted-foreground/50 transition-colors"
            >
              supremecourt.gov.jm
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
