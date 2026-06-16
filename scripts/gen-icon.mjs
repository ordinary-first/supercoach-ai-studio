import sharp from 'sharp';

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="36%" r="80%">
      <stop offset="0%" stop-color="#123659"/>
      <stop offset="52%" stop-color="#0A1E38"/>
      <stop offset="100%" stop-color="#040D1A"/>
    </radialGradient>
    <linearGradient id="s" x1="18%" y1="0%" x2="82%" y2="100%">
      <stop offset="0%" stop-color="#9AD6FF"/>
      <stop offset="46%" stop-color="#5AA9FF"/>
      <stop offset="100%" stop-color="#4DE8E0"/>
    </linearGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="11" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="soft" x="-90%" y="-90%" width="280%" height="280%">
      <feGaussianBlur stdDeviation="42"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="238" r="118" fill="#5AA9FF" opacity="0.20" filter="url(#soft)"/>
  <path d="M 350 176 C 322 138, 222 132, 196 182 C 173 226, 232 252, 286 268 C 344 286, 350 350, 300 380 C 252 408, 178 392, 160 346"
        fill="none" stroke="url(#s)" stroke-width="50" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
</svg>`;

const buf = Buffer.from(svg);
const targets = [
  ['icon-512-new.png', 512],
  ['icon-192-new.png', 192],
  ['favicon-32-new.png', 32],
];
for (const [name, size] of targets) {
  await sharp(buf, { density: 384 }).resize(size, size).png().toFile(name);
  console.log('rendered', name);
}
