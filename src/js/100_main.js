// Main application code for RPChat using ChatManager and ChatMessage components

// Define state variables
let apiKeys = {};
let currentProvider = null;
let selectedModelId = null;
let temperature = null;
let isProcessing = false;
let chatManager = null;

/**
 * Extracts the current chat to a Markdown formatted string.
 * This function is available on the window object for console access.
 * @param {boolean} [assistant=true] - Include assistant messages.
 * @param {boolean} [user=true] - Include user messages.
 * @param {boolean} [system=false] - Include system messages.
 * @param {boolean} [labels=false] - Add role labels to each message.
 * @returns {string} The chat content in Markdown format.
 */
window.extractChatToMarkdown = function (assistant = true, user = true, system = false, labels = false) {
	if (!chatManager) {
		console.error("ChatManager not initialized.");
		return "Error: ChatManager not found.";
	}

	// Filter out the trailing empty user message
	const messagesToExport = chatManager.getMessagesJSON();

	let markdown = '';

	messagesToExport.forEach(message => {
		let include = false;
		if (assistant && message.role === ROLES.ASSISTANT) {
			include = true;
		}
		if (user && message.role === ROLES.USER && message.content) { // Exclude empty user messages
			include = true;
		}
		if (system && message.role === ROLES.SYSTEM) {
			include = true;
		}

		if (include) {
			if (labels) {
				markdown += `**${message.role.charAt(0).toUpperCase() + message.role.slice(1)}:** `;
			}
			markdown += `${message.content.trim()}\n\n`;
		}
	});

	// For easy copying, log to console, copy to clipboard, and return
	console.log(markdown);
	if (navigator.clipboard) {
		navigator.clipboard.writeText(markdown).then(() => {
			if (typeof showStatus === 'function') {
				showStatus('Chat copied to clipboard', 'success');
			}
		}).catch(err => {
			console.error('Failed to copy to clipboard:', err);
		});
	}

	return markdown;
}

// Provider and model management functions
window.createProvider = function (providerData) {
	return new Promise((resolve, reject) => {
		if (!validateProviderData(providerData)) {
			return Promise.reject({ reason: 'Invalid provider data', data: providerData });
		}
		if (!db) return reject('DB not initialized');
		const transaction = db.transaction(['providers'], 'readwrite');
		const store = transaction.objectStore('providers');
		const request = store.add(providerData);
		request.onsuccess = () => resolve(providerData);
		request.onerror = (event) => reject(event.target.error);
	});
};

window.readProvider = function (providerId) {
	return new Promise((resolve, reject) => {
		if (!db) return reject('DB not initialized');
		const transaction = db.transaction(['providers', 'models'], 'readonly');
		const providerStore = transaction.objectStore('providers');
		const modelStore = transaction.objectStore('models');

		const providerRequest = providerStore.get(providerId);

		providerRequest.onsuccess = () => {
			const provider = providerRequest.result;
			if (!provider) {
				resolve(null);
				return;
			}

			const modelIndex = modelStore.index('providerId');
			const modelsRequest = modelIndex.getAll(providerId);

			modelsRequest.onsuccess = () => {
				provider.models = modelsRequest.result;
				resolve(provider);
			};
		};
		transaction.onerror = (event) => reject(event.target.error);
	});
};

window.updateProvider = function (providerId, providerData) {
	if (providerData.id !== providerId) {
		return Promise.reject('Provider ID mismatch');
	}
	return new Promise((resolve, reject) => {
		if (!db) return reject('DB not initialized');
		const transaction = db.transaction(['providers'], 'readwrite');
		const store = transaction.objectStore('providers');
		const dataToStore = { ...providerData };
		delete dataToStore.models; // Models are managed in their own store
		const request = store.put(dataToStore);
		request.onsuccess = () => resolve(providerData);
		request.onerror = (event) => reject(event.target.error);
	});
};

