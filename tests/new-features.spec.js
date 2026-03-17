const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('RPStory New Features', () => {

	test.beforeEach(async ({ page }) => {
		const indexPath = path.resolve(__dirname, '..', 'index.html');
		await page.goto(`file://${indexPath}`);
	});

	test('should show confirmation dialog when clearing non-empty chat', async ({ page }) => {
		// 1. Add some content to the story area using addMessage (which handles DOM)
		await page.evaluate(() => {
			window.RPChat.chatManager.addMessage('assistant', 'Some story content');
		});

		// 2. Click clear and check for dialog
		let dialogAppeared = false;
		page.on('dialog', async dialog => {
			dialogAppeared = true;
			expect(dialog.message()).toContain('Are you sure you want to clear');
			await dialog.dismiss();
		});

		await page.locator('#clear-chat').click();
		expect(dialogAppeared).toBe(true);
		
		// Story should still be there because we dismissed
		const storyContent = await page.locator('.assistant-message .editable-content').textContent();
		expect(storyContent).toBe('Some story content');
	});

	test('should copy chat to clipboard when extracting', async ({ page }) => {
		// Mock navigator.clipboard
		await page.evaluate(() => {
			window.clipboardData = '';
			navigator.clipboard.writeText = async (text) => {
				window.clipboardData = text;
				return Promise.resolve();
			};
		});

		// Add some content
		await page.evaluate(() => {
			window.RPChat.chatManager.addMessage('assistant', 'Story to extract');
		});

		// Click extract
		await page.locator('#extract-chat-md').click();

		// Check if clipboard mock was called
		const clipboardData = await page.evaluate(() => window.clipboardData);
		expect(clipboardData).toContain('Story to extract');
	});

	test('should refactor createModel to update provider', async ({ page }) => {
		// Seed the DB first since it starts empty in the test
		await page.evaluate(async () => {
			await window.initDB();
			// Seed with deepseek provider
			const deepseek = window.RPChat.config.PROVIDERS.get('deepseek');
			const providerToSeed = { ...deepseek, models: [] }; // No models initially
			await window.createProvider(providerToSeed);
		});

		await page.evaluate(async () => {
			const providerId = 'deepseek';
			const newModel = {
				id: 'new-test-model',
				displayName: 'New Test Model',
				defaultTemperature: 0.5
			};

			const result = await window.createModel(providerId, newModel);
			window.createModelResult = result;

			// Verify it's in the DB
			const readProvider = await window.readProvider(providerId);
			window.readProviderResult = readProvider;
		});

		const createModelResult = await page.evaluate(() => window.createModelResult);
		expect(createModelResult.id).toBe('new-test-model');

		const readProviderResult = await page.evaluate(() => window.readProviderResult);
		expect(readProviderResult.models.some(m => m.id === 'new-test-model')).toBe(true);
	});
});
