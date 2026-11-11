import Image from "next/image";

/**
 * The CourtWatch JA emblem (gold scales in a shield).
 *
 * Decorative by default: it always sits next to the "CourtWatch JA" wordmark,
 * so screen readers skip it. Source: public/brand/logo-3d.png (378px), which
 * stays sharp up to roughly 180px on screen. For anything larger use
 * public/brand/logo.svg.
 */
export default function BrandLogo({
  size = 28,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo-3d.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
