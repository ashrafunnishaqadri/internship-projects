/**
 * SummarAI — NLP Engine
 * Implements three summarization algorithms:
 *   1. TF-IDF Extractive (Term Frequency–Inverse Document Frequency)
 *   2. Word Frequency (simple bag-of-words scoring)
 *   3. Positional Ranking (sentence position heuristic)
 *
 * Also includes keyword extraction using TF-IDF scores.
 */

// ─────────────────────────────────────────────────────────────
// STOP WORDS (common words to ignore in scoring)
// ─────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'a','about','above','after','again','against','all','am','an','and',
  'any','are','aren\'t','as','at','be','because','been','before','being',
  'below','between','both','but','by','can','cannot','can\'t','could',
  'couldn\'t','did','didn\'t','do','does','doesn\'t','doing','don\'t',
  'down','during','each','few','for','from','further','get','got','had',
  'hadn\'t','has','hasn\'t','have','haven\'t','having','he','he\'d',
  'he\'ll','he\'s','her','here','here\'s','hers','herself','him',
  'himself','his','how','how\'s','i','i\'d','i\'ll','i\'m','i\'ve','if',
  'in','into','is','isn\'t','it','it\'s','its','itself','let\'s','me',
  'more','most','mustn\'t','my','myself','no','nor','not','of','off',
  'on','once','only','or','other','ought','our','ours','ourselves',
  'out','over','own','same','shan\'t','she','she\'d','she\'ll','she\'s',
  'should','shouldn\'t','so','some','such','than','that','that\'s',
  'the','their','theirs','them','themselves','then','there','there\'s',
  'these','they','they\'d','they\'ll','they\'re','they\'ve','this',
  'those','through','to','too','under','until','up','very','was',
  'wasn\'t','we','we\'d','we\'ll','we\'re','we\'ve','were','weren\'t',
  'what','what\'s','when','when\'s','where','where\'s','which','while',
  'who','who\'s','whom','why','why\'s','will','with','won\'t','would',
  'wouldn\'t','you','you\'d','you\'ll','you\'re','you\'ve','your',
  'yours','yourself','yourselves','also','just','like','may','might',
  'much','now','often','s','t','re','ll','d','m','ve'
]);

// ─────────────────────────────────────────────────────────────
// TEXT PREPROCESSING
// ─────────────────────────────────────────────────────────────

/**
 * Tokenize text into sentences using a robust regex.
 */
function tokenizeSentences(text) {
  // Handle abbreviations, ellipsis, and normal end-of-sentence punctuation
  const sentences = text
    .replace(/([.?!])\s*(?=[A-Z])/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 15); // ignore very short fragments
  return sentences;
}

/**
 * Tokenize a sentence/text into words (lowercased, alpha only).
 */
function tokenizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Stem a word using a simple Porter-like stemmer (suffix stripping).
 */
function stemWord(word) {
  return word
    .replace(/ational$/, 'ate')
    .replace(/tional$/, 'tion')
    .replace(/ences?$/, 'ence')
    .replace(/izers?$/, 'ize')
    .replace(/ising$|izing$/, 'ize')
    .replace(/ising$/, 'ise')
    .replace(/ations?$/, 'ate')
    .replace(/ators?$/, 'ate')
    .replace(/alism$/, 'al')
    .replace(/iveness$/, 'ive')
    .replace(/fulness$/, 'ful')
    .replace(/ousness$/, 'ous')
    .replace(/alisms?$/, 'al')
    .replace(/encies$/, 'ence')
    .replace(/ancies$/, 'ance')
    .replace(/ments?$/, '')
    .replace(/ness$/, '')
    .replace(/ings?$/, '')
    .replace(/edly$|edly$/, '')
    .replace(/edly$/, '')
    .replace(/edly$/, 'ed')
    .replace(/ingly$/, '')
    .replace(/ly$/, '')
    .replace(/ies$/, 'y')
    .replace(/ed$/, '')
    .replace(/er$/, '')
    .replace(/s$/, '');
}

