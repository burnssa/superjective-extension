# Superjective Chrome Extension

Privacy-first AI draft generator that uses multiple LLMs with Thompson Sampling for intelligent model selection.

**Related Projects:**
- [Superjective Web App](https://github.com/superjective/superjective) - Main application
- [Superjective API Docs](https://docs.superjective.com) - API documentation

## Features

- **Right-click context menu** - Generate AI responses from any selected text
- **Sidebar interface** - View 2-3 AI-generated drafts side-by-side
- **Privacy-first PII filtering** - All filtering happens client-side before sending to server
- **Auth0 authentication** - Secure login with your Superjective account
- **Thompson Sampling** - Intelligent model selection that learns from your preferences

## Privacy Promise

**Your data is filtered before it leaves your browser.**

All PII (personally identifiable information) filtering happens client-side in [`lib/pii-filter.js`](lib/pii-filter.js). This code is open source so you can verify exactly what's being filtered:

```javascript
// What gets filtered:
- Emails → [EMAIL]
- Phone numbers → [PHONE]
- Social Security Numbers → [SSN]
- URLs → [URL]
- Credit card numbers → [CARD]
- Names (in greetings) → [NAME]
- Companies (with Inc/LLC/etc) → [COMPANY]
```

We encourage you to review the code and submit improvements.

## Installation

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store listing
2. Click "Add to Chrome"
3. Sign in with your Superjective account

### Development Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/superjective/superjective-extension.git
   cd superjective-extension
   ```

2. Update configuration in `background/service-worker.js`:
   ```javascript
   const API_BASE = 'https://api.superjective.com';
   const AUTH0_DOMAIN = 'your-tenant.auth0.com';
   const AUTH0_CLIENT_ID = 'your-client-id';
   const AUTH0_AUDIENCE = 'https://api.superjective.com';
   ```

3. Update `manifest.json` with your Auth0 client ID

4. Add icon files to `icons/` directory (16px, 48px, 128px PNG)

5. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

## Usage

1. **Sign in**: Click the extension icon and authenticate with Auth0
2. **Generate drafts**:
   - Select text on any webpage
   - Right-click → "Generate AI Response"
   - Sidebar opens with 2-3 AI drafts
3. **Select your favorite**: Click "Select This Draft" to record your preference
4. **Copy**: Use "Copy to Clipboard" to paste the draft

Your selections improve the AI model recommendations over time through Thompson Sampling.

## Auth0 Configuration

Configure your Auth0 application:

1. **Allowed Callback URLs**: Add your extension's redirect URL
   - Get this by calling `chrome.identity.getRedirectURL()` in the console
   - Format: `https://<extension-id>.chromiumapp.org/`

2. **Allowed Web Origins**: Add the same URL

3. **Grant Types**: Enable "Authorization Code" and "Refresh Token"

4. **Token Endpoint Authentication Method**: Set to "None" (for PKCE)

## Architecture

### Project Structure

```
superjective-extension/
├── manifest.json              # Chrome extension manifest (MV3)
├── background/
│   └── service-worker.js      # OAuth, API calls, message handling
├── content/
│   └── content-script.js      # Sidebar injection into web pages
├── sidebar/
│   ├── index.html             # Sidebar UI container
│   ├── sidebar.js             # UI state and logic
│   └── styles.css             # Styling
├── lib/
│   └── pii-filter.js          # Client-side PII filtering
├── icons/                     # Extension icons
├── LICENSE                    # MIT License
└── README.md
```

### API Integration

The extension uses the Superjective API:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/comparisons` | Create a new comparison |
| `POST /api/generate` | Generate 2-3 responses with Thompson Sampling |
| `POST /api/comparisons/{id}/complete` | Record selection, update model stats |

Your extension activity syncs with your [Superjective dashboard](https://app.superjective.com).

### Security

- **OAuth 2.0 with PKCE** - Secure authentication without exposing secrets
- **No stored credentials** - Tokens stored in Chrome's secure storage
- **Automatic token refresh** - Seamless re-authentication

## Development

### Local API Development

Update `API_BASE` for local testing:

```javascript
const API_BASE = 'http://localhost:8000';
```

### Testing Checklist

- [ ] Auth flow completes successfully
- [ ] PII is filtered (check network tab)
- [ ] Drafts are generated from multiple models
- [ ] Selection is recorded
- [ ] Drafts appear in Superjective dashboard

### Building for Production

1. Update all configuration values
2. Add production icons
3. Test thoroughly
4. Zip the directory (excluding `.git`)
5. Upload to Chrome Web Store

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For security issues, please email security@superjective.com instead of opening a public issue.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/superjective/superjective-extension/issues)
- **Email**: support@superjective.com
- **Documentation**: [docs.superjective.com](https://docs.superjective.com)
