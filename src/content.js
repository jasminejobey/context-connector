// content.js
// Runs on Claude, ChatGPT, Grok, and Gemini pages.
// Injects your browsing context into the chat interface.

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const CONFIG = {
  INJECTION_DELAY: 2000,
  RETRY_INTERVAL: 1000,
  MAX_RETRIES: 10
};

// ─────────────────────────────────────────────
// PLATFORM DETECTION
// ─────────────────────────────────────────────

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

function getSelectors(platform) {
  const selectors = {
    claude: {
      input: 'div[contenteditable="true"][data-placeholder]',
      inputAlt: 'fieldset textarea',
      chatContainer: 'div[role="presentation"]'
    },
    chatgpt: {
      input: 'textarea[data-id]',
      inputAlt: '#prompt-textarea',
      chatContainer: 'main'
    },
    grok: {
      input: 'div[contenteditable="true"][role="textbox"]',
      inputAlt: 'textarea',
      chatContainer: 'main'
    },
    gemini: {
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

let contextProfile = null;
let hasInjected = false;

function findInputElement(selectors) {
  let input = document.querySelector(selectors.input);
  if (!input && selectors.inputAlt) {
    input = document.querySelector(selectors.inputAlt);
  }
  return input;
}

async function injectContext(platform, formattedProfile) {
  contextProfile = formattedProfile;
  const selectors = getSelectors(platform);
  
  if (!selectors) {
    console.log('[Context Connector] No selectors for platform:', platform);
    return;
  }
  
  let retries = 0;
  
  const setupInjection = () => {
    const input = findInputElement(selectors);
    
    if (input) {
      console.log('[Context Connector] Input field found, setting up injection listener');
      
      // Wait for user to start typing, then inject
      const injectOnFirstInput = (e) => {
        if (hasInjected) return;
        
        console.log('[Context Connector] User started typing, injecting context');
        
        // Small delay to let the first character appear
        setTimeout(() => {
          if (input.tagName === 'TEXTAREA') {
            injectIntoTextarea(input, contextProfile);
          } else {
            injectIntoContentEditable(input, contextProfile);
          }
          hasInjected = true;
        }, 100);
      };
      
      // Listen for focus and first input
      input.addEventListener('focus', () => {
        if (!hasInjected) {
          input.addEventListener('input', injectOnFirstInput, { once: true });
        }
      }, { once: true });
      
      return true;
    }
    
    retries++;
    if (retries < CONFIG.MAX_RETRIES) {
      console.log(`[Context Connector] Input not found, retry ${retries}/${CONFIG.MAX_RETRIES}`);
      setTimeout(setupInjection, CONFIG.RETRY_INTERVAL);
    } else {
      console.log('[Context Connector] Max retries reached, setup failed');
    }
    
    return false;
  };
  
  setTimeout(setupInjection, CONFIG.INJECTION_DELAY);
}

function injectIntoTextarea(textarea, formattedProfile) {
  const existingContent = textarea.value;
  
  if (existingContent.includes('## Personal Context')) {
    console.log('[Context Connector] Context already present, skipping injection');
    return;
  }
  
  // Prepend context before the user's text
  textarea.value = formattedProfile + '\n' + existingContent;
  
  // Trigger input and change events
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Move cursor to end
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  
  console.log('[Context Connector] Context injected into textarea');
}

function injectIntoContentEditable(element, formattedProfile) {
  const existingContent = element.innerText || '';
  
  if (existingContent.includes('## Personal Context')) {
    console.log('[Context Connector] Context already present, skipping injection');
    return;
  }
  
  // Prepend context before the user's text
  element.innerText = formattedProfile + '\n' + existingContent;
  
  // Trigger input and change events
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Move cursor to end
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  
  console.log('[Context Connector] Context injected into contenteditable');
}

// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

async function init() {
  // Reset injection flag for new page
  hasInjected = false;
  
  const platform = detectPlatform();
  
  if (!platform) {
    console.log('[Context Connector] Not on a supported platform');
    return;
  }
  
  console.log('[Context Connector] Platform detected:', platform);
  
  chrome.runtime.sendMessage(
    { action: 'getFormattedProfile' },
    (response) => {
      if (response && response.formatted) {
        console.log('[Context Connector] Profile received, setting up injection');
        injectContext(platform, response.formatted);
      } else {
        console.log('[Context Connector] No profile available yet.');
      }
    }
  );
}

init();

// ─────────────────────────────────────────────
// PAGE NAVIGATION HANDLING
// ─────────────────────────────────────────────

let lastUrl = window.location.href;

new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log('[Context Connector] URL changed, re-running injection');
    init();
  }
}).observe(document.body, { subtree: true, childList: true });
