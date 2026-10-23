const chat = document.getElementById('chat');
const form = document.getElementById('chatForm');
const question = document.getElementById('question');
const trace = document.getElementById('trace');
const sourceUsed = document.getElementById('sourceUsed');
const sendButton = form.querySelector('button[type="submit"]');
const sendLabel = sendButton.querySelector('span:first-child');
const themeToggle = document.getElementById('themeToggle');
let isSending = false;

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
  themeToggle.querySelector('.theme-label').textContent = isDark ? 'Light' : 'Dark';
  themeToggle.querySelector('.theme-icon').textContent = isDark ? '☼' : '◐';
}

applyTheme(localStorage.getItem('knowledge-desk-theme') || 'light');
themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  localStorage.setItem('knowledge-desk-theme', theme);
});

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function safeExternalUrl(value = '') {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function responseText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(block => {
      if (typeof block === 'string') return block;
      return block && typeof block.text === 'string' ? block.text : '';
    }).filter(Boolean).join('\n');
  }
  return value && typeof value === 'object' && typeof value.text === 'string' ? value.text : '';
}

function addMessage(role, text, source = '', citations = []) {
  const wrap = document.createElement('div');
  const label = role === 'user' ? 'You' : 'Knowledge Desk';
  const avatar = role === 'user' ? '' : '<div class="avatar" aria-hidden="true"><span>✳</span></div>';
  const citeHtml = citations.length
    ? `<div class="citations"><strong>Sources</strong><br>${citations.map(citation => {
      const title = escapeHtml(citation.title || citation.url || 'Source');
      const url = safeExternalUrl(citation.url);
      return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${title}</a>` : title;
    }).join('<br>')}</div>`
    : '';

  wrap.className = `message ${role}`;
  wrap.innerHTML = `${avatar}<div class="bubble"><div class="message-meta"><strong>${label}</strong><span>JUST NOW</span></div>${escapeHtml(responseText(text)).replace(/\n/g, '<br>')}${source ? `<div class="answer-source">Source: ${escapeHtml(source)}</div>` : ''}${citeHtml}</div>`;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function renderTrace(items = []) {
  trace.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No trace.';
    trace.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'trace-item';
    row.textContent = item;
    trace.appendChild(row);
  });
}

async function askAgent(value) {
  if (isSending) return;
  isSending = true;
  addMessage('user', value);
  question.value = '';
  question.style.height = 'auto';
  renderTrace(['Running LangGraph workflow...']);
  sourceUsed.textContent = 'Searching sources...';
  chat.setAttribute('aria-busy', 'true');
  sendButton.disabled = true;
  sendLabel.textContent = 'Thinking';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Request failed');

    addMessage('assistant', data.answer, data.source_used, data.citations || []);
    renderTrace(data.trace || []);
    sourceUsed.textContent = data.source_used || 'Unknown';
  } catch (error) {
    addMessage('assistant', `Error: ${error.message}`);
    renderTrace(['Request failed']);
    sourceUsed.textContent = 'Error';
  } finally {
    isSending = false;
    chat.removeAttribute('aria-busy');
    sendButton.disabled = false;
    sendLabel.textContent = 'Ask agent';
    question.focus();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const value = question.value.trim();
  if (value) askAgent(value);
});

question.addEventListener('input', () => {
  question.style.height = 'auto';
  question.style.height = `${Math.min(question.scrollHeight, 160)}px`;
});

question.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll('.example').forEach(button => {
  button.addEventListener('click', () => askAgent(button.dataset.question));
});

const modal = document.getElementById('uploadModal');
const openUpload = document.getElementById('openUpload');
const closeUpload = document.getElementById('closeUpload');
let previousFocus;

function showUpload() {
  previousFocus = document.activeElement;
  modal.classList.remove('hidden');
  document.getElementById('adminKey').focus();
}

function hideUpload() {
  modal.classList.add('hidden');
  previousFocus?.focus();
}

openUpload.addEventListener('click', showUpload);
closeUpload.addEventListener('click', hideUpload);
modal.addEventListener('click', event => {
  if (event.target === modal) hideUpload();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !modal.classList.contains('hidden')) hideUpload();
});

document.getElementById('uploadBtn').addEventListener('click', async event => {
  const button = event.currentTarget;
  const file = document.getElementById('fileInput').files[0];
  const key = document.getElementById('adminKey').value;
  const status = document.getElementById('uploadStatus');
  if (!file) {
    status.textContent = 'Choose a document to continue.';
    return;
  }

  status.textContent = 'Indexing document...';
  button.disabled = true;
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'X-Admin-Key': key },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Upload failed');
    status.textContent = `Indexed ${data.file}: ${data.chunks} chunks.`;
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});