window.deleteProvider = function (providerId) {
	return new Promise((resolve, reject) => {
		if (!db) return reject('DB not initialized');
		const transaction = db.transaction(['providers', 'models'], 'readwrite');
		const providerStore = transaction.objectStore('providers');
		const modelStore = transaction.objectStore('models');

		providerStore.delete(providerId);

		const modelIndex = modelStore.index('providerId');
		const modelsRequest = modelIndex.openCursor(providerId);

		modelsRequest.onsuccess = () => {
			const cursor = modelsRequest.result;
			if (cursor) {
				modelStore.delete(cursor.primaryKey);
				cursor.continue();
			}
		};

		transaction.oncomplete = () => resolve(providerId);
		transaction.onerror = (event) => reject(event.target.error);
	});
};
// validateProviderData returns true if providerData is a proper config.RPChat.AIProvider object.
function validateProviderData(providerData) {
	if (!providerData || typeof providerData !== 'object') {
		return false;
	}
	const requiredKeys = ['id', 'displayName', 'apiFormat', 'endpoint', 'models'];
	for (const key of requiredKeys) {
		if (!providerData.hasOwnProperty(key)) {
			return false;
		}
	}
	if (!Array.isArray(providerData.models)) {
		return false;
	}
	return true;
}

// Revise createModel. It should read the provider object, append the model
// data to the models array, then update the provider.
window.createModel = async function (providerId, modelData) {
	if (!validateModelData(modelData)) {
		throw new Error('Invalid model data');
	}
	if (!db) throw new Error('DB not initialized');

	// 1. Read the provider
	const provider = await window.readProvider(providerId);
	if (!provider) {
		throw new Error(`Provider ${providerId} not found`);
	}

	// 2. Add the model to the models store
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(['models', 'providers'], 'readwrite');
		const modelStore = transaction.objectStore('models');
		const providerStore = transaction.objectStore('providers');

		const dataToAdd = { ...modelData, providerId: providerId };
		const modelRequest = modelStore.add(dataToAdd);

		modelRequest.onsuccess = () => {
			// 3. Update the provider's models array (though models are in their own store, 
			// the provider object we return should have the updated list)
			if (!provider.models) provider.models = [];
			provider.models.push(dataToAdd);

			// Note: updateProvider specifically deletes dataToStore.models, 
			// because models are managed in their own store. 
			// So we just need to ensure the model is in the models store.
			// The original TODO suggested updating the provider, but the 
			// current architecture keeps them separate. 
			// However, to satisfy the "update the provider" intent, 
			// we can trigger an update on the provider store even if it's redundant.

			const providerDataToStore = { ...provider };
			delete providerDataToStore.models;
			const providerRequest = providerStore.put(providerDataToStore);

			providerRequest.onsuccess = () => resolve(dataToAdd);
			providerRequest.onerror = (event) => reject(event.target.error);
		};
		modelRequest.onerror = (event) => reject(event.target.error);
	});
};

window.readModel = function (providerId, modelId) {
	return new Promise((resolve, reject) => {
		if (!db) return reject('DB not initialized');
		const transaction = db.transaction(['models'], 'readonly');
		const store = transaction.objectStore('models');
		const request = store.get(modelId);
		request.onsuccess = () => {
			const model = request.result;
			if (model && model.providerId === providerId) {
				resolve(model);
			} else {
				resolve(null);
			}
		};
		request.onerror = (event) => reject(event.target.error);
	});
};

window.updateModel = function (providerId, modelId, modelData) {
	if (modelData.id !== modelId) {
		return Promise.reject('Model ID mismatch');
	}
	return new Promise((resolve, reject) => {
		if (!db) return reject('DB not initialized');
		const transaction = db.transaction(['models'], 'readwrite');
		const store = transaction.objectStore('models');
		const dataToUpdate = { ...modelData, providerId: providerId };
		const request = store.put(dataToUpdate);
		request.onsuccess = () => resolve(dataToUpdate);
		request.onerror = (event) => reject(event.target.error);
	});
};

window.deleteModel = function (providerId, modelId) {
	return new Promise((resolve, reject) => {
		if (!db) return reject('DB not initialized');
		const transaction = db.transaction(['models'], 'readwrite');
		const store = transaction.objectStore('models');

		const getRequest = store.get(modelId);
		getRequest.onsuccess = () => {
			const model = getRequest.result;
			if (model && model.providerId === providerId) {
				const deleteRequest = store.delete(modelId);
				deleteRequest.onsuccess = () => resolve(modelId);
				deleteRequest.onerror = (event) => reject(event.target.error);
			} else if (model) {
				reject(`Model ${modelId} does not belong to provider ${providerId}`);
			} else {
				resolve(null); // Not found, but not an error for delete
			}
		};
		getRequest.onerror = (event) => reject(event.target.error);
	});
};

