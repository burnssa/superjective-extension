// Superjective Extension - Content Script
// Injects sidebar into web pages and handles communication

let sidebarIframe = null;
let activeInputElement = null; // Store the element where text was selected

// Listen for messages from background worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  if (request.action === 'openSidebar') {
    console.log('Opening sidebar with text:', request.text);
    // Capture the active element (input/textarea/contenteditable)
    activeInputElement = document.activeElement;
    openSidebar(request.text);
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
  // Try to find the best element to insert into:
  // 1. Use activeInputElement if it's still valid
  // 2. Check if there's a currently focused editable element
  // 3. Search for common compose elements on the page
  // 4. Fall back to clipboard

  let targetElement = null;

  // First check if there's a currently focused editable element
  const currentActive = document.activeElement;
  if (isEditableElement(currentActive)) {
    targetElement = currentActive;
  }

  // If not, use the stored activeInputElement if it's still in the DOM
  if (!targetElement && activeInputElement && document.body.contains(activeInputElement)) {
    targetElement = activeInputElement;
  }

  // If still not found, search for common compose elements
  if (!targetElement) {
    targetElement = findEditableElement();
  }

  if (!targetElement) {
    console.log('No editable element found, copying to clipboard');
    navigator.clipboard.writeText(text);
    return;
  }

  console.log('Inserting text into:', targetElement.tagName, targetElement);

  // Handle different element types
  if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
    targetElement.value = text;
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (targetElement.isContentEditable || targetElement.contentEditable === 'true') {
    targetElement.innerHTML = text.replace(/\n/g, '<br>');
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    const editableParent = targetElement.closest('[contenteditable="true"]');
    if (editableParent) {
      editableParent.innerHTML = text.replace(/\n/g, '<br>');
      editableParent.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      navigator.clipboard.writeText(text);
    }
  }
}

// Check if an element is editable
function isEditableElement(el) {
  if (!el) return false;
  return (
    el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && ['text', 'email', 'search', 'url'].includes(el.type)) ||
    el.isContentEditable ||
    el.contentEditable === 'true'
  );
}

// Find common compose/message elements on the page
function findEditableElement() {
  const selectors = [
    // Gmail compose
    '[contenteditable="true"][aria-label*="message" i]',
    '[contenteditable="true"][aria-label*="body" i]',
    // LinkedIn
    '[contenteditable="true"][aria-label*="compose" i]',
    '[contenteditable="true"][role="textbox"]',
    // Generic
    'textarea[name*="message" i]',
    'textarea[name*="body" i]',
    'textarea:not([readonly])',
    '[contenteditable="true"]'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && document.body.contains(el)) {
      return el;
    }
  }

  return null;
}

// Allow closing sidebar with Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebarIframe) {
    closeSidebar();
  }
});
