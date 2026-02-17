// background.js
// Service worker that runs in the background and syncs browsing history daily.
// Combined with historyProcessor code to avoid ES6 module issues.

// ─────────────────────────────────────────────
// HISTORY PROCESSOR CODE (inline)
// ─────────────────────────────────────────────

const PROCESSOR_CONFIG = {
  activeDaysWindow: 30,
  coreToolThreshold: 10,
  blocklist: new Set([
    "google.com", "google.co.uk", "bing.com", "duckduckgo.com",
    "googletagmanager.com", "doubleclick.net", "googlesyndication.com",
    "facebook.com", "instagram.com", "twitter.com", "x.com",
    "youtube.com",
    "localhost", "127.0.0.1",
    "accounts.google.com", "login.microsoftonline.com",
    "amazon.com",
  ]),
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

function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isBlocked(domain) {
  if (!domain) return true;
  for (const blocked of PROCESSOR_CONFIG.blocklist) {
    if (domain === blocked || domain.endsWith("." + blocked)) return true;
  }
  return false;
}

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

function classifyDomains(domainMap) {
  const now = Date.now();
  const activeCutoff = now - PROCESSOR_CONFIG.activeDaysWindow * 24 * 60 * 60 * 1000;
  const result = { core: [], active: [], light: [] };
  for (const [domain, data] of domainMap.entries()) {
    const entry = { domain, visitCount: data.visitCount, lastVisit: data.lastVisit };
    if (data.visitCount >= PROCESSOR_CONFIG.coreToolThreshold) {
      result.core.push(entry);
    } else if (data.lastVisit >= activeCutoff) {
      result.active.push(entry);
    } else {
      result.light.push(entry);
    }
  }
  for (const tier of Object.values(result)) {
    tier.sort((a, b) => b.visitCount - a.visitCount);
  }
  return result;
}

function detectTopics(domainMap) {
  const detectedTopics = new Set();
  for (const [domain] of domainMap.entries()) {
    for (const [topic, domains] of Object.entries(PROCESSOR_CONFIG.topicMap)) {
      if (domains.some(d => domain === d || domain.endsWith("." + d))) {
        detectedTopics.add(topic);
      }
    }
  }
  return Array.from(detectedTopics);
}

function buildContextProfile(historyItems) {
  const domainMap = buildDomainFrequencyMap(historyItems);
  const classified = classifyDomains(domainMap);
  const topics = detectTopics(domainMap);
  return {
    generatedAt: new Date().toISOString(),
    totalDomainsAnalyzed: domainMap.size,
    topics,
    coreTools: classified.core.slice(0, 15).map(e => e.domain),
    activeInterests: classified.active.slice(0, 20).map(e => e.domain),
  };
}

function formatProfileForInjection(profile) {
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

// ─────────────────────────────────────────────
// BACKGROUND SCRIPT CONFIGURATION
// ─────────────────────────────────────────────

const CONFIG = {
  ALARM_NAME: 'dailyHistorySync',
  SYNC_INTERVAL_MINUTES: 1440,
  HISTORY_DAYS_BACK: 90,
  STORAGE_KEY: 'contextProfile'
};

// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Context Connector] Extension installed:', details.reason);
  
  await chrome.alarms.create(CONFIG.ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CONFIG.SYNC_INTERVAL_MINUTES
  });
  
  await syncHistory();
  
  console.log('[Context Connector] Daily sync alarm created');
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[Context Connector] Chrome started, checking alarm...');
  
  const alarm = await chrome.alarms.get(CONFIG.ALARM_NAME);
  
  if (!alarm) {
    console.log('[Context Connector] Alarm missing, recreating...');
    await chrome.alarms.create(CONFIG.ALARM_NAME, {
      delayInMinutes: 1,
      periodInMinutes: CONFIG.SYNC_INTERVAL_MINUTES
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CONFIG.ALARM_NAME) {
    console.log('[Context Connector] Daily alarm triggered, syncing history...');
    syncHistory();
  }
});

// ─────────────────────────────────────────────
// HISTORY SYNC LOGIC
// ─────────────────────────────────────────────

async function syncHistory() {
  try {
    console.log('[Context Connector] Starting history sync...');
    
    const now = Date.now();
    const startTime = now - (CONFIG.HISTORY_DAYS_BACK * 24 * 60 * 60 * 1000);
    
    const historyItems = await chrome.history.search({
      text: '',
      startTime: startTime,
      maxResults: 10000
    });
    
    console.log(`[Context Connector] Found ${historyItems.length} history items`);
    
    const profile = buildContextProfile(historyItems);
    
    console.log('[Context Connector] Profile generated:', {
      topics: profile.topics.length,
      coreTools: profile.coreTools.length,
      activeInterests: profile.activeInterests.length
    });
    
    await chrome.storage.local.set({
      [CONFIG.STORAGE_KEY]: profile
    });
    
    console.log('[Context Connector] Profile saved to storage');
    
  } catch (error) {
    console.error('[Context Connector] Sync failed:', error);
  }
}

// ─────────────────────────────────────────────
// MESSAGE HANDLING
// ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.action === 'syncNow') {
    syncHistory().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (message.action === 'getProfile') {
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      sendResponse({ profile: result[CONFIG.STORAGE_KEY] || null });
    });
    return true;
  }
  
  if (message.action === 'getFormattedProfile') {
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      const profile = result[CONFIG.STORAGE_KEY];
      if (profile) {
        const formatted = formatProfileForInjection(profile);
        sendResponse({ formatted });
      } else {
        sendResponse({ formatted: null });
      }
    });
    return true;
  }
});