// validateModelData(modelData) returns true if modelData is a proper RPChat.config.AIModel object.
function validateModelData(modelData) {
	if (!modelData || typeof modelData !== 'object') {
		return false;
	}
	const requiredKeys = ['id', 'displayName', 'defaultTemperature'];
	for (const key of requiredKeys) {
		if (!modelData.hasOwnProperty(key)) {
			return false;
		}
	}
	return true;
}


// Database management
const DB_NAME = 'rpchatDB';
const DB_VERSION = 1; // Using a simple integer for IndexedDB version
let db;

function initDB() {
	return new Promise((resolve, reject) => {
		console.log('Opening database:', DB_NAME, 'version:', DB_VERSION);
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			console.log('Upgrading database...');

			// Create providers object store
			if (!db.objectStoreNames.contains('providers')) {
				const providersStore = db.createObjectStore('providers', { keyPath: 'id' });
				console.log('Created providers object store');
			}

			// Create models object store
			if (!db.objectStoreNames.contains('models')) {
				const modelsStore = db.createObjectStore('models', { keyPath: 'id' });
				modelsStore.createIndex('providerId', 'providerId', { unique: false });
				console.log('Created models object store and providerId index');
			}
		};

		request.onsuccess = (event) => {
			db = event.target.result;
			console.log('Database initialized successfully');
			resolve(db);
		};

		request.onerror = (event) => {
			console.error('Database error:', event.target.error);
			reject(event.target.error);
		};

		request.onblocked = (event) => {
			console.error('Database blocked - another connection may be open');
			reject(new Error('Database blocked'));
		};
	});
}


