import { TracingPreset } from '../types';

// High-detail SVG data URIs for immediate offline testing
const daVinciEyeSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450" fill="none">
  <rect width="600" height="450" fill="#141416"/>
  <g stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <!-- Outer Eye Contours -->
    <path d="M120 225 C 220 120, 380 120, 480 225" />
    <path d="M120 225 C 220 310, 380 310, 480 225" />
    <!-- Tear Duct -->
    <path d="M120 225 C 105 228, 95 235, 105 240 C 115 242, 125 235, 120 225" stroke="#E2E8F0" stroke-width="2"/>
    <!-- Iris & Pupil -->
    <circle cx="300" cy="215" r="75" stroke="#38BDF8" stroke-width="3"/>
    <circle cx="300" cy="215" r="32" fill="#F59E0B" stroke="#F59E0B" stroke-width="2"/>
    <!-- Light Reflection Highlight -->
    <ellipse cx="280" cy="195" rx="14" ry="10" fill="#FFFFFF"/>
    <!-- Upper Eyelid Fold -->
    <path d="M110 185 C 220 90, 380 90, 490 185" stroke="#94A3B8" stroke-width="2" stroke-dasharray="4 2"/>
    <!-- Eyebrow Arch & Hatching -->
    <path d="M90 120 C 220 40, 380 50, 520 110" stroke="#FBBF24" stroke-width="4"/>
    <path d="M120 115 L 135 90 M 160 105 L 180 75 M 210 95 L 230 65 M 270 85 L 290 60 M 340 85 L 355 65 M 410 95 L 420 80 M 470 105 L 475 95" stroke="#FBBF24" stroke-width="2"/>
    <!-- Eyelashes -->
    <path d="M180 170 Q 170 130 160 110" stroke="#F59E0B" stroke-width="2"/>
    <path d="M240 155 Q 240 120 235 95" stroke="#F59E0B" stroke-width="2.5"/>
    <path d="M300 150 Q 300 110 305 85" stroke="#F59E0B" stroke-width="2.5"/>
    <path d="M370 155 Q 380 120 390 95" stroke="#F59E0B" stroke-width="2.5"/>
    <path d="M440 180 Q 460 150 475 130" stroke="#F59E0B" stroke-width="2"/>
    <!-- Shading hatching on lower lid -->
    <path d="M180 260 L 195 280 M 230 270 L 245 290 M 290 275 L 300 295 M 350 270 L 360 290 M 410 255 L 420 275" stroke="#64748B" stroke-width="1.5"/>
  </g>
</svg>
`)}`;

const botanicalLeafSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" fill="none">
  <rect width="600" height="600" fill="#111827"/>
  <g stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <!-- Central Stem -->
    <path d="M300 550 C 300 400, 305 250, 310 80" stroke="#34D399" stroke-width="6"/>
    <!-- Monstera Outline & Fenestrations -->
    <path d="M310 80 C 420 110, 520 230, 480 390 C 450 480, 370 520, 300 550 C 230 520, 150 480, 120 390 C 80 230, 180 110, 310 80 Z" fill="#064E3B" fill-opacity="0.2"/>
    <!-- Cutouts / Slits -->
    <path d="M310 180 C 370 170, 420 150, 450 140 C 430 190, 380 220, 310 220" />
    <path d="M310 270 C 390 270, 450 260, 480 270 C 450 320, 390 330, 310 320" />
    <path d="M310 370 C 390 380, 440 390, 460 420 C 420 440, 370 430, 310 410" />
    <!-- Left Cutouts -->
    <path d="M310 180 C 250 170, 200 150, 170 140 C 190 190, 240 220, 310 220" />
    <path d="M310 270 C 230 270, 170 260, 140 270 C 170 320, 230 330, 310 320" />
    <path d="M310 370 C 230 380, 180 390, 160 420 C 200 440, 250 430, 310 410" />
  </g>
</svg>
`)}`;

const tattooRoseSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
  <rect width="500" height="500" fill="#18181B"/>
  <g stroke="#F43F5E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <!-- Rose Center Heart -->
    <path d="M250 180 C 240 160, 220 160, 210 180 C 200 200, 240 220, 250 230 C 260 220, 300 200, 290 180 C 280 160, 260 160, 250 180 Z" fill="#9F1239" fill-opacity="0.3"/>
    <!-- Inner Petals Spiral -->
    <path d="M210 190 C 190 210, 200 250, 240 260 C 270 265, 295 245, 290 220" />
    <path d="M230 165 C 260 150, 305 170, 310 205 C 315 245, 280 275, 250 280" />
    <path d="M190 175 C 165 200, 170 245, 195 270 C 220 295, 275 300, 310 275" />
    <!-- Outer Dramatic Petals -->
    <path d="M150 220 C 130 260, 150 320, 210 340 C 270 360, 340 335, 365 285 C 385 245, 360 190, 325 160" />
    <path d="M175 330 C 220 375, 290 375, 335 330" />
    <!-- Leaves -->
    <path d="M140 280 C 90 290, 70 350, 110 390 C 150 410, 180 370, 170 330 Z" stroke="#10B981" stroke-width="2.5"/>
    <path d="M100 340 L 140 345 M 115 365 L 135 355" stroke="#10B981" stroke-width="1.5"/>
    <path d="M350 280 C 400 290, 420 350, 380 390 C 340 410, 310 370, 320 330 Z" stroke="#10B981" stroke-width="2.5"/>
    <path d="M390 340 L 350 345 M 375 365 L 355 355" stroke="#10B981" stroke-width="1.5"/>
  </g>
</svg>
`)}`;

const faceProportionsSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 600" width="500" height="600" fill="none">
  <rect width="500" height="600" fill="#0F172A"/>
  <!-- Loomis / Proportion Construction Guides -->
  <g stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.6">
    <!-- Center Vertical Line -->
    <line x1="250" y1="50" x2="250" y2="550"/>
    <!-- Rule of Thirds Facial Lines -->
    <line x1="80" y1="160" x2="420" y2="160"/> <!-- Hairline -->
    <line x1="80" y1="270" x2="420" y2="270"/> <!-- Browline -->
    <line x1="80" y1="380" x2="420" y2="380"/> <!-- Nose base -->
    <line x1="120" y1="460" x2="380" y2="460"/> <!-- Mouth line -->
    <circle cx="250" cy="240" r="150"/> <!-- Loomis Sphere -->
  </g>
  <!-- Face Feature Outlines -->
  <g stroke="#F59E0B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <!-- Jaw & Chin -->
    <path d="M130 250 C 135 380, 180 480, 250 510 C 320 480, 365 380, 370 250"/>
    <!-- Left & Right Eyes -->
    <path d="M165 290 Q 195 275 225 290 Q 195 305 165 290 Z"/>
    <circle cx="195" cy="290" r="10" fill="#F59E0B"/>
    <path d="M275 290 Q 305 275 335 290 Q 305 305 275 290 Z"/>
    <circle cx="305" cy="290" r="10" fill="#F59E0B"/>
    <!-- Eyebrows -->
    <path d="M155 265 Q 195 250 230 265"/>
    <path d="M270 265 Q 305 250 345 265"/>
    <!-- Nose -->
    <path d="M245 280 L 240 370 Q 250 385 260 370"/>
    <path d="M230 365 Q 235 380 245 375"/>
    <path d="M270 365 Q 265 380 255 375"/>
    <!-- Lips -->
    <path d="M210 440 Q 250 425 290 440"/>
    <path d="M210 440 Q 250 455 290 440"/>
    <path d="M225 440 Q 250 470 275 440"/>
  </g>
</svg>
`)}`;

export const TRACING_PRESETS: TracingPreset[] = [
  {
    id: 'davinci-eye',
    title: 'Da Vinci Anatomical Eye',
    category: 'Anatomy Study',
    difficulty: 'Intermediate',
    thumbnailUrl: daVinciEyeSvg,
    sourceUrl: daVinciEyeSvg,
    recommendedFilter: 'edges'
  },
  {
    id: 'botanical-monstera',
    title: 'Monstera Deliciosa Leaf',
    category: 'Botanical',
    difficulty: 'Beginner',
    thumbnailUrl: botanicalLeafSvg,
    sourceUrl: botanicalLeafSvg,
    recommendedFilter: 'stencil'
  },
  {
    id: 'tattoo-rose',
    title: 'Neo-Traditional Rose',
    category: 'Tattoo & Stencils',
    difficulty: 'Beginner',
    thumbnailUrl: tattooRoseSvg,
    sourceUrl: tattooRoseSvg,
    recommendedFilter: 'normal'
  },
  {
    id: 'face-proportions',
    title: 'Loomis Head & Facial Proportions',
    category: 'Portraiture',
    difficulty: 'Master',
    thumbnailUrl: faceProportionsSvg,
    sourceUrl: faceProportionsSvg,
    recommendedFilter: 'edges'
  }
];
