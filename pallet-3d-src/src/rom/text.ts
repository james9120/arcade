/**
 * Enough of the GBA English text encoding to decode species names.
 * Bytes outside this set become "?". Terminator is 0xFF.
 * Space is 0x00 in this encoding, so it is not a terminator.
 */
const PUNCTUATION: Record<number, string> = {
  0x00: " ",
  0xab: "!",
  0xac: "?",
  0xad: ".",
  0xae: "-",
  0xb8: ",",
};

export function decodeText(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    if (byte === 0xff) break;
    if (byte >= 0xbb && byte <= 0xd4) {
      out += String.fromCharCode(65 + (byte - 0xbb));
    } else if (byte >= 0xd5 && byte <= 0xee) {
      out += String.fromCharCode(97 + (byte - 0xd5));
    } else if (byte >= 0xa1 && byte <= 0xaa) {
      out += String.fromCharCode(48 + (byte - 0xa1));
    } else if (PUNCTUATION[byte] !== undefined) {
      out += PUNCTUATION[byte];
    } else {
      out += "?";
    }
  }
  return out.trim();
}