// Initialize application
async function init() { // Load saved state from sessionStorage
	try {
		await initDB();
	} catch (error) {
		showStatus('Failed to initialize database. Provider management will not work.', 'error');
	}
	loadStateFromStorage();

	// Set up UI elements based on configuration
	initializeUIElements();

	// Initialize ChatManager with system prompt
	initializeChatManager();
	window.RPChat.chatManager = chatManager;

	window.testProviderDBInterface = async function () {
		console.log("=== Testing Provider DB Interface ===");

		try {
			// 0. Save a copy of the DB
			console.log("Step 0: Saving DB backup...");
			const dbBackup = await backupDB();
			console.log("DB backup completed");

			// 1. Delete and recreate the DB
			console.log("Step 1: Recreating DB...");
			await deleteDB();
			await initDB();
			console.log("DB recreated");

			let testResults = [];

			// 2. Loop over the Providers in RPChat.config.PROVIDERS
			console.log("Step 2: Testing providers...");
			for (const [providerId, originalProvider] of window.RPChat.config.PROVIDERS) {
				console.log(`Testing provider: ${providerId}`);

				// Copy the provider and empty the models field
				const providerCopy = { ...originalProvider };
				const originalModels = [...providerCopy.models];
				providerCopy.models = []; // Empty models for provider creation

				try {
					// Create the provider in the DB using the copy
					await window.createProvider(providerCopy);
					console.log(`  Provider ${providerId} created`);

					// Create the models in the DB using the original provider's models
					for (const model of originalModels) {
						await window.createModel(providerId, model);
					}
					console.log(`  ${originalModels.length} models created for provider ${providerId}`);

					// 3. Read the provider from the DB
					const readProvider = await window.readProvider(providerId);
					if (!readProvider) {
						throw new Error(`Failed to read provider ${providerId} from DB`);
					}

					// Compare the read provider with the original
					const comparison = compareProviders(originalProvider, readProvider);
					testResults.push({
						providerId,
						success: comparison.success,
						differences: comparison.differences
					});

					if (comparison.success) {
						console.log(`  ✅ Provider ${providerId} test PASSED`);
					} else {
						console.log(`  ❌ Provider ${providerId} test FAILED:`);
						comparison.differences.forEach(diff => console.log(`    ${diff}`));
					}

				} catch (error) {
					console.error(`  ❌ Error testing provider ${providerId}:`, error);
					testResults.push({
						providerId,
						success: false,
						error: error.message
					});
				}
			}

			// 4. Delete the DB
			console.log("Step 4: Cleaning up test DB...");
			await deleteDB();

			// 5. Restore DB from saved copy
			console.log("Step 5: Restoring DB from backup...");
			await restoreDB(dbBackup);
			console.log("DB restored");

			// Report final results
			const successCount = testResults.filter(r => r.success).length;
			const totalCount = testResults.length;

			console.log("=== TEST RESULTS SUMMARY ===");
			console.log(`Total providers tested: ${totalCount}`);
			console.log(`Successful tests: ${successCount}`);
			console.log(`Failed tests: ${totalCount - successCount}`);

			if (successCount === totalCount) {
				console.log("🎉 ALL TESTS PASSED!");
				return "✅ All provider DB interface tests passed!";
			} else {
				console.log("❌ Some tests failed. Check detailed results above.");
				return `❌ ${totalCount - successCount} tests failed. Check console for details.`;
			}

		} catch (error) {
			console.error("❌ Test execution failed:", error);
			return `❌ Test execution failed: ${error.message}`;
		}
	};

	// Helper function to backup the entire database
	async function backupDB() {
		const backup = {
			providers: [],
			models: []
		};

		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['providers', 'models'], 'readonly');
			const providerStore = transaction.objectStore('providers');
			const modelStore = transaction.objectStore('models');

			// Backup providers
			const providerRequest = providerStore.getAll();
			providerRequest.onsuccess = () => {
				backup.providers = providerRequest.result;

				// Backup models
				const modelRequest = modelStore.getAll();
				modelRequest.onsuccess = () => {
					backup.models = modelRequest.result;
					resolve(backup);
				};
				modelRequest.onerror = () => reject(modelRequest.error);
			};
			providerRequest.onerror = () => reject(providerRequest.error);
		});
	}

	// Helper function to delete the database
	async function deleteDB() {
		return new Promise((resolve, reject) => {
			if (db) {
				db.close();
			}
			const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
			deleteRequest.onsuccess = () => resolve();
			deleteRequest.onerror = () => reject(deleteRequest.error);
		});
	}

	// Helper function to restore database from backup
	async function restoreDB(backup) {
		// First ensure DB is initialized
		await initDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['providers', 'models'], 'readwrite');
			const providerStore = transaction.objectStore('providers');
			const modelStore = transaction.objectStore('models');

			// Restore providers
			for (const provider of backup.providers) {
				providerStore.put(provider);
			}

			// Restore models
			for (const model of backup.models) {
				modelStore.put(model);
			}

			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
	}

	// Helper function to compare providers
	function compareProviders(original, fromDB) {
		const differences = [];

		// Check basic fields
		const fieldsToCheck = ['id', 'displayName', 'apiFormat', 'endpoint'];
		for (const field of fieldsToCheck) {
			if (original[field] !== fromDB[field]) {
				differences.push(`${field}: expected '${original[field]}', got '${fromDB[field]}'`);
			}
		}

		// Check models array
		if (!Array.isArray(fromDB.models)) {
			differences.push(`models: expected array, got ${typeof fromDB.models}`);
		} else {
			if (original.models.length !== fromDB.models.length) {
				differences.push(`models length: expected ${original.models.length}, got ${fromDB.models.length}`);
			} else {
				// Sort both arrays by ID to ensure consistent comparison
				const origModelsSorted = [...original.models].sort((a, b) => a.id.localeCompare(b.id));
				const dbModelsSorted = [...fromDB.models].sort((a, b) => a.id.localeCompare(b.id));

				// Check each model
				for (let i = 0; i < origModelsSorted.length; i++) {
					const origModel = origModelsSorted[i];
					const dbModel = dbModelsSorted[i];

					const modelFields = ['id', 'displayName', 'defaultTemperature'];
					for (const field of modelFields) {
						if (origModel[field] !== dbModel[field]) {
							differences.push(`model '${origModel.id}' ${field}: expected '${origModel[field]}', got '${dbModel[field]}'`);
						}
					}
				}
			}
		}

		return {
			success: differences.length === 0,
			differences
		};
	}
	console.log("Test function added! Run window.testProviderDBInterface() in console to test.");

	// Attach event listeners
	attachEventListeners();

	// Initialize import/export functionality
	initImportExport();

	// Show initialization status
	showStatus('Application initialized');

}

// Set up import/export functionality
function initImportExport() {
	// Set up the import/export functionality
	RPChat.importExport.setupImportExport(
		() => chatManager,               // Pass a getter for the entire chatManager object
		showStatus                       // Function to show status messages
	);
}

