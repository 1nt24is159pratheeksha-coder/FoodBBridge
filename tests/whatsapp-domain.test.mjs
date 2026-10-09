import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { parseRegistrationCapacity, parseRegistrationCapacityAnswer, extractRegistrationFields, isConversationalQuestion } from '../src/lib/whatsapp/registration-input.ts';
import { prepareHistoricalMeals, recommendedProductionRange } from '../src/lib/whatsapp/forecast-math.ts';
import { ASSESSMENT_RETRY_MESSAGE, parseAssessmentResult, requireManualReviewWhenConfidenceIsLow } from '../src/lib/whatsapp/assessment-result.ts';
import { analyzeFoodImage, assessmentFailureCategory, extractAssessmentJson, FOOD_ASSESSMENT_MODEL } from '../src/lib/whatsapp/assessment-engine.ts';
import { downloadTwilioMedia } from '../src/lib/whatsapp/pipeline.server.ts';
import { isAvailableOffer, remainingOfferQuantity } from '../src/lib/whatsapp/ngo-availability.ts';
import { checkGroqConnectivity, requestGroqText } from '../src/lib/whatsapp/groq-ai.server.ts';

function validPngBase64() {
  const crc32 = (data) => {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (name, data) => {
    const type = Buffer.from(name);
    const length = Buffer.alloc(4);
    const checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
    return Buffer.concat([length, type, data, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header[8] = 8;
  header[9] = 2;
  const scanlines = Buffer.from([0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255]);
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}

test('daily meal capacity accepts positive values and rejects malformed or empty input', () => {
  assert.equal(parseRegistrationCapacity('50'), 50);
  assert.equal(parseRegistrationCapacityAnswer('50 meals'), 50);
  assert.equal(parseRegistrationCapacity('50kg'), null);
  assert.equal(parseRegistrationCapacityAnswer('50kg'), null);
  assert.equal(parseRegistrationCapacity(''), null);
  assert.equal(parseRegistrationCapacity('0'), null);
  assert.equal(parseRegistrationCapacity('no idea'), null);
});

test('natural language extracts restaurant, city, and meal capacity', () => {
  assert.deepEqual(extractRegistrationFields('We are a restaurant in Yelahanka and serve around 50 meals every day'), {
    city: 'Yelahanka', organization_type: 'restaurant', daily_meals: 50,
  });
});

test('registration clarification requests are not treated as field answers', () => {
  assert.equal(isConversationalQuestion('Can I change this later'), true);
  assert.equal(isConversationalQuestion('50'), false);
});

test('forecast history excludes target and future dates and rejects duplicate observed dates', () => {
  const input = [
    { date: '2026-10-01', meals: 100 },
    { date: '2026-10-13', meals: 1740 },
    { date: '2026-10-14', meals: 1800 },
  ];
  assert.deepEqual(prepareHistoricalMeals(input, '2026-10-13'), [{ date: '2026-10-01', meals: 100 }]);
  assert.throws(() => prepareHistoricalMeals([input[0], input[0]], '2026-10-13'), /Duplicate historical date/);
});

test('production recommendation range brackets the prediction', () => {
  const range = recommendedProductionRange(1634);
  assert.ok(range.low < 1634 && range.high > 1634);
  assert.deepEqual(recommendedProductionRange(0), { low: 0, high: 0 });
});

test('assessment parser rejects malformed model results instead of coercing absent values to zero', () => {
  const valid = {
    food_name: 'Rice', estimated_portions: 12, estimated_weight_kg: 4.2,
    quality_screening_status: 'REVIEW_REQUIRED', visual_quality: 'Fair', freshness: 'Appears fresh',
    confidence_percent: 58, assessment_note: 'The image is unclear.', limitations: ['Some food is occluded.'],
  };
  assert.equal(parseAssessmentResult(valid, 'vision-model').estimated_portions, 12);
  assert.throws(() => parseAssessmentResult({ ...valid, estimated_portions: undefined }, 'vision-model'), /portion estimate/);
  assert.throws(() => parseAssessmentResult({ ...valid, confidence_percent: 101 }, 'vision-model'), /confidence/);
  const lowConfidence = requireManualReviewWhenConfidenceIsLow(parseAssessmentResult({ ...valid, confidence_percent: 28, quality_screening_status: 'ELIGIBLE' }, 'vision-model'));
  assert.equal(lowConfidence.quality_screening_status, 'REVIEW_REQUIRED');
  assert.match(lowConfidence.assessment_note, /manual review/i);
});

test('missing Groq credentials fail before making an image-assessment request', async () => {
  const previous = process.env['GROQ_API_KEY']; delete process.env['GROQ_API_KEY'];
  try { await assert.rejects(analyzeFoodImage('not-used', 'image/jpeg'), /GROQ_API_KEY missing/); }
  finally { if (previous !== undefined) process.env['GROQ_API_KEY'] = previous; }
});

test('GroqCloud receives a base64 image and returns the validated structured assessment', async () => {
  const oldKey = process.env['GROQ_API_KEY']; const oldFetch = globalThis.fetch;
  process.env['GROQ_API_KEY'] = 'unit-test-groq-key-never-real'; const imageBase64 = validPngBase64();
  const assessment = { food_name: 'Rice and lentils', estimated_portions: 18, estimated_weight_kg: 6.2,
    quality_screening_status: 'REVIEW_REQUIRED', visual_quality: 'Fair', freshness: 'Appears fresh', confidence_percent: 62,
    assessment_note: 'Rice is visible in a covered tray.', limitations: ['Tray depth is not visible.'] };
  let body; let url; let headers;
  globalThis.fetch = async (requestUrl, init) => { url = requestUrl; headers = init.headers; body = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(assessment), reasoning: 'not assessment output' } }] }), { status: 200 }); };
  try {
    const result = await analyzeFoodImage(imageBase64, 'image/png');
    assert.equal(FOOD_ASSESSMENT_MODEL, 'qwen/qwen3.8-27b');
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(headers.Authorization, 'Bearer unit-test-groq-key-never-real');
    assert.equal(body.model, 'qwen/qwen3.8-27b');
    assert.equal(body.messages[1].content[1].image_url.url, `data:image/png;base64,${imageBase64}`);
    assert.equal(body.messages[1].content[1].type, 'image_url');
    assert.equal(body.max_completion_tokens, 700);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(body.response_format.json_schema.schema.required, Object.keys(assessment));
    assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    assert.equal(result.food_name, 'Rice and lentils'); assert.equal(result.estimated_portions, 18);
    assert.deepEqual(result.limitations, assessment.limitations); assert.equal(result.model, 'qwen/qwen3.8-27b');
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env['GROQ_API_KEY']; else process.env['GROQ_API_KEY'] = oldKey; }
});

