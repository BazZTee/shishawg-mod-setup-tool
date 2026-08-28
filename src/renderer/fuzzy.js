/**
 * Fuzzy Matching Engine for ShishaWG Mod Setup Tool
 * Handles typo tolerance, token matching, similarity calculation, and duplicate detection.
 */

// Calculate Levenshtein Distance
function levenshteinDistance(s1, s2) {
  if (!s1) return s2 ? s2.length : 0;
  if (!s2) return s1.length;

  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();

  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);

  for (let i = 0; i <= b.length; i++) {
    v0[i] = i;
  }

  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) {
      v0[j] = v1[j];
    }
  }

  return v1[b.length];
}

// Calculate similarity score between 0.0 (no match) and 1.0 (exact match)
function similarityScore(s1, s2) {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();

  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0;

  // Direct substring bonus
  if (a.includes(b) || b.includes(a)) {
    const minLen = Math.min(a.length, b.length);
    const maxLen = Math.max(a.length, b.length);
    const subRatio = minLen / maxLen;
    return Math.max(0.8, subRatio);
  }

  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, (maxLen - dist) / maxLen);
}

// Extract clean name string whether item is string or object
function getItemName(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  return (item.name || '').trim();
}

/**
 * Find the best matching item in a catalog array against a query string.
 * Uses full-string similarity + token matching.
 * @param {string} query Search query or text snippet
 * @param {Array} list Array of strings or {name, ...} objects
 * @param {number} minScore Minimum threshold (default: 0.65)
 * @returns {object|null} { item, name, score } or null if below threshold
 */
function findBestFuzzyMatch(query, list, minScore = 0.65) {
  if (!query || !list || list.length === 0) return null;
  const qClean = query.toLowerCase().trim();
  if (qClean.length < 2) return null;

  let bestMatch = null;
  let highestScore = 0;

  const qTokens = qClean.split(/[\s,./\\-]+/).filter(t => t.length > 1);

  for (const entry of list) {
    const name = getItemName(entry);
    if (!name) continue;
    const nLower = name.toLowerCase().trim();

    // 1. Exact match
    if (qClean === nLower) {
      return { item: entry, name, score: 1.0 };
    }

    // 2. Full-string similarity
    let score = similarityScore(qClean, nLower);

    // 3. Substring inclusion
    if (nLower.includes(qClean)) {
      score = Math.max(score, 0.85 + (qClean.length / nLower.length) * 0.15);
    } else if (qClean.includes(nLower)) {
      score = Math.max(score, 0.85 + (nLower.length / qClean.length) * 0.15);
    }

    // 4. Token-based matching
    const nTokens = nLower.split(/[\s,./\\-]+/).filter(t => t.length > 1);
    let matchedTokenCount = 0;

    for (const qt of qTokens) {
      for (const nt of nTokens) {
        if (qt === nt) {
          matchedTokenCount++;
          break;
        } else {
          const tSim = similarityScore(qt, nt);
          if (tSim >= 0.8) {
            matchedTokenCount += tSim;
            break;
          }
        }
      }
    }

    if (nTokens.length > 0) {
      const tokenScore = (matchedTokenCount / nTokens.length);
      score = Math.max(score, tokenScore * 0.95);
    }

    if (score > highestScore && score >= minScore) {
      highestScore = score;
      bestMatch = { item: entry, name, score: highestScore };
    }
  }

  return bestMatch;
}

/**
 * Fuzzy search & filter a list for search inputs.
 * Returns sorted list of matching items.
 */
function fuzzyFilterList(query, list, minScore = 0.45) {
  if (!query || !query.trim()) return list;
  if (!list || list.length === 0) return [];

  const q = query.toLowerCase().trim();
  const scored = [];

  for (const entry of list) {
    const name = getItemName(entry);
    if (!name) continue;
    const nLower = name.toLowerCase();

    let score = 0;
    if (nLower === q) score = 1.0;
    else if (nLower.startsWith(q)) score = 0.9 + (q.length / nLower.length) * 0.09;
    else if (nLower.includes(q)) score = 0.8 + (q.length / nLower.length) * 0.09;
    else {
      score = similarityScore(q, nLower);
    }

    if (score >= minScore) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.entry);
}

/**
 * Check if a new candidate item is a duplicate or near-duplicate of an existing entry.
 * @param {string} candidate The new item name to add
 * @param {Array} list Existing items array
 * @returns {object} { isExact: boolean, isNearDuplicate: boolean, matchName: string, similarity: number }
 */
function checkDuplicateFuzzy(candidate, list) {
  if (!candidate || !list || list.length === 0) {
    return { isExact: false, isNearDuplicate: false, matchName: '', similarity: 0 };
  }

  const cClean = candidate.toLowerCase().trim();

  for (const item of list) {
    const name = getItemName(item);
    const nLower = name.toLowerCase().trim();

    if (cClean === nLower) {
      return { isExact: true, isNearDuplicate: true, matchName: name, similarity: 1.0 };
    }

    const sim = similarityScore(cClean, nLower);
    if (sim >= 0.80) {
      return { isExact: false, isNearDuplicate: true, matchName: name, similarity: sim };
    }
  }

  return { isExact: false, isNearDuplicate: false, matchName: '', similarity: 0 };
}

// Common Shisha synonym / brand expansion helper
const SHISHA_SYNONYMS = {
  'futr': 'Amotion Futr',
  'futer': 'Amotion Futr',
  'emotion': 'Amotion Futr',
  'flashbang': 'Amotion Flash Bang',
  'breeze': 'Moze Breeze Two',
  'breeze2': 'Moze Breeze Two',
  'varity': 'Moze Varity',
  'specter': 'Vyro Specter',
  'cosmo': 'Cosmo Bowl',
  'vosku': 'Voskurymsia Mumia',
  'mumia': 'Voskurymsia Mumia',
  'litbowl': 'Hookain LitBowl',
  'lit bowl': 'Hookain LitBowl',
  'onmo': 'ONMO HMD',
  'nagrani': 'Na Grani',
  'na grani': 'Na Grani',
  'kaloud': 'Kaloud Lotus I+ 2.0',
  'lotus': 'Kaloud Lotus I+ 2.0',
  'zauber': 'Magic Cubes (Zauberwürfel) !kohle',
  'zauberwürfel': 'Magic Cubes (Zauberwürfel) !kohle',
  'zauberwuerfel': 'Magic Cubes (Zauberwürfel) !kohle',
  'magic': 'Magic Cubes (Zauberwürfel) !kohle',
  'cubes': 'Magic Cubes (Zauberwürfel) !kohle',
  'blackcoco': 'Black Coco 26mm',
  'black coco': 'Black Coco 26mm',
  'shaman': 'Shaman 26mm',
  'xkah': 'XKAH Lite',
  'xklite': 'XKAH Lite',
  'xkpro': 'XKAH Pro'
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    levenshteinDistance,
    similarityScore,
    findBestFuzzyMatch,
    fuzzyFilterList,
    checkDuplicateFuzzy,
    getItemName,
    SHISHA_SYNONYMS
  };
}
