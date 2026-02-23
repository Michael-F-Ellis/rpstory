// ChatManager is a class that manages a list of ChatMessages.

// It provides the delete callbacks and methods to create the JSON body
// of the list of chat messages used to send context and prompt to
// an AI API. It can also parse a JSON body of messages received from
// an input file.

// It enforces that there is exactly one system message and it is always the first message.
// It ensures the last message is always a user message (potentially empty) for continuation.

// It doesn't handle communication with servers or file i/0 or manage
// session storage.

// Assumes ChatMessage class and its constants (ROLES, CSS_CLASSES) are available globally or imported.
// Assumes a global showStatus function exists, or it's passed via notificationCB.

class ChatManager {
	/**
	 * Manages a collection of ChatMessage objects.
	 * Enforces exactly one system message at the beginning.
	 * Ensures the last message is always a user message.
	 * @param {string} [initialSystemPrompt='You are a helpful assistant.'] - The initial system prompt content. Cannot be empty.
	 * @param {function} [notificationCB=null] - Callback for displaying status messages (e.g., showStatus). Defaults to console.log.
	 * @param {HTMLElement} [container=null] - The DOM element to render messages into.
	 * @param {function} [onUpdateCallback=null] - Callback function to execute when the message list is modified.
	 */
	constructor(initialSystemPrompt = 'You are a helpful assistant.', notificationCB = null, container = null, onUpdateCallback = null) {
		this.onUpdate = onUpdateCallback; // Store the update callback
		// Use provided notification callback or a default console log
		this.notificationHandler = notificationCB || function (message, type = 'info') {
			console.log(`[${type.toUpperCase()}] ${message}`);
		};
		this.container = container; // Store the container for rendering

		// Bind methods that will be used as callbacks to ensure 'this' context
		this.handleDelete = this.handleDelete.bind(this);
		this.handleDeleteFromHere = this.handleDeleteFromHere.bind(this);

		const systemPromptContent = initialSystemPrompt || 'You are a helpful assistant.';

		// Create the three fixed containers
		this.systemMessage = this.createMessage(
			ROLES.SYSTEM,
			systemPromptContent,
		);

		this.storyMessage = this.createMessage(
			ROLES.ASSISTANT,
			''
		);

		this.promptMessage = this.createMessage(
			ROLES.USER,
			'?'
		);

		// Note: No initial rendering from constructor to allow setup completion.
		// Call render() explicitly after instantiation if needed immediately.
	}

	get messages() {
		return [this.systemMessage, this.storyMessage, this.promptMessage];
	}

	createMessage(role, content) {
		return new ChatMessage(
			role,
			content,
			this.handleDelete,
			this.handleDeleteFromHere,
			this.notificationHandler,
			0, // characterId
			1  // visibility
		);
	}

	/**
	 * Calls the registered onUpdate callback, if provided.
	 * @private
	 */

	_notifyUpdate() {
		if (typeof this.onUpdate === 'function') {
			this.onUpdate();
		}
	}

	/**
	 * Adds multiple messages at once, minimizing UI updates and notifications.
	 * @param {Array<{role: string, content: string}|Array<string, string>>} messages - Array of message objects or [role, content] arrays
	 * @returns {Array<ChatMessage>} Array of the newly created ChatMessage instances
	 */
	addMessages(messages) {
		if (!Array.isArray(messages) || messages.length === 0) {
			return [];
		}

		const addedMessages = [];
		let systemMessageUpdated = false;

		// Process all messages
		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i];
			let role, content;

			// Handle both object {role, content} and array [role, content] formats
			if (Array.isArray(msg)) {
				[role, content] = msg;
			} else if (typeof msg === 'object' && msg !== null) {
				role = msg.role;
				content = msg.content;
			} else {
				console.error('Invalid message format:', msg);
				continue;
			}

			// Handle system message specially
			if (role === ROLES.SYSTEM) {
				this.systemMessage.content = content;
				const contentEl = this.systemMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
				if (contentEl) {
					contentEl.textContent = content;
				}
				addedMessages.push(this.systemMessage);
				systemMessageUpdated = true;
				continue;
			}

			// Validate role is user or assistant
			if (role !== ROLES.USER && role !== ROLES.ASSISTANT && role !== ROLES.APP) {
				this.notificationHandler(`Invalid role "${role}" in message batch. Skipping.`, 'error');
				console.error(`Invalid role in message batch: ${role}`);
				continue;
			}

