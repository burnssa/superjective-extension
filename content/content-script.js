// Superjective Extension - Content Script
// Injects sidebar into web pages and handles communication

// Guard against duplicate injection
if (window.superjective_loaded) {
  console.log('Superjective content script already loaded, skipping');
} else {
  window.superjective_loaded = true;
}

let sidebarIframe = null;

// Listen for messages from background worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  if (request.action === 'openSidebar') {
    // Always open sidebar - let it handle showing error if no text
    const text = request.text || '';
    console.log('Opening sidebar with text:', text ? text.substring(0, 50) + '...' : '(empty)');
    openSidebar(text);
    sendResponse({ success: true });
  }
});

// Create and show sidebar
function openSidebar(selectedText) {
  // Remove existing sidebar if present
  if (sidebarIframe) {
    sidebarIframe.remove();
    sidebarIframe = null;
  }

  // Create iframe for sidebar
  sidebarIframe = document.createElement('iframe');
  sidebarIframe.id = 'superjective-sidebar';
  sidebarIframe.src = chrome.runtime.getURL('sidebar/index.html');
  sidebarIframe.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 420px;
    height: 100vh;
    border: none;
    border-left: 1px solid #e5e7eb;
    background: white;
    z-index: 2147483647;
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
    transition: transform 0.3s ease;
  `;

  document.body.appendChild(sidebarIframe);

  // Adjust page content to make room for sidebar
  document.body.style.marginRight = '420px';
  document.body.style.transition = 'margin-right 0.3s ease';

  // Send selected text to sidebar when it's ready
  sidebarIframe.addEventListener('load', () => {
    sidebarIframe.contentWindow.postMessage({
      type: 'INIT_SIDEBAR',
      selectedText
    }, '*');
  });
}

// Close sidebar
function closeSidebar() {
  if (sidebarIframe) {
    sidebarIframe.remove();
    sidebarIframe = null;
    document.body.style.marginRight = '0';
  }
}

// Listen for messages from sidebar
window.addEventListener('message', (event) => {
  // Only accept messages from our sidebar
  if (event.source !== sidebarIframe?.contentWindow) return;

  if (event.data.type === 'CLOSE_SIDEBAR') {
    closeSidebar();
  }

  if (event.data.type === 'COPY_TO_CLIPBOARD') {
    navigator.clipboard.writeText(event.data.text).then(() => {
      // Notify sidebar that copy was successful
      sidebarIframe?.contentWindow.postMessage({
        type: 'COPY_SUCCESS'
      }, '*');
    });
  }

  if (event.data.type === 'INSERT_TEXT') {
    insertTextIntoElement(event.data.text);
    // Notify sidebar that insert was successful
    sidebarIframe?.contentWindow.postMessage({
      type: 'INSERT_SUCCESS'
    }, '*');
  }
});

// Insert text into the active input element
function insertTextIntoElement(text) {
  // Priority order:
  // 1. FIRST look for compose-specific elements (Gmail, LinkedIn, etc.)
  // 2. Check if currently focused element is a valid compose target
  // 3. Fall back to clipboard

  let targetElement = null;

  // First, always look for compose-specific elements - this is the most reliable
  targetElement = findComposeElement();

  // If no compose element found, check if there's a currently focused editable
  // that looks like a compose box (not a listitem, not the email being read)
  if (!targetElement) {
    const currentActive = document.activeElement;
    if (isValidComposeTarget(currentActive)) {
      targetElement = currentActive;
    }
  }

  if (!targetElement) {
    console.log('No compose element found, copying to clipboard instead');
    navigator.clipboard.writeText(text);
    // Notify user
    showNotification('Draft copied to clipboard - paste it into your compose window');
    return;
  }

  console.log('Inserting text into:', targetElement.tagName, targetElement.getAttribute('aria-label'), targetElement);

  // Handle different element types
  if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
    targetElement.value = text;
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    targetElement.focus();
  } else if (targetElement.isContentEditable || targetElement.contentEditable === 'true') {
    targetElement.focus();
    targetElement.innerHTML = text.replace(/\n/g, '<br>');
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Show a brief notification to the user
function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

// Check if an element is a valid compose target (not a listitem, not read-only content)
function isValidComposeTarget(el) {
  if (!el) return false;

  // Must be editable
  const isEditable = (
    el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && ['text', 'email', 'search', 'url'].includes(el.type)) ||
    el.isContentEditable ||
    el.contentEditable === 'true'
  );

  if (!isEditable) return false;

  // Exclude elements that are clearly NOT compose boxes
  const role = el.getAttribute('role');
  if (role === 'listitem' || role === 'list' || role === 'option') {
    return false;
  }

  // Check if it's likely a compose box by looking at aria-label
  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
  const composeKeywords = ['message', 'body', 'compose', 'reply', 'write', 'editor'];
  if (composeKeywords.some(kw => ariaLabel.includes(kw))) {
    return true;
  }

  // Check role="textbox" which is commonly used for compose areas
  if (role === 'textbox') {
    return true;
  }

  // For textareas/inputs, check name attribute
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const name = (el.getAttribute('name') || '').toLowerCase();
    if (composeKeywords.some(kw => name.includes(kw))) {
      return true;
    }
    return true; // Textareas are usually compose targets
  }

  return false;
}

// Find compose-specific elements on the page (Gmail, LinkedIn, etc.)
function findComposeElement() {
  // Gmail-specific selectors (most specific first)
  const gmailSelectors = [
    // Gmail compose body - the editable div with role="textbox"
    'div[role="textbox"][aria-label*="Body" i]',
    'div[role="textbox"][aria-label*="Message" i]',
    'div[role="textbox"][contenteditable="true"]',
    // Gmail compose - class-based fallback
    'div.Am.Al.editable[contenteditable="true"]',
    'div[aria-label*="Message Body" i][contenteditable="true"]',
  ];

  // Try Gmail selectors first
  for (const selector of gmailSelectors) {
    const el = document.querySelector(selector);
    if (el && document.body.contains(el) && isVisible(el)) {
      return el;
    }
  }

  // Generic compose selectors
  const genericSelectors = [
    // LinkedIn
    '[contenteditable="true"][aria-label*="compose" i]',
    '[contenteditable="true"][aria-label*="write" i]',
    // Generic role-based
    '[role="textbox"][contenteditable="true"]',
    // Textarea fallbacks
    'textarea[name*="message" i]',
    'textarea[name*="body" i]',
    'textarea[name*="compose" i]',
  ];

  for (const selector of genericSelectors) {
    const el = document.querySelector(selector);
    if (el && document.body.contains(el) && isVisible(el)) {
      return el;
    }
  }

  return null;
}

// Check if element is visible
function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0' &&
         el.offsetParent !== null;
}

// Allow closing sidebar with Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebarIframe) {
    closeSidebar();
  }
});
