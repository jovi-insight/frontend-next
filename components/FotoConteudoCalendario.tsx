"use client";

import { useState } from "react";

export default function FotoConteudoCalendario({
  url,
  alt,
  className = "",
}: {
  url?: string | null;
  alt: string;
  className?: string;
}) {
  const [urlQueFalhou, setUrlQueFalhou] = useState<string | null>(null);

  return (
    <span className={`calendario-arquivo-foto ${className}`.trim()}>
      {url && url !== urlQueFalhou ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setUrlQueFalhou(url)}
        />
      ) : (
        <span className="material-symbols-outlined" aria-label="Foto indisponível">
          hide_image
        </span>
      )}
    </span>
  );
}
