import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Mirrors getPointOptions() from AdminScreen — produces the same valid point
 * steps: [0, 20%, 40%, 60%, 80%, 100%] of maxPts (rounded to nearest 100).
 */
function getValidPoints(maxPts: number): number[] {
  const steps = 5;
  const step = Math.ceil(maxPts / steps / 100) * 100;
  const opts: number[] = [0];
  for (let i = 1; i <= steps; i++) {
    const v = Math.min(i * step, maxPts);
    if (!opts.includes(v)) opts.push(v);
  }
  if (!opts.includes(maxPts)) opts.push(maxPts);
  return opts;
}

function roundToNearest(value: number, opts: number[]): number {
  return opts.reduce((best, curr) =>
    Math.abs(curr - value) < Math.abs(best - value) ? curr : best
  );
}

/**
 * Rates a photo using Claude Haiku vision.
 *
 * @param photoUrl      - Publicly accessible URL of the submitted photo
 * @param missionDescription - Human-readable mission context (name + desc / prompt)
 * @param maxPts        - Maximum points available for this mission
 * @param scoringFocus  - Optional extra instructions from the organizer (games.ai_photo_instructions)
 * @returns             Points awarded, rounded to the nearest valid step
 * @throws              If the Claude API call fails or returns unparseable JSON
 */
export async function ratePhoto(params: {
  photoUrl: string;
  missionDescription: string;
  maxPts: number;
  scoringFocus?: string | null;
}): Promise<number> {
  const { photoUrl, missionDescription, maxPts, scoringFocus } = params;
  if (maxPts <= 0) throw new Error('maxPts must be a positive number');
  const validPts = getValidPoints(maxPts);

  const promptLines = [
    'You are judging a photo submission for a team competition.',
    '',
    `Mission: ${missionDescription}`,
    `Max points available: ${maxPts}`,
    ...(scoringFocus ? [`Extra scoring focus from the organizer: ${scoringFocus}`] : []),
    '',
    `Award a score from 0 to ${maxPts}:`,
    '- 0: Photo is completely off-topic, unrelated to the mission, or blank',
    '- ~25% of max: Attempted but barely matches what was asked',
    '- ~50% of max: Acceptable effort, partially matches the mission',
    '- ~75% of max: Good match, clearly understood the mission',
    `- 100% of max (${maxPts} points): Perfect execution, exactly what was asked`,
    '',
    'Respond with ONLY valid JSON: {"points": <integer>}',
  ];

  // Fetch and base64-encode the image so it works with all model versions.
  const imgRes = await fetch(photoUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch photo: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();
  const imgBase64 = Buffer.from(imgBuffer).toString('base64');
  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
  const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const)
    .find(t => t === contentType) ?? 'image/jpeg';

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imgBase64 },
          },
          {
            type: 'text',
            text: promptLines.join('\n'),
          },
        ],
      },
    ],
  });

  const firstBlock = response.content[0];
  const text = firstBlock?.type === 'text' ? firstBlock.text.trim() : '';
  const match = text.match(/"points"\s*:\s*(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Unexpected AI response: ${text}`);

  const raw = Math.round(parseFloat(match[1]));
  return roundToNearest(raw, validPts);
}
