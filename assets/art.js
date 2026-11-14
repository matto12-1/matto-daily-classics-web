// assets/art.js: 지면 스펙클 SVG(아침신문 계승).

export const SPECKLE = `
<svg class="speckle" aria-hidden="true"><defs>
  <pattern id="fib" width="90" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
    <rect x="10" y="14" width="14" height="3" rx="1.5" fill="#EE5A36" opacity=".5"/>
    <rect x="60" y="40" width="10" height="3" rx="1.5" fill="#2FA79B" opacity=".45"/>
    <rect x="34" y="70" width="12" height="3" rx="1.5" fill="#F0A83C" opacity=".5"/>
    <circle cx="76" cy="16" r="2" fill="#8CC9EA" opacity=".6"/>
    <circle cx="20" cy="52" r="1.6" fill="#EE5A36" opacity=".4"/>
  </pattern></defs>
  <rect width="100%" height="100%" fill="url(#fib)"/>
</svg>`;
