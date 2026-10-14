import type { FetchedPage } from "./polite-fetch";

export type PageFetcher = (url: string) => Promise<FetchedPage | null>;

export interface RetryOutcome {
  page: FetchedPage | null;
  notes: string[];
  /** The retry itself failed (timeout/reset): the page is kept, but the caller should stop crawling this host. */
  retryFailed: boolean;
}

/**
 * Fetch a page; if it arrives cut off, retry once. Keeps the best version (complete, else the longest partial) and never
 * discards a partial page because the retry failed. The notes tell the lead record its contact set may be incomplete.
 */
export async function fetchWithTruncationRetry(fetchPage: PageFetcher, url: string): Promise<RetryOutcome> {
  const first = await fetchPage(url);
  if (!first?.truncated) return { page: first, notes: [], retryFailed: false };
  try {
    const again = await fetchPage(url);
    if (again && !again.truncated) return { page: again, notes: [], retryFailed: false };
    const best = again && again.html.length > first.html.length ? again : first;
    return { page: best, notes: [`partial page (contacts may be incomplete): ${url}`], retryFailed: false };
  } catch (err) {
    return { page: first, notes: [`partial page kept; retry failed for ${url}: ${err instanceof Error ? err.message : String(err)}`], retryFailed: true };
  }
}
