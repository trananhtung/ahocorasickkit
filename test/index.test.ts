import { AhoCorasick, buildAutomaton, searchAll, containsAny } from "../src/index.js";

// Helper to sort matches deterministically for comparison
function sortMatches(matches: ReturnType<typeof searchAll>) {
  return [...matches].sort((a, b) =>
    a.start !== b.start ? a.start - b.start : a.pattern.localeCompare(b.pattern)
  );
}

describe("AhoCorasick — construction", () => {
  test("empty automaton returns no matches", () => {
    const ac = new AhoCorasick();
    expect(ac.size).toBe(0);
    expect(ac.search("hello")).toEqual([]);
  });

  test("add() returns this for chaining", () => {
    const ac = new AhoCorasick();
    expect(ac.add("hello")).toBe(ac);
  });

  test("add() after build() throws", () => {
    const ac = new AhoCorasick().add("a");
    ac.build();
    expect(() => ac.add("b")).toThrow("Cannot add patterns after build()");
  });

  test("add() with empty pattern throws", () => {
    expect(() => new AhoCorasick().add("")).toThrow("Empty pattern");
  });

  test("size reports pattern count", () => {
    const ac = new AhoCorasick().add("he").add("she").add("his");
    expect(ac.size).toBe(3);
  });

  test("patterns property reflects insertion order", () => {
    const ac = new AhoCorasick().add("he").add("she").add("hers");
    expect(ac.patterns).toEqual(["he", "she", "hers"]);
  });

  test("build() is idempotent", () => {
    const ac = new AhoCorasick().add("a");
    ac.build();
    ac.build(); // second call — should not throw
    expect(ac.search("a")).toHaveLength(1);
  });

  test("search() auto-builds", () => {
    const ac = new AhoCorasick().add("a");
    expect(ac.search("a")).toHaveLength(1); // didn't call build() manually
  });
});

describe("AhoCorasick — classic ushers example", () => {
  // Reference: Aho-Corasick original 1975 paper example
  // patterns: he, she, his, hers; text: ushers
  let ac: AhoCorasick;
  beforeEach(() => {
    ac = new AhoCorasick().add("he").add("she").add("his").add("hers").build();
  });

  test("finds 'she' in ushers", () => {
    const m = ac.search("ushers").find(m => m.pattern === "she");
    expect(m).toBeDefined();
    expect(m!.start).toBe(1);
    expect(m!.end).toBe(4);
  });

  test("finds 'he' in ushers", () => {
    const m = ac.search("ushers").find(m => m.pattern === "he");
    expect(m).toBeDefined();
    expect(m!.start).toBe(2);
    expect(m!.end).toBe(4);
  });

  test("finds 'hers' in ushers", () => {
    const m = ac.search("ushers").find(m => m.pattern === "hers");
    expect(m).toBeDefined();
    expect(m!.start).toBe(2);
    expect(m!.end).toBe(6);
  });

  test("does NOT find 'his' in ushers", () => {
    const m = ac.search("ushers").find(m => m.pattern === "his");
    expect(m).toBeUndefined();
  });

  test("returns 3 total matches from ushers", () => {
    expect(ac.search("ushers")).toHaveLength(3);
  });
});

describe("AhoCorasick — basic single-pattern", () => {
  test("single occurrence", () => {
    const ac = new AhoCorasick().add("abc");
    expect(ac.search("xabcx")).toEqual([{ start: 1, end: 4, pattern: "abc", payload: undefined }]);
  });

  test("multiple occurrences of same pattern", () => {
    const ac = new AhoCorasick().add("ab");
    const m = ac.search("ababab");
    expect(m).toHaveLength(3);
    expect(m.map(x => x.start)).toEqual([0, 2, 4]);
  });

  test("pattern at start of text", () => {
    const ac = new AhoCorasick().add("hello");
    const m = ac.search("hello world");
    expect(m[0].start).toBe(0);
    expect(m[0].end).toBe(5);
  });

  test("pattern at end of text", () => {
    const ac = new AhoCorasick().add("world");
    const m = ac.search("hello world");
    expect(m[0].start).toBe(6);
    expect(m[0].end).toBe(11);
  });

  test("text equals pattern", () => {
    const ac = new AhoCorasick().add("abc");
    expect(ac.search("abc")).toHaveLength(1);
  });

  test("no match returns empty array", () => {
    const ac = new AhoCorasick().add("xyz");
    expect(ac.search("hello world")).toEqual([]);
  });

  test("single-character pattern", () => {
    const ac = new AhoCorasick().add("a");
    expect(ac.search("banana")).toHaveLength(3);
  });
});

