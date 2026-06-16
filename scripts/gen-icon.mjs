import sharp from 'sharp';

const SRC = 'public/icon-512.png';
const SIZE = 512;
const INNER = Math.round(SIZE * 0.72); // S가 프레임의 ~72% 차지 (꽉 차되 약간의 여백)

// 기존 아이콘에서 흰 여백 제거 → S만 타이트하게
const tight = await sharp(SRC).trim().toBuffer();
const tmeta = await sharp(tight).metadata();

// 알파 마스크: S(어두운 부분)는 불투명, 흰 배경은 투명
const alpha = await sharp(tight).greyscale().negate().toColourspace('b-w').png().toBuffer();

// 흰색 S (배경 투명)
const whiteS = await sharp({ create: { width: tmeta.width, height: tmeta.height, channels: 3, background: '#FFFFFF' } })
  .joinChannel(alpha)
  .png()
  .toBuffer();

// 기존 색(회색) S (배경 투명)
const origS = await sharp(tight).removeAlpha().joinChannel(alpha).png().toBuffer();

async function compose(sBuf, bgInput, out) {
  const s = await sharp(sBuf).resize(INNER, INNER, { fit: 'inside' }).toBuffer();
  await sharp(bgInput).composite([{ input: s, gravity: 'center' }]).png().toFile(out);
}

// 시안 A — X 스타일: 흰 S를 거의 검정(딥네이비)에 꽉 차게
await compose(
  whiteS,
  { create: { width: SIZE, height: SIZE, channels: 4, background: '#0A0E16' } },
  'icon-A-512.png',
);

// 시안 B — 기존 S 유지, 키우고 부드러운 라이트 그라데이션으로 깊이감
const lightBg = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g" cx="50%" cy="40%" r="80%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#D8E0EC"/></radialGradient></defs><rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/></svg>`,
);
await compose(origS, lightBg, 'icon-B-512.png');

console.log('rendered icon-A-512.png (X-style dark), icon-B-512.png (light depth)');