// Load state from local and session storage
function loadStateFromStorage() {
	// Init fallback values using first item from PROVIDERS
	const firstProvider = Array.from(window.RPChat.config.PROVIDERS.values())[0];
	const firstProviderKey = Array.from(window.RPChat.config.PROVIDERS.keys())[0];
	const fp = firstProviderKey
	const fm = firstProvider.models[0].id;
	const tmp = firstProvider.models[0].defaultTemperature;
	try {
		// Keep API keys are in localStorage for sharing across tabs
		apiKeys = JSON.parse(localStorage.getItem('apiKeys')) || {};

		// We use sessionStorage for everything else
		currentProvider = sessionStorage.getItem('apiProvider') || fp;

		selectedModelId = sessionStorage.getItem('selectedModelId') || fm;
		null;
		temperature = sessionStorage.getItem('temperature') ?
			parseFloat(sessionStorage.getItem('temperature')) :
			tmp;
	} catch (error) {
		showStatus('Error loading state from storage:', 'error');
	}
}

// Initialize UI elements based on configuration
function initializeUIElements() {
	// Set up provider selector
	populateProviderSelector();

	// Set up model selector for the current provider
	updateModelSelector();

	// Set up system prompt selector
	updateSystemPromptSelector();

	// Load API key if available
	if (apiKeys[getProvider().apiKeyName]) {
		El.apiKeyInput.value = '********'; // Show masked value
	}

	// Set temperature value if not set and a model is selected
	if (temperature === null && selectedModelId) {
		const model = getProvider().getModel(selectedModelId);
		if (model) {
			temperature = model.defaultTemperature;
		}
	}

	if (temperature !== null) {
		El.temperatureInput.value = temperature;
	}
}

// Initialize ChatManager
function initializeChatManager() {

	// Create ChatManager with system prompt and notification handler
	chatManager = new ChatManager(
		getCurrentSystemPrompt(),
		showStatus,
		El.chatContainer,
		onChatUpdate
	);
	window.RPChat.chatManager = chatManager;

	// Try to load saved messages from sessionStorage
	try {
		const savedMessages = sessionStorage.getItem('chatMessages');
		if (savedMessages) {
			chatManager.parseMessagesJSON(savedMessages);
		}
	} catch (error) {
		console.error('Error loading saved messages:', error);
		showStatus('Failed to load saved chat messages', 'error');
	}

	// Render the chat
	chatManager.render();

	// Scroll to the bottom to show messages
	scrollToBottom();
}

// Callback for when chat is updated
function onChatUpdate() {
	// Save messages to sessionStorage
	const messagesJSON = chatManager.getMessagesJSON();
	sessionStorage.setItem('chatMessages', JSON.stringify(messagesJSON));

	// Enable/disable send button based on edit state and content
	updateSendButtonState();
}

// Update send button state based on trailing message state
function updateSendButtonState() {
	if (!El.sendButton) return;

	const trailingMessage = chatManager.getTrailingUserMessage();

	// Disable send button if:
	// 1. Any message is being edited (besides trailing user message)
	// 2. The trailing message doesn't exist, is empty, or not being/just been edited
	const hasClosedEmptyFinalPrompt = trailingMessage && !trailingMessage.isBeingEdited() && trailingMessage.content.trim() === '';

	const hasOtherActiveEdits = chatManager.messages.some(message => message !== trailingMessage && message.isBeingEdited());

	if (hasOtherActiveEdits) {
		El.sendButton.disabled = true;
		El.sendLabel.textContent = "One or more messages are being edited";
	} else if (hasClosedEmptyFinalPrompt) {
		El.sendButton.disabled = true;
		El.sendLabel.textContent = "Final prompt is empty";
	}
	else {
		El.sendButton.disabled = false;
		El.sendLabel.textContent = "Ready"
	}
}

// Populate provider selector dropdown
function populateProviderSelector() {
	El.apiProviderSelector.innerHTML = '';

	window.RPChat.config.PROVIDERS.forEach((provider, id) => {
		const option = document.createElement('option');
		option.value = id;
		option.textContent = provider.displayName;
		El.apiProviderSelector.appendChild(option);
	});

	El.apiProviderSelector.value = currentProvider;
}

// Update model selector based on current provider
function updateModelSelector() {
	El.modelSelector.innerHTML = '';

	const provider = getProvider();
	if (!provider) return;

	provider.models.forEach(model => {
		const option = document.createElement('option');
		option.value = model.id;
		option.textContent = model.displayName;
		El.modelSelector.appendChild(option);
	});

	// Set selected model
	if (selectedModelId && provider.getModel(selectedModelId)) {
		El.modelSelector.value = selectedModelId;
	} else {
		// Select first model by default
		selectedModelId = provider.models[0]?.id;
		El.modelSelector.value = selectedModelId;
	}

	// Update temperature based on selected model
	updateTemperature();
}

