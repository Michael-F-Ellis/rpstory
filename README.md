# RPStory - Editable AI Chat Client

RPStory is a flexible chat interface for roleplaying with AI language models. It allows you to edit both your messages and AI responses, providing full control over the conversation context.

## Try It Now
You can use RPStory directly at: https://michael-f-ellis.github.io/rpstory. Note that you'll need to have or obtain an API key for at least one of the following providers:
*   [`DeepSeek`](https://platform.deepseek.com/api_keys)
*   [`Fireworks`](https://fireworks.ai/api-keys)
*   [`Google Gemini`](https://aistudio.google.com/app/apikey)
*   [`Together AI`](https://api.together.ai/settings/api-keys)
*   [`Z`](https://z.ai/model-api) 

## Getting Started
- Clone this repository or download the files
- Open index.html in your browser
- Select your preferred AI provider from the dropdown
- Enter your API key for the selected provider and click "Save Key"
- Select a model and adjust the temperature as needed
- Choose a system prompt style from the dropdown (or use the default)
- Use your first prompt to define roles for yourself and the AI
- - It can be as simple 'You are Jack and I am Jill' 
- - or complex as you like with fully fleshed out characters and scenario.
- - The AI will respond as the character you defined for it.
- Start chatting!

## Features
### Multiple Supported Providers and Models
*   **DeepSeek**
    *   DeepSeek Chat
    *   DeepSeek Reasoner
*   **Fireworks**
    *   Qwen 3 235B
*   **Google Gemini**
    *   Gemini 2.5 Pro
    *   Gemini 2.5 Flash
*   **Together.ai**
    *   OpenAI GPT-OSS-120B
    *   OpenAI GPT-OSS-20B
    *   Meta Llama 3.1 405B
    *   Qwen 2.5 72B
*   **Z**
    *   glm-4.5
    *   glm-4.5-air

### Extensible
All the CSS, HTML and JavaScript is bundled into a single file you can edit and customize. See [RPStory Build System](BUILD.md) for development instructions and [RPStory Architecture](ARCHITECTURE.md) for a detailed overview of the code.

- Add support for new AI providers by editing the `providers.json` file in the repo and rebuilding.
- - New providers must have endpoints that implement a basic  OpenAI compatible chat API.
### Rich Message Controls:
- Edit any message (system, user, or assistant)
- Delete single messages or delete from a specific point
- Collapsible system prompts
### Model Control:
- Temperature adjustment for controlling response randomness
- Model selection for each provider
- System prompt selector with preset styles (first person, third person, minimal)
- Editable system prompts
- Make changes at any point in the conversation
### Data Management:
- Import/Export chat sessions as JSON files.
- Session persistence across page refreshes
- Convenient API key storage in browser `localStorage`
### Privacy-Focused:
- All data stored locally in your browser and file system
- API keys never sent to any server except the respective AI provider
## Usage
### Requirements
- A modern browser (tested on Chrome, Firefox, and Edge)
- An API key for each AI provider you use.
### Basic Operation
- Type in the chat area and click "Send" to submit your message
- The AI will respond based on the conversation context
### Editing and Controls
- Click the 🖊️ (edit) button on any message to modify its content
- For user messages, click the ⟲ (delete from here) button to remove all subsequent messages
- System prompts can be collapsed/expanded using the toggle button
### Session Management
- Click "Clear" to start a new conversation (retaining your system prompt)
- Click "Export" to save your current chat as a JSON file
- Click "Import" to load a previously exported chat
- Click "Extract" to save the chat content to a Markdown file
### Configuration
- Change the AI provider using the dropdown at the top
- Select different models based on your chosen provider
- Choose a system prompt style from the dropdown (first person, third person, or minimal)
- Adjust the "Temperature" slider to control response randomness (higher values = more creative/random)
### System Prompts
RPStory comes with preset system prompt styles optimized for different roleplaying scenarios:
- **First Person**: For immersive roleplaying where you interact directly with AI characters. This is the default for new chats.
- **Third Person**: For collaborative storytelling from an observer perspective
- **Minimal**: A simple assistant prompt for general conversation, e.g. interactively developing characters or summarizing a plot line.

You can select a style from the dropdown or edit the system prompt by clicking the edit button on the system message at the beginning of the conversation. Note that your customized versions will be saved when you export a chat and restored when you import it.

## Privacy
Your API keys and chat history are stored only in your browser's local storage and are never sent to any server other than the AI provider APIs for processing your messages. Please note that while your data is kept private, the AI providers may still have access to your messages for training their models. Also note that saving API keys in your browser's local storage is secure as long as no third-party libraries are introduced into the application. 

## License
[MIT License](LICENSE)
