// background.js
// Service worker that runs in the background and syncs browsing history daily.

import { buildContextProfile, formatProfileForInjection } from './historyProcessor.js';

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const CONFIG = {
  // Name of the alarm that triggers daily sync
  ALARM_NAME: 'dailyHistorySync',
  
  // How often to sync (in minutes) - 1440 = 24 hours
  SYNC_INTERVAL_MINUTES: 1440,
  
  // How far back to look in history (in days)
  HISTORY_DAYS_BACK: 90,
  
  // Storage key for the context profile
  STORAGE_KEY: 'contextProfile'
};


// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

/**
 * onInstalled
 * Runs when the extension is first installed or updated.
 * Sets up the daily alarm and does an immediate first sync.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Context Connector] Extension installed:', details.reason);
  
  // Create the daily alarm
  await chrome.alarms.create(CONFIG.ALARM_NAME, {
    delayInMinutes: 1, // First sync in 1 minute
    periodInMinutes: CONFIG.SYNC_INTERVAL_MINUTES
  });
  
  // Do an immediate sync so users see results right away
  await syncHistory();
  
  console.log('[Context Connector] Daily sync alarm created');
});


/**
 * onStartup
 * Runs every time Chrome starts.
 * Ensures the alarm exists in case it was cleared.
 */
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


/**
 * onAlarm
 * Runs when the daily alarm fires.
 * Triggers a history sync.
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CONFIG.ALARM_NAME) {
    console.log('[Context Connector] Daily alarm triggered, syncing history...');
    syncHistory();
  }
});


// ─────────────────────────────────────────────
// HISTORY SYNC LOGIC
// ─────────────────────────────────────────────

/**
 * syncHistory
 * Main function that:
 * 1. Fetches browsing history from Chrome
 * 2. Processes it into a context profile
 * 3. Saves it to Chrome storage
 */
async function syncHistory() {
  try {
    console.log('[Context Connector] Starting history sync...');
    
    // Calculate how far back to search
    const now = Date.now();
    const startTime = now - (CONFIG.HISTORY_DAYS_BACK * 24 * 60 * 60 * 1000);
    
    // Fetch history from Chrome
    // maxResults: 10000 is the Chrome API limit
    const historyItems = await chrome.history.search({
      text: '',           // Empty string = all history
      startTime: startTime,
      maxResults: 10000   // Chrome's maximum
    });
    
    console.log(`[Context Connector] Found ${historyItems.length} history items`);
    
    // Process the raw history into a structured context profile
    const profile = buildContextProfile(historyItems);
    
    console.log('[Context Connector] Profile generated:', {
      topics: profile.topics.length,
      coreTools: profile.coreTools.length,
      activeInterests: profile.activeInterests.length
    });
    
    // Save to Chrome's local storage
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

/**
 * onMessage
 * Listens for messages from other parts of the extension.
 * Used by popup.js to trigger manual syncs or request the current profile.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // Manual sync requested from popup
  if (message.action === 'syncNow') {
    syncHistory().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Required for async sendResponse
  }
  
  // Popup requesting the current profile
  if (message.action === 'getProfile') {
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      sendResponse({ profile: result[CONFIG.STORAGE_KEY] || null });
    });
    return true; // Required for async sendResponse
  }
  
  // Content script requesting the formatted profile for injection
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
    return true; // Required for async sendResponse
  }
});


// ─────────────────────────────────────────────
// UTILITY: Expose sync function for testing
// ─────────────────────────────────────────────

// This allows you to manually trigger a sync from the Chrome DevTools console:
// chrome.runtime.getBackgroundPage((bg) => bg.syncHistory());
if (typeof window !== 'undefined') {
  window.syncHistory = syncHistory;
}
