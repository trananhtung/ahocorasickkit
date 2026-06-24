interface Match {
    /** Zero-based index of the first character of the match */
    start: number;
    /** Zero-based index of the character AFTER the last character (exclusive end) */
    end: number;
    /** The pattern that matched */
    pattern: string;
    /** The payload associated with this pattern (set via add(pattern, payload)) */
    payload?: unknown;
}
declare class AhoCorasick {
    private _nodes;
    private _patterns;
    private _payloads;
    private _built;
    constructor();
    private _makeNode;
    /**
     * Add a pattern to the automaton.
     * Must be called before build() / search().
     * @param pattern The string pattern to search for.
     * @param payload Optional data to attach to this pattern.
     */
    add(pattern: string, payload?: unknown): this;
    /**
     * Build failure links (BFS). Must be called after all add() calls.
     * search() calls this automatically on first use.
     */
    build(): this;
    private _buildU16Map;
    /**
     * Search for all pattern occurrences in `text`.
     * Returns matches in order of their end position.
     * `start` and `end` are UTF-16 code-unit indices (consistent with String.indexOf).
     */
    search(text: string): Match[];
    /**
     * Check if the text contains any of the patterns.
     */
    containsAny(text: string): boolean;
    /**
     * Find the first match in text, or undefined if none.
     */
    findFirst(text: string): Match | undefined;
    /**
     * Count total occurrences of all patterns in the text.
     */
    count(text: string): number;
    /**
     * Replace all pattern occurrences in text.
     * @param text The source text.
     * @param replacement String or function (match) → replacement string.
     */
    replace(text: string, replacement: string | ((match: Match) => string)): string;
    /** Number of patterns in the automaton. */
    get size(): number;
    /** The list of patterns (in insertion order). */
    get patterns(): readonly string[];
}
/**
 * Convenience factory: build an automaton from a list of patterns.
 */
declare function buildAutomaton(patterns: string[]): AhoCorasick;
/**
 * One-shot: search text for all occurrences of any pattern.
 */
declare function searchAll(patterns: string[], text: string): Match[];
/**
 * One-shot: check if text contains any pattern.
 */
declare function containsAny(patterns: string[], text: string): boolean;

export { AhoCorasick, type Match, buildAutomaton, containsAny, searchAll };
