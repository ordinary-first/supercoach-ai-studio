import sharp from 'sharp';
import { readFileSync } from 'fs';

// 원본(기존 S 아이콘)을 먼저 메모리로 읽는다 — 이후 public/ 파일을 덮어써도 안전.
const SRC = readFileSync('public/icon-512.png');

// 흰 여백 제거 → S만 타이트하게
const tight = await sharp(SRC).trim().toBuffer();
const tmeta = await sharp(tight).metadata();

// 알파 마스크: S(어두운 부분) 불투명, 흰 배경 투명
const alpha = await sharp(tight).greyscale().negate().toColourspace('b-w').png().toBuffer();

// 흰/실버 S (배경 투명)
const whiteS = await sharp({ create: { width: tmeta.width, height: tmeta.height, channels: 3, background: '#FFFFFF' } })
  .joinChannel(alpha)
  .png()
  .toBuffer();

// 512 마스터 아이콘: 딥네이비 배경에 S를 72%로 꽉 차게
const INNER = Math.round(512 * 0.72);
const sResized = await sharp(whiteS).resize(INNER, INNER, { fit: 'inside' }).toBuffer();
const master = await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0A0E16' } })
  .composite([{ input: sResized, gravity: 'center' }])
  .png()
  .toBuffer();

// 사이즈별로 public/에 기록 (교체)
const targets = [
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/favicon-32.png', 32],
];
for (const [path, size] of targets) {
  await sharp(master).resize(size, size).png().toFile(path);
  console.log('wrote', path, size);
}
