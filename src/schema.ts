import { z } from 'zod';

// Zod schemas shared by the server (validation + structured outputs) and the client (types only).
// The example web-research feature returns this shape; replace or add schemas per project.
// Structured outputs reject min/max/length constraints, so keep schemas to types, enums and descriptions.

export const FactSchema = z.object({
  label: z.string().describe('What the fact is about, e.g. "Price", "Release date", "Requirements"'),
  value: z.string().describe('The fact itself, briefly'),
  sourceUrl: z.string().nullable().describe('The exact address of the page the fact comes from; null if none'),
});

export const ResearchResultSchema = z.object({
  title: z.string().describe('A short title for the topic'),
  summary: z.string().describe('A concise answer: the conclusion first, then the reasoning'),
  keyPoints: z.array(z.string()).describe('The 3–6 most important points'),
  facts: z.array(FactSchema).describe('Concrete, checked facts with their source'),
  confidence: z.enum(['high', 'medium', 'low']).describe('How certain the answer is, given the sources found'),
  openQuestions: z.array(z.string()).describe('What could not be established, or what is worth checking yourself'),
});

export type Fact = z.infer<typeof FactSchema>;
export type ResearchResultCore = z.infer<typeof ResearchResultSchema>;
