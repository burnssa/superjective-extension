// Superjective Extension - Content Script
// Injects sidebar into web pages and handles communication

let sidebarIframe = null;

// Listen for messages from background worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openSidebar') {
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
});

// Allow closing sidebar with Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebarIframe) {
    closeSidebar();
  }
});
