// Superjective Extension - Sidebar UI Logic

// State
let state = {
  selectedText: '',
  context: '',
  drafts: [],
  comparisonId: null,
  loading: false,
  selectedDraftId: null,
  error: null,
  authenticated: false
};

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const loginBtn = document.getElementById('login-btn');
const closeBtn = document.getElementById('close-btn');
const contextInput = document.getElementById('context-input');
const generateBtn = document.getElementById('generate-btn');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const draftsContainer = document.getElementById('drafts-container');
const actionsSection = document.getElementById('actions-section');
const regenerateBtn = document.getElementById('regenerate-btn');
const piiNotice = document.getElementById('pii-notice');
const insertHint = document.getElementById('insert-hint');

// PII Filter instance
const piiFilter = new PIIFilter();

// Initialize
async function init() {
  // Set up message listener FIRST (before async operations)
  setupMessageListener();

  // Check auth status
  const authStatus = await sendMessage({ action: 'checkAuth' });
  state.authenticated = authStatus.authenticated;

  if (state.authenticated) {
    showScreen('main');
    // Don't auto-generate - let user add context first
  } else {
    showScreen('auth');
  }

  // Set up other event listeners
  setupEventListeners();
}

// Set up message listener immediately to catch INIT_SIDEBAR
function setupMessageListener() {
  window.addEventListener('message', (event) => {
    console.log('Sidebar received message:', event.data);
    if (event.data.type === 'INIT_SIDEBAR') {
      console.log('Setting selectedText to:', event.data.selectedText);
      state.selectedText = event.data.selectedText;
      // Don't auto-generate - let user add context first and click Generate
    }

    if (event.data.type === 'COPY_SUCCESS') {
      showToast('Copied to clipboard!');
    }

    if (event.data.type === 'INSERT_SUCCESS') {
      // Already showing toast in insert handler
    }
  });
}

function setupEventListeners() {
  loginBtn.addEventListener('click', handleLogin);
  closeBtn.addEventListener('click', handleClose);
  generateBtn.addEventListener('click', () => handleGenerate());
  retryBtn.addEventListener('click', () => handleGenerate());
  regenerateBtn.addEventListener('click', () => handleGenerate());

  contextInput.addEventListener('input', (e) => {
    state.context = e.target.value;
  });

  // Enter key triggers generate
  contextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  });
}