test('assessment extracts fenced or prefaced JSON from final content and ignores reasoning fields', async () => {
  const assessment = { food_name: 'Rice', estimated_portions: 2, estimated_weight_kg: 0.5,
    quality_screening_status: 'REVIEW_REQUIRED', visual_quality: 'Fair', freshness: 'Appears fresh',
    confidence_percent: 40, assessment_note: 'Limited view.', limitations: ['Container depth is unclear.'] };
  assert.deepEqual(extractAssessmentJson(`Result follows:\n\`\`\`json\n${JSON.stringify(assessment)}\n\`\`\``), assessment);
  const oldKey = process.env['GROQ_API_KEY']; const oldFetch = globalThis.fetch;
  process.env['GROQ_API_KEY'] = 'unit-test-key-never-real';
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(assessment)}\n\`\`\``, reasoning: '{"estimated_portions":999}' } }] }), { status: 200 });
  try { assert.equal((await analyzeFoodImage(validPngBase64(), 'image/png')).estimated_portions, 2); }
  finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env['GROQ_API_KEY']; else process.env['GROQ_API_KEY'] = oldKey; }
});

test('malformed JSON and missing required fields retain explicit failure categories', async () => {
  assert.throws(() => extractAssessmentJson('{not-json}'), (error) => assessmentFailureCategory(error) === 'malformed_json');
  const oldKey = process.env['GROQ_API_KEY']; const oldFetch = globalThis.fetch;
  process.env['GROQ_API_KEY'] = 'unit-test-key-never-real';
  const incomplete = { food_name: 'Rice', estimated_weight_kg: 1, quality_screening_status: 'REVIEW_REQUIRED',
    visual_quality: 'Fair', freshness: 'Appears fresh', confidence_percent: 40, assessment_note: 'Limited view.', limitations: ['Depth unclear.'] };
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(incomplete) } }] }), { status: 200 });
  try {
    await assert.rejects(analyzeFoodImage(validPngBase64(), 'image/png'), (error) => {
      assert.equal(assessmentFailureCategory(error), 'invalid_or_missing_portions');
      return true;
    });
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env['GROQ_API_KEY']; else process.env['GROQ_API_KEY'] = oldKey; }
});

