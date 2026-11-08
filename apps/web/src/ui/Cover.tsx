// PDFs carry no cover art, so each book gets a typographic cover in a colour picked from its title.
export function coverColor(title: string): string {
  // FNV-1a hash → a hue from 65° to 345°, staying clear of the red-orange range the accent owns.
  // Dark enough (30 % lightness) for white title text at AA contrast.
  let h = 0x811c9dc5;
  for (const c of title) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return `hsl(${65 + (h % 280)} 45% 30%)`;
}

export function Cover({ title, author, size = "m" }: { title: string; author?: string; size?: "s" | "m" | "l" }) {
  return (
    <div className={`cover cover-${size}`} style={{ background: coverColor(title) }} aria-hidden="true">
      {size !== "s" && <span className="cover-title">{title}</span>}
      {author && size !== "s" && <span className="cover-author">{author}</span>}
    </div>
  );
}
