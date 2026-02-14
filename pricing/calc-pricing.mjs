import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, 'pricing-config.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const TEXT_MODEL = 'gpt-4o-mini';
const IMAGE_MODEL = 'gpt-image-1.5';
const AUDIO_MODEL = 'gpt-4o-mini-tts';
const VIDEO_MODEL = 'sora-2';

const CREDIT_COST = {
  medium: 1,
  high: 3,
};

const money = (value) => `$${value.toFixed(2)}`;

const calcTextCost = (inputTokens, outputTokens, calls) => {
  const model = config.openaiPricing.textModels[TEXT_MODEL];
  const input = (inputTokens * calls * model.inputPer1MUsd) / 1_000_000;
  const output = (outputTokens * calls * model.outputPer1MUsd) / 1_000_000;
  return input + output;
};

const calcImageCountsByCredits = (credits, highCreditRatio) => {
  const highCredits = Math.floor(credits * highCreditRatio);
  const highImages = Math.floor(highCredits / CREDIT_COST.high);
  const usedForHigh = highImages * CREDIT_COST.high;
  const mediumCredits = Math.max(0, credits - usedForHigh);
  const mediumImages = Math.floor(mediumCredits / CREDIT_COST.medium);
  return { highImages, mediumImages };
};

const calcImageCost = (mediumImages, highImages) => {
  const model = config.openaiPricing.imageModels[IMAGE_MODEL];
  const medium = mediumImages * model.medium1024Usd;
  const high = highImages * model.high1024Usd;
  return medium + high;
};

const calcAudioCost = (minutes) => {
  const model = config.openaiPricing.audioModels[AUDIO_MODEL];
  return minutes * model.perMinuteUsd;
};

const calcVideoCost = (generations) => {
  const model = config.openaiPricing.videoModels[VIDEO_MODEL];
  const seconds = config.assumptions.videoLengthSeconds;
  return generations * seconds * model.perSecond720pUsd;
};

const calcInfraPerPaidUser = () => {
  const infra = config.assumptions.infra;
  const shared = infra.fixedMonthlyUsd / infra.assumedPaidUsers;
  return shared + infra.variablePerPaidUserUsd;
};

const calcFees = (priceUsd) => {
  if (priceUsd <= 0) return 0;
  const percent = config.fees.polarSubscriptionPercent * priceUsd;
  return percent + config.fees.polarFixedUsd;
};

const calcTierCost = (tier, mode) => {
  const limits = tier.limits;
  const isPaid = tier.priceUsd > 0;
  const highRatio =
    mode === 'worst'
      ? limits.highImageCreditRatioWorst
      : limits.highImageCreditRatioExpected;
  const imageCounts = calcImageCountsByCredits(limits.imageCredits, highRatio);

  const chatCost = calcTextCost(
    config.assumptions.chatInputTokensPerMessage,
    config.assumptions.chatOutputTokensPerMessage,
    limits.chatMessages,
  );

  const narrativeCost = calcTextCost(
    config.assumptions.narrativeInputTokensPerCall,
    config.assumptions.narrativeOutputTokensPerCall,
    limits.narrativeCalls,
  );

  const imageCost = calcImageCost(imageCounts.mediumImages, imageCounts.highImages);
  const audioCost = calcAudioCost(limits.audioMinutes);
  const videoCost = calcVideoCost(limits.videoGenerations);
  const aiCost = chatCost + narrativeCost + imageCost + audioCost + videoCost;
  const infraCost = isPaid ? calcInfraPerPaidUser() : 0;
  const totalCost = aiCost + infraCost;

  const fee = calcFees(tier.priceUsd);
  const netRevenue = Math.max(0, tier.priceUsd - fee);
  const margin = netRevenue - totalCost;
  const marginRate = netRevenue > 0 ? (margin / netRevenue) * 100 : 0;

  return {
    tier: tier.name,
    mode,
    price: tier.priceUsd,
    fee,
    netRevenue,
    chatCost,
    narrativeCost,
    imageCost,
    audioCost,
    videoCost,
    infraCost,
    totalCost,
    margin,
    marginRate,
    imageCounts,
  };
};

const printRow = (row) => {
  const sign = row.margin >= 0 ? 'OK' : 'RISK';
  const label = `${row.tier} (${row.mode})`;
  const images = `M:${row.imageCounts.mediumImages}/H:${row.imageCounts.highImages}`;
  console.log(
    [
      label.padEnd(22),
      `price ${money(row.price)}`.padEnd(14),
      `net ${money(row.netRevenue)}`.padEnd(14),
      `cost ${money(row.totalCost)}`.padEnd(16),
      `margin ${money(row.margin)}`.padEnd(16),
      `(${row.marginRate.toFixed(1)}%)`.padEnd(10),
      `[${sign}]`.padEnd(8),
      `images ${images}`,
    ].join(' | '),
  );
};

console.log('Secret Coach pricing simulation');
console.log(`Config: ${configPath}`);
console.log(`Image model: ${IMAGE_MODEL}, Text model: ${TEXT_MODEL}`);
console.log('---');

for (const tier of config.tiers) {
  const expected = calcTierCost(tier, 'expected');
  const worst = calcTierCost(tier, 'worst');
  printRow(expected);
  printRow(worst);
  console.log(
    `  breakdown expected -> chat ${money(expected.chatCost)}, image ${money(
      expected.imageCost,
    )}, audio ${money(expected.audioCost)}, video ${money(expected.videoCost)}`
  );
  console.log('---');
}
