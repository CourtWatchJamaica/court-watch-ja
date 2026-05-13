/**
 * Transcend legal icon set — inline SVG components.
 * Keep Search, Bell, Settings, ChevronRight, Loader2, ExternalLink, X, User as Lucide.
 */

interface IconProps {
  className?: string;
  strokeWidth?: number;
}

/** Scales of justice — replaces Scale in the Navbar logo */
export function HigherCourtIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="6" x2="22" y2="6" />
      <path d="M5 6 2 13h6L5 6z" />
      <path d="M19 6l-3 7h6l-3-7z" />
      <path d="M8 22h8" />
    </svg>
  );
}

/** Gavel — replaces Gavel / GavelIcon in Judge cards and Chambers button */
export function CourtroomIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14 13-7.5 7.5c-.83.83-2.17.83-3 0a2.12 2.12 0 0 1 0-3L11 10" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </svg>
  );
}

/** Newspaper / document — replaces FileText in Legal Pulse */
export function NewspaperIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M2 15h10" />
      <path d="M2 18h8" />
      <path d="M2 12h12" />
    </svg>
  );
}

/** Courthouse — replaces Building / Home on court landing pages */
export function CourtIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21h18" />
      <path d="M4 21V10" />
      <path d="M20 21V10" />
      <path d="M6 10V8" />
      <path d="M10 10V8" />
      <path d="M14 10V8" />
      <path d="M18 10V8" />
      <path d="M12 2 3 8h18L12 2z" />
      <rect x="9" y="13" width="6" height="8" />
    </svg>
  );
}

/** Bookmark with check — replaces Bookmark in Docket / tracking contexts */
export function VerdictIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      <path d="m9 11 2 2 4-4" />
    </svg>
  );
}

/** Filled bookmark with check — replaces BookmarkCheck in tracked state */
export function VerdictCheckIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path d="m9 11 2 2 4-4" />
    </svg>
  );
}
