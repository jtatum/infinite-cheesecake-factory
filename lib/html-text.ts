import { decode } from "html-entities";

/** Decode character references occasionally emitted by text-generation models. */
export function decodeHtmlCharacterReferences(value: string) {
  return decode(value, { level: "html5", scope: "strict" });
}
