export interface Match {
  /** Zero-based index of the first character of the match */
  start: number;
  /** Zero-based index of the character AFTER the last character (exclusive end) */
  end: number;
  /** The pattern that matched */
  pattern: string;
  /** The payload associated with this pattern (set via add(pattern, payload)) */
  payload?: unknown;
}

interface AhoCorasickNode {
  children: Map<string, number>;  // char → node id
  fail: number;                   // failure link
  output: number[];               // pattern indices that match at this node
  dict: number;                   // dictionary suffix link (shortcut to nearest output ancestor)
}

export class AhoCorasick {
  private _nodes: AhoCorasickNode[];
  private _patterns: string[];
  private _payloads: unknown[];
  private _built: boolean;

  constructor() {
    this._nodes = [this._makeNode()];  // node 0 = root
    this._patterns = [];
    this._payloads = [];
    this._built = false;
  }

  private _makeNode(): AhoCorasickNode {
    return { children: new Map(), fail: 0, output: [], dict: -1 };
  }

  /**
   * Add a pattern to the automaton.
   * Must be called before build() / search().
   * @param pattern The string pattern to search for.
   * @param payload Optional data to attach to this pattern.
   */
  add(pattern: string, payload?: unknown): this {
    if (this._built) throw new Error("Cannot add patterns after build()");
    if (pattern.length === 0) throw new Error("Empty pattern is not allowed");

    const idx = this._patterns.length;
    this._patterns.push(pattern);
    this._payloads.push(payload);

    let node = 0;
    for (const ch of pattern) {
      if (!this._nodes[node].children.has(ch)) {
        const next = this._nodes.length;
        this._nodes.push(this._makeNode());
        this._nodes[node].children.set(ch, next);
      }
      node = this._nodes[node].children.get(ch)!;
    }
    this._nodes[node].output.push(idx);
    return this;
  }

  /**
   * Build failure links (BFS). Must be called after all add() calls.
   * search() calls this automatically on first use.
   */
  build(): this {
    if (this._built) return this;
    this._built = true;

    const root = this._nodes[0];
    const queue: number[] = [];

    // Depth-1 nodes: failure link → root
    for (const [, child] of root.children) {
      this._nodes[child].fail = 0;
      queue.push(child);
    }

    // BFS to set failure + dict links
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currNode = this._nodes[curr];

      for (const [ch, child] of currNode.children) {
        queue.push(child);
        let fail = currNode.fail;

        // Walk up failure links until we find a node with a `ch` child or reach root
        while (fail !== 0 && !this._nodes[fail].children.has(ch)) {
          fail = this._nodes[fail].fail;
        }
        const failDest = this._nodes[fail].children.get(ch);
        this._nodes[child].fail = (failDest !== undefined && failDest !== child) ? failDest : 0;

        // Merge output from failure link
        const failNode = this._nodes[this._nodes[child].fail];
        for (const p of failNode.output) {
          if (!this._nodes[child].output.includes(p)) this._nodes[child].output.push(p);
        }

        // Dictionary link: nearest ancestor (via fail links) that has output
        const failId = this._nodes[child].fail;
        if (this._nodes[failId].output.length > 0) {
          this._nodes[child].dict = failId;
        } else {
          this._nodes[child].dict = this._nodes[failId].dict;
        }
      }
    }