test('malformed image base64 and unsupported MIME types fail before calling Groq', async () => {
  const oldKey = process.env['GROQ_API_KEY']; const oldFetch = globalThis.fetch;
  process.env['GROQ_API_KEY'] = 'unit-test-key-never-real'; let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('must not be called'); };
  try { await assert.rejects(analyzeFoodImage('not-base64!', 'image/png'), /Invalid base64 image data/);
    await assert.rejects(analyzeFoodImage(validPngBase64(), 'image/bmp'), /Unsupported image MIME type/); assert.equal(called, false);
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env['GROQ_API_KEY']; else process.env['GROQ_API_KEY'] = oldKey; }
});

test('malformed Groq JSON and provider errors fail safely without response details', async () => {
  const oldKey = process.env['GROQ_API_KEY']; const oldFetch = globalThis.fetch;
  process.env['GROQ_API_KEY'] = 'unit-test-groq-key-never-real';
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{bad json' } }] }), { status: 200 });
    await assert.rejects(analyzeFoodImage(validPngBase64(), 'image/png'), /invalid structured JSON/);
    assert.match(ASSESSMENT_RETRY_MESSAGE, /no assessment was saved/i);
    globalThis.fetch = async () => new Response('sensitive provider response', { status: 403 });
    await assert.rejects(analyzeFoodImage(validPngBase64(), 'image/png'), (error) => error.message.includes('[403]') && !error.message.includes('sensitive provider response') && !error.message.includes('unit-test-groq-key-never-real'));
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env['GROQ_API_KEY']; else process.env['GROQ_API_KEY'] = oldKey; }
});

test('Groq timeout fails without fabricating an assessment', async () => {
  const oldKey = process.env['GROQ_API_KEY']; const oldFetch = globalThis.fetch;
  process.env['GROQ_API_KEY'] = 'unit-test-key-never-real'; globalThis.fetch = async () => { throw new DOMException('timeout', 'TimeoutError'); };
  try { await assert.rejects(analyzeFoodImage(validPngBase64(), 'image/png'), /AI request failed \(timeout\)/); assert.match(ASSESSMENT_RETRY_MESSAGE, /no assessment was saved/i); }
  finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env['GROQ_API_KEY']; else process.env['GROQ_API_KEY'] = oldKey; }
});
test('image retrieval errors omit remote response bodies and route to retry', async () => {
  const oldLovable = process.env['LOVABLE_API_KEY'];
  const oldTwilio = process.env['TWILIO_API_KEY'];
  const oldFetch = globalThis.fetch;
  process.env['LOVABLE_API_KEY'] = 'unit-test-lovable-key-never-real';
  process.env['TWILIO_API_KEY'] = 'unit-test-twilio-key-never-real';
  globalThis.fetch = async () => new Response('sensitive upstream text', { status: 503 });
  try {
    await assert.rejects(downloadTwilioMedia('https://api.twilio.com/2010-04-01/Accounts/ACx/Messages/MMx/Media/MEx'), (error) => {
      assert.match(error.message, /503/);
      assert.equal(error.message.includes('sensitive upstream text'), false);
      return true;
    });
    assert.match(ASSESSMENT_RETRY_MESSAGE, /no assessment was saved/i);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldLovable === undefined) delete process.env['LOVABLE_API_KEY']; else process.env['LOVABLE_API_KEY'] = oldLovable;
    if (oldTwilio === undefined) delete process.env['TWILIO_API_KEY']; else process.env['TWILIO_API_KEY'] = oldTwilio;
  }
});