describe("AhoCorasick — overlapping patterns", () => {
  test("nested patterns: 'ab' inside 'abc'", () => {
    const ac = new AhoCorasick().add("ab").add("abc");
    const m = ac.search("abc");
    const patterns = m.map(x => x.pattern);
    expect(patterns).toContain("ab");
    expect(patterns).toContain("abc");
  });

  test("overlapping: 'aa' in 'aaa' finds 2 matches", () => {
    const ac = new AhoCorasick().add("aa");
    expect(ac.search("aaa")).toHaveLength(2);
  });

  test("suffix pattern: 'b' inside 'ab'", () => {
    const ac = new AhoCorasick().add("ab").add("b");
    const m = ac.search("ab");
    expect(m).toHaveLength(2);
  });
});

describe("AhoCorasick — payload support", () => {
  test("payload is attached to match", () => {
    const ac = new AhoCorasick()
      .add("foo", { id: 1 })
      .add("bar", { id: 2 });
    const results = ac.search("foobar");
    const fooMatch = results.find(m => m.pattern === "foo");
    const barMatch = results.find(m => m.pattern === "bar");
    expect(fooMatch?.payload).toEqual({ id: 1 });
    expect(barMatch?.payload).toEqual({ id: 2 });
  });

  test("undefined payload when not set", () => {
    const ac = new AhoCorasick().add("abc");
    expect(ac.search("abc")[0].payload).toBeUndefined();
  });
});

describe("AhoCorasick — containsAny()", () => {
  test("returns true when pattern present", () => {
    const ac = new AhoCorasick().add("bad").add("word");
    expect(ac.containsAny("this is a bad sentence")).toBe(true);
  });

  test("returns false when no pattern", () => {
    const ac = new AhoCorasick().add("bad").add("word");
    expect(ac.containsAny("clean sentence")).toBe(false);
  });

  test("returns false on empty text", () => {
    const ac = new AhoCorasick().add("x");
    expect(ac.containsAny("")).toBe(false);
  });

  test("returns false when automaton is empty", () => {
    const ac = new AhoCorasick();
    expect(ac.containsAny("anything")).toBe(false);
  });
});

describe("AhoCorasick — findFirst()", () => {
  test("finds the first match by end position", () => {
    const ac = new AhoCorasick().add("world").add("hello");
    const m = ac.findFirst("hello world");
    expect(m?.pattern).toBe("hello");
  });

  test("returns undefined when no match", () => {
    const ac = new AhoCorasick().add("xyz");
    expect(ac.findFirst("hello")).toBeUndefined();
  });

  test("returns undefined on empty automaton", () => {
    const ac = new AhoCorasick();
    expect(ac.findFirst("hello")).toBeUndefined();
  });
});

describe("AhoCorasick — count()", () => {
  test("zero when no patterns", () => {
    expect(new AhoCorasick().count("hello")).toBe(0);
  });

  test("counts all occurrences including overlaps", () => {
    const ac = new AhoCorasick().add("he").add("she").add("hers");
    expect(ac.count("ushers")).toBe(3);
  });
});

describe("AhoCorasick — replace()", () => {
  test("string replacement", () => {
    const ac = new AhoCorasick().add("bad").add("worse");
    expect(ac.replace("this is bad and worse", "CENSORED")).toBe("this is CENSORED and CENSORED");
  });

  test("function replacement", () => {
    const ac = new AhoCorasick().add("foo").add("bar");
    const result = ac.replace("foo and bar", m => m.pattern.toUpperCase());
    expect(result).toBe("FOO and BAR");
  });

  test("no matches returns original", () => {
    const ac = new AhoCorasick().add("xyz");
    expect(ac.replace("hello world", "NOPE")).toBe("hello world");
  });

  test("overlapping: takes longer non-overlapping matches", () => {
    const ac = new AhoCorasick().add("ab").add("abcd");
    // "abcd" is longer and starts at 0; "ab" also starts at 0 — abcd wins
    const result = ac.replace("abcde", "X");
    expect(result).toBe("Xe");
  });

  test("replace with function gets correct match info", () => {
    const ac = new AhoCorasick().add("hello", "payload-123");
    const result = ac.replace("say hello", m => `${m.pattern}[${m.start}:${m.end}]`);
    expect(result).toBe("say hello[4:9]");
  });

  test("empty text returns empty", () => {
    const ac = new AhoCorasick().add("x");
    expect(ac.replace("", "y")).toBe("");
  });
});

