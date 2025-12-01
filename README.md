# Superjective Chrome Extension

Generate the best email drafts for you with frontier AI, while controlling the data you share and the final text you send. Compare responses from the strongest models on the market and pick the one that fits your needs.

## Why Superjective?

Most AI writing tools give you a single option from one model. But models vary in their strengths and styles. With instant access to drafts from multiple cutting edge AI providers, you get a running start on your message, with content to match your tastes and preferences. Superjective shows you the best drafts, and you choose what works. You also stay in control of your privacy, only sharing the specific data you choose, while sensitive content is automatically filtered before being sent for AI prompting,

Over time, the system learns your preferences using Thompson Sampling and gets better at showing options you'll like.

## How It Works

1. **Select text** in any email or message you want to reply to
2. **Right-click** → "Create AI Draft Responses"
3. **Add context** (optional) - tone preferences, background info, constraints
4. **Compare drafts** from multiple AI models
5. **One click** to insert your chosen draft

## Privacy First

All personally identifiable information (PII) is filtered **in your browser** before being sent to any server:

- Email addresses → `[EMAIL]`
- Phone numbers → `[PHONE]`
- Names (using NLP detection) → `[NAME]`
- Family names → `[NAME] Family`
- Currency amounts → `[AMOUNT]`
- SSN, credit cards, IP addresses

The filtering code is open source and verifiable in [`lib/pii-filter.js`](lib/pii-filter.js). We use [compromise](https://github.com/spencermountain/compromise) for NLP-based name detection.

## Running Your Own Instance

This extension requires a backend API to generate AI responses. To run your own instance:

1. **Backend API**: Clone and run [superjective/spj_backend](https://github.com/superjective/spj_backend) locally, or deploy your own
2. **Auth0 Tenant**: Create a free account at [auth0.com](https://auth0.com) and configure:
   - A **Single Page Application** (get the Domain and Client ID)
   - An **API** (get the Audience identifier)
   - Add your extension's callback URL to Allowed Callback URLs (see step 4 below)
3. **For production deployments**: Update `manifest.json` host_permissions to include your API domain (e.g., `"https://your-api.example.com/*"`)

### Web Store Submission Checklist

When preparing a build for Chrome Web Store submission:

- [ ] **Create `config.js`** from `config.example.js` with production values:
  - [ ] `API_BASE`: Your production API URL (e.g., `https://api.yourdomain.com`)
  - [ ] `AUTH0_DOMAIN`: Your Auth0 tenant (e.g., `your-tenant.auth0.com`)
  - [ ] `AUTH0_CLIENT_ID`: Your Auth0 SPA client ID
  - [ ] `AUTH0_AUDIENCE`: Your Auth0 API identifier
- [ ] **Update `manifest.json`** host_permissions:
  - [ ] Add your production API domain (e.g., `"https://api.yourdomain.com/*"`)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/superjective/superjective-extension.git
cd superjective-extension
```

### 2. Configure credentials

Copy the example config and add your Auth0 credentials:

```bash
cp config.example.js config.js
```

Edit `config.js`:

```javascript
export const CONFIG = {
  API_BASE: 'https://your-api.herokuapp.com',
  AUTH0_DOMAIN: 'your-domain.auth0.com',
  AUTH0_CLIENT_ID: 'your-client-id',
  AUTH0_AUDIENCE: 'your-api-audience'
};
```

### 3. Load in Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `superjective-extension` folder

### 4. Configure Auth0 Callback

Add the extension's redirect URL to your Auth0 application's Allowed Callback URLs:

```
https://<extension-id>.chromiumapp.org/
```

Find your extension ID in `chrome://extensions`.

## Usage Tips

- **Add context for better results**: "Keep it brief" or "Respond as someone who's excited about the opportunity"
- **Open your compose window first**: The draft auto-inserts when you select it
- **Works anywhere**: Gmail, LinkedIn, Slack, or any site with text inputs

## Architecture

```
superjective-extension/
├── manifest.json          # Extension configuration
├── config.js              # Credentials (gitignored)
├── config.example.js      # Template
├── background/
│   └── service-worker.js  # Auth & API calls
├── content/
│   └── content-script.js  # Page injection & text insertion
├── sidebar/
│   ├── index.html
│   ├── sidebar.js
│   └── styles.css
├── lib/
│   ├── pii-filter.js      # Privacy protection
│   └── compromise.min.js  # NLP for name detection
└── icons/
```

## Development

### Testing Changes

1. Make your changes
2. Go to `chrome://extensions`
3. Click the refresh icon on the extension
4. Refresh the page you're testing on

### Local API

Update `API_BASE` in `config.js` for local development:

```javascript
API_BASE: 'http://localhost:8000'
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions welcome! For security issues, please email support@superjective.ai.

## Support

- Issues: [GitHub Issues](https://github.com/superjective/superjective-extension/issues)
- Web app: [superjective.ai](https://superjective.ai)
