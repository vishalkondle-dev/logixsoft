import React from 'react';

interface LogoIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function LogoIcon({ size = 32, className, style, ...props }: LogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="pgBgGradComponent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3730a3" />
          <stop offset="40%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="pgBoltGradComponent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="60%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      {/* Background Squircle */}
      <rect width="128" height="128" rx="28" fill="url(#pgBgGradComponent)" />
      <rect x="1" y="1" width="126" height="126" rx="27" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" fill="none" />

      {/* Top-Left Finder */}
      <rect x="20" y="20" width="34" height="34" rx="8" fill="none" stroke="#ffffff" strokeWidth="5.5" />
      <rect x="29" y="29" width="16" height="16" rx="4" fill="#ffffff" />

      {/* Top-Right Finder */}
      <rect x="74" y="20" width="34" height="34" rx="8" fill="none" stroke="#ffffff" strokeWidth="5.5" />
      <rect x="83" y="29" width="16" height="16" rx="4" fill="#ffffff" />

      {/* Bottom-Left Finder */}
      <rect x="20" y="74" width="34" height="34" rx="8" fill="none" stroke="#ffffff" strokeWidth="5.5" />
      <rect x="29" y="83" width="16" height="16" rx="4" fill="#ffffff" />

      {/* QR Timing & Alignment Modules */}
      <rect x="61" y="20" width="6" height="6" rx="2" fill="#ffffff" />
      <rect x="61" y="32" width="6" height="6" rx="2" fill="#ffffff" opacity="0.9" />
      <rect x="61" y="44" width="6" height="6" rx="2" fill="#ffffff" />

      <rect x="20" y="61" width="6" height="6" rx="2" fill="#ffffff" />
      <rect x="32" y="61" width="6" height="6" rx="2" fill="#ffffff" opacity="0.9" />
      <rect x="44" y="61" width="6" height="6" rx="2" fill="#ffffff" />

      {/* Center Hub Module */}
      <rect x="58" y="58" width="12" height="12" rx="3.5" fill="#ffffff" />

      {/* Bottom Data Modules */}
      <rect x="61" y="76" width="6" height="6" rx="2" fill="#ffffff" opacity="0.9" />
      <rect x="61" y="88" width="6" height="6" rx="2" fill="#ffffff" opacity="0.8" />
      <rect x="61" y="100" width="6" height="6" rx="2" fill="#ffffff" opacity="0.7" />

      {/* Bottom-Right Accent Module */}
      <rect x="98" y="98" width="8" height="8" rx="2.5" fill="#ffffff" opacity="0.9" />

      {/* Dynamic Payment Bolt */}
      <path
        d="M94 63 L74 85 L88 85 L79 107 L105 79 L91 79 Z"
        fill="url(#pgBoltGradComponent)"
        stroke="#67e8f9"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}
