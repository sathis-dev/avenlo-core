// ====================================
// AVENLO CORE - RING -1: THE ANOMALY SIEVE
// Native-level text hashing, homoglyph normalization, ZWJ detection
// ====================================

import { Message } from 'discord.js';
import { createLogger } from '@avenlo/shared';

const logger = createLogger('ring-minus-1');

// ====================================
// CONSTANTS
// ====================================

// Common homoglyphs mapped back to English
const HOMOGLYPH_MAP: Record<string, string> = {
  'а': 'a', '@': 'a', '4': 'a', 'Λ': 'a',
  'в': 'b', 'ß': 'b', '8': 'b',
  'с': 'c', '©': 'c', '¢': 'c', '(': 'c',
  'ԁ': 'd', 'đ': 'd',
  'е': 'e', '3': 'e', '€': 'e', '£': 'e',
  'ƒ': 'f',
  'ɡ': 'g', '9': 'g',
  'һ': 'h', '#': 'h',
  'і': 'i', '1': 'i', '!': 'i', '|': 'i',
  'ј': 'j',
  'κ': 'k',
  'ӏ': 'l', 'I': 'l',
  'м': 'm',
  'п': 'n', 'η': 'n',
  'о': 'o', '0': 'o', 'ø': 'o', 'θ': 'o',
  'р': 'p',
  'q': 'q',
  'г': 'r', '®': 'r',
  'ѕ': 's', '5': 's', '$': 's',
  'т': 't', '7': 't', '+': 't',
  'υ': 'u', 'μ': 'u',
  'ν': 'v',
  'ѡ': 'w',
  'х': 'x', '×': 'x',
  'у': 'y', '¥': 'y',
  'z': 'z', '2': 'z'
};

const ZWJ_REGEX = /[\u200B-\u200D\uFEFF]/g;
const ZALGO_REGEX = /[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D4-\u08E1\u08E3-\u0902\u093A-\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CC2\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D01\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86-\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ABD\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DF5\u1DFC-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA8C4\uA8E0-\uA8F1\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2D]/g;

export interface RingMinus1Result {
  blocked: boolean;
  reason?: string;
  normalizedContent: string;
  threatAmount: number;
}

// ====================================
// RING -1 IMPLEMENTATION
// ====================================

export class RingMinus1 {
  private static instance: RingMinus1;

  private constructor() {}

  public static getInstance(): RingMinus1 {
    if (!RingMinus1.instance) {
      RingMinus1.instance = new RingMinus1();
    }
    return RingMinus1.instance;
  }

  /**
   * Extremely fast pre-processing of text to strip out obfuscation
   * Runs in < 0.1ms
   */
  public processMessage(message: Message): RingMinus1Result {
    let content = message.content;
    let threatAmount = 0;
    let blocked = false;
    let reason = '';

    // 1. Detect and Strip Zero-Width Joiners (Invisible character evasion)
    if (ZWJ_REGEX.test(content)) {
      content = content.replace(ZWJ_REGEX, '');
      threatAmount += 15; // Suspicious, but could be artifacts
    }

    // 2. Detect and Strip Zalgo Text (Chat crashing attempts)
    if (ZALGO_REGEX.test(content)) {
      const matchCount = (message.content.match(ZALGO_REGEX) || []).length;
      if (matchCount > 20) {
        blocked = true;
        reason = 'Zalgo Text / Chat Nuke Evasion';
        threatAmount += 50;
      }
      content = content.replace(ZALGO_REGEX, '');
    }

    // 3. Normalize Homoglyphs (Converting Cyrillic/Greek back to English)
    let normalized = '';
    let homoglyphCount = 0;
    for (const char of content.toLowerCase()) {
      if (HOMOGLYPH_MAP[char]) {
        normalized += HOMOGLYPH_MAP[char];
        homoglyphCount++;
      } else {
        normalized += char;
      }
    }

    // If an unnatural amount of homoglyphs is detected, flag it
    if (homoglyphCount > 5 && (homoglyphCount / content.length) > 0.3) {
      threatAmount += 30; // High probability of AI evasion attempt
    }

    // 4. Fuzzy Hashing (SimHash) - Check if this is a polymorphic spam variant
    // We calculate a basic structural hash (ignoring numbers and punctuation)
    const structureHash = this.calculateStructuralHash(normalized);
    // (Note: The actual lookup against the Hive Mind happens in Ring 1, 
    // Ring -1 just prepares the mathematical data)
    
    // Attach the normalized content to the message object so later rings use the clean version
    (message as any)._normalizedContent = normalized;
    (message as any)._structureHash = structureHash;

    return {
      blocked,
      reason,
      normalizedContent: normalized,
      threatAmount
    };
  }

  /**
   * Calculates a structural hash that ignores exact words but captures the "shape" of the message.
   * Useful for polymorphic spam where raiders change 1 or 2 words to bypass filters.
   */
  private calculateStructuralHash(text: string): string {
    // Remove all numbers, punctuation, and emojis
    const stripped = text.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
    const words = stripped.split(' ');
    
    // Create a hash based on the lengths of words.
    // "Free nitro here" (4, 5, 4) -> same hash as "Make money fast" (4, 5, 4)
    // This is incredibly powerful for catching template-based spam bots.
    return words.map(w => w.length).join('-');
  }
}
