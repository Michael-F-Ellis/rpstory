// DOM element references
const El = {
	apiProviderSelector: document.getElementById('api-provider'),
	apiKeyInput: document.getElementById('api-key'),
	saveKeyBtn: document.getElementById('save-key'),
	modelSelector: document.getElementById('model-selector'),
	systemPromptSelector: document.getElementById('system-prompt-selector'),
	temperatureInput: document.getElementById('temperature-input'),
	storyEditor: document.getElementById('story-editor'),
	sendButton: document.getElementById('send-button'),
	clearStoryBtn: document.getElementById('clear-chat'),
	statusMessage: document.getElementById('status-message'),
	sendLabel: document.getElementById('send-label'),
	headerToggle: document.getElementById('header-toggle'),
	headerContent: document.getElementById('header-content'),
	scrollTopBtn: document.getElementById('scroll-top'),
	scrollBottomBtn: document.getElementById('scroll-bottom'),
	// New elements for Markdown extraction
	extractMdBtn: document.getElementById('extract-chat-md')
};
