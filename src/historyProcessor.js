Perfect! Here's the code to paste for src/historyProcessor.js:
Copy everything below and paste it into GitHub when creating src/historyProcessor.js:
javascript// historyProcessor.js
// Reads raw browser history and converts it into a structured context profile.

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const CONFIG = {
  // How many days back to look for "active" interests
  activeDaysWindow: 30,

  // Minimum visits to a domain before it's considered "a tool you use"
  coreToolThreshold: 10,

  // Domains to always ignore — noise, not context
  blocklist: new Set([
    "google.com", "google.co.uk", "bing.com", "duckduckgo.com", // search engines
    "googletagmanager.com", "doubleclick.net", "googlesyndication.com", // ads/trackers
    "facebook.com", "instagram.com", "twitter.com", "x.com", // social (optional — remove if you want these)
    "youtube.com", // high-volume, low-signal (remove if relevant to you)
    "localhost", "127.0.0.1", // local dev
    "accounts.google.com", "login.microsoftonline.com", // auth pages
    "amazon.com", // too broad to be useful without more parsing
  ]),

  // Topic categories and the domains that signal them
  // Add your own domains here over time
  topicMap: {
    "Product Management": [
      "linear.app", "notion.so", "jira.atlassian.com", "productboard.com",
      "miro.com", "figma.com", "amplitude.com", "mixpanel.com",
      "producthunt.com", "lenny.substack.com"
    ],
    "AI & Machine Learning": [
      "claude.ai", "chatgpt.com", "openai.com", "gemini.google.com",
      "huggingface.co", "arxiv.org", "deepmind.com", "anthropic.com",
      "replicate.com", "perplexity.ai"
    ],
    "Finance & Investing": [
      "bloomberg.com", "wsj.com", "ft.com", "schwab.com",
      "robinhood.com", "coinbase.com", "yahoo.com", "marketwatch.com"
    ],
    "Real Estate": [
      "zillow.com", "redfin.com", "realtor.com", "apartments.com",
      "streeteasy.com", "compass.com"
    ],
    "Fashion & Style": [
      "vogue.com", "net-a-porter.com", "ssense.com", "matchesfashion.com",
      "farfetch.com", "theoutnet.com", "shopbop.com", "revolve.com",
      "whowhatwear.com", "byrdie.com"
    ],
    "Travel": [
      "google.com/travel", "expedia.com", "kayak.com", "airbnb.com",
      "tripadvisor.com", "booking.com", "skyscanner.com", "hotels.com"
    ],
    "Health & Wellness": [
      "myfitnesspal.com", "peloton.com", "headspace.com", "calm.com",
      "healthline.com", "webmd.com", "nytimes.com/section/health"
    ],
    "Engineering & Tech": [
      "github.com", "stackoverflow.com", "docs.python.org", "developer.mozilla.org",
      "npmjs.com", "vercel.com", "netlify.com", "aws.amazon.com"
    ],
    "News & Media": [
      "nytimes.com", "theguardian.com", "bbc.com", "theatlantic.com",
      "newyorker.com", "politico.com", "axios.com"
    ]
  }
};


// ─────────────────────────────────────────────
// CORE FUNCTIONS
// ─────────────────────────────────────────────

/**
 * extractDomain
 * Pulls the root domain from a full URL string.
 * Example: "https://www.notion.so/my-page" → "notion.so"
 */
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    // Strip "www." prefix so "www.notion.so" and "notion.so" are treated the same
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}


/**
 * isBlocked
 * Returns true if a domain should be ignored entirely.
 */
function isBlocked(domain) {
  if (!domain) return true;
  // Check exact match and any parent domain match
  for (const blocked of CONFIG.blocklist) {
    if (domain === blocked || domain.endsWith("." + blocked)) return true;
  }
  return false;
}


/**
 * buildDomainFrequencyMap
 * Takes raw Chrome history items and returns a map of:
 *   domain → { visitCount, lastVisit, urls: Set }
 */
