// Main application code for RPChat using ChatManager and ChatMessage components

// Define state variables
window.RPChat = window.RPChat || {};
let apiKeys = {};
let currentProvider = null;
let selectedModelId = null;
let temperature = null;
let isProcessing = false;
let storyManager = null;
let processor = null;

const MARGIN = 20; // Example, but let's just remove the block

/**
 * Extracts the current chat to a Markdown formatted string.
 * This function is available on the window object for console access.
 * @param {boolean} [assistant=true] - Include assistant messages.
 * @param {boolean} [user=true] - Include user messages.
 * @param {boolean} [system=false] - Include system messages.
 * @param {boolean} [labels=false] - Add role labels to each message.
 * @returns {string} The chat content in Markdown format.
 */
window.extractChatToMarkdown = function () {
	if (!storyManager) {
		console.error("StoryManager not initialized.");
		return "Error: StoryManager not found.";
	}

	const markdown = storyManager.getContent();

	// For easy copying, log to console, copy to clipboard, and return
	console.log(markdown);
	if (navigator.clipboard) {
		navigator.clipboard.writeText(markdown).then(() => {
			if (typeof showStatus === 'function') {
				showStatus('Story copied to clipboard', 'success');
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
async function initializeApp() { 
	try {
		await initDB();
	} catch (error) {
		showStatus('Failed to initialize database. Provider management will not work.', 'error');
	}
	loadStateFromStorage();

	// Set up UI elements based on configuration
	initializeUIElements();

	// Initialize StoryManager
	storyManager = new StoryManager(El.storyEditor, () => {
        // Save to storage on every update (debounced if needed, but StoryManager does it)
        sessionStorage.setItem('storyContent', storyManager.getContent());
    });
	window.RPChat.storyManager = storyManager;

    // Load saved story content
    const savedStory = sessionStorage.getItem('storyContent');
    if (savedStory) {
        storyManager.setContent(savedStory);
    }

    // Initialize Processor
    processor = new IterativePromptProcessor(window.RPChat.api, window.RPChat.config);

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
	El.sendButton.addEventListener('click', handleProcessStory);

	// Clear story
	El.clearStoryBtn.addEventListener('click', handleClearStory);

	// Scroll buttons
	if (El.scrollTopBtn) {
		El.scrollTopBtn.addEventListener('click', () => {
			if (El.storyEditor) {
				El.storyEditor.scrollTo({ top: 0, behavior: 'smooth' });
			}
		});
	}
	if (El.scrollBottomBtn) {
		El.scrollBottomBtn.addEventListener('click', () => {
			if (El.storyEditor) {
				El.storyEditor.scrollTo({ top: El.storyEditor.scrollHeight, behavior: 'smooth' });
			}
		});
	}

	// Toggle System Prompt Modal
	if (El.toggleSystemPromptBtn) {
		El.toggleSystemPromptBtn.addEventListener('click', handleToggleSystemPrompt);
	}
	if (El.closeSystemPromptBtn) {
		El.closeSystemPromptBtn.addEventListener('click', handleCloseSystemPrompt);
	}

	// Initial button state (could be simplified)
    if (El.sendButton) El.sendButton.disabled = false;
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
// Handle send button click - Unified for SingleText mode
async function handleProcessStory() {
    if (isProcessing) return;

    const storyText = storyManager.getContent();
    
    // Check for syntax errors first
    const { prompts, errors } = processor.parseStory(storyText);
    if (errors.length > 0) {
        showStatus(errors.join('\n'), 'error');
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
    showStatus('Processing story...');

    const options = {
        provider: currentProvider,
        model: selectedModelId,
        temperature: temperature,
        systemPrompt: getCurrentSystemPrompt(),
        apiKey: apiKey
    };

    const onProgress = (data) => {
        // Update story editor with changes
        storyManager.setContent(data.updatedText);
        showStatus(`Processed prompt. ${data.response.length} chars added.`, 'success');
        scrollToBottom();
    };

    const onTotalError = (err) => {
        isProcessing = false;
        El.sendButton.disabled = false;
        showStatus(err, 'error');
    };

    if (prompts.length > 0) {
        await processor.processPrompts(storyText, options, onProgress, onTotalError);
    } else {
        // Continue from end logic
        await processor.continueStory(storyText, options, onProgress, onTotalError);
    }

    isProcessing = false;
    El.sendButton.disabled = false;
    showStatus('Story development complete.', 'success');
    scrollToBottom();
}

// Handle API errors
function handleApiError(error) {
	isProcessing = false;
	El.sendButton.disabled = false;

	console.error('API Error:', error);

	// Show status message for error
	showStatus(`Error: ${error.message || 'Unknown error occurred'}`, 'error');

	// Scroll to the bottom to show status if needed
	scrollToBottom();
}

// Handle clear story button
function handleClearStory() {
	if (confirm('Are you sure you want to clear the story text?')) {
		storyManager.setContent('');
		sessionStorage.removeItem('storyContent');
	}
	showStatus('Story cleared');
}

// Handle system prompt toggle (Modal)
function handleToggleSystemPrompt() {
    if (!El.systemPromptModal || !El.systemPromptText) return;
    
    // Populate with current prompt before showing
    El.systemPromptText.value = getCurrentSystemPrompt();
    El.systemPromptModal.style.display = 'flex';
}

function handleCloseSystemPrompt() {
    if (!El.systemPromptModal || !El.systemPromptText) return;
    
    const newPrompt = El.systemPromptText.value.trim();
    if (newPrompt) {
        sessionStorage.setItem('storySystemPrompt', newPrompt);
        showStatus('System prompt updated for this story', 'success');
    } else {
        sessionStorage.removeItem('storySystemPrompt');
        showStatus('System prompt reset to default', 'info');
    }
    
    El.systemPromptModal.style.display = 'none';
}

// Show status message and use as notification handler for ChatManager
// Utility function to show status messages and use as notification handler for ChatManager
function showStatus(message, type = 'info') {
	if (!El.statusMessage) return;
	console.log('status message:', message)

	El.statusMessage.textContent = message;
	El.statusMessage.className = type;
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

try {
    // Initialize header toggle
    initHeaderToggle();

    // Call initialization
    initializeApp();

} catch (e) {
    console.error("Critical initialization error:", e);
    const statusEl = document.getElementById('status-message');
    if (statusEl) statusEl.textContent = "Init Error: " + e.message;
}

// Utility function to scroll story editor to bottom
function scrollToBottom() {
	if (El.storyEditor) {
		El.storyEditor.scrollTop = El.storyEditor.scrollHeight;
	}
}
