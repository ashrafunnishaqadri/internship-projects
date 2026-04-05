/**
 * SummarAI — Application Controller
 * Wires together UI interactions with the NLP engine.
 */

// ─────────────────────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────────────────────
const inputText        = document.getElementById('input-text');
const summarizeBtn     = document.getElementById('summarize-btn');
const clearBtn         = document.getElementById('clear-btn');
const loadSampleBtn    = document.getElementById('load-sample-btn');
const copyBtn          = document.getElementById('copy-btn');
const downloadBtn      = document.getElementById('download-btn');
const methodSelect     = document.getElementById('method-select');
const lengthSlider     = document.getElementById('length-slider');
const sliderLabel      = document.getElementById('slider-label');
const highlightToggle  = document.getElementById('highlight-toggle');
const keywordsToggle   = document.getElementById('keywords-toggle');

const inputWordsEl     = document.getElementById('input-words');
const inputSentEl      = document.getElementById('input-sentences');
const inputCharsEl     = document.getElementById('input-chars');

const outputArea       = document.getElementById('output-area');
const outputFooter     = document.getElementById('output-footer');
const outputWordsEl    = document.getElementById('output-words');
const compressionEl    = document.getElementById('compression-ratio');
const readingTimeEl    = document.getElementById('reading-time');

const keywordsSection  = document.getElementById('keywords-section');
const keywordsCloud    = document.getElementById('keywords-cloud');
const statsSection     = document.getElementById('stats-section');
const highlightSection = document.getElementById('highlighted-section');
const highlightTextEl  = document.getElementById('highlighted-text');

const statSentVal      = document.getElementById('stat-sentences-val');
const statCompVal      = document.getElementById('stat-compression-val');
const statReadVal      = document.getElementById('stat-readtime-val');
const statScoreVal     = document.getElementById('stat-score-val');

const toast            = document.getElementById('toast');

// ─────────────────────────────────────────────────────────────
// SAMPLE TEXT
// ─────────────────────────────────────────────────────────────
const SAMPLE_TEXT = `Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.

The term "artificial intelligence" had previously been used to describe machines that mimic and display human cognitive skills associated with the human mind, such as learning and problem-solving. This definition has since been rejected by major AI researchers who now describe AI in terms of rationality and acting rationally, which does not limit how intelligence can be articulated.

AI applications include advanced web search engines (e.g., Google), recommendation systems (used by YouTube, Amazon, and Netflix), understanding human speech (such as Siri and Alexa), self-driving cars (e.g., Tesla and Waymo), generative or creative tools (ChatGPT and AI art), automated decision-making, and competing at the highest level in strategic game systems (such as chess and Go).

As machines become increasingly capable, tasks considered to require intelligence are often removed from the definition of AI, a phenomenon known as the AI effect. For instance, optical character recognition is frequently excluded from things considered to be AI, having become a routine technology. Modern machine learning techniques are the core part of many powerful AI tools developed in recent years including systems for protein structure prediction, large language models like GPT-4, and image synthesis models like Stable Diffusion.

The various sub-fields of AI research are centered around particular goals and the use of particular tools. The traditional goals of AI research include reasoning, knowledge representation, planning, learning, natural language processing, perception, and support for robotics. General intelligence (the ability to complete any task performable by a human) is among the field's long-term goals. To solve these problems, AI researchers have adapted and integrated a wide range of problem-solving techniques, including search and mathematical optimization, formal logic, artificial neural networks, and methods based on statistics, operations research, and economics.

AI was founded as an academic discipline in 1956, and in the years since it has experienced several waves of optimism followed by disappointment and the loss of funding (known as an "AI winter"), followed by new approaches, success, and renewed funding. AI research has tried and discarded many different approaches, including simulating the brain, modeling human problem solving, formal logic, large databases of knowledge, and imitating animal behavior. In the first decades of the 21st century, highly mathematical and statistical machine learning has dominated the field, and this technique has proved highly successful, helping to solve many challenging problems throughout industry and academia.

The implications of AI are profound and far-reaching. From healthcare diagnostics to financial trading, from creative arts to scientific research, AI is transforming virtually every domain of human activity. However, these advances also raise important ethical questions about bias, privacy, job displacement, and autonomous weapons. Ensuring that AI development proceeds in a way that is safe, beneficial, and aligned with human values has become one of the most critical challenges of our time.`;

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
let currentSummary = '';
let lastResult = null;

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

function showToast(message, duration = 2800) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function animateNumber(el, target, suffix = '', duration = 600) {
  const start = parseInt(el.textContent) || 0;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(start + (target - start) * eased) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text) {
  return NLP.tokenizeSentences(text).length;
}

function readingTime(words, wpm = 200) {
  const mins = Math.ceil(words / wpm);
  return mins === 1 ? '1 min' : `${mins} mins`;
}