function buildDomainFrequencyMap(historyItems) {
  const map = new Map();

  for (const item of historyItems) {
    const domain = extractDomain(item.url);
    if (!domain || isBlocked(domain)) continue;

    if (!map.has(domain)) {
      map.set(domain, { visitCount: 0, lastVisit: 0, urls: new Set() });
    }

    const entry = map.get(domain);
    entry.visitCount += item.visitCount || 1;
    entry.lastVisit = Math.max(entry.lastVisit, item.lastVisitTime || 0);
    entry.urls.add(item.url);
  }

  return map;
}


/**
 * classifyDomains
 * Given a domain frequency map, assigns each domain to a tier:
 *   - "core"   : visited 10+ times total (daily-driver tools)
 *   - "active" : visited in the last 30 days (current interests)
 *   - "light"  : visited, but infrequent and older
 *
 * Returns an object: { core: [], active: [], light: [] }
 * Each entry is: { domain, visitCount, lastVisit }
 */
function classifyDomains(domainMap) {
  const now = Date.now();
  const activeCutoff = now - CONFIG.activeDaysWindow * 24 * 60 * 60 * 1000;

  const result = { core: [], active: [], light: [] };

  for (const [domain, data] of domainMap.entries()) {
    const entry = { domain, visitCount: data.visitCount, lastVisit: data.lastVisit };

    if (data.visitCount >= CONFIG.coreToolThreshold) {
      result.core.push(entry);
    } else if (data.lastVisit >= activeCutoff) {
      result.active.push(entry);
    } else {
      result.light.push(entry);
    }
  }

  // Sort each tier by visit count descending
  for (const tier of Object.values(result)) {
    tier.sort((a, b) => b.visitCount - a.visitCount);
  }

  return result;
}


/**
 * detectTopics
 * Looks at all domains in the frequency map and matches them
 * against CONFIG.topicMap to infer the user's interest areas.
 * Returns an array of topic strings that had at least one matching domain.
 */
function detectTopics(domainMap) {
  const detectedTopics = new Set();

  for (const [domain] of domainMap.entries()) {
    for (const [topic, domains] of Object.entries(CONFIG.topicMap)) {
      if (domains.some(d => domain === d || domain.endsWith("." + d))) {
        detectedTopics.add(topic);
      }
    }
  }

  return Array.from(detectedTopics);
}


/**
 * buildContextProfile
 * The main function. Takes raw Chrome history items and returns
 * a structured context profile object ready to be stored or injected.
 */
export function buildContextProfile(historyItems) {
  const domainMap = buildDomainFrequencyMap(historyItems);
  const classified = classifyDomains(domainMap);
  const topics = detectTopics(domainMap);

  return {
    generatedAt: new Date().toISOString(),
    totalDomainsAnalyzed: domainMap.size,
    topics,
    coreTools: classified.core.slice(0, 15).map(e => e.domain),      // Top 15 daily tools
    activeInterests: classified.active.slice(0, 20).map(e => e.domain), // Top 20 recent
    // light tier is stored but not injected by default — too noisy
  };
}


/**
 * formatProfileForInjection
 * Converts the context profile object into a clean, human-readable
 * string suitable for prepending to an LLM system prompt.
 */
export function formatProfileForInjection(profile) {
  const lines = [];

  lines.push("## Personal Context (auto-generated from browsing history)");
  lines.push(`_Last updated: ${new Date(profile.generatedAt).toLocaleDateString()}_`);
  lines.push("");

  if (profile.topics.length > 0) {
    lines.push(`**Interest areas:** ${profile.topics.join(", ")}`);
  }

  if (profile.coreTools.length > 0) {
    lines.push(`**Tools I use regularly:** ${profile.coreTools.join(", ")}`);
  }

  if (profile.activeInterests.length > 0) {
    lines.push(`**Recently active on:** ${profile.activeInterests.join(", ")}`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  return lines.join("\n");
}