/**
 * Compute term frequency for a list of words. Returns a Map {word: tf}.
 */
function computeTF(words) {
  const freq = new Map();
  for (const w of words) {
    const stem = stemWord(w);
    freq.set(stem, (freq.get(stem) || 0) + 1);
  }
  const total = words.length || 1;
  const tf = new Map();
  for (const [w, count] of freq) {
    tf.set(w, count / total);
  }
  return tf;
}

/**
 * Compute IDF over a collection of word-lists (per sentence).
 * Returns a Map {word: idf}.
 */
function computeIDF(docWordLists) {
  const N = docWordLists.length;
  const df = new Map();
  for (const words of docWordLists) {
    const unique = new Set(words.map(stemWord));
    for (const w of unique) {
      df.set(w, (df.get(w) || 0) + 1);
    }
  }
  const idf = new Map();
  for (const [w, count] of df) {
    idf.set(w, Math.log((N + 1) / (count + 1)) + 1); // smooth IDF
  }
  return idf;
}

// ─────────────────────────────────────────────────────────────
// ALGORITHM 1: TF-IDF EXTRACTIVE SUMMARIZATION
// ─────────────────────────────────────────────────────────────

function summarizeTFIDF(sentences, ratio) {
  const wordLists = sentences.map(s => tokenizeWords(s));
  const idf = computeIDF(wordLists);

  // Score each sentence using sum of TF-IDF scores
  const scored = sentences.map((sentence, idx) => {
    const words = wordLists[idx];
    const tf = computeTF(words);
    let score = 0;
    for (const [w, tfVal] of tf) {
      score += tfVal * (idf.get(w) || 0);
    }
    // Boost first and last sentences slightly (heuristic)
    const posBoost = (idx === 0 || idx === sentences.length - 1) ? 1.2 : 1.0;
    // Normalize by sentence length to avoid bias toward long sentences
    const lenFactor = Math.sqrt(Math.max(words.length, 1));
    return { sentence, score: (score / lenFactor) * posBoost, idx };
  });

  return scored;
}

// ─────────────────────────────────────────────────────────────
// ALGORITHM 2: WORD FREQUENCY SUMMARIZATION (LUHN'S METHOD)
// ─────────────────────────────────────────────────────────────

function summarizeFrequency(sentences, ratio) {
  // Build global word frequency
  const allWords = sentences.flatMap(s => tokenizeWords(s));
  const freq = new Map();
  for (const w of allWords) {
    const stem = stemWord(w);
    freq.set(stem, (freq.get(stem) || 0) + 1);
  }
  const maxFreq = Math.max(...freq.values(), 1);

  // Normalize frequencies
  const normFreq = new Map();
  for (const [w, count] of freq) {
    normFreq.set(w, count / maxFreq);
  }

  // Score sentences
  const scored = sentences.map((sentence, idx) => {
    const words = tokenizeWords(sentence);
    let score = words.reduce((sum, w) => sum + (normFreq.get(stemWord(w)) || 0), 0);
    score = score / Math.sqrt(Math.max(words.length, 1));
    return { sentence, score, idx };
  });

  return scored;
}

// ─────────────────────────────────────────────────────────────
// ALGORITHM 3: POSITIONAL RANKING SUMMARIZATION
// ─────────────────────────────────────────────────────────────

function summarizePositional(sentences, ratio) {
  const N = sentences.length;

  const scored = sentences.map((sentence, idx) => {
    // Positional score: paragraphs begin/end matter most
    let posScore;
    const relPos = idx / Math.max(N - 1, 1);
    if (relPos <= 0.1)      posScore = 1.0;   // Very beginning
    else if (relPos <= 0.25) posScore = 0.85;
    else if (relPos <= 0.5)  posScore = 0.65;
    else if (relPos <= 0.75) posScore = 0.5;
    else if (relPos <= 0.9)  posScore = 0.7;  // Near end
    else                     posScore = 0.9;  // Very end (conclusion)

    // Combine with word frequency for a hybrid score
    const words = tokenizeWords(sentence);
    const uniqueWords = new Set(words.map(stemWord)).size;
    const lengthScore = Math.min(uniqueWords / 15, 1.0); // reward lexical richness

    // Boost sentences with numeric data (often informative)
    const hasNumbers = /\d/.test(sentence) ? 1.1 : 1.0;

    return {
      sentence,
      score: (posScore * 0.6 + lengthScore * 0.4) * hasNumbers,
      idx
    };
  });

  return scored;
}

