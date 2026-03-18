# RPStory - Iterative AI Story Writer

RPStory is a document-centric writing interface for roleplaying and storytelling with AI language models. Instead of a traditional chat interface, RPStory provides a unified editor where you can embed AI instructions directly into your narrative.

## Try It Now
You can use RPStory directly at: https://michael-f-ellis.github.io/rpstory. You'll need an API key for one of the supported providers:
*   [`DeepSeek`](https://platform.deepseek.com/api_keys)
*   [`Google Gemini`](https://aistudio.google.com/app/apikey)
*   [`Together AI`](https://api.together.ai/settings/api-keys)
*   [`Fireworks`](https://fireworks.ai/api-keys)

## How It Works: The SingleText Model
RPStory uses a simple syntax to separate story text from AI instructions:

- **`[[AI Prompt]]`**: Type your instructions inside double brackets. When you click **Process Story**, the AI will replace these brackets with its generated response.
- **`{{Persistent Context}}`**: Type background info (character descriptions, setting details) inside double braces. These are included in every AI request but remain in your document for easy editing.
- **Continuation**: If no `[[prompt]]` is present, clicking **Process Story** simply asks the AI to continue the narrative from the last line.

## Getting Started
1. Clone this repository or download the files.
2. Open `index.html` in your browser.
3. Configure your **API Provider** and **Key** in the header.
4. Set your **System Prompt** (the AI's persona) using the 📝 button in the header.
5. Start writing! Place a `[[prompt]]` wherever you want the AI to take over.

## Core Features
- **Unified Editor**: Write and edit AI responses in the same place.
- **Iterative Processing**: The AI processes all `[[prompt]]` tags sequentially.
- **System Prompt Modal**: A dedicated space to define the AI's core personality.
- **Syntax Highlighting**: Real-time visual feedback for prompts and background context.
- **Import/Export**: Save and load your stories as JSON files. Legacy chat-format files are automatically migrated.

## Technical Details
RPStory is a serverless, single-page application built with vanilla JavaScript. It has no external dependencies.
- **Build System**: See [BUILD.md](BUILD.md).
- **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md).

## Privacy
Your API keys and story history are stored only in your browser (`localStorage` and `sessionStorage`) and are never sent to any server other than the AI provider APIs.

## License
[MIT License](LICENSE)
