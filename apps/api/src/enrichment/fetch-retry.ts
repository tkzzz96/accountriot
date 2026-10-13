export interface FetchedPage {
  html: string;
  status: number;
  truncated: boolean;
}
export type PageFetcher = (url: string) => Promise<FetchedPage | null>;

export interface RetryOutcome {
  page: FetchedPage | null;
  notes: string[];
  /** true when the host failed on the retry: the caller should stop crawling this host. */
  hostStruggling: boolean;
}

/**
 * Fetch a page; if it arrives cut off, retry once. Keeps the best (complete, else longest) version, never throws away a
 * partial page because the retry failed, and tells the caller to stop hammering a host that fails twice.
 */
export async function fetchWithTruncationRetry(fetchPage: PageFetcher, url: string): Promise<RetryOutcome> {
  const first = await fetchPage(url);
  if (!first?.truncated) return { page: first, notes: [], hostStruggling: false };
  try {
    const again = await fetchPage(url);
    if (again && !again.truncated) return { page: again, notes: [], hostStruggling: false };
    const best = again && again.html.length > first.html.length ? again : first;
    return { page: best, notes: [`partial page (contacts may be incomplete): ${url}`], hostStruggling: false };
  } catch (err) {
    return {
      page: first,
      notes: [`partial page kept; retry failed for ${url}: ${err instanceof Error ? err.message : String(err)}`],
      hostStruggling: true,
    };
  }
}