// Update temperature input based on selected model
function updateTemperature() {
	if (!selectedModelId) return;

	const model = getProvider().getModel(selectedModelId);
	if (!model) return;

	if (temperature === null) {
		temperature = model.defaultTemperature;
		El.temperatureInput.value = temperature;
	}
}

// Get current provider object
function getProvider() {
	return window.RPChat.config.PROVIDERS.get(currentProvider);
}

// Attach event listeners to UI elements
function attachEventListeners() {
	// Provider selection
	El.apiProviderSelector.addEventListener('change', handleProviderChange);

	// API key management
	El.saveKeyBtn.addEventListener('click', handleSaveApiKey);

	// Model selection
	El.modelSelector.addEventListener('change', handleModelChange);

	// System prompt selection
	El.systemPromptSelector.addEventListener('change', updateSystemPrompt);

	// Temperature control - apply debouncing (300ms delay)
	El.temperatureInput.addEventListener('input', debounce(handleTemperatureChange, 300));

	// Send button
	El.sendButton.addEventListener('click', handleSendMessage);

	// Clear chat
	El.clearChatBtn.addEventListener('click', handleClearChat);

	// Scroll buttons
	if (El.scrollTopBtn) {
		El.scrollTopBtn.addEventListener('click', () => {
			if (El.chatContainer) {
				El.chatContainer.scrollTo({ top: 0, behavior: 'smooth' });
			}
		});
	}
	if (El.scrollBottomBtn) {
		El.scrollBottomBtn.addEventListener('click', () => {
			if (El.chatContainer) {
				El.chatContainer.scrollTo({ top: El.chatContainer.scrollHeight, behavior: 'smooth' });
			}
		});
	}

	// Add a mutation observer to detect changes to the chat container
	// This helps update the send button state when edits start/end
	if (El.chatContainer) {
		const observer = new MutationObserver(() => {
			updateSendButtonState();
		});
		observer.observe(El.chatContainer, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['contenteditable']
		});
	}

	// Initial button state
	updateSendButtonState();

}

// Handle provider change
function handleProviderChange(event) {
	currentProvider = event.target.value;
	sessionStorage.setItem('apiProvider', currentProvider);

	// Update model selector for new provider
	updateModelSelector();

	// Update API key input
	if (apiKeys[getProvider().apiKeyName]) {
		El.apiKeyInput.value = '********'; // Masked
	} else {
		El.apiKeyInput.value = '';
	}

	showStatus(`Provider changed to ${getProvider().displayName}`);
}

// Handle saving API key
function handleSaveApiKey() {
	const apiKey = El.apiKeyInput.value.trim();

	if (!apiKey) {
		showStatus('Please enter an API key', 'error');
		return;
	}

	const keyName = getProvider().apiKeyName;

	// Don't overwrite if user just sees the masked value
	if (apiKey !== '********') {
		apiKeys[keyName] = apiKey;
		localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
		El.apiKeyInput.value = '********'; // Mask after saving
	}

	showStatus('API key saved successfully');
}

// Handle model change
function handleModelChange(event) {
	selectedModelId = event.target.value;
	sessionStorage.setItem('selectedModelId', selectedModelId);

	// Update temperature with model default
	const model = getProvider().getModel(selectedModelId);
	if (model) {
		temperature = model.defaultTemperature;
		El.temperatureInput.value = temperature;
		sessionStorage.setItem('temperature', temperature);
	}

	showStatus(`Model changed to ${model?.displayName || selectedModelId}`);
}

// Handle temperature change
function handleTemperatureChange(event) {
	temperature = parseFloat(event.target.value);
	sessionStorage.setItem('temperature', temperature);
}

// Handle send button click
function handleSendMessage() {
	const trailingMessage = chatManager.getTrailingUserMessage();

	// Check if any message is being edited (other than the trailing one)
	const hasOtherActiveEdits = chatManager.messages.some(message => message !== trailingMessage && message.isBeingEdited());

	if (hasOtherActiveEdits) {
		showStatus('Please save or cancel any active edits before sending', 'error');
		return;
	}

	if (!trailingMessage || trailingMessage.content.trim() === '') {
		showStatus('Please enter a message before sending', 'error');
		return;
	}

	// If the trailing message is still in edit mode, save it first
	if (trailingMessage.isBeingEdited()) {
		trailingMessage.saveEdit();
	}

	sendMessage(trailingMessage.content);
}

