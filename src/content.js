// content.js
// Runs on Claude, ChatGPT, Grok, and Gemini pages.
// Injects your browsing context into the chat interface.

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const CONFIG = {
  // How long to wait before injecting (ms)
  // Gives the page time to fully load
  INJECTION_DELAY: 2000,
  
  // How long to wait between retry attempts (ms)
  RETRY_INTERVAL: 1000,
  
  // Maximum number of retries to find the input field
  MAX_RETRIES: 10
};


// ─────────────────────────────────────────────
// PLATFORM DETECTION
// ─────────────────────────────────────────────

/**
 * detectPlatform
 * Figures out which LLM platform we're on based on the URL.
 * Returns: 'claude' | 'chatgpt' | 'grok' | 'gemini' | null
 */
function detectPlatform() {
  const hostname = window.location.hostname;
  
  if (hostname.includes('claude.ai')) return 'claude';
  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) return 'chatgpt';
  if (hostname.includes('x.com') && window.location.pathname.includes('grok')) return 'grok';
  if (hostname.includes('gemini.google.com')) return 'gemini';
  
  return null;
}


// ─────────────────────────────────────────────
// PLATFORM-SPECIFIC SELECTORS
// ─────────────────────────────────────────────

/**
 * getSelectors
 * Returns the CSS selectors needed to find the chat input for each platform.
 * These are the specific DOM elements where users type their messages.
 * 
 * Note: These selectors may need updating if platforms change their UI.
 */
function getSelectors(platform) {
  const selectors = {
    claude: {
      // Claude's main textarea for message input
      input: 'div[contenteditable="true"][data-placeholder]',
      // Alternative selector if the first fails
      inputAlt: 'fieldset textarea',
      // The container where messages appear
      chatContainer: 'div[role="presentation"]'
    },
    
    chatgpt: {
      // ChatGPT's main textarea
      input: 'textarea[data-id]',
      inputAlt: '#prompt-textarea',
      chatContainer: 'main'
    },
    
    grok: {
      // Grok's input (similar to Twitter's compose)
      input: 'div[contenteditable="true"][role="textbox"]',
      inputAlt: 'textarea',
      chatContainer: 'main'
    },
    
    gemini: {
      // Gemini's input field
      input: 'rich-textarea div[contenteditable="true"]',
      inputAlt: 'textarea[aria-label]',
      chatContainer: 'main'
    }
  };
  
  return selectors[platform] || null;
}


// ─────────────────────────────────────────────
// INJECTION LOGIC
// ─────────────────────────────────────────────

/**
 * findInputElement
 * Tries to locate the chat input field using platform-specific selectors.
 * Returns the DOM element or null if not found.
 */
function findInputElement(selectors) {
  // Try primary selector
  let input = document.querySelector(selectors.input);
  
  // If primary fails, try alternative
  if (!input && selectors.inputAlt) {
    input = document.querySelector(selectors.inputAlt);
  }
  
  return input;
}


/**
 * injectContext
 * Main injection function. Finds the input field and prepends context.
 */
async function injectContext(platform, formattedProfile) {
  const selectors = getSelectors(platform);
  
  if (!selectors) {
    console.log('[Context Connector] No selectors for platform:', platform);
    return;
  }
  
  let retries = 0;
  
  // Retry loop - keeps trying to find the input field
  const attemptInjection = () => {
    const input = findInputElement(selectors);
    
    if (input) {
      console.log('[Context Connector] Input field found, injecting context');
      
      // Different injection methods depending on element type
      if (input.tagName === 'TEXTAREA') {
        // For textarea elements (ChatGPT, some Gemini views)
        injectIntoTextarea(input, formattedProfile);
      } else {
        // For contenteditable divs (Claude, Grok, most modern UIs)
        injectIntoContentEditable(input, formattedProfile);
      }
      
      return true; // Success
    }
    
    // If not found and we haven't maxed out retries, try again
    retries++;
    if (retries < CONFIG.MAX_RETRIES) {
      console.log(`[Context Connector] Input not found, retry ${retries}/${CONFIG.MAX_RETRIES}`);
      setTimeout(attemptInjection, CONFIG.RETRY_INTERVAL);
    } else {
      console.log('[Context Connector] Max retries reached, injection failed');
    }
    
    return false;
  };
  
  // Start the first attempt after initial delay
  setTimeout(attemptInjection, CONFIG.INJECTION_DELAY);
}


/**
 * injectIntoTextarea
 * Handles injection for standard textarea elements.
 */
function injectIntoTextarea(textarea, formattedProfile) {
  // Get existing content (in case user already started typing)
  const existingContent = textarea.value;
  
  // Check if context was already injected
  if (existingContent.includes('## Personal Context')) {
    console.log('[Context Connector] Context already present, skipping injection');
    return;
  }
  
  // Prepend context to existing content
  textarea.value = formattedProfile + existingContent;
  
  // Trigger input event so the UI updates (character count, send button, etc.)
  const event = new Event('input', { bubbles: true });
  textarea.dispatchEvent(event);
  
  console.log('[Context Connector] Context injected into textarea');
}


/**
 * injectIntoContentEditable
 * Handles injection for contenteditable div elements.
 */
function injectIntoContentEditable(element, formattedProfile) {
  // Get existing content
  const existingContent = element.innerText || '';
  
  // Check if context was already injected
  if (existingContent.includes('## Personal Context')) {
    console.log('[Context Connector] Context already present, skipping injection');
    return;
  }
  
  // For contenteditable, we set text content directly
  // The formatted profile is already in markdown-style plain text
  element.innerText = formattedProfile + existingContent;
  
  // Trigger input event
  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
  
  console.log('[Context Connector] Context injected into contenteditable');
}


// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

/**
 * init
 * Entry point. Runs when the content script loads.
 */
async function init() {
  const platform = detectPlatform();
  
  if (!platform) {
    console.log('[Context Connector] Not on a supported platform');
    return;
  }
  
  console.log('[Context Connector] Platform detected:', platform);
  
  // Request the formatted profile from the background script
  chrome.runtime.sendMessage(
    { action: 'getFormattedProfile' },
    (response) => {
      if (response && response.formatted) {
        console.log('[Context Connector] Profile received, starting injection');
        injectContext(platform, response.formatted);
      } else {
        console.log('[Context Connector] No profile available yet. Try syncing in the extension popup.');
      }
    }
  );
}


// Run initialization
init();


// ─────────────────────────────────────────────
// PAGE NAVIGATION HANDLING
// ─────────────────────────────────────────────

/**
 * Listen for URL changes (single-page app navigation)
 * Some platforms use client-side routing, so we need to re-inject
 * when the user navigates to a new chat.
 */
let lastUrl = window.location.href;

new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log('[Context Connector] URL changed, re-running injection');
    init();
  }
}).observe(document.body, { subtree: true, childList: true });
