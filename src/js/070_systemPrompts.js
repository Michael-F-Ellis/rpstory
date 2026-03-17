// {{SYSTEM_PROMPTS_PLACEHOLDER}}

// Function to update the system prompt selector dropdown
function updateSystemPromptSelector() {
	const selector = El.systemPromptSelector;
	if (!selector) return;

	// Clear existing options
	selector.innerHTML = '';

	// Add options for each system prompt
	systemPrompts.forEach((prompt, index) => {
		const option = document.createElement('option');
		option.value = index;
		option.textContent = prompt.name;
		selector.appendChild(option);
	});

	// Check if there's an imported system prompt in sessionStorage
	const importedPrompt = sessionStorage.getItem('importedSystemPrompt');
	if (importedPrompt) {
		const importedOption = document.createElement('option');
		importedOption.value = 'imported';
		importedOption.textContent = 'Imported';
		selector.appendChild(importedOption);
	}

	// Restore the previously selected system prompt option or default to first
	const savedSelection = sessionStorage.getItem('selectedSystemPrompt');
	if (savedSelection === 'imported' && importedPrompt) {
		selector.value = 'imported';
	} else if (savedSelection && systemPrompts[parseInt(savedSelection)]) {
		selector.value = savedSelection;
	} else if (systemPrompts.length > 0) {
		selector.selectedIndex = 0;
	}
}

// Function to get the current system prompt content
function getCurrentSystemPrompt() {
	const selector = El.systemPromptSelector;
	if (!selector) return 'You are a helpful assistant.';

	const selectedValue = selector.value;

	// Check if "Imported" is selected
	if (selectedValue === 'imported') {
		const importedPrompt = sessionStorage.getItem('importedSystemPrompt');
		return importedPrompt || 'You are a helpful assistant.';
	}

	// Otherwise use the standard system prompts
	const selectedIndex = parseInt(selectedValue) || 0;
	return systemPrompts[selectedIndex]?.content || 'You are a helpful assistant.';
}

// Function to update the system prompt when selector changes
function updateSystemPrompt() {
	// Save the selected system prompt option to sessionStorage
    if (El.systemPromptSelector) {
	    sessionStorage.setItem('selectedSystemPrompt', El.systemPromptSelector.value);
    }
    
    // In SingleText mode, we don't have a visible system message to update in the editor.
    // The processor will pick up the current selection when it calls getCurrentSystemPrompt().
    
	showStatus(`System prompt updated to: ${systemPrompts[El.systemPromptSelector.value]?.name || 'Imported'}`);
}