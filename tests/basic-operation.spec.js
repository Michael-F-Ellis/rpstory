const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('RPStory Basic Operation Flow', () => {

	test.beforeEach(async ({ page }) => {
		// Log page console errors
		page.on('console', msg => console.log('PAGE LOG:', msg.text()));

		// Navigate to the local index.html directly
		const indexPath = path.resolve(__dirname, '..', 'index.html');
		await page.goto(`file://${indexPath}`);

		// Mock the API requests to avoid actually hitting the provider
		await page.route('**/*', async (route) => {
			const request = route.request();
			if (request.method() === 'POST' && request.url().includes('api')) {
				console.log('Intercepted API request:', request.url());
				try {
					const postData = JSON.parse(request.postData() || '{}');
					console.log('API PAYLOAD MESSAGES:', JSON.stringify(postData.messages || postData.contents));

					// Mock OpenAI standard format response for simplicity
					const mockResponse = {
						choices: [
							{
								finish_reason: 'stop',
								message: {
									role: 'assistant',
									content: 'This is a mock AI response snippet.'
								}
							}
						],
						usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
					};

					let messages = postData.messages || [];
					let lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';

					if (lastUserMessage.includes('Part 3')) {
						mockResponse.choices[0].message.content = 'They became best friends.';
					} else if (lastUserMessage.includes('Part 2')) {
						mockResponse.choices[0].message.content = 'The knight found a generic dragon.';
					} else if (lastUserMessage.includes('Part 1')) {
						mockResponse.choices[0].message.content = 'Once upon a time, there was a brave knight.';
					}

					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify(mockResponse)
					});
				} catch (e) {
					console.error('Mock error:', e);
					await route.continue();
				}
			} else {
				await route.continue();
			}
		});

		// Fill in a dummy API key so it allows sending
		const apiKeyInput = page.locator('#api-key');
		await apiKeyInput.fill('dummy-api-key-for-test');
		await page.locator('#save-key').click();
	});

	test('should maintain story across export, clear, import, and subsequent prompt', async ({ page }) => {
		// Increase timeout
		test.setTimeout(60000);

		// Focus the story editor
		const editor = page.locator('#story-editor');

		// 1. Submit first prompt
		await editor.click();
		await page.keyboard.press('Control+A');
		await page.keyboard.press('Backspace');
		await page.keyboard.type('Part 1 [[tell a story]]');
		await page.locator('#send-button').click();

		// Wait for response to appear in story area
		await expect(page.locator('#status-message')).toContainText('complete', { timeout: 15000 });
		await expect(editor).toContainText('Once upon a time');

		// 2. Submit second prompt
		await page.evaluate(() => {
			const el = document.getElementById('story-editor');
			el.innerText += '\\n\\nPart 2 [[what did he find?]]';
		});
		await page.locator('#send-button').click();

		// Wait for response appended
		await expect(page.locator('#status-message')).toContainText('complete', { timeout: 15000 });
		await expect(editor).toContainText('generic dragon');

		// Verify full story text right now
		const storyBeforeExport = await editor.textContent();
		expect(storyBeforeExport).toContain('Once upon a time');
		expect(storyBeforeExport).toContain('generic dragon');

		// 3. Export chat
		// Wait for download
		const downloadPromise = page.waitForEvent('download');
		await page.locator('#export-chat').click();
		const download = await downloadPromise;

		// Save the exported file
		const exportPath = path.join(__dirname, 'temp_export.json');
		await download.saveAs(exportPath);

		// 4. Clear chat
		page.on('dialog', dialog => dialog.accept()); // Accept the confirmation dialog
		await page.locator('#clear-chat').click();

		await expect(editor).toBeEmpty();

		// 5. Import chat
		// Hook into file chooser
		const fileChooserPromise = page.waitForEvent('filechooser');
		await page.locator('#import-chat').click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles(exportPath);

		// Wait a bit for import parsing and rendering
		await page.waitForTimeout(1000);

		// Verify story is restored
		const storyAfterImport = await editor.textContent();
		// remove exact match check since leading parsing adds newlines or trims etc
		expect(storyAfterImport).toContain('Once upon a time');
		expect(storyAfterImport).toContain('generic dragon');

		// 6. Submit a third prompt
		await page.evaluate(() => {
			const el = document.getElementById('story-editor');
			el.innerText += '\\n\\nPart 3 [[and then?]]';
		});
		await page.locator('#send-button').click();

		// Wait for new response
		await expect(page.locator('#status-message')).toContainText('complete', { timeout: 15000 });
		await expect(editor).toContainText('best friends');

		// THE BUG: Verify the initial story is STILL there along with the new text.
		const finalStory = await editor.textContent();

		// Clean up the temporary file
		if (fs.existsSync(exportPath)) {
			fs.unlinkSync(exportPath);
		}

		// These expectations will fail if the bug is present (i.e., if previous story is wiped out)
		expect(finalStory).toContain('Once upon a time');
		expect(finalStory).toContain('generic dragon');
		expect(finalStory).toContain('best friends');
	});
});
