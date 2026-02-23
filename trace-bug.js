const fs = require('fs');
// Mocking DOM elements to load ChatManager
global.document = {
	createElement: () => ({ classList: { add: () => { }, remove: () => { }, toggle: () => false, contains: () => false }, appendChild: () => { }, querySelector: () => ({ textContent: '' }), querySelectorAll: () => [], setAttribute: () => { }, dataset: {}, addEventListener: () => { } }),
	getElementById: () => null,
	addEventListener: () => { }
};
global.window = {
	RPChat: {
		markdown: { parse: (text) => text }
	}
};

const domUtils = { sanitizeContent: (content) => content };
global.window.RPChat.domUtils = domUtils;

const chatMessageCode = fs.readFileSync('src/js/040_ChatMessage.js', 'utf8');
eval(chatMessageCode + '\n global.ChatMessage = ChatMessage; \n global.ROLES = { SYSTEM: "system", ASSISTANT: "assistant", USER: "user", APP: "app" }; \n global.CSS_CLASSES = { MESSAGE: "message", USER_MESSAGE: "user-message", ASSISTANT_MESSAGE: "assistant-message", SYSTEM_MESSAGE: "system-message", EDITABLE_CONTENT: "editable-content", MESSAGE_CONTROLS: "message-controls", COLLAPSIBLE: "collapsible", TOGGLE_COLLAPSE: "toggle-collapse", MESSAGE_BODY: "message-body", COLLAPSED: "collapsed", ICON_BUTTON: "icon-button" };');

const chatManagerCode = fs.readFileSync('src/js/050_ChatManager.js', 'utf8');
eval(chatManagerCode + '\n global.ChatManager = ChatManager;');

const chat = new ChatManager();
// Add messages
chat.addMessages([
	{ role: 'user', content: 'Part 1' },
	{ role: 'assistant', content: 'Once upon a time' },
	{ role: 'user', content: 'Part 2' },
	{ role: 'assistant', content: 'The dragon' }
]);

const exported = chat.getMessagesJSON();
console.log("EXPORTED:", JSON.stringify(exported, null, 2));

chat.messages = []; // simulate clear
chat.parseMessagesJSON(exported);

console.log("IMPORTED MESSAGES LENGTH:", chat.messages.length);
console.log("IMPORTED MESSAGES:", chat.getMessagesJSON());

chat.addMessage('user', 'Part 3');
console.log("AFTER PART 3 PROMPT:", chat.getMessagesJSON());

chat.addMessage('assistant', 'They are friends');
console.log("AFTER PART 3 RESPONSE:", chat.getMessagesJSON());
