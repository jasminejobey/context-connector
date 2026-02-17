// content.js
// Runs on Claude, ChatGPT, Grok, and Gemini pages.
// Shows a floating button to copy your context to clipboard.

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
// FLOATING BUTTON UI
// ─────────────────────────────────────────────

let floatingButton = null;
let contextProfile = null;

function createFloatingButton() {
  // Remove existing button if any
  if (floatingButton) {
    floatingButton.remove();
  }
  
  // Create button container
  floatingButton = document.createElement('div');
  floatingButton.id = 'context-connector-button';
  
  // Styling
  floatingButton.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 10000;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 24px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    user-select: none;
  `;
  
  // Icon + text
  floatingButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    <span>Copy Context</span>
  `;
  
  // Hover effect
  floatingButton.addEventListener('mouseenter', () => {
    floatingButton.style.transform = 'translateY(-2px)';
    floatingButton.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2), 0 3px 6px rgba(0, 0, 0, 0.15)';
  });
  
  floatingButton.addEventListener('mouseleave', () => {
    floatingButton.style.transform = 'translateY(0)';
    floatingButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
  });
  
  // Click handler
  floatingButton.addEventListener('click', async () => {
    if (!contextProfile) {
      showNotification('No context available yet', 'error');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(contextProfile);
      showNotification('Context copied! Paste it into your message', 'success');
      
      // Animate button
      floatingButton.style.transform = 'scale(0.95)';
      setTimeout(() => {
        floatingButton.style.transform = 'scale(1)';
      }, 100);
      
    } catch (error) {
      console.error('[Context Connector] Copy failed:', error);
      showNotification('Copy failed. Please try again', 'error');
    }
  });
  
  // Add to page
  document.body.appendChild(floatingButton);
  console.log('[Context Connector] Floating button created');
}

// ─────────────────────────────────────────────
// NOTIFICATION SYSTEM
// ─────────────────────────────────────────────

function showNotification(message, type = 'info') {
  // Remove existing notification if any
  const existing = document.getElementById('context-connector-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'context-connector-notification';
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 10001;
    background: ${colors[type]};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease;
  `;
  
  // Add CSS animation
  if (!document.getElementById('context-connector-styles')) {
    const style = document.createElement('style');
    style.id = 'context-connector-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

async function init() {
  const platform = detectPlatform();
  
  if (!platform) {
    console.log('[Context Connector] Not on a supported platform');
    return;
  }
  
  console.log('[Context Connector] Platform detected:', platform);
  
  // Request context profile
  chrome.runtime.sendMessage(
    { action: 'getFormattedProfile' },
    (response) => {
      if (response && response.formatted) {
        contextProfile = response.formatted;
        console.log('[Context Connector] Profile loaded');
        
        // Create the floating button
        createFloatingButton();
        
        // Show welcome notification
        setTimeout(() => {
          showNotification('Click the button to copy your context', 'info');
        }, 1000);
        
      } else {
        console.log('[Context Connector] No profile available yet');
        
        // Still show button, but it will show error when clicked
        createFloatingButton();
      }
    }
  );
}

// Run initialization
init();

// ─────────────────────────────────────────────
// PAGE NAVIGATION HANDLING
// ─────────────────────────────────────────────

let lastUrl = window.location.href;

new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log('[Context Connector] URL changed, recreating button');
    
    // Remove old button
    if (floatingButton) {
      floatingButton.remove();
      floatingButton = null;
    }
    
    // Reinitialize
    setTimeout(init, 1000);
  }
}).observe(document.body, { subtree: true, childList: true });
