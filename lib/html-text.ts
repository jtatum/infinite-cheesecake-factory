const namedCharacterReferences: Record<string, string> = {
  amp: "&",
  apos: "'",
  bull: "•",
  copy: "©",
  deg: "°",
  eacute: "é",
  Eacute: "É",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  mdash: "—",
  middot: "·",
  nbsp: "\u00a0",
  ndash: "–",
  pound: "£",
  quot: '"',
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  times: "×",
  trade: "™",
  euro: "€",
  gt: ">",
  lt: "<",
};

/** Decode character references occasionally emitted by text-generation models. */
export function decodeHtmlCharacterReferences(value: string) {
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z][\da-z]+));/gi, (reference, decimal, hexadecimal, named) => {
    if (named) return namedCharacterReferences[named] ?? reference;

    const codePoint = Number.parseInt(decimal ?? hexadecimal, decimal ? 10 : 16);
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      return reference;
    }
    return String.fromCodePoint(codePoint);
  });
}
