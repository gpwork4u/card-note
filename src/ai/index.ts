import type { AiProvider, SearchResult } from '@/types';
import { useStore } from '@/store';
import { LocalProvider } from './local';

// Current provider. Local (offline) by default; ClaudeProvider can be swapped in
// once the user configures an API key and ./claude.ts is wired up.
let provider: AiProvider = new LocalProvider();

export function setProvider(p: AiProvider) {
  provider = p;
}

export function providerLabel(): string {
  return provider.label;
}

export function aiIsLocal(): boolean {
  return provider.id === 'local';
}

/** Natural-language search over the card library. Returns the answer + citations. */
export async function aiSearch(question: string): Promise<SearchResult> {
  const q = question.trim();
  if (!q) return { answer: '', citations: [] };
  const cards = useStore.getState().cards;
  return provider.search(q, cards);
}

/** Regenerate AI link suggestions and push them into the store (as dashed links). */
export async function aiSuggestLinks(focusCardId?: string): Promise<number> {
  const { cards, links, setAiSuggestions } = useStore.getState();
  const suggestions = await provider.suggestLinks(cards, links, focusCardId);
  setAiSuggestions(suggestions);
  return suggestions.length;
}

/** Extract cards from a diary entry and add them to the library. */
export async function aiExtractDiary(entryId: string): Promise<number> {
  const state = useStore.getState();
  const entry = state.diary.find((d) => d.id === entryId);
  if (!entry) return 0;
  const knownTags = [...new Set(state.cards.flatMap((c) => c.tags))];
  const extracted = await provider.extractCardsFromDiary(entry, knownTags);
  state.applyDiaryExtraction(entryId, extracted);
  return extracted.length;
}

/** Suggest a type/tags for a card (used on import / new card). Applies in place. */
export async function aiClassify(cardId: string): Promise<void> {
  const state = useStore.getState();
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return;
  const result = await provider.autoClassify(card);
  state.updateCard(cardId, { type: result.type, ...(result.tags ? { tags: result.tags } : {}) });
}
