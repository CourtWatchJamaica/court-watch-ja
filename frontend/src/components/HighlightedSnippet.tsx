"use client";

interface Props {
  text: string;
  className?: string;
  markClassName?: string;
}

// Splits on [[...]] delimiters produced by ts_headline and renders
// matched terms as highlighted <mark> spans.
export default function HighlightedSnippet({
  text,
  className = "text-[11px] text-white/65 leading-relaxed",
  markClassName = "bg-[#009B3A]/20 text-[#009B3A] rounded px-0.5 not-italic font-medium",
}: Props) {
  const parts = text.split(/(\[\[.*?\]\])/g);

  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("[[") && part.endsWith("]]")) {
          return (
            <mark key={i} className={markClassName}>
              {part.slice(2, -2)}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
