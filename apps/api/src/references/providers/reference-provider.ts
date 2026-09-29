import { RefItem } from "../selection";

export interface ReferenceProvider {
  readonly name: string;
  /** Returns candidate references for a canonical niche. Must never download or store third-party images. */
  find(niche: string, language: string): Promise<RefItem[]>;
}
