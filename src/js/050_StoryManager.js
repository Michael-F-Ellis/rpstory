/**
 * StoryManager handles the single-text document editor for SingleText mode.
 * It manages the contenteditable area, syntax highlighting for brackets,
 * and document state.
 */
class StoryManager {
    /**
     * @param {HTMLElement} container - The DOM element to act as the editor.
     * @param {function} onUpdateCallback - Optional callback for content changes.
     */
    constructor(container, onUpdateCallback = null) {
        this.container = container;
        this.onUpdate = onUpdateCallback;
        
        // Ensure container is editable
        this.container.contentEditable = "true";
        this.container.style.whiteSpace = "pre-wrap";
        this.container.style.outline = "none";
        this.container.style.minHeight = "200px";
        this.container.style.padding = "1rem";
        this.container.style.fontFamily = "monospace";
        
        // Bind events
        this.container.addEventListener('input', () => this._handleInput());
        this.container.addEventListener('keydown', (e) => this._handleKeyDown(e));
        
        this._isDebouncing = false;
    }

    /**
     * Get the full text content of the editor.
     */
    getContent() {
        // Use innerText to preserve newlines and avoid HTML tags
        return this.container.innerText;
    }

    /**
     * Set the content of the editor.
     * @param {string} content - The plain text content.
     */
    setContent(content) {
        this.container.innerText = content;
        this.applyHighlighting(true); // Force highlighting
    }

    /**
     * Apply syntax highlighting to [[prompt]] and {{background}} blocks.
     * Uses a selection save/restore trick based on character offset.
     */
    applyHighlighting(force = false) {
        if (!force && this._isProcessingHighlight) return;
        this._isProcessingHighlight = true;

        const selection = window.getSelection();
        let offset = 0;
        const isFocused = document.activeElement === this.container;

        if (isFocused && selection.rangeCount > 0) {
            offset = this._getCursorOffset();
        }

        const rawText = this.getContent();
        
        // Only re-render if text actually changed or forced
        // (This helps avoid jumps while typing plain text)
        const escaped = this._escapeHTML(rawText);
        const highlighted = escaped
            .replace(/\[\[(.*?)\]\]/g, '<span class="prompt-highlight">[[$1]]</span>')
            .replace(/\{\{(.*?)\}\}/g, '<span class="background-highlight">{{$1}}</span>');

        if (this.container.innerHTML !== highlighted || force) {
            this.container.innerHTML = highlighted;
            if (isFocused) {
                this._setCursorOffset(offset);
            }
        }

        this._isProcessingHighlight = false;
        this._notifyUpdate();
    }

    _escapeHTML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    _getCursorOffset() {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(this.container);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return preCaretRange.toString().length;
    }

    _setCursorOffset(offset) {
        const selection = window.getSelection();
        const range = document.createRange();
        let charCount = 0;
        let nodeStack = [this.container];

        while (nodeStack.length > 0) {
            let node = nodeStack.pop();
            if (node.nodeType === 3) {
                let nextCharCount = charCount + node.length;
                if (offset <= nextCharCount) {
                    range.setStart(node, offset - charCount);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    return;
                }
                charCount = nextCharCount;
            } else {
                let i = node.childNodes.length;
                while (i--) {
                    nodeStack.push(node.childNodes[i]);
                }
            }
        }
    }

    _handleInput() {
        // Debounce highlighting to avoid lag while typing fast
        if (this._highlightTimeout) clearTimeout(this._highlightTimeout);
        this._highlightTimeout = setTimeout(() => this.applyHighlighting(), 500);
        this._notifyUpdate();
    }

    _handleKeyDown(e) {
        // Custom keys handling if needed (e.g. Tab)
    }

    _notifyUpdate() {
        if (this.onUpdate) {
            this.onUpdate();
        }
    }

    /**
     * Highlights an active prompt during processing.
     */
    highlightActivePrompt(index, length) {
        // Implementation for visual feedback during generation
    }
}

// Global CSS for highlighting (to be injected or added to main.css)
const STORY_STYLES = `
.prompt-highlight {
    background-color: rgba(128, 90, 213, 0.2);
    border-bottom: 2px solid #805ad5;
    font-weight: bold;
    color: #553c9a;
}
.background-highlight {
    background-color: rgba(49, 130, 206, 0.1);
    border: 1px dashed #3182ce;
    font-style: italic;
    color: #2b6cb0;
}
.active-prompt {
    background-color: #fbd38d !important;
    animation: blink 1s infinite;
}
@keyframes blink {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}
`;