// Send message to API
function sendMessage(content) {
	if (isProcessing) return;

	if (!content || content.trim() === '') {
		showStatus('Cannot send empty message', 'error');
		return;
	}

	const provider = getProvider();
	const apiKey = apiKeys[provider.apiKeyName];

	if (!apiKey) {
		showStatus('Please enter and save an API key first', 'error');
		return;
	}

	// Start processing
	isProcessing = true;
	El.sendButton.disabled = true;
	showStatus('Processing...');

	// Get messages for API (ChatManager gives us properly formatted messages)
	const apiMessages = chatManager.getMessagesJSON();

	// Call API
	callAPI(apiMessages);
}

// Call AI provider API
function callAPI(apiMessages) {
	const provider = getProvider();
	const apiKey = apiKeys[provider.apiKeyName];
	// Start the timer when API call begins
	const startTime = Date.now();
	const timerInterval = setInterval(() => {
		if (!isProcessing) {
			clearInterval(timerInterval);
			return;
		}
		const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
		El.sendLabel.textContent = `Waiting for response... ${elapsedSeconds.toString().padStart(2, '0')}`;
	}, 1000);

	// Prepare request body
	const requestBody = provider.prepareRequestBody(
		selectedModelId,
		apiMessages,
		null, // use default max tokens
		temperature
	);

	// Prepare endpoint and make API call
	let endpoint = provider.endpoint;
	if (provider.apiFormat === 'gemini-native') {
		// Replace {{model}} placeholder with actual model ID
		endpoint = endpoint.replace('{{model}}', selectedModelId);
		// Add API key as URL parameter
		endpoint += `?key=${apiKey}`;

		// Make API call without authorization header for Gemini
		window.RPChat.api.sendGeminiRequest(
			endpoint,
			requestBody,
			(response) => handleApiResponse(response, requestBody),
			handleApiError
		);
	} else {
		// Use standard OpenAI-compatible API
		window.RPChat.api.sendRequest(
			endpoint,
			apiKey,
			requestBody,
			(response) => handleApiResponse(response, requestBody),
			handleApiError
		);
	}
}

// Handle successful API response
function handleApiResponse(response, requestBody) {
	isProcessing = false;
	El.sendButton.disabled = false;

	try {
		// Check finish_reason and log if not 'stop'
		let finishReason = null;

		// For Gemini native API format:
		if (response.candidates && response.candidates[0] && response.candidates[0].finishReason) {
			finishReason = response.candidates[0].finishReason;
		}
		// For OpenAI/Together.ai standard format:
		else if (response.choices && response.choices[0] && response.choices[0].finish_reason) {
			finishReason = response.choices[0].finish_reason;
		}

		if (finishReason && finishReason !== 'STOP' && finishReason !== 'stop') {
			console.log('Non-stop finish_reason detected:', finishReason);
			console.log('Request body:', requestBody);
		}

		// Extract AI response content
		const responseContent = window.RPChat.api.extractResponseContent(response);

		// Calculate where the new content will appear before adding it
		let targetScrollTop = undefined;
		if (El.chatContainer && chatManager.storyMessage && chatManager.storyMessage.element) {
			const storyContentEl = chatManager.storyMessage.element.querySelector('.editable-content');
			if (storyContentEl) {
				const containerRect = El.chatContainer.getBoundingClientRect();
				const contentRect = storyContentEl.getBoundingClientRect();
				// The bottom of the current text will be the top of the new text.
				// We subtract 40px so a little bit of the old text remains visible for context.
				targetScrollTop = El.chatContainer.scrollTop + (contentRect.bottom - containerRect.top) - 40;
			}
		}

		// Merge user prompt into story if it's not a dummy '?' or empty
		const currentPrompt = chatManager.getTrailingUserMessage().content;
		if (currentPrompt && currentPrompt !== '?') {
			chatManager.addMessage(ROLES.ASSISTANT, currentPrompt);
		}

		// Add assistant message using ChatManager
		chatManager.addMessage(ROLES.ASSISTANT, responseContent);

		// Clear the prompt area
		chatManager.clearPrompt();

		// Explicitly render the chat to update the UI
		chatManager.render();

		// Scroll to the top of the new content
		if (targetScrollTop !== undefined && targetScrollTop > 0) {
			El.chatContainer.scrollTo({
				top: targetScrollTop,
				behavior: 'smooth'
			});
		} else {
			scrollToTopOfLastAssistantMessage();
		}

		const tokenInfo = window.RPChat.api.getTokenUsageString(response);
		showStatus(tokenInfo || 'Response received', 'token-count');
	} catch (error) {
		handleApiError(error);
	}
}