// Auth handlers
async function handleLogin() {
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  try {
    const result = await sendMessage({ action: 'login' });
    if (result.success) {
      state.authenticated = true;
      showScreen('main');
      // Auto-generate if we have selected text
      if (state.selectedText) {
        handleGenerate();
      }
    } else {
      throw new Error(result.error || 'Login failed');
    }
  } catch (error) {
    alert('Login failed: ' + error.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In with Auth0';
  }
}

function handleClose() {
  window.parent.postMessage({ type: 'CLOSE_SIDEBAR' }, '*');
}

// Generate drafts
async function handleGenerate() {
  if (!state.selectedText) {
    showError('No text selected');
    return;
  }

  // Filter PII before sending
  const filteredPrompt = piiFilter.filter(state.selectedText);
  const filteredContext = state.context ? piiFilter.filter(state.context) : '';

  // Debug logging for PII filtering
  console.log('PII Filter - Original prompt:', state.selectedText);
  console.log('PII Filter - Filtered prompt:', filteredPrompt);
  if (state.context) {
    console.log('PII Filter - Original context:', state.context);
    console.log('PII Filter - Filtered context:', filteredContext);
  }

  // Check if PII was filtered
  const piiFiltered = filteredPrompt !== state.selectedText ||
    (state.context && filteredContext !== state.context);

  console.log('PII Filter - Was PII filtered?', piiFiltered);

  if (piiFiltered) {
    piiNotice.classList.remove('hidden');
  } else {
    piiNotice.classList.add('hidden');
  }

  // Show loading state
  state.loading = true;
  state.error = null;
  state.drafts = [];
  state.selectedDraftId = null;
  updateUI();

  try {
    const result = await sendMessage({
      action: 'generateDrafts',
      data: {
        prompt: filteredPrompt,
        context: filteredContext || undefined
      }
    });

    if (result.error) {
      throw new Error(result.error);
    }

    state.drafts = result.drafts;
    state.comparisonId = result.comparison_id;
    state.loading = false;
    updateUI();
  } catch (error) {
    state.error = error.message;
    state.loading = false;
    updateUI();
  }
}

// Select a draft
async function handleSelectDraft(responseId) {
  if (!state.comparisonId) return;

  state.selectedDraftId = responseId;
  updateUI();

  // Auto-insert the selected draft
  const selectedDraft = state.drafts.find(d => d.response_id === responseId);
  if (selectedDraft) {
    handleInsertDraft(selectedDraft.text);
    showToast('Draft inserted!');
  }

  try {
    // Build response feedback
    const responseFeedback = state.drafts.map(draft => ({
      response_id: draft.response_id,
      is_flagged: false,
      flag_reason: null
    }));

    await sendMessage({
      action: 'completeDrafts',
      data: {
        comparisonId: state.comparisonId,
        bestResponseId: responseId,
        responseFeedback
      }
    });
  } catch (error) {
    console.error('Failed to record selection:', error);
    // Don't show error to user - selection is recorded locally
  }
}

// Copy draft text
function handleCopyDraft(text) {
  window.parent.postMessage({
    type: 'COPY_TO_CLIPBOARD',
    text
  }, '*');
}

// Insert draft text into the original input
function handleInsertDraft(text) {
  window.parent.postMessage({
    type: 'INSERT_TEXT',
    text
  }, '*');
}

// UI Updates
function updateUI() {
  // Loading state
  if (state.loading) {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    draftsContainer.innerHTML = '';
    actionsSection.classList.add('hidden');
    return;
  }

  loadingState.classList.add('hidden');

  // Error state
  if (state.error) {
    errorState.classList.remove('hidden');
    errorMessage.textContent = state.error;
    draftsContainer.innerHTML = '';
    actionsSection.classList.add('hidden');
    return;
  }

  errorState.classList.add('hidden');

  // Render drafts
  if (state.drafts.length > 0) {
    renderDrafts();
    actionsSection.classList.remove('hidden');
    insertHint.classList.remove('hidden');
  } else {
    insertHint.classList.add('hidden');
  }
}

function renderDrafts() {
  const hasSelection = state.selectedDraftId !== null;

  draftsContainer.innerHTML = state.drafts.map((draft, index) => {
    const isSelected = state.selectedDraftId === draft.response_id;
    const isNotSelected = hasSelection && !isSelected;
    const providerInitial = draft.provider ? draft.provider[0].toUpperCase() : '?';

    return `
      <div class="draft-card ${isSelected ? 'selected' : ''} ${isNotSelected ? 'not-selected' : ''}" data-response-id="${draft.response_id}">
        <div class="draft-header">
          <div class="draft-info">
            <div class="provider-badge">${providerInitial}</div>
            <span class="draft-label">Draft ${index + 1}</span>
          </div>
          ${isSelected ? '<span class="selected-badge">✓ Selected</span>' : ''}
          ${isNotSelected ? '<span class="not-selected-badge">Not selected</span>' : ''}
        </div>

        <div class="draft-text">${escapeHtml(draft.text)}</div>

        <div class="draft-actions">
          ${!hasSelection ? `
            <button class="btn btn-primary select-btn" data-response-id="${draft.response_id}">
              Select This Draft
            </button>
          ` : `
            <button class="btn btn-secondary copy-btn" data-text="${escapeAttr(draft.text)}">
              Copy Draft
            </button>
          `}
        </div>

        ${hasSelection ? `
          <div class="model-details">
            <strong>Provider:</strong> ${escapeHtml(draft.provider)}<br>
            <strong>Model:</strong> ${escapeHtml(draft.model_name || 'Unknown')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Add event listeners
  draftsContainer.querySelectorAll('.select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const responseId = parseInt(btn.dataset.responseId);
      handleSelectDraft(responseId);
    });
  });

  draftsContainer.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handleCopyDraft(btn.dataset.text);
      showToast('Copied to clipboard!');
    });
  });
}

function showScreen(screen) {
  authScreen.classList.add('hidden');
  mainScreen.classList.add('hidden');

  if (screen === 'auth') {
    authScreen.classList.remove('hidden');
  } else if (screen === 'main') {
    mainScreen.classList.remove('hidden');
  }
}

function showError(message) {
  state.error = message;
  state.loading = false;
  updateUI();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Utilities
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
