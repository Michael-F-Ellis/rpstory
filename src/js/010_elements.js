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
	extractMdBtn: document.getElementById('extract-chat-md'),
	toggleSystemPromptBtn: document.getElementById('toggle-system-prompt'),
	systemPromptModal: document.getElementById('system-prompt-modal'),
	systemPromptText: document.getElementById('system-prompt-text'),
	closeSystemPromptBtn: document.getElementById('close-system-prompt'),
	// Preferences elements
	togglePreferencesBtn: document.getElementById('toggle-preferences'),
	preferencesModal: document.getElementById('preferences-modal'),
	themeSelect: document.getElementById('theme-select'),
	closePreferencesBtn: document.getElementById('close-preferences')
};
