import { googleClient } from './googleClient';
import { z } from 'zod';
import { ResearchError } from './errors';
import { jsonSchemaFor } from './research';
import type { VoiceQuery } from '../src/aiSettings';
import { APP } from '../src/config';

const MAX_TTS_CHARS = 6000;
const PCM_RATE = 24_000;

// Delivery is described in the prompt; the TTS model speaks only the text after the colon.
const VOICE_STYLE = 'Read aloud in a calm, warm, mature male voice, clearly and at a moderate pace:';

/** Gemini TTS -> WAV bytes. Newer models return WAV; older ones return raw 16-bit PCM, which we wrap. */
export async function synthesizeSpeech(apiKey: string, model: string, voiceName: string, text: string, signal?: AbortSignal): Promise<Buffer> {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) throw new ResearchError('No text to read.', 400);
  if (clean.length > MAX_TTS_CHARS) throw new ResearchError('The text is too long to read in one go.', 400);

  const ai = googleClient(apiKey);
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: `${VOICE_STYLE}\n\n${clean}` }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      abortSignal: signal,
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new ResearchError('Gemini returned no audio. Try again.', 502);
  const audio = Buffer.from(part.inlineData.data, 'base64');
  const mime = part.inlineData.mimeType ?? '';
  if (/wav/i.test(mime) || audio.subarray(0, 4).toString('ascii') === 'RIFF') return audio;
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1]) || PCM_RATE;
  return wavFromPcm16(audio, rate);
}

function wavFromPcm16(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const VoiceQuerySchema = z.object({
  transcript: z.string().describe('Verbatim transcript of what was said, in the language it was spoken in'),
  query: z.string().describe('The request as one sentence, in the same language, ready to put into the chat box; empty text if there is no request'),
});

/** Gemini listens to a recorded voice message (WAV) and returns the transcript plus the request it describes. */
export async function understandVoiceMessage(apiKey: string, model: string, wav: Buffer, signal?: AbortSignal): Promise<VoiceQuery> {
  const ai = googleClient(apiKey);
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `This is a voice message from a user of the ${APP.name} app. It may be in any language. ` +
              'Transcribe exactly what was said, in the language it was spoken in (names, brands and styles in their usual spelling), ' +
              'and in the query field give the request as one sentence in the same language. Do not add anything that was not said in the recording.',
          },
          { inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } },
        ],
      },
    ],
    config: { responseMimeType: 'application/json', responseJsonSchema: jsonSchemaFor(VoiceQuerySchema), abortSignal: signal },
  });

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(response.text ?? '');
  } catch {
    // handled below
  }
  const result = VoiceQuerySchema.safeParse(parsed);
  if (!result.success) throw new ResearchError('Could not understand the recording. Try saying it again.', 422);
  return result.data as VoiceQuery;
}