test('Groq text requests use Qwen 3.8 and preserve structured JSON output', async () => {
  const oldKey = process.env['GROQ_API_KEY']; const oldFetch = globalThis.fetch;
  process.env['GROQ_API_KEY'] = 'unit-test-key-never-real'; let captured;
  globalThis.fetch = async (url, init) => { captured = { url, init }; return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 }); };
  try {
    const result = await requestGroqText({ instructions: 'system', input: 'hello', maxOutputTokens: 12, json: true });
    assert.equal(result.ok, true); assert.equal(result.text, '{"ok":true}');
    assert.equal(captured.url, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(captured.init.body); assert.equal(body.model, 'qwen/qwen3.8-27b');
    assert.equal(body.messages[0].content, 'system'); assert.equal(body.max_completion_tokens, 12);
    assert.deepEqual(body.response_format, { type: 'json_object' });
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env['GROQ_API_KEY']; else process.env['GROQ_API_KEY'] = oldKey; }
});

test('Groq connectivity probe returns only status and sanitized error category', async () => {
  const oldKey = process.env['GROQ_API_KEY']; const oldFetch = globalThis.fetch;
  process.env['GROQ_API_KEY'] = 'unit-test-secret-never-returned';
  globalThis.fetch = async () => new Response('sensitive provider body', { status: 403 });
  try { const result = await checkGroqConnectivity();
    assert.deepEqual(result, { connected: false, httpStatus: 403, errorCategory: 'invalid_key_or_permission' });
    assert.equal(JSON.stringify(result).includes('unit-test-secret'), false);
    assert.equal(JSON.stringify(result).includes('sensitive provider body'), false);
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env['GROQ_API_KEY']; else process.env['GROQ_API_KEY'] = oldKey; }
});

test('Groq failures are sanitized and categorized by HTTP status', async () => {
  const oldKey = process.env['GROQ_API_KEY']; const oldFetch = globalThis.fetch;
  process.env['GROQ_API_KEY'] = 'unit-test-key-never-real';
  try {
    for (const [status, reason] of [[400, 'invalid_request'], [403, 'invalid_key_or_permission'], [404, 'model_unavailable'], [429, 'rate_limited']]) {
      globalThis.fetch = async () => new Response('sensitive provider detail', { status });
      const result = await requestGroqText({ instructions: 'test', input: 'test', maxOutputTokens: 1 });
      assert.deepEqual(result, { ok: false, reason, httpStatus: status });
      assert.equal(JSON.stringify(result).includes('sensitive provider detail'), false);
    }
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env['GROQ_API_KEY']; else process.env['GROQ_API_KEY'] = oldKey; }
});
test('NGO available quantity subtracts accepted allocations and never goes negative', () => {
  assert.equal(remainingOfferQuantity(100, 35), 65);
  assert.equal(remainingOfferQuantity(20, 25), 0);
  assert.equal(isAvailableOffer('ASSESSMENT_COMPLETE', 65, '2026-10-10T12:00:00.000Z', Date.parse('2026-10-09T12:00:00.000Z')), true);
  assert.equal(isAvailableOffer('ALLOCATED', 65, '2026-10-10T12:00:00.000Z', Date.parse('2026-10-09T12:00:00.000Z')), false);
  assert.equal(isAvailableOffer('AVAILABLE', 0, null), false);
  assert.equal(isAvailableOffer('AVAILABLE', 1, '2026-10-08T12:00:00.000Z', Date.parse('2026-10-09T12:00:00.000Z')), false);
});