    return this;
  }

  private _buildU16Map(text: string): { chars: string[]; u16: number[] } {
    const chars: string[] = [];
    const u16: number[] = [];
    let pos = 0;
    for (const ch of text) {
      chars.push(ch);
      u16.push(pos);
      pos += ch.length; // 1 for BMP, 2 for supplementary (emoji, etc.)
    }
    u16.push(pos); // sentinel: position after last code point
    return { chars, u16 };
  }

  /**
   * Search for all pattern occurrences in `text`.
   * Returns matches in order of their end position.
   * `start` and `end` are UTF-16 code-unit indices (consistent with String.indexOf).
   */
  search(text: string): Match[] {
    if (!this._built) this.build();

    const { chars, u16 } = this._buildU16Map(text);
    const results: Match[] = [];
    let node = 0;

    for (let cp = 0; cp < chars.length; cp++) {
      const ch = chars[cp];

      // Follow failure links until we find a transition or reach root
      while (node !== 0 && !this._nodes[node].children.has(ch)) {
        node = this._nodes[node].fail;
      }

      const next = this._nodes[node].children.get(ch);
      node = next !== undefined ? next : 0;

      // Emit all patterns ending at code-point index cp
      for (const pidx of this._nodes[node].output) {
        const pattern = this._patterns[pidx];
        const patCpLen = [...pattern].length;
        results.push({
          start: u16[cp - patCpLen + 1],
          end: u16[cp + 1],
          pattern,
          payload: this._payloads[pidx],
        });
      }
    }

    return results;
  }

  /**
   * Check if the text contains any of the patterns.
   */
  containsAny(text: string): boolean {
    if (!this._built) this.build();

    let node = 0;
    for (const ch of text) {
      while (node !== 0 && !this._nodes[node].children.has(ch)) {
        node = this._nodes[node].fail;
      }
      const next = this._nodes[node].children.get(ch);
      node = next !== undefined ? next : 0;
      if (this._nodes[node].output.length > 0) return true;
    }
    return false;
  }

  /**
   * Find the first match in text, or undefined if none.
   */
  findFirst(text: string): Match | undefined {
    if (!this._built) this.build();

    const { chars, u16 } = this._buildU16Map(text);
    let node = 0;
    for (let cp = 0; cp < chars.length; cp++) {
      const ch = chars[cp];
      while (node !== 0 && !this._nodes[node].children.has(ch)) {
        node = this._nodes[node].fail;
      }
      const next = this._nodes[node].children.get(ch);
      node = next !== undefined ? next : 0;
      if (this._nodes[node].output.length > 0) {
        const pidx = this._nodes[node].output[0];
        const pattern = this._patterns[pidx];
        const patCpLen = [...pattern].length;
        return {
          start: u16[cp - patCpLen + 1],
          end: u16[cp + 1],
          pattern,
          payload: this._payloads[pidx],
        };
      }
    }
    return undefined;
  }

  /**
   * Count total occurrences of all patterns in the text.
   */
  count(text: string): number {
    return this.search(text).length;
  }

  /**
   * Replace all pattern occurrences in text.
   * @param text The source text.
   * @param replacement String or function (match) → replacement string.
   */
  replace(text: string, replacement: string | ((match: Match) => string)): string {
    const matches = this.search(text);
    if (matches.length === 0) return text;

    const fn = typeof replacement === "string" ? () => replacement : replacement;

    // Sort by start (ascending), resolving overlaps by taking the longer match
    const merged: Match[] = [];
    for (const m of matches.sort((a, b) => a.start - b.start || b.end - a.end)) {
      const prev = merged[merged.length - 1];
      if (prev && m.start < prev.end) continue; // skip overlapping shorter
      merged.push(m);
    }

    let result = "";
    let pos = 0;
    for (const m of merged) {
      result += text.slice(pos, m.start);
      result += fn(m);
      pos = m.end;
    }
    result += text.slice(pos);
    return result;
  }

  /** Number of patterns in the automaton. */
  get size(): number { return this._patterns.length; }

  /** The list of patterns (in insertion order). */
  get patterns(): readonly string[] { return this._patterns; }
}

/**
 * Convenience factory: build an automaton from a list of patterns.
 */
export function buildAutomaton(patterns: string[]): AhoCorasick {
  const ac = new AhoCorasick();
  for (const p of patterns) ac.add(p);
  return ac.build();
}

/**
 * One-shot: search text for all occurrences of any pattern.
 */
export function searchAll(patterns: string[], text: string): Match[] {
  return buildAutomaton(patterns).search(text);
}

/**
 * One-shot: check if text contains any pattern.
 */
export function containsAny(patterns: string[], text: string): boolean {
  return buildAutomaton(patterns).containsAny(text);
}
