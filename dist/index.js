// src/automaton.ts
var AhoCorasick = class {
  constructor() {
    this._nodes = [this._makeNode()];
    this._patterns = [];
    this._payloads = [];
    this._built = false;
  }
  _makeNode() {
    return { children: /* @__PURE__ */ new Map(), fail: 0, output: [], dict: -1 };
  }
  /**
   * Add a pattern to the automaton.
   * Must be called before build() / search().
   * @param pattern The string pattern to search for.
   * @param payload Optional data to attach to this pattern.
   */
  add(pattern, payload) {
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
      node = this._nodes[node].children.get(ch);
    }
    this._nodes[node].output.push(idx);
    return this;
  }
  /**
   * Build failure links (BFS). Must be called after all add() calls.
   * search() calls this automatically on first use.
   */
  build() {
    if (this._built) return this;
    this._built = true;
    const root = this._nodes[0];
    const queue = [];
    for (const [, child] of root.children) {
      this._nodes[child].fail = 0;
      queue.push(child);
    }
    while (queue.length > 0) {
      const curr = queue.shift();
      const currNode = this._nodes[curr];
      for (const [ch, child] of currNode.children) {
        queue.push(child);
        let fail = currNode.fail;
        while (fail !== 0 && !this._nodes[fail].children.has(ch)) {
          fail = this._nodes[fail].fail;
        }
        const failDest = this._nodes[fail].children.get(ch);
        this._nodes[child].fail = failDest !== void 0 && failDest !== child ? failDest : 0;
        const failNode = this._nodes[this._nodes[child].fail];
        for (const p of failNode.output) {
          if (!this._nodes[child].output.includes(p)) this._nodes[child].output.push(p);
        }
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
  _buildU16Map(text) {
    const chars = [];
    const u16 = [];
    let pos = 0;
    for (const ch of text) {
      chars.push(ch);
      u16.push(pos);
      pos += ch.length;
    }
    u16.push(pos);
    return { chars, u16 };
  }
  /**
   * Search for all pattern occurrences in `text`.
   * Returns matches in order of their end position.
   * `start` and `end` are UTF-16 code-unit indices (consistent with String.indexOf).
   */
  search(text) {
    if (!this._built) this.build();
    const { chars, u16 } = this._buildU16Map(text);
    const results = [];
    let node = 0;
    for (let cp = 0; cp < chars.length; cp++) {
      const ch = chars[cp];
      while (node !== 0 && !this._nodes[node].children.has(ch)) {
        node = this._nodes[node].fail;
      }
      const next = this._nodes[node].children.get(ch);
      node = next !== void 0 ? next : 0;
      for (const pidx of this._nodes[node].output) {
        const pattern = this._patterns[pidx];
        const patCpLen = [...pattern].length;
        results.push({
          start: u16[cp - patCpLen + 1],
          end: u16[cp + 1],
          pattern,
          payload: this._payloads[pidx]
        });
      }
    }
    return results;
  }
  /**
   * Check if the text contains any of the patterns.
   */
  containsAny(text) {
    if (!this._built) this.build();
    let node = 0;
    for (const ch of text) {
      while (node !== 0 && !this._nodes[node].children.has(ch)) {
        node = this._nodes[node].fail;
      }
      const next = this._nodes[node].children.get(ch);
      node = next !== void 0 ? next : 0;
      if (this._nodes[node].output.length > 0) return true;
    }
    return false;
  }
  /**
   * Find the first match in text, or undefined if none.
   */
  findFirst(text) {
    if (!this._built) this.build();
    const { chars, u16 } = this._buildU16Map(text);
    let node = 0;
    for (let cp = 0; cp < chars.length; cp++) {
      const ch = chars[cp];
      while (node !== 0 && !this._nodes[node].children.has(ch)) {
        node = this._nodes[node].fail;
      }
      const next = this._nodes[node].children.get(ch);
      node = next !== void 0 ? next : 0;
      if (this._nodes[node].output.length > 0) {
        const pidx = this._nodes[node].output[0];
        const pattern = this._patterns[pidx];
        const patCpLen = [...pattern].length;
        return {
          start: u16[cp - patCpLen + 1],
          end: u16[cp + 1],
          pattern,
          payload: this._payloads[pidx]
        };
      }
    }
    return void 0;
  }
  /**
   * Count total occurrences of all patterns in the text.
   */
  count(text) {
    return this.search(text).length;
  }
  /**
   * Replace all pattern occurrences in text.
   * @param text The source text.
   * @param replacement String or function (match) → replacement string.
   */
  replace(text, replacement) {
    const matches = this.search(text);
    if (matches.length === 0) return text;
    const fn = typeof replacement === "string" ? () => replacement : replacement;
    const merged = [];
    for (const m of matches.sort((a, b) => a.start - b.start || b.end - a.end)) {
      const prev = merged[merged.length - 1];
      if (prev && m.start < prev.end) continue;
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
  get size() {
    return this._patterns.length;
  }
  /** The list of patterns (in insertion order). */
  get patterns() {
    return this._patterns;
  }
};
function buildAutomaton(patterns) {
  const ac = new AhoCorasick();
  for (const p of patterns) ac.add(p);
  return ac.build();
}
function searchAll(patterns, text) {
  return buildAutomaton(patterns).search(text);
}
function containsAny(patterns, text) {
  return buildAutomaton(patterns).containsAny(text);
}
export {
  AhoCorasick,
  buildAutomaton,
  containsAny,
  searchAll
};
//# sourceMappingURL=index.js.map