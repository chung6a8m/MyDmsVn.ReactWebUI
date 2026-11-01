export function wellFormedText(value: string): boolean {
  return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
}

// Scan before JSON.parse: the native parser discards duplicate member evidence
// and accepts lone surrogates and numeric exponents forbidden by WEB3.
export function parseStrictJson(source: string): unknown {
  const require = (valid: unknown) => { if (!valid) throw new SyntaxError("Invalid strict JSON"); };
  require(wellFormedText(source) && !source.startsWith("\uFEFF"));
  let position = 0;
  const whitespace = () => { while (/[ \t\r\n]/.test(source[position] ?? "x")) position++; };
  const string = (): string => {
    require(source[position] === '"');
    const start = position++;
    while (position < source.length) {
      if (source[position] === "\\") { position += 2; continue; }
      if (source[position++] === '"') {
        const value: string = JSON.parse(source.slice(start, position));
        require(wellFormedText(value));
        return value;
      }
    }
    throw new SyntaxError("Invalid strict JSON");
  };
  const value = (depth: number): void => {
    require(depth <= 32); whitespace();
    if (source[position] === '"') { string(); return; }
    if (source[position] === "{") {
      position++; whitespace();
      const keys = new Set<string>();
      if (source[position] === "}") { position++; return; }
      for (;;) {
        whitespace(); const key = string(); require(!keys.has(key)); keys.add(key);
        whitespace(); require(source[position++] === ":"); value(depth + 1); whitespace();
        const delimiter = source[position++]; if (delimiter === "}") return; require(delimiter === ",");
      }
    }
    if (source[position] === "[") {
      position++; whitespace(); if (source[position] === "]") { position++; return; }
      for (;;) {
        value(depth + 1); whitespace(); const delimiter = source[position++];
        if (delimiter === "]") return; require(delimiter === ",");
      }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9][0-9]*))/.exec(source.slice(position));
    require(token && token[0] !== "-0"); position += token![0].length;
  };
  try { value(0); whitespace(); require(position === source.length); return JSON.parse(source); }
  catch { throw new SyntaxError("Invalid strict JSON"); }
}
