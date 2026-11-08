import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ApiError as GoogleApiError } from '@google/genai';
import { PROVIDER_INFO, type KeyProvider as Provider } from '../src/aiSettings';
import { ProviderHttpError } from './images/http';
import { SecretsUnavailableError } from './secrets';

export class ResearchError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
  }
}

function statusOf(err: unknown): number | undefined {
  if (err instanceof ProviderHttpError) return err.status;
  if (err instanceof Anthropic.APIError || err instanceof OpenAI.APIError) return err.status ?? undefined;
  if (err instanceof GoogleApiError) return err.status;
  return undefined;
}

function isAbort(err: unknown): boolean {
  return (
    err instanceof Anthropic.APIUserAbortError ||
    err instanceof OpenAI.APIUserAbortError ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

/** Short explanation of a provider failure, for key tests and request errors. */
export function describeProviderError(provider: Provider, err: unknown): string {
  const name = `${PROVIDER_INFO[provider].company} (${PROVIDER_INFO[provider].label})`;
  const status = statusOf(err);
  if (status === 401 || (status === 400 && provider === 'google' && /API key/i.test(String((err as Error)?.message)))) {
    return `Invalid ${name} key. Check that it was copied in full.`;
  }
  if (status === 403) return `The ${name} key has no access to this model or feature. Check the project's permissions.`;
  if (status === 404) return `The chosen model is not available to this ${name} key. Choose another model in Settings.`;
  if (status === 402) return `The ${name} account has run out of credit. Top it up with the provider.`;
  if (status === 429) return `The ${name} account hit its rate or spending limit. Wait a moment or check billing.`;
  if (status && status >= 500) return `${name} is having temporary problems (error ${status}). Try again in a moment.`;
  if (err instanceof Anthropic.APIConnectionError || err instanceof OpenAI.APIConnectionError || (err instanceof TypeError && /fetch failed/i.test(err.message))) {
    return `Cannot reach ${name}. Check the server's internet connection.`;
  }
  const detail = err instanceof Error ? err.message : String(err);
  return `${name} error: ${detail.slice(0, 300)}`;
}

/**
 * Maps any failure to an HTTP status + message. Provider auth failures become 400 —
 * 401 is reserved for "owner session expired", which logs the client out.
 */
export function toHttpError(err: unknown, provider?: Provider): { status: number; message: string } {
  if (err instanceof ResearchError) return { status: err.status, message: err.message };
  if (err instanceof SecretsUnavailableError) return { status: 503, message: err.message };
  if (isAbort(err)) return { status: 499, message: 'Request cancelled.' };
  const status = statusOf(err);
  if (provider && status !== undefined) {
    const mapped = status === 401 ? 400 : status;
    return { status: mapped, message: describeProviderError(provider, err) };
  }
  return { status: 500, message: err instanceof Error ? err.message : 'Unknown server error.' };
}