// ─────────────────────────────────────────────────────────────
// SENTENCE SELECTION
// ─────────────────────────────────────────────────────────────

/**
 * Given scored sentences and a ratio, pick the top N sentences
 * and return them in ORIGINAL order (for coherence).
 */
function selectTopSentences(scoredSentences, ratio) {
  const count = Math.max(1, Math.round(scoredSentences.length * (ratio / 100)));
  const top = [...scoredSentences]
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
  // Restore original order
  top.sort((a, b) => a.idx - b.idx);
  return top;
}

// ─────────────────────────────────────────────────────────────
// KEYWORD EXTRACTION
// ─────────────────────────────────────────────────────────────

/**
 * Extract top keywords using TF-IDF across all sentences.
 */
function extractKeywords(sentences, topN = 15) {
  const wordLists = sentences.map(s => tokenizeWords(s));
  const idf = computeIDF(wordLists);

  // Aggregate TF across full document
  const allWords = wordLists.flat();
  const docTF = computeTF(allWords);

  // Score = tf * idf
  const scores = [];
  for (const [word, tfVal] of docTF) {
    const idfVal = idf.get(word) || 0;
    scores.push({ word, score: tfVal * idfVal });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topN);
}

// ─────────────────────────────────────────────────────────────
// MAIN SUMMARIZE FUNCTION
// ─────────────────────────────────────────────────────────────

/**
 * @param {string} text - Input document
 * @param {string} method - 'tfidf' | 'frequency' | 'position'
 * @param {number} ratio  - Summary length as % of original (10–60)
 * @returns {{ summary: string[], scoredSentences: Array, keywords: Array, stats: object }}
 */
function summarize(text, method, ratio) {
  const sentences = tokenizeSentences(text);

  if (sentences.length === 0) {
    return { summary: [], scoredSentences: [], keywords: [], stats: {} };
  }

  // Run selected algorithm
  let scoredSentences;
  switch (method) {
    case 'frequency':
      scoredSentences = summarizeFrequency(sentences, ratio);
      break;
    case 'position':
      scoredSentences = summarizePositional(sentences, ratio);
      break;
    default:
      scoredSentences = summarizeTFIDF(sentences, ratio);
  }

  const selected = selectTopSentences(scoredSentences, ratio);
  const keywords = extractKeywords(sentences);

  // Compute stats
  const inputWordCount = text.split(/\s+/).filter(Boolean).length;
  const summaryWordCount = selected.map(s => s.sentence).join(' ').split(/\s+/).filter(Boolean).length;
  const compressionPct = Math.round((1 - summaryWordCount / inputWordCount) * 100);
  const avgRelevance = selected.length
    ? (selected.reduce((sum, s) => sum + s.score, 0) / selected.length)
    : 0;

  // Normalize relevance to 0-100 using all scores
  const maxScore = Math.max(...scoredSentences.map(s => s.score), 1);
  const relevanceScore = Math.min(Math.round((avgRelevance / maxScore) * 100), 100);

  return {
    summary: selected,
    allSentences: scoredSentences,
    keywords,
    stats: {
      inputWords: inputWordCount,
      summaryWords: summaryWordCount,
      inputSentences: sentences.length,
      extractedSentences: selected.length,
      compressionPct,
      relevanceScore,
      readTimeSaved: Math.max(0, Math.round((inputWordCount - summaryWordCount) / 200)) // avg 200wpm
    }
  };
}

// Export for use in app.js (module-free, global)
window.NLP = {
  summarize,
  tokenizeSentences,
  extractKeywords,
  STOP_WORDS
};