describe("AhoCorasick — Unicode", () => {
  test("matches Unicode patterns", () => {
    const ac = new AhoCorasick().add("héllo").add("wörld");
    const m = ac.search("say héllo to the wörld");
    expect(sortMatches(m).map(x => x.pattern)).toEqual(["héllo", "wörld"]);
  });

  test("matches emoji patterns", () => {
    const ac = new AhoCorasick().add("🎉").add("🚀");
    const text = "let's 🎉 and 🚀 off";
    const m = ac.search(text);
    expect(m).toHaveLength(2);
    // UTF-16 positions: "let's " = 6 chars, 🎉 = 2 UTF-16 units
    expect(m.find(x => x.pattern === "🎉")?.start).toBe(text.indexOf("🎉"));
    expect(m.find(x => x.pattern === "🚀")?.start).toBe(text.indexOf("🚀"));
  });

  test("Chinese characters", () => {
    const ac = new AhoCorasick().add("北京").add("上海");
    const m = ac.search("北京和上海是中国城市");
    expect(sortMatches(m).map(x => x.pattern)).toEqual(["北京", "上海"]);
  });
});

describe("buildAutomaton() convenience factory", () => {
  test("builds and returns usable automaton", () => {
    const ac = buildAutomaton(["he", "she", "hers"]);
    expect(ac.search("ushers")).toHaveLength(3);
  });

  test("empty pattern list — no matches", () => {
    const ac = buildAutomaton([]);
    expect(ac.search("hello")).toEqual([]);
  });
});

describe("searchAll() convenience function", () => {
  test("one-shot search", () => {
    const results = searchAll(["he", "she", "hers"], "ushers");
    expect(results).toHaveLength(3);
  });

  test("no matches", () => {
    expect(searchAll(["xyz"], "hello")).toEqual([]);
  });
});

describe("containsAny() convenience function", () => {
  test("returns true when match found", () => {
    expect(containsAny(["spam", "phishing"], "this is a spam email")).toBe(true);
  });

  test("returns false when no match", () => {
    expect(containsAny(["spam", "phishing"], "clean email")).toBe(false);
  });
});

describe("AhoCorasick — edge cases", () => {
  test("single-character text, single-character pattern — match", () => {
    const ac = new AhoCorasick().add("a");
    expect(ac.search("a")).toHaveLength(1);
  });

  test("single-character text, single-character pattern — no match", () => {
    const ac = new AhoCorasick().add("b");
    expect(ac.search("a")).toHaveLength(0);
  });

  test("pattern longer than text — no match", () => {
    const ac = new AhoCorasick().add("hello world");
    expect(ac.search("hello")).toHaveLength(0);
  });

  test("identical patterns added twice — finds two payloads", () => {
    const ac = new AhoCorasick().add("x", 1).add("x", 2);
    const m = ac.search("x");
    // Both patterns should be found (same trie node, but two output entries)
    expect(m).toHaveLength(2);
    const payloads = m.map(x => x.payload).sort();
    expect(payloads).toEqual([1, 2]);
  });

  test("large number of patterns — all matched", () => {
    const ac = new AhoCorasick();
    // Zero-pad so no pattern is a substring of another (pat_000 … pat_099)
    const patterns = Array.from({ length: 100 }, (_, i) => `pat_${String(i).padStart(3, "0")}_x`);
    for (const p of patterns) ac.add(p);
    const text = patterns.join(" ");
    const matches = ac.search(text);
    expect(matches).toHaveLength(100);
  });

  test("patterns with shared prefix", () => {
    const ac = new AhoCorasick().add("abc").add("abcd").add("abcde");
    const m = ac.search("abcde");
    const found = m.map(x => x.pattern).sort();
    expect(found).toEqual(["abc", "abcd", "abcde"]);
  });

  test("all-same-character pattern in all-same-character text", () => {
    const ac = new AhoCorasick().add("aaa");
    // "aaaa" contains "aaa" at positions 0 and 1
    expect(ac.search("aaaa")).toHaveLength(2);
  });

  test("reuse automaton across multiple search calls", () => {
    const ac = new AhoCorasick().add("cat").add("dog").build();
    expect(ac.search("the cat sat")).toHaveLength(1);
    expect(ac.search("dog and cat")).toHaveLength(2);
    expect(ac.search("no animals")).toHaveLength(0);
  });
});
