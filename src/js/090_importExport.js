/* IMPORT EXPORT */
window.RPChat = window.RPChat || {};
window.RPChat.importExport = (function () {
	// Function to export story data
	function exportStory(content, systemPrompt) {
		let finalContent = content;
		if (systemPrompt && systemPrompt.trim()) {
			finalContent = `{{SYSTEM ${systemPrompt.trim()}}}\n\n` + content;
		}

		const storyData = {
			storyContent: finalContent,
			exportDate: new Date().toISOString(),
            format: 'singletext'
		};

		const dataStr = JSON.stringify(storyData, null, 2);
		const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

		const exportFileDefaultName = `rpstory-export-${new Date().toISOString().slice(0, 10)}.json`;

		const linkElement = document.createElement('a');
		linkElement.setAttribute('href', dataUri);
		linkElement.setAttribute('download', exportFileDefaultName);
		linkElement.click();
	}

	// Function to set up import/export UI elements
	function setupImportExport(showStatus) {
		const exportBtn = document.getElementById('export-chat');
		const importBtn = document.getElementById('import-chat');
		const extractBtn = document.getElementById('extract-chat-md');

		const importInput = document.createElement('input');
		importInput.type = 'file';
		importInput.id = 'import-input';
		importInput.accept = '.json';
		importInput.style.display = 'none';
		document.body.appendChild(importInput);

		if (exportBtn) {
			exportBtn.addEventListener('click', () => {
				const content = window.RPChat.storyManager.getContent();
				const systemPrompt = typeof getCurrentSystemPrompt === 'function' ? getCurrentSystemPrompt() : '';
				exportStory(content, systemPrompt);
			});
		}

		if (importBtn) {
			importBtn.addEventListener('click', () => importInput.click());
		}

		if (extractBtn) {
			extractBtn.addEventListener('click', () => {
				const content = window.extractChatToMarkdown();
				if (content) {
					const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
					const exportFileDefaultName = `rpstory-${new Date().toISOString().slice(0, 10)}.txt`;
					const linkElement = document.createElement('a');
					linkElement.setAttribute('href', dataUri);
					linkElement.setAttribute('download', exportFileDefaultName);
					linkElement.click();
				}
			});
		}

		importInput.addEventListener('change', (event) => {
			const file = event.target.files[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = function (e) {
					try {
						const importedData = JSON.parse(e.target.result);
                        let finalContent = '';

						// Detect format
						if (importedData.format === 'singletext') {
							finalContent = importedData.storyContent;
						} else if (Array.isArray(importedData.messages)) {
							// LEGACY MIGRATION
                            showStatus('Migrating legacy chat format...', 'info');
                            
                            // 1. Extract system prompt if present
                            const systemMsg = importedData.messages.find(m => m.role === 'system');
                            let systemBlock = '';
                            if (systemMsg && systemMsg.content) {
                                systemBlock = `{{SYSTEM ${systemMsg.content.trim()}}}\n\n`;
                            }

                            // 2. Flatten user/assistant messages
                            const storyText = importedData.messages
                                .filter(m => m.role === 'user' || m.role === 'assistant')
                                .map(m => m.content.trim())
                                .filter(c => c.length > 0 && c !== '?')
                                .join('\n\n');
                            
                            finalContent = systemBlock + storyText;
						} else {
							throw new Error('Unrecognized file format.');
						}

                        // NEW: Extract system prompt from finalContent if present (at the very beginning)
                        const systemRegex = /^\{\{\s*SYSTEM([\s\S]*?)\}\}\n*/i;
                        const match = finalContent.match(systemRegex);
                        if (match) {
                            const extractedSystem = match[1].trim();
                            sessionStorage.setItem('storySystemPrompt', extractedSystem);
                            finalContent = finalContent.replace(systemRegex, '');
                            showStatus('Extracted system prompt from imported file', 'info');
                        }

						window.RPChat.storyManager.setContent(finalContent);
						sessionStorage.setItem('storyContent', finalContent);
						showStatus('Story imported successfully', 'success');

					} catch (error) {
						console.error('Error importing:', error);
						showStatus(`Error importing: ${error.message}`, 'error');
					} finally {
						importInput.value = '';
					}
				};

				reader.onerror = () => {
					showStatus('Error reading file', 'error');
					importInput.value = '';
				};
				reader.readAsText(file);
			}
		});
	}

	return {
		setupImportExport: setupImportExport,
		exportStory: exportStory
	};
})();
