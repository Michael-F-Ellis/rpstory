# RPStory Architecture Reference

## Overview

RPStory is a single-page application (SPA) designed for iterative AI-assisted story writing. Unlike traditional chat interfaces, RPStory uses a **SingleText** document model where the user writes in a unified editor, and AI interactions are triggered by specific syntax embedded directly in the text.

## Design Goals
- **Serverless**: Runs entirely in the browser. No backend required.
- **No Dependencies**: Pure HTML, CSS, and vanilla JS. No external libraries.
- **Document-Centric**: Focus on the story as a single evolving entity rather than a series of messages.

## Application Structure

```
├── index.html (Build target)
├── src/
│   ├── html/template.html (UI structure)
│   ├── css/main.css (Styles)
│   └── js/
│       ├── 010_elements.js (DOM references)
│       ├── 050_StoryManager.js (Editor logic & Syntax Highlighting)
│       ├── 080_api.js (Provider-specific API logic)
│       ├── 081_processor.js (Iterative prompting engine)
│       ├── 090_importExport.js (JSON persistence)
│       └── 100_main.js (App coordination)
```

## Core Components

### 1. StoryManager (`050_StoryManager.js`)
**Purpose**: Manages the `#story-editor` (contenteditable) and handles real-time syntax highlighting.

- **Content Tracking**: Provides methods to get/set the raw text while preserving cursor position.
- **Syntax Highlighting**: Uses regex-based replacement to wrap `[[prompt]]` and `{{background}}` tags in styled `<span>` tags.
- **UI State**: Manages the visual feedback for active processing.

### 2. IterativePromptProcessor (`081_processor.js`)
**Purpose**: The "engine" that parses the document and manages sequential AI requests.

- **Prompt Discovery**: Scans the text for `[[...]]` blocks.
- **Context Assembly**: Gathers all `{{...}}` blocks to include as persistent context.
- **Sequential Execution**: Processes each prompt one-by-one, replacing the tag with the AI response in real-time.
- **Continuation**: If no prompts are found, it defaults to a "Continue from end" behavior using the full text as context.

### 3. AIProvider & AIModel (`080_api.js`)
**Purpose**: Abstracts the differences between various AI providers (OpenAI, Gemini, DeepSeek, etc.).

- **Request Formatting**: Translates the unified prompt/context into provider-specific JSON payloads.
- **Key Management**: Maps provider IDs to specific `localStorage` keys for API authentication.

### 4. Import/Export (`090_importExport.js`)
**Purpose**: Handles saving and loading story sessions.

- **JSON Format**: Saves the story text and metadata as a standard JSON object.
- **System Prompt Handling**: Automatically extracts/injects `{{SYSTEM ...}}` markers to ensure the system persona is persisted without cluttering the main editor.
- **Backwards Compatibility**: Migrates legacy chat-format JSON files into the SingleText format on import.

## Data Flow

### AI Interaction Loop
1. **Trigger**: User clicks "Process Story".
2. **Scan**: `IterativePromptProcessor` identifies all `[[prompt]]` tags.
3. **Loop**:
   - Assemble context: `System Prompt` + `{{Background Blocks}}` + `Text preceding the prompt`.
   - Send API Request via `AIProvider`.
   - **Update**: Replace `[[prompt]]` with AI response in the editor via `StoryManager`.
4. **Finalize**: Scroll to bottom and show completion status.

## Extension Points

- **New Highlighting**: Add new regex patterns to `StoryManager.applyHighlighting`.
- **New Providers**: Add configurations to `providers.json`.
- **UI Customization**: Modify `template.html` and `main.css`.

## Error Handling
- **Missing Brackets**: Validates that all tags are properly closed before processing.
- **API Failures**: Displays error status without losing the current story state.
- **Browser Limits**: Uses `sessionStorage` for temporary state and `localStorage` for persistent API keys.sabled controls during processing
- Status messages for user feedback
- Confirmation dialogs for destructive actions
