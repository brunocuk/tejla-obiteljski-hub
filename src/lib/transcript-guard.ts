/** Validation helpers for voice transcripts (Croatian Latin script only). */

const CYRILLIC = /[\u0400-\u04FF]/;

export const TRANSCRIBE_BIAS_PROMPT =
  "Hrvatski jezik, latinica. Primjeri izraza: zubar, pregled, frizer, depilacija, kozmetičar, trening, roditeljski sastanak, ispit, škola, rođendan, putovanje, izlet, servis, uplata, rok, kupiti, nazvati, podsjeti me, sutra, danas, u petak, u osam sati.";

export const TRANSCRIBE_RETRY_PROMPT =
  "Transcribe only in Croatian Latin script. Never use Cyrillic. " + TRANSCRIBE_BIAS_PROMPT;

export const TRANSCRIBE_UNUSABLE_MESSAGE = "Nismo dobro čuli. Pokušaj ponovno.";

export function hasCyrillic(text: string): boolean {
  return CYRILLIC.test(text);
}

/** A transcript is usable when it has content and contains no Cyrillic characters. */
export function isUsableTranscript(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return !hasCyrillic(trimmed);
}
