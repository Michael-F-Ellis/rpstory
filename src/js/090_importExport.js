/* IMPORT EXPORT */
window.RPChat = window.RPChat || {};
window.RPChat.importExport = (function () {
	// Function to export chat data
	function exportChat(messages) {
		const chatData = {
			messages: messages, // Just export the data, not the full objects
			exportDate: new Date().toISOString()
		};

		const dataStr = JSON.stringify(chatData, null, 2);
		const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

		const exportFileDefaultName = `rpchat-export-${new Date().toISOString().slice(0, 10)}.json`;

		const linkElement = document.createElement('a');
		linkElement.setAttribute('href', dataUri);
		linkElement.setAttribute('download', exportFileDefaultName);
		linkElement.click();
	}

	// Function to set up import/export UI elements using existing buttons
	function setupImportExport(getChatManager, showStatus) {
		// Get references to existing buttons in the footer
		const exportBtn = document.getElementById('export-chat');
		const importBtn = document.getElementById('import-chat');
		const extractBtn = document.getElementById('extract-chat-md');

		// Create a hidden file input for import
		const importInput = document.createElement('input');
		importInput.type = 'file';
		importInput.id = 'import-input';
		importInput.accept = '.json';
		importInput.style.display = 'none';
		document.body.appendChild(importInput);

		// Add event listeners to the existing buttons
		if (exportBtn) {
			exportBtn.addEventListener('click', () => {
				const chatManager = getChatManager();
				exportChat(chatManager.getMessagesJSON());
			});
		} else {
			console.error('Export button not found in the DOM');
		}

		if (importBtn) {
			importBtn.addEventListener('click', () => importInput.click());
		} else {
			console.error('Import button not found in the DOM');
		}

		// New logic for story extraction (no modal)
		if (extractBtn) {
			extractBtn.addEventListener('click', () => {
				// Only include assistant messages (the story) without labels
				const markdownContent = window.extractChatToMarkdown(true, false, false, false);

				if (markdownContent) {
					const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(markdownContent);
					const exportFileDefaultName = `rpstory-${new Date().toISOString().slice(0, 10)}.txt`;

					const linkElement = document.createElement('a');
					linkElement.setAttribute('href', dataUri);
					linkElement.setAttribute('download', exportFileDefaultName);
					linkElement.click();
				}
			});
		} else {
			console.error('Extract button not found in the DOM');
		}

		importInput.addEventListener('change', (event) => {
			const file = event.target.files[0];
			if (file) {
				const reader = new FileReader();

				reader.onload = function (e) {
					try {
						const importedData = JSON.parse(e.target.result);

						// Basic validation
						if (!importedData || !Array.isArray(importedData.messages)) {
							throw new Error('Invalid chat file format.');
						}

						// Clean, robust import workflow with the new 3-container paradigm
						const globalChatManager = getChatManager();

						// Save the imported system prompt to sessionStorage
						// Parse checks first to pull the imported system message correctly
						const systemMessage = importedData.messages.find(msg => msg.role === 'system');
						if (systemMessage) {
							sessionStorage.setItem('importedSystemPrompt', systemMessage.content);
							El.systemPromptSelector.value = 'imported';
						}

						// Let the manager parse and distribute the text contents
						globalChatManager.parseMessagesJSON(importedData.messages);

						// Persist changes
						sessionStorage.setItem('chatMessages', JSON.stringify(globalChatManager.getMessagesJSON()));

						// Update the system prompt selector to include the "Imported" option
						updateSystemPromptSelector();

						// Render the chat (in case parsing missed anything)
						globalChatManager.render();

						showStatus('Chat imported successfully', 'success');

					} catch (error) {
						console.error('Error importing chat:', error);
						showStatus(`Error importing chat: ${error.message}`, 'error');
					} finally {
						// Reset the input value to allow importing the same file again
						importInput.value = '';
					}
				};

				reader.onerror = function () {
					showStatus('Error reading file', 'error');
					// Reset the input value
					importInput.value = '';
				};

				reader.readAsText(file);
			}
		});
	}

	return {
		setupImportExport: setupImportExport,
		exportChat: exportChat
	};
})();
