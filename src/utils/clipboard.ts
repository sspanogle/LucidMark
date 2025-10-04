/**
 * Clipboard utilities for copy-to-clipboard functionality
 */

export interface CopyResult {
  readonly success: boolean;
  readonly message: string;
}

/**
 * Copy text to the system clipboard with error handling
 */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  try {
    // Use the modern Clipboard API if available
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return { success: true, message: 'Copied to clipboard!' };
    }

    // Fallback for older browsers or insecure contexts
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      return { success: true, message: 'Copied to clipboard!' };
    } else {
      return { success: false, message: 'Copy failed - please try manually selecting the text' };
    }
  } catch (error) {
    console.error('Copy to clipboard failed:', error);
    return { success: false, message: 'Copy failed - clipboard access denied' };
  }
}

/**
 * Show a temporary feedback message near a target element
 */
export function showCopyFeedback(target: HTMLElement, message: string, success: boolean): void {
  const feedback = document.createElement('div');
  feedback.className = `copy-feedback ${success ? 'copy-feedback--success' : 'copy-feedback--error'}`;
  feedback.textContent = message;
  
  // Position the feedback near the target
  const rect = target.getBoundingClientRect();
  feedback.style.position = 'fixed';
  feedback.style.top = `${rect.top - 35}px`;
  feedback.style.right = `${window.innerWidth - rect.right}px`;
  feedback.style.zIndex = '1000';
  
  document.body.appendChild(feedback);
  
  // Auto-remove after animation
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.parentNode.removeChild(feedback);
    }
  }, 2000);
}