// ─────────────────────────────────────────────────────────────
// INPUT LIVE STATS
// ─────────────────────────────────────────────────────────────

function updateInputStats() {
  const text = inputText.value;
  const words = countWords(text);
  const sentences = text.trim().length > 0 ? countSentences(text) : 0;
  const chars = text.length;

  inputWordsEl.innerHTML   = `<strong>${words.toLocaleString()}</strong> words`;
  inputSentEl.innerHTML    = `<strong>${sentences}</strong> sentences`;
  inputCharsEl.innerHTML   = `<strong>${chars.toLocaleString()}</strong> characters`;

  summarizeBtn.disabled = words < 30;
}

inputText.addEventListener('input', updateInputStats);

// ─────────────────────────────────────────────────────────────
// SLIDER
// ─────────────────────────────────────────────────────────────

lengthSlider.addEventListener('input', () => {
  sliderLabel.textContent = lengthSlider.value + '%';
  // Update slider track fill visually
  const pct = ((lengthSlider.value - lengthSlider.min) / (lengthSlider.max - lengthSlider.min)) * 100;
  lengthSlider.style.background = `linear-gradient(90deg, #818cf8 ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
});

// Initialize slider fill
const initPct = ((lengthSlider.value - lengthSlider.min) / (lengthSlider.max - lengthSlider.min)) * 100;
lengthSlider.style.background = `linear-gradient(90deg, #818cf8 ${initPct}%, rgba(255,255,255,0.1) ${initPct}%)`;

// ─────────────────────────────────────────────────────────────
// SAMPLE TEXT
// ─────────────────────────────────────────────────────────────

loadSampleBtn.addEventListener('click', () => {
  inputText.value = SAMPLE_TEXT;
  updateInputStats();
  // Animate in
  inputText.style.opacity = '0';
  setTimeout(() => { inputText.style.transition = 'opacity 0.4s'; inputText.style.opacity = '1'; }, 10);
  showToast('📄 Sample text loaded — click Summarize!');
});

// ─────────────────────────────────────────────────────────────
// CLEAR
// ─────────────────────────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  inputText.value = '';
  updateInputStats();
  resetOutput();
});

function resetOutput() {
  outputArea.innerHTML = `
    <div class="output-placeholder">
      <div class="placeholder-icon">
        <svg width="48" height="48" fill="none" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" stroke="url(#ph-grad2)" stroke-width="2" stroke-dasharray="4 4"/><path d="M16 18h16M16 24h10M16 30h16" stroke="url(#ph-grad2)" stroke-width="2" stroke-linecap="round"/><defs><linearGradient id="ph-grad2" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#818cf8"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs></svg>
      </div>
      <p>Your summary will appear here</p>
      <span>Paste text and click Summarize</span>
    </div>`;
  outputFooter.style.display = 'none';
  keywordsSection.style.display = 'none';
  statsSection.style.display = 'none';
  highlightSection.style.display = 'none';
  currentSummary = '';
  lastResult = null;
}

// ─────────────────────────────────────────────────────────────
// COPY & DOWNLOAD
// ─────────────────────────────────────────────────────────────

copyBtn.addEventListener('click', async () => {
  if (!currentSummary) return;
  try {
    await navigator.clipboard.writeText(currentSummary);
    showToast('✅ Summary copied to clipboard!');
    copyBtn.innerHTML = `<svg width="14" height="14" fill="none" viewBox="0 0 16 16"><path d="M3 8l4 4 6-6" stroke="#34d399" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Copied!`;
    setTimeout(() => {
      copyBtn.innerHTML = `<svg width="14" height="14" fill="none" viewBox="0 0 16 16"><rect x="5" y="5" width="8" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Copy`;
    }, 2000);
  } catch {
    showToast('❌ Could not copy — please select and copy manually.');
  }
});

downloadBtn.addEventListener('click', () => {
  if (!currentSummary) return;
  const method = methodSelect.options[methodSelect.selectedIndex].text;
  const date = new Date().toLocaleDateString();
  const content = `SummarAI — Text Summary\nMethod: ${method}\nDate: ${date}\n\n${'='.repeat(60)}\n\n${currentSummary}`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `summary-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Summary saved!');
});

// ─────────────────────────────────────────────────────────────
// SUMMARIZE
// ─────────────────────────────────────────────────────────────

function doSummarize() {
  const text = inputText.value.trim();
  if (!text || countWords(text) < 30) {
    showToast('⚠️ Please enter at least 30 words of text.');
    return;
  }

  // Set loading state
  summarizeBtn.classList.add('loading');
  summarizeBtn.disabled = true;
  summarizeBtn.querySelector('.btn-content').childNodes[2].textContent = ' Processing…';

  // Run NLP async (defer to avoid blocking UI thread)
  setTimeout(() => {
    try {
      const method = methodSelect.value;
      const ratio  = parseInt(lengthSlider.value);
      const result = NLP.summarize(text, method, ratio);
      lastResult = result;
      renderResults(result, text);
    } catch (err) {
      console.error(err);
      showToast('❌ An error occurred during summarization.');
    } finally {
      summarizeBtn.classList.remove('loading');
      summarizeBtn.disabled = false;
      summarizeBtn.querySelector('.btn-content').childNodes[2].textContent = ' Summarize Text';
    }
  }, 60);
}

summarizeBtn.addEventListener('click', doSummarize);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!summarizeBtn.disabled) doSummarize();
  }
});

// ─────────────────────────────────────────────────────────────
// RENDER RESULTS
// ─────────────────────────────────────────────────────────────

function renderResults(result, originalText) {
  if (result.summary.length === 0) {
    showToast('⚠️ Not enough content to summarize. Try more text.');
    return;
  }

  // Build summary text
  currentSummary = result.summary.map(s => s.sentence).join(' ');

  // ── Output Area ──────────────────────────────────────────
  const summaryHtml = result.summary.map((s, i) => {
    const delay = i * 0.07;
    return `<span class="summary-sentence" style="animation: fade-up 0.4s ease ${delay}s both">${escapeHtml(s.sentence)}</span>`;
  }).join(' ');

  outputArea.innerHTML = `<div class="summary-text">${summaryHtml}</div>`;
  outputFooter.style.display = 'flex';

  const { stats } = result;
  outputWordsEl.innerHTML = `<strong>${stats.summaryWords.toLocaleString()}</strong> words`;
  compressionEl.innerHTML = `<strong>${stats.compressionPct}%</strong> compression`;
  readingTimeEl.textContent = stats.readTimeSaved > 0
    ? `⏳ Saved ~${readingTime(stats.inputWords - stats.summaryWords)} reading`
    : '';

  // ── Stats Cards ──────────────────────────────────────────
  statsSection.style.display = 'grid';
  statSentVal.textContent  = stats.extractedSentences + ' / ' + stats.inputSentences;
  statCompVal.textContent  = stats.compressionPct + '%';
  statReadVal.textContent  = stats.readTimeSaved > 0 ? '~' + readingTime(stats.inputWords - stats.summaryWords) : '<1 min';
  statScoreVal.textContent = stats.relevanceScore + '%';

  // ── Keywords ─────────────────────────────────────────────
  if (keywordsToggle.checked && result.keywords.length > 0) {
    keywordsSection.style.display = 'block';
    const maxScore = result.keywords[0].score;

    keywordsCloud.innerHTML = result.keywords.map((kw, i) => {
      const pct = Math.round((kw.score / maxScore) * 100);
      const rank = i < 3 ? 'rank-1' : i < 8 ? 'rank-2' : 'rank-3';
      const delay = `${i * 0.04}s`;
      return `<span class="keyword-tag ${rank}" style="animation-delay:${delay}" title="Relevance: ${pct}%">
        ${escapeHtml(kw.word)}
        <span class="keyword-score">${pct}%</span>
      </span>`;
    }).join('');
  } else {
    keywordsSection.style.display = 'none';
  }

  // ── Highlighted Text ─────────────────────────────────────
  if (highlightToggle.checked) {
    highlightSection.style.display = 'block';
    const selectedSet = new Set(result.summary.map(s => s.sentence));
    const allSentences = result.allSentences;

    const highlightedHtml = allSentences.map(s => {
      if (selectedSet.has(s.sentence)) {
        return `<mark>${escapeHtml(s.sentence)}</mark>`;
      }
      return escapeHtml(s.sentence);
    }).join(' ');

    highlightTextEl.innerHTML = highlightedHtml;
  } else {
    highlightSection.style.display = 'none';
  }

  showToast(`✨ Summary generated! ${stats.compressionPct}% compression achieved.`);
}

// ─────────────────────────────────────────────────────────────
// TOGGLE CHANGES (re-render if result exists)
// ─────────────────────────────────────────────────────────────

highlightToggle.addEventListener('change', () => {
  if (!lastResult) return;
  if (highlightToggle.checked) {
    highlightSection.style.display = 'block';
    const selectedSet = new Set(lastResult.summary.map(s => s.sentence));
    const highlightedHtml = lastResult.allSentences.map(s =>
      selectedSet.has(s.sentence) ? `<mark>${escapeHtml(s.sentence)}</mark>` : escapeHtml(s.sentence)
    ).join(' ');
    highlightTextEl.innerHTML = highlightedHtml;
  } else {
    highlightSection.style.display = 'none';
  }
});

keywordsToggle.addEventListener('change', () => {
  if (!lastResult) return;
  if (keywordsToggle.checked && lastResult.keywords.length > 0) {
    keywordsSection.style.display = 'block';
  } else {
    keywordsSection.style.display = 'none';
  }
});

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
updateInputStats();
