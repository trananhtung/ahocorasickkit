# ahocorasickkit

Zero-dependency TypeScript Aho-Corasick automaton for multi-pattern string search. Find **all** occurrences of N patterns in O(text + matches) time — the same algorithm behind Python's [pyahocorasick](https://pypi.org/project/pyahocorasick/) and Go's [iohub/corasick](https://github.com/iohub/corasick).

Drop-in replacement for the abandoned [`ahocorasick`](https://www.npmjs.com/package/ahocorasick) npm package (2016), with full TypeScript types.

[![npm](https://img.shields.io/npm/v/ahocorasickkit)](https://www.npmjs.com/package/ahocorasickkit)
[![license](https://img.shields.io/npm/l/ahocorasickkit)](LICENSE)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)

## Install

```bash
npm install ahocorasickkit
```

## Quick start

```typescript
import { AhoCorasick } from "ahocorasickkit";

const ac = new AhoCorasick()
  .add("he")
  .add("she")
  .add("his")
  .add("hers")
  .build();

ac.search("ushers");
// [
//   { start: 1, end: 4, pattern: "she", payload: undefined },
//   { start: 2, end: 4, pattern: "he",  payload: undefined },
//   { start: 2, end: 6, pattern: "hers",payload: undefined },
// ]
```

## Why Aho-Corasick?

| Approach | Cost to search N patterns in text of length T |
|---|---|
| N × `String.indexOf` | O(N × T) |
| N × RegExp | O(N × T), plus regex overhead |
| **Aho-Corasick** | **O(T + matches)** — build once, search fast |

Great for: keyword filters, spam detection, log analysis, autocomplete highlighting, tokenizers, anti-virus signature scanning.

## API

### `new AhoCorasick()`

```typescript
const ac = new AhoCorasick();
```

### `.add(pattern, payload?)`

Add a pattern before calling `build()`. Returns `this` for chaining. Optional `payload` is arbitrary data attached to matches.

```typescript
ac.add("error", { severity: "high" });
ac.add("warn",  { severity: "medium" });
```

### `.build()`

Compute failure links (BFS). Called automatically by `search()` on first use. Explicit call is recommended for clarity.

### `.search(text): Match[]`

Find all occurrences. Returns `Match[]` sorted by end position.

```typescript
interface Match {
  start:   number;   // index of first character (inclusive)
  end:     number;   // index after last character (exclusive)
  pattern: string;
  payload: unknown;
}
```

### `.containsAny(text): boolean`

Returns `true` as soon as any pattern is found (short-circuits).

### `.findFirst(text): Match | undefined`

Return the first match by end position, or `undefined`.

### `.count(text): number`

Total number of pattern occurrences (including overlapping).

### `.replace(text, replacement): string`

Replace non-overlapping pattern occurrences. When two patterns overlap, the longer one wins.

```typescript
const ac = new AhoCorasick().add("foo").add("bar");
ac.replace("foo and bar", "WORD"); // "WORD and WORD"

// Function replacement:
ac.replace("foo and bar", m => `[${m.pattern}]`); // "[foo] and [bar]"
```

### Convenience functions

```typescript
import { buildAutomaton, searchAll, containsAny } from "ahocorasickkit";

// Build from array of patterns
const ac = buildAutomaton(["foo", "bar", "baz"]);

// One-shot search
searchAll(["foo", "bar"], "foo and bar"); // Match[]

// One-shot contains check
containsAny(["spam", "scam"], "legit email"); // false
```

## Real-world example: content moderation

```typescript
import { AhoCorasick } from "ahocorasickkit";

const filter = new AhoCorasick();
for (const [word, category] of profanityList) {
  filter.add(word, category);
}
filter.build();

function moderate(text: string) {
  const hits = filter.search(text.toLowerCase());
  if (hits.length === 0) return { clean: true, text };
  const redacted = filter.replace(text.toLowerCase(), m => "*".repeat(m.pattern.length));
  return { clean: false, text: redacted, categories: hits.map(h => h.payload) };
}
```

## Algorithm

Aho-Corasick (1975) builds a finite automaton in O(sum of pattern lengths). The automaton is traversed once for each character in the text. Failure links allow the automaton to fall back to the longest proper suffix that is also a valid prefix of some pattern — so every position is visited at most once.

```
Build:  O(Σ|pᵢ|)    — sum of pattern lengths
Search: O(T + |M|)   — text length + number of matches
Space:  O(Σ|pᵢ|)
```

## License

MIT
