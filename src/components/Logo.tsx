/**
 * The Real Food Hackz leaf. Drawn as vector art so it stays crisp at favicon
 * size, needs no image request, and sits on either theme without a white box.
 */

export function LeafMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  // Below ~32px the vein tracery just greys the leaf out, so keep the silhouette.
  const veins = size >= 32;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rfh-leaf" x1="18%" y1="12%" x2="86%" y2="94%">
          <stop offset="0%" stopColor="#6faa7f" />
          <stop offset="55%" stopColor="#4e8c66" />
          <stop offset="100%" stopColor="#356b4c" />
        </linearGradient>
      </defs>
      <path d="M 78.00,22.00 L 93,7" stroke="#2c5a41" strokeWidth="4.8" strokeLinecap="round"/>
      <path d="M 14.00,86.00 C 11.00,45.00 40.00,13.00 78.00,22.00 C 88.00,57.00 52.00,88.00 14.00,86.00 Z" fill="url(#rfh-leaf)" stroke="#2c5a41" strokeWidth="2.2" strokeLinejoin="round"/>
      {veins && (
        <g stroke="#dcebe1" strokeWidth="0.7" strokeLinecap="round" opacity="0.32">
      <path d="M 18.31,81.69 Q 16.18,82.82 13.82,82.34"/>
      <path d="M 18.31,81.69 Q 17.07,83.73 17.41,86.09"/>
      <path d="M 22.65,77.35 Q 19.13,81.43 13.82,82.34"/>
      <path d="M 22.65,77.35 Q 18.46,80.78 17.41,86.09"/>
      <path d="M 27.04,72.96 Q 21.30,77.74 13.82,77.77"/>
      <path d="M 27.04,72.96 Q 22.04,78.50 21.71,85.96"/>
      <path d="M 31.47,68.53 Q 23.12,71.77 14.63,68.94"/>
      <path d="M 31.47,68.53 Q 27.87,76.48 30.16,84.90"/>
      <path d="M 35.94,64.06 Q 25.55,65.84 16.42,60.59"/>
      <path d="M 35.94,64.06 Q 33.75,73.88 38.32,82.84"/>
      <path d="M 40.45,59.55 Q 28.58,60.00 19.15,52.79"/>
      <path d="M 40.45,59.55 Q 39.61,70.72 46.08,79.85"/>
      <path d="M 45.00,55.00 Q 32.19,54.32 22.75,45.63"/>
      <path d="M 45.00,55.00 Q 45.37,67.01 53.31,76.02"/>
      <path d="M 49.59,50.41 Q 36.36,48.84 27.17,39.19"/>
      <path d="M 49.59,50.41 Q 50.97,62.77 59.91,71.43"/>
      <path d="M 54.22,45.78 Q 41.08,43.61 32.33,33.57"/>
      <path d="M 54.22,45.78 Q 56.33,58.03 65.76,66.13"/>
      <path d="M 58.90,41.10 Q 46.34,38.69 38.19,28.83"/>
      <path d="M 58.90,41.10 Q 61.38,52.79 70.74,60.22"/>
      <path d="M 63.61,36.39 Q 52.11,34.14 44.68,25.08"/>
      <path d="M 63.61,36.39 Q 66.04,47.08 74.73,53.77"/>
      <path d="M 68.37,31.63 Q 58.39,30.00 51.74,22.38"/>
      <path d="M 68.37,31.63 Q 70.25,40.91 77.62,46.86"/>
      <path d="M 73.16,26.84 Q 65.15,26.33 59.31,20.83"/>
      <path d="M 73.16,26.84 Q 73.94,34.30 79.30,39.56"/>
      </g>
      )}
      <path d="M 14.00,86.00 Q 44.00,56.00 78.00,22.00" stroke="#e6f1e9" strokeWidth="1.4" strokeLinecap="round" opacity="0.6"/>
    </svg>
  );
}

/** Leaf + wordmark — the site header lockup. */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LeafMark size={small ? 28 : 36} />
      <span
        className={`font-semibold tracking-tight text-ink ${small ? "text-base" : "text-lg"}`}
      >
        Real Food Hackz
      </span>
    </div>
  );
}

/** The full badge: leaf with the name curved over its shoulder. Used where the
 *  logo gets room to breathe (About, and the exported logo.svg). */
