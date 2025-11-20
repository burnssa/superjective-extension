// Superjective Extension - Background Service Worker
// Handles Auth0 OAuth, API calls, and message passing

import { CONFIG } from '../config.js';

const API_BASE = CONFIG.API_BASE;
const AUTH0_DOMAIN = CONFIG.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = CONFIG.AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = CONFIG.AUTH0_AUDIENCE;

// Create context menu when extension installs
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'generate-response',
    title: 'Create AI Draft Responses',
    contexts: ['selection']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'generate-response') {
    const selectedText = info.selectionText;
    console.log('Context menu clicked, selected text:', selectedText);

    // Send message to content script to open sidebar
    chrome.tabs.sendMessage(tab.id, {
      action: 'openSidebar',
      text: selectedText
    }).then(() => {
      console.log('Message sent to content script');
    }).catch(err => {
      console.error('Failed to send message:', err);
    });
  }
});

// Handle messages from content script and sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    handleLogin()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'logout') {
    handleLogout()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'checkAuth') {
    checkAuthStatus()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'generateDrafts') {
    generateDrafts(request.data)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'completeDrafts') {
    completeDrafts(request.data)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Auth0 OAuth Flow
async function handleLogin() {
  const redirectUri = chrome.identity.getRedirectURL();
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store code verifier for token exchange
  await chrome.storage.local.set({ codeVerifier, state });

  const authUrl = new URL(`https://${AUTH0_DOMAIN}/authorize`);
  authUrl.searchParams.set('client_id', AUTH0_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid profile email offline_access');
  authUrl.searchParams.set('audience', AUTH0_AUDIENCE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        try {
          const url = new URL(redirectUrl);
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');

          // Verify state
          const { state: savedState, codeVerifier } = await chrome.storage.local.get(['state', 'codeVerifier']);
          if (returnedState !== savedState) {
            reject(new Error('State mismatch'));
            return;
          }

          // Exchange code for tokens
          const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

          // Store tokens
          await chrome.storage.local.set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: Date.now() + (tokens.expires_in * 1000)
          });

          resolve({ success: true });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

async function exchangeCodeForTokens(code, codeVerifier, redirectUri) {
  const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: AUTH0_CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  return response.json();
}

async function handleLogout() {
  await chrome.storage.local.remove(['accessToken', 'refreshToken', 'expiresAt']);
  return { success: true };
}

async function checkAuthStatus() {
  const { accessToken, expiresAt } = await chrome.storage.local.get(['accessToken', 'expiresAt']);

  if (!accessToken) {
    return { authenticated: false };
  }

  // Check if token is expired
  if (Date.now() >= expiresAt) {
    // Try to refresh
    try {
      await refreshAccessToken();
      return { authenticated: true };
    } catch {
      return { authenticated: false };
    }
  }

  return { authenticated: true };
}

async function refreshAccessToken() {
  const { refreshToken } = await chrome.storage.local.get('refreshToken');

  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: AUTH0_CLIENT_ID,
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const tokens = await response.json();

  await chrome.storage.local.set({
    accessToken: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in * 1000)
  });

  return tokens.access_token;
}

async function getAccessToken() {
  const { accessToken, expiresAt } = await chrome.storage.local.get(['accessToken', 'expiresAt']);

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  // Refresh if expired or about to expire (5 min buffer)
  if (Date.now() >= expiresAt - 300000) {
    return refreshAccessToken();
  }

  return accessToken;
}

// API Calls
async function generateDrafts({ prompt, context }) {
  const token = await getAccessToken();

  // Build the full prompt with system instructions
  const systemInstructions = `Generate a plain text email response. Do not use markdown formatting (no **, *, #, etc.). Write naturally as you would in an authentic email.`;

  let fullPrompt = `${systemInstructions}\n\n${prompt}`;
  if (context) {
    fullPrompt += `\n\nContext: ${context}`;
  }

  // Step 1: Create comparison
  const comparisonResponse = await fetch(`${API_BASE}/api/comparisons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      prompt: fullPrompt
    })
  });

  if (!comparisonResponse.ok) {
    const error = await comparisonResponse.json();
    throw new Error(error.detail?.message || 'Failed to create comparison');
  }

  const comparison = await comparisonResponse.json();

  // Step 2: Generate responses
  const generateResponse = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      comparison_id: comparison.id
    })
  });

  if (!generateResponse.ok) {
    const error = await generateResponse.json();
    throw new Error(error.detail?.error || 'Failed to generate responses');
  }

  const result = await generateResponse.json();

  // Step 3: Fetch comparison to get actual response IDs from database
  const fetchComparisonResponse = await fetch(`${API_BASE}/api/comparisons/${comparison.id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!fetchComparisonResponse.ok) {
    throw new Error('Failed to fetch comparison details');
  }

  const comparisonWithResponses = await fetchComparisonResponse.json();

  // Format for sidebar - use actual database response IDs
  return {
    comparison_id: comparison.id,
    drafts: comparisonWithResponses.responses.map((r, index) => ({
      response_id: r.id,
      text: r.content,
      model_id: parseInt(r.llm_id),
      provider: r.language_model.provider,
      model_name: r.language_model.name,
      display_order: r.display_order
    })),
    response_count: comparisonWithResponses.responses.length
  };
}

async function completeDrafts({ comparisonId, bestResponseId, responseFeedback }) {
  const token = await getAccessToken();

  const response = await fetch(`${API_BASE}/api/comparisons/${comparisonId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      best_response_id: bestResponseId,
      response_feedback: responseFeedback
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.message || 'Failed to complete comparison');
  }

  return response.json();
}

// Utility functions
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
