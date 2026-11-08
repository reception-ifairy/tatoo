import { withImageRules } from '../src/options';

// Image prompts that are not part of a design (option thumbnails). The consultation prompt is server/persona.ts,
// design prompts are server/designPrompt.ts.

/** Prompt for one option's thumbnail: the option first, then the shared motif, then the house rules. */
export function samplePrompt(motif: string, promptLabel: string | null, optionPrompt: string): string {
  const phrase = optionPrompt.replace(/\.+$/, '');
  const head = promptLabel ? `${promptLabel}: ${phrase}.` : `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;
  return withImageRules(`${head} The picture shows ${motif}, centred, the ${promptLabel ? promptLabel.toLowerCase() : 'style'} clearly visible.`);
}