export function LogoLockup({ width = 200, className = "" }: { width?: number; className?: string }) {
  return (
    <svg viewBox="0 0 224 176" width={width} fill="none" className={className} role="img" aria-label="Real Food Hackz">
      <defs>
        <linearGradient id="rfh-leaf-lockup" x1="18%" y1="12%" x2="86%" y2="94%">
          <stop offset="0%" stopColor="#6faa7f" />
          <stop offset="55%" stopColor="#4e8c66" />
          <stop offset="100%" stopColor="#356b4c" />
        </linearGradient>
        <path id="rfh-arc" d="M 45.05,120.69 A 69,69 0 0 1 171.75,69.50" />
      </defs>
      <g transform="translate(60,52)">
        <path d="M 78.00,22.00 L 93,7" stroke="#2c5a41" strokeWidth="4.8" strokeLinecap="round"/>
        <path d="M 14.00,86.00 C 11.00,45.00 40.00,13.00 78.00,22.00 C 88.00,57.00 52.00,88.00 14.00,86.00 Z" fill="url(#rfh-leaf-lockup)" stroke="#2c5a41" strokeWidth="2.2" strokeLinejoin="round"/>
        <g stroke="#dcebe1" strokeWidth="0.7" strokeLinecap="round" opacity="0.32">
      <path d="M 18.31,81.69 Q 16.18,82.82 13.82,82.34"/>
      <path d="M 18.31,81.69 Q 17.07,83.73 17.41,86.09"/>
      <path d="M 22.65,77.35 Q 19.13,81.43 13.82,82.34"/>
      <path d="M 22.65,77.35 Q 18.46,80.78 17.41,86.09"/>
      <path d="M 27.04,72.96 Q 21.30,77.74 13.82,77.77"/>
      <path d="M 27.04,72.96 Q 22.04,78.50 21.71,85.96"/>
      <path d="M 31.47,68.53 Q 23.12,71.77 14.63,68.94"/>
      <path d="M 31.47,68.53 Q 27.87,76.48 30.16,84.90"/>
      <path d="M 35.94,64.06 Q 25.55,65.84 16.42,60.59"/>
      <path d="M 35.94,64.06 Q 33.75,73.88 38.32,82.84"/>
      <path d="M 40.45,59.55 Q 28.58,60.00 19.15,52.79"/>
      <path d="M 40.45,59.55 Q 39.61,70.72 46.08,79.85"/>
      <path d="M 45.00,55.00 Q 32.19,54.32 22.75,45.63"/>
      <path d="M 45.00,55.00 Q 45.37,67.01 53.31,76.02"/>
      <path d="M 49.59,50.41 Q 36.36,48.84 27.17,39.19"/>
      <path d="M 49.59,50.41 Q 50.97,62.77 59.91,71.43"/>
      <path d="M 54.22,45.78 Q 41.08,43.61 32.33,33.57"/>
      <path d="M 54.22,45.78 Q 56.33,58.03 65.76,66.13"/>
      <path d="M 58.90,41.10 Q 46.34,38.69 38.19,28.83"/>
      <path d="M 58.90,41.10 Q 61.38,52.79 70.74,60.22"/>
      <path d="M 63.61,36.39 Q 52.11,34.14 44.68,25.08"/>
      <path d="M 63.61,36.39 Q 66.04,47.08 74.73,53.77"/>
      <path d="M 68.37,31.63 Q 58.39,30.00 51.74,22.38"/>
      <path d="M 68.37,31.63 Q 70.25,40.91 77.62,46.86"/>
      <path d="M 73.16,26.84 Q 65.15,26.33 59.31,20.83"/>
      <path d="M 73.16,26.84 Q 73.94,34.30 79.30,39.56"/>
      </g>
        <path d="M 14.00,86.00 Q 44.00,56.00 78.00,22.00" stroke="#e6f1e9" strokeWidth="1.4" strokeLinecap="round" opacity="0.6"/>
      </g>
      <text
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="16"
        fontWeight="700"
        letterSpacing="2.4"
        fill="currentColor"
      >
        <textPath href="#rfh-arc" startOffset="50%" textAnchor="middle">
          REAL FOOD HACKZ
        </textPath>
      </text>
    </svg>
  );
}
