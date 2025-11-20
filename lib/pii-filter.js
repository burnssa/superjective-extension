// Superjective Extension - Client-Side PII Filter
// Privacy-first: All filtering happens in the browser before sending to server
// Open source and verifiable

// Import compromise for NLP-based name detection
// Note: compromise.js must be loaded before this script

/**
 * PIIFilter - Removes personally identifiable information from text
 *
 * Replaces PII with placeholder tags:
 * - Emails → [EMAIL]
 * - Phone numbers → [PHONE]
 * - SSN → [SSN]
 * - URLs → [URL]
 * - Names → [NAME] (NLP-based detection using compromise)
 * - Companies → [COMPANY] (basic detection)
 */
class PIIFilter {
  constructor() {
    // Regex patterns for structured PII (highly reliable)
    this.patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
      phone: /\b(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
      ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
      // Credit card (basic pattern)
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      // IP addresses
      ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      // Currency amounts ($12,000, $500.00, etc.)
      currency: /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g
    };

    // Regex patterns for name contexts (conservative, high-precision)
    this.namePatterns = [
      // Titles with names
      /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
      // Names in email greetings
      /\b(?:Dear|Hi|Hello|Hey)\s+[A-Z][a-z]+\b/gi,
      // Family names (Burns Family, Smith Family)
      /\b[A-Z][a-z]+\s+Family\b/g
    ];

    // Common company suffixes
    this.companySuffixes = /\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+(?:Inc\.|LLC|Corp\.|Corporation|Company|Co\.|Ltd\.)\b/g;
  }

  /**
   * Filter all PII from text
   * @param {string} text - Input text to filter
   * @returns {string} - Filtered text with PII replaced by placeholders
   */
  filter(text) {
    if (!text) return text;

    let filtered = text;

    // Apply structured patterns first (most reliable)
    filtered = filtered.replace(this.patterns.email, '[EMAIL]');
    filtered = filtered.replace(this.patterns.phone, '[PHONE]');
    filtered = filtered.replace(this.patterns.ssn, '[SSN]');
    filtered = filtered.replace(this.patterns.url, '[URL]');
    filtered = filtered.replace(this.patterns.creditCard, '[CARD]');
    filtered = filtered.replace(this.patterns.ipAddress, '[IP]');
    filtered = filtered.replace(this.patterns.currency, '[AMOUNT]');

    // Apply company pattern
    filtered = filtered.replace(this.companySuffixes, '[COMPANY]');

    // Apply conservative regex name patterns
    const namePatterns = [
      /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
      /\b(?:Dear|Hi|Hello|Hey)\s+[A-Z][a-z]+\b/gi,
      /\b[A-Z][a-z]+\s+Family\b/g
    ];

    for (const pattern of namePatterns) {
      filtered = filtered.replace(pattern, (match) => {
        const prefixes = ['Dear', 'Hi', 'Hello', 'Hey'];
        for (const prefix of prefixes) {
          if (match.toLowerCase().startsWith(prefix.toLowerCase())) {
            return `${prefix} [NAME]`;
          }
        }
        if (match.endsWith('Family')) {
          return '[NAME] Family';
        }
        return '[NAME]';
      });
    }

    // Use compromise NLP for detecting person names
    if (typeof nlp !== 'undefined') {
      try {
        const doc = nlp(filtered);
        const people = doc.people().out('array');

        // Sort by length descending to replace longer names first
        people.sort((a, b) => b.length - a.length);

        for (const name of people) {
          if (name && name.length > 1) {
            // Escape special regex characters in the name
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filtered = filtered.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '[NAME]');
          }
        }
      } catch (e) {
        console.warn('Compromise NLP error:', e);
      }
    }

    return filtered;
  }

  /**
   * Get a summary of what was filtered
   * @param {string} original - Original text
   * @param {string} filtered - Filtered text
   * @returns {Object} - Summary of filtered items
   */
  getSummary(original, filtered) {
    const summary = {
      emailsRemoved: (original.match(this.patterns.email) || []).length,
      phonesRemoved: (original.match(this.patterns.phone) || []).length,
      urlsRemoved: (original.match(this.patterns.url) || []).length,
      ssnRemoved: (original.match(this.patterns.ssn) || []).length,
      totalReplacements: 0
    };

    summary.totalReplacements =
      summary.emailsRemoved +
      summary.phonesRemoved +
      summary.urlsRemoved +
      summary.ssnRemoved;

    return summary;
  }

  /**
   * Check if text contains any PII
   * @param {string} text - Text to check
   * @returns {boolean} - True if PII detected
   */
  containsPII(text) {
    if (!text) return false;

    return (
      this.patterns.email.test(text) ||
      this.patterns.phone.test(text) ||
      this.patterns.ssn.test(text) ||
      this.patterns.creditCard.test(text)
    );
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PIIFilter;
}

// Also make available globally for browser context
if (typeof window !== 'undefined') {
  window.PIIFilter = PIIFilter;
}