// Handle API errors
function handleApiError(error) {
	isProcessing = false;
	El.sendButton.disabled = false;

	console.error('API Error:', error);

	// Create app message for error
	chatManager.addMessage(ROLES.APP, `Error: ${error.message || 'Unknown error occurred'}`);

	// Explicitly render the chat to update the UI
	chatManager.render();

	// Scroll to the bottom to show new message
	scrollToBottom();

	showStatus('Error occurred while calling API', 'error');
}

// Handle clear chat button
function handleClearChat() {
	if (confirm('Are you sure you want to clear the chat history?')) {
		// Reset system prompt selector to first option
		El.systemPromptSelector.selectedIndex = 0;

		// Clear the 3 containers directly using ChatManager's new method
		chatManager.clear();

		// Clear sessionStorage (except system prompt and settings)
		sessionStorage.removeItem('chatMessages');

		chatManager._notifyUpdate();
	}
	showStatus('Chat cleared');
}

// Show status message and use as notification handler for ChatManager
function showStatus(message, type = 'info') {
	if (!El.statusMessage) return;
	console.log('status message:', message)

	El.statusMessage.textContent = message;
	El.statusMessage.className = type;

	/*
	// Leave the message visible for token counts and error
	if (type == 'error' || type=='token-count') {
		return;
	}
	// Otherwise, auto-clear after a delay
	let timeout = 10000;
	if (type === 'success') {
		timeout = 500; // just a quick acknowledgement
	}
	setTimeout(() => {
		if (El.statusMessage) {
			El.statusMessage.textContent = '';
			El.statusMessage.className = '';
			console.log('status message cleared')
		}
	}, timeout);
	*/
}

// Initialize the application
function initializeApp() {
	// Wait for DOM to be fully loaded
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
}

// Header toggle functionality
function initHeaderToggle() {
	// Check if we're on mobile
	function isMobile() {
		return window.innerWidth <= 768;
	}

	// Set initial state based on screen size
	function setInitialHeaderState() {
		if (isMobile()) {
			El.headerContent.classList.remove('expanded');
			El.headerToggle.setAttribute('aria-expanded', 'false');
		} else {
			El.headerContent.classList.add('expanded');
			El.headerToggle.setAttribute('aria-expanded', 'true');
		}
		// Gear icon stays the same regardless of state
		El.headerToggle.textContent = '⚙️';
	}

	// Toggle header content
	function toggleHeader() {
		const isExpanded = El.headerContent.classList.contains('expanded');

		if (isExpanded) {
			El.headerContent.classList.remove('expanded');
			El.headerToggle.setAttribute('aria-expanded', 'false');
		} else {
			El.headerContent.classList.add('expanded');
			El.headerToggle.setAttribute('aria-expanded', 'true');
		}
		// Gear icon stays the same regardless of state
		El.headerToggle.textContent = '⚙️';
	}

	// Add event listeners
	El.headerToggle.addEventListener('click', toggleHeader);

	// Handle window resize
	window.addEventListener('resize', setInitialHeaderState);

	// Set initial state
	setInitialHeaderState();
}

// Initialize header toggle
initHeaderToggle();

// Call initialization
initializeApp();

// Utility function to scroll to the top of the last assistant message
function scrollToTopOfLastAssistantMessage() {
	if (El.chatContainer) {
		const assistantMessages = El.chatContainer.querySelectorAll('.assistant-message');
		if (assistantMessages.length > 0) {
			const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
			const containerRect = El.chatContainer.getBoundingClientRect();
			const messageRect = lastAssistantMessage.getBoundingClientRect();

			// Calculate the scroll amount needed to bring the message's top to the container's top.
			const scrollAmount = El.chatContainer.scrollTop + (messageRect.top - containerRect.top);

			El.chatContainer.scrollTo({
				top: scrollAmount,
				behavior: 'smooth'
			});
		}
	}
}

// Utility function to scroll chat container to bottom
function scrollToBottom() {
	if (El.chatContainer) {
		El.chatContainer.scrollTop = El.chatContainer.scrollHeight;
	}
}
