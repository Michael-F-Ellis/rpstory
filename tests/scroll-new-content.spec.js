const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('RPStory Scroll to New Content', () => {

	test.beforeEach(async ({ page }) => {
		// Navigate to the local index.html directly
		const indexPath = path.resolve(__dirname, '..', 'index.html');
		await page.goto(`file://${indexPath}`);

		// Mock the API requests to avoid actually hitting the provider
		await page.route('**/*', async (route) => {
			const request = route.request();
			if (request.method() === 'POST' && request.url().includes('api')) {
				try {
					const postData = JSON.parse(request.postData() || '{}');

					const mockResponse = {
						choices: [
							{
								finish_reason: 'stop',
								message: {
									role: 'assistant',
									content: ''
								}
							}
						],
						usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
					};

					let messages = postData.messages || [];
					let lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';

					if (lastUserMessage.includes('long story')) {
						mockResponse.choices[0].message.content = Array(50).fill('This is a long existing paragraph in the story to create scrolling space.').join('\n\n');
					} else if (lastUserMessage.includes('one more')) {
						mockResponse.choices[0].message.content = 'This is the NEW paragraph added to the story.';
					} else {
						mockResponse.choices[0].message.content = 'Default response.';
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
		await page.locator('#api-key').fill('dummy-api-key-for-test');
		await page.locator('#save-key').click();
	});

	test('should scroll to the top of newly added content or at least down', async ({ page }) => {
		test.setTimeout(30000);

		const editor = page.locator('#story-editor');

		// 1. Submit first prompt to generate long story
		await editor.click();
		await page.keyboard.press('Control+A');
		await page.keyboard.press('Backspace');
		await page.keyboard.type('[[Tell me a long story]]');
		await page.locator('#send-button').click();

		// Wait for response to appear in story area
		await expect(editor).toContainText('long existing paragraph', { timeout: 10000 });

		// Make sure it's fully rendered and scrollable
		await page.waitForTimeout(1000);

		// Scroll back to the very top to ensure we are testing the auto-scroll behavior jumping down
		await page.evaluate(() => document.getElementById('story-editor').scrollTo(0, 0));
		await page.waitForTimeout(500);

		// 2. Submit second prompt
		await page.evaluate(() => {
			const el = document.getElementById('story-editor');
			el.innerText += '\\n\\n[[Add one more paragraph]]';
		});
		await page.locator('#send-button').click();

		// Wait for new response appended
		await expect(editor).toContainText('NEW paragraph', { timeout: 10000 });

		// Wait for smooth scroll time to finish
		await page.waitForTimeout(1500);

		// 3. Verify scroll position
		const currentScrollTop = await page.evaluate(() => document.getElementById('story-editor').scrollTop);

		// In some viewports, it might not be able to scroll all the way to target if there is not enough new text
		// So we check if it is either close to the target, OR if it has reached the max scroll limit.
		const maxScrollTop = await page.evaluate(() => {
			const c = document.getElementById('story-editor');
			return c.scrollHeight - c.clientHeight;
		});

		// It should have scrolled significantly down, not be at the top.
		expect(currentScrollTop).toBeGreaterThan(100);

		// It should be near the target or at the maximum possible scroll bounds
		const isAtBottom = Math.abs(currentScrollTop - maxScrollTop) < 15;

		expect(isAtBottom).toBeTruthy();
	});
});