			// For RPStory: always append to existing assistant message
			if (role === ROLES.ASSISTANT) {
				if (this.storyMessage.content.trim() !== '') {
					this.storyMessage.content += '\n\n' + content;
				} else {
					this.storyMessage.content = content;
				}
				// Update the DOM element directly if it exists
				const contentEl = this.storyMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
				if (contentEl) {
					contentEl.textContent = this.storyMessage.content;
				}
				addedMessages.push(this.storyMessage);
				continue;
			}

			if (role === ROLES.USER) {
				// For RPStory: if there is already a user message, just update it instead of creating new
				this.promptMessage.content = content;
				const contentEl = this.promptMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
				if (contentEl) {
					contentEl.textContent = this.promptMessage.content;
				}
				addedMessages.push(this.promptMessage);
				continue;
			}
		}

		// Send a single notification
		if (systemMessageUpdated) {
			this.notificationHandler('System prompt updated.', 'info');
		}
		if (addedMessages.length > 0) {
			this._notifyUpdate();
		}

		return addedMessages;
	}

	// Keep the original addMessage for backward compatibility and single message adds
	addMessage(role, content) {
		return this.addMessages([{ role, content }])[0] || null;
	}

	clear() {
		this.systemMessage.content = 'You are a helpful assistant.';
		const systemContentEl = this.systemMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
		if (systemContentEl) {
			systemContentEl.textContent = this.systemMessage.content;
		}

		this.storyMessage.content = '';
		const storyContentEl = this.storyMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
		if (storyContentEl) {
			storyContentEl.textContent = this.storyMessage.content;
		}

		this.promptMessage.content = ''; // Usually the user clears it entirely or leaves a '?'? Empty string matches RPChat behavior prior to edit.
		const promptContentEl = this.promptMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
		if (promptContentEl) {
			promptContentEl.textContent = this.promptMessage.content;
		}
		this._notifyUpdate();
	}

	/**
	 * Callback handler for deleting a single message.
	 * Passed to ChatMessage instances. System message cannot be deleted.
	 * Ensures a trailing empty user message exists after deletion.
	 * @param {string} messageId - The ID of the message to delete.
	 */
	handleDelete(messageId) {
		if (messageId === this.systemMessage.id) {
			this.notificationHandler('System message cannot be deleted.', 'error');
			return;
		}

		// Require confirmation from user before deleting
		if (!confirm(`Are you sure you want to delete this message?`)) {
			return;
		}

		if (messageId === this.storyMessage.id) {
			this.storyMessage.content = '';
			const contentEl = this.storyMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
			if (contentEl) { contentEl.textContent = ''; }
			this.notificationHandler('Message deleted.', 'success');
		} else if (messageId === this.promptMessage.id) {
			this.promptMessage.content = '?';
			const contentEl = this.promptMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
			if (contentEl) { contentEl.textContent = '?'; }
			this.notificationHandler('Message deleted.', 'success');
		} else {
			this.notificationHandler('Could not find message to delete.', 'error');
			return;
		}

		if (this.onUpdate) {
			this.onUpdate();
		}
		this._notifyUpdate(); // Notify that the message list has changed
	}

	/**
	 * Callback handler for deleting messages from a specific point onwards.
	 * Passed to ChatMessage instances (typically user messages).
	 * Ensures the system message is never deleted.
	 * Ensures a trailing empty user message exists after deletion.
	 * @param {string} messageId - The ID of the message to delete from (inclusive).
	 */
	handleDeleteFromHere(messageId) {
		// Method kept around by convention but should be unused moving forward as RPStory hides this button.
		this.notificationHandler('Functionality disabled in RPStory.', 'warning');
	}

	/**
	 * Gets the current chat messages as an array of plain objects suitable for JSON serialization.
	 * Filters out the trailing empty user message if present, as it's UI-only.
	 * Assumes ChatMessage.saveEdit() updates the instance's `content` property.
	 * @returns {Array<{role: string, content: string}>}
	 */
	getMessagesJSON() {
		// Make a copy to potentially modify for export
		let messagesToExport = [
			{ role: this.systemMessage.role, content: this.systemMessage.content },
			{ role: this.storyMessage.role, content: this.storyMessage.content }
		];

		// Check if the last message is an empty user message (added by _ensureTrailingUserMessage)
		if (this.promptMessage.content !== '' && this.promptMessage.content !== '?') {
			messagesToExport.push({ role: this.promptMessage.role, content: this.promptMessage.content });
		}

		return messagesToExport;
	}

	/**
	 * Prepares messages for API request specifically for a character.
	 * Filters and transforms messages based on character visibility and ownership.
	 * @param {number} nextCharacterId - The ID of the character to prepare messages for
	 * @param {Array<ChatMessage>} [allMessages=this.messages] - Optional array of messages to use instead of this.messages
	 * @returns {Array<{role: string, content: string}>} Array of transformed message objects for API
	 */
	prepareApiMessagesForCharacter(nextCharacterId, allMessages = this.messages) {
		if (!Array.isArray(allMessages)) {
			console.error("Invalid messages array provided to prepareApiMessagesForCharacter");
			return [];
		}

		// Create a new array of message objects according to the specified rules
		return allMessages.reduce((apiMessages, message) => {
			// Skip messages that should be omitted:
			// - Private messages not belonging to nextCharacterId
			if (message.visibility === 0 && message.characterId !== nextCharacterId) {
				return apiMessages; // Skip this message
			}

			// Determine the role for API based on the rules
			let apiRole;

			if (
				// Global system messages rule
				(message.characterId === 0 && message.visibility === 1 && message.role === ROLES.SYSTEM) ||
				// Private messages for nextCharacterId rule
				(message.characterId === nextCharacterId && message.visibility === 0)
			) {
				apiRole = 'system';
			} else if (
				// Public messages FROM nextCharacterId rule
				message.characterId === nextCharacterId && message.visibility === 1
			) {
				apiRole = 'assistant';
			} else if (
				// Public messages FROM other characters rule
				(message.characterId !== nextCharacterId && message.characterId !== 0 && message.visibility === 1) ||
				// Public messages from human user rule
				(message.characterId === 0 && message.visibility === 1 && message.role === ROLES.USER)
			) {
				apiRole = 'user';
			} else {
				// If no rule matches, skip this message
				return apiMessages;
			}

			// Add the transformed message to the API messages array
			apiMessages.push({
				role: apiRole,
				content: message.content
			});

			return apiMessages;
		}, []);
	}

	/**
	 * Parses a JSON string or an array of message objects and replaces the current chat history.
	 * Validates that the input data has exactly one system message at the beginning.
	 * Ensures a trailing empty user message exists after parsing.
	 * @param {string | Array<{role: string, content: string}>} jsonData - JSON string or array of message objects.
	 */
	parseMessagesJSON(jsonData) {
		let parsedMessages;
		try {
			// 1. Parse Input
			if (typeof jsonData === 'string') {
				parsedMessages = JSON.parse(jsonData);
			} else if (Array.isArray(jsonData)) {
				parsedMessages = jsonData;
			} else {
				throw new Error("Input must be a JSON string or an array.");
			}

			if (!Array.isArray(parsedMessages)) {
				throw new Error("Parsed data is not an array.");
			}

			// 2. --- Validate Structure and System Message Rule ---
			if (parsedMessages.length === 0) {
				// Allow loading just a system prompt if needed, constructor handles default
				// throw new Error("Cannot load empty chat history. Must contain at least a system message.");
				// If empty, we'll just end up with the default system + empty user
			} else {
				// Check first message is system if messages exist
				if (parsedMessages[0]?.role !== ROLES.SYSTEM) {
					throw new Error(`Invalid chat history: First message must have role "${ROLES.SYSTEM}"`);
				}
				// Check for other system messages
				const otherSystemMessages = parsedMessages.slice(1).filter(m => m.role === ROLES.SYSTEM);
				if (otherSystemMessages.length > 0) {
					throw new Error(`Invalid chat history: Only one message with role "${ROLES.SYSTEM}" is allowed (must be the first).`);
				}
				// Basic validation of remaining message structure
				if (!parsedMessages.every(m => typeof m === 'object' && m !== null && 'role' in m && 'content' in m && Object.values(ROLES).includes(m.role))) {
					throw new Error("Invalid message structure found in parsed data.");
				}
			}
			// --- End Validation ---

			// 4. Flatten imported messages to RPStory format (1 System, 1 Assistant, 1 User)
			let systemContent = 'You are a helpful assistant.';
			let assistantContent = '';
			let userContent = '';

			parsedMessages.forEach(msgData => {
				if (msgData.role === ROLES.SYSTEM) systemContent = msgData.content;
				if (msgData.role === ROLES.ASSISTANT) {
					// Append story chunks
					if (assistantContent !== '') {
						assistantContent += '\n\n' + msgData.content;
					} else {
						assistantContent = msgData.content;
					}
				}
				if (msgData.role === ROLES.USER) {
					// We can either keep the last user prompt or ignore past prompts.
					// We'll keep the very last one as the current prompt.
					userContent = msgData.content;
				}
			});

			this.systemMessage.content = systemContent;
			const sysContentEl = this.systemMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
			if (sysContentEl) { sysContentEl.textContent = systemContent; }

			this.storyMessage.content = assistantContent;
			const storyContentEl = this.storyMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
			if (storyContentEl) { storyContentEl.textContent = assistantContent; }

			this.promptMessage.content = userContent;
			const promptContentEl = this.promptMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
			if (promptContentEl) { promptContentEl.textContent = userContent; }

			this.notificationHandler('Chat history loaded successfully.', 'success');

			this._notifyUpdate(); // Notify that the message list has changed

		} catch (error) {
			console.error("Failed to parse messages JSON:", error);
			this.notificationHandler(`Failed to load chat history: ${error.message}`, 'error');
			// Do not modify this.messages if parsing/validation failed
		}
	}

	/**
	 * Renders all managed messages into the specified container element.
	 * Clears the container before rendering.
	 * @param {HTMLElement} [container=this.container] - The DOM element to render messages into. If not provided, uses the container set in the constructor.
	 */
	render(container = this.container) {
		const targetContainer = container || this.container;
		if (!targetContainer) {
			console.error("ChatManager.render: No container element provided or set.");
			this.notificationHandler("Cannot render chat: Container not specified.", "error");
			return;
		}
		if (!(targetContainer instanceof Node)) {
			console.error('ChatManager.render: Provided container is not a valid DOM Node.', targetContainer);
			this.notificationHandler("Cannot render chat: Invalid container.", "error");
			return;
		}

		// Store container if passed and not already set
		if (container && !this.container) {
			this.container = container;
		}

		// Clear existing content
		targetContainer.innerHTML = '';

		// Render each message
		this.systemMessage.render(targetContainer);
		this.storyMessage.render(targetContainer);
		this.promptMessage.render(targetContainer);
	}

	/**
	 * Sets or updates the container element for rendering.
	 * @param {HTMLElement} containerElement - The DOM element.
	 */
	setContainer(containerElement) {
		if (containerElement instanceof Node) {
			this.container = containerElement;
		} else {
			console.error("ChatManager.setContainer: Invalid container element provided.");
		}
	}

	/**
	 * Gets the system prompt message content.
	 * @returns {string} The content of the system message.
	 */
	getSystemPrompt() {
		return this.systemMessage.content;
	}

	/**
	 * Updates the content of the system prompt message.
	 * @param {string} newContent - The new content for the system prompt.
	 */
	updateSystemPrompt(newContent) {
		this.systemMessage.content = newContent; // Update internal content

		// Update the DOM element directly if it exists
		const contentEl = this.systemMessage.element?.querySelector(`.${CSS_CLASSES.EDITABLE_CONTENT}`);
		if (contentEl) {
			contentEl.textContent = newContent;
		}

		this.notificationHandler('System prompt updated.', 'info');

		// Note: Technically only content changed, not the structure.
		// A full update notification might trigger a full re-render, which is slightly inefficient here.
		// However, for simplicity, we notify of an update. A more complex system might have different notification types.
		this._notifyUpdate();
	}
	/**
	 * Checks if any message in the chat is currently being edited.
	 * @returns {boolean} True if any message is being edited, false otherwise.
	 */
	hasActiveEdits() {
		return this.systemMessage.isBeingEdited() || this.storyMessage.isBeingEdited() || this.promptMessage.isBeingEdited();
	}

	/**
	 * Gets the trailing user message (which should be empty unless being edited)
	 * @returns {ChatMessage|null} The trailing user message or null if not found
	 */
	getTrailingUserMessage() {
		return this.promptMessage;
	}
}
