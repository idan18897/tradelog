export default function TradingLogIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="tl-round">
          <rect width="200" height="200" rx="44"/>
        </clipPath>
      </defs>

      <g clipPath="url(#tl-round)">
        {/* Backgrounds */}
        <polygon points="0,0 200,0 0,200" fill="#1a3d2e"/>
        <polygon points="200,200 200,0 0,200" fill="#3d1a22"/>
        {/* Diagonal */}
        <line x1="200" y1="0" x2="0" y2="200" stroke="white" strokeWidth="5" strokeLinecap="round"/>

        {/* ── BULL (upper-left) ── */}
        <g stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Body */}
          <ellipse cx="62" cy="88" rx="36" ry="22"/>
          {/* Head */}
          <ellipse cx="104" cy="70" rx="19" ry="16"/>
          {/* Muzzle */}
          <ellipse cx="116" cy="76" rx="9" ry="7"/>
          {/* Horns */}
          <path d="M 97 58 Q 90 42 98 36"/>
          <path d="M 106 57 Q 114 38 122 34"/>
          {/* Neck connection */}
          <line x1="87" y1="74" x2="98" y2="76"/>
          {/* Legs */}
          <line x1="46" y1="108" x2="44" y2="132"/>
          <line x1="58" y1="108" x2="57" y2="132"/>
          <line x1="72" y1="108" x2="74" y2="132"/>
          <line x1="82" y1="107" x2="84" y2="130"/>
          {/* Tail */}
          <path d="M 27 84 Q 18 76 20 64"/>
        </g>

        {/* ── BEAR (lower-right) ── */}
        <g stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Body */}
          <ellipse cx="148" cy="162" rx="27" ry="18"/>
          {/* Head */}
          <circle cx="148" cy="132" r="22"/>
          {/* Ears */}
          <circle cx="131" cy="115" r="8"/>
          <circle cx="165" cy="115" r="8"/>
          {/* Snout */}
          <ellipse cx="148" cy="139" rx="10" ry="7"/>
          {/* Eyes */}
          <circle cx="140" cy="127" r="2" fill="white" stroke="none"/>
          <circle cx="156" cy="127" r="2" fill="white" stroke="none"/>
          {/* Open mouth */}
          <path d="M 138 145 Q 148 155 158 145"/>
          {/* Paws */}
          <path d="M 124 158 Q 116 170 122 174"/>
          <path d="M 172 158 Q 180 170 174 174"/>
        </g>
      </g>

      <rect width="200" height="200" rx="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
    </svg>
  )
}
