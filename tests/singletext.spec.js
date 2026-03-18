const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('RPStory SingleText Mode', () => {

    test.beforeEach(async ({ page }) => {
        // Forward browser console logs to terminal
        page.on('console', msg => console.log('BROWSER:', msg.text()));
        
        await page.goto('http://localhost:8080/index.html');
        
        // Wait for RPChat and storyManager to be initialized
        await page.waitForFunction(() => window.RPChat && window.RPChat.storyManager, { timeout: 15000 });

        // Mock API responses
        await page.evaluate(() => {
            window.fetch = async (url, options) => {
                console.log("Mock Fetch called with URL:", url);
                const body = JSON.parse(options.body);
                // Join all message contents to check for prompts in any role
                const allContent = body.messages.map(m => m.content).join('\n');
                console.log("Mock Fetch content length:", allContent.length);
                
                let responseText = "AI Response";
                if (allContent.includes("[USER INSTRUCTION: Describe Jill]")) {
                    responseText = "Jill has red pigtails.";
                } else if (allContent.includes("[Please continue the story...]")) {
                    responseText = " They lived happily ever after.";
                }

                console.log("Mock Fetch returning response:", responseText);
                return {
                    ok: true,
                    json: async () => {
                        console.log("Mock Fetch JSON requested");
                        return {
                            choices: [{
                                message: { content: responseText },
                                finish_reason: 'stop'
                            }],
                            usage: { prompt_tokens: 10, completion_tokens: 10 }
                        };
                    }
                };
            };
        });

        // Set dummy API key via UI to ensure it matches the current provider
        await page.locator('#api-key').fill('dummy-api-key-for-test');
        await page.locator('#save-key').click();
	});

	test('should process a single [[prompt]]', async ({ page }) => {
        // Set content
        await page.evaluate(() => {
            window.RPChat.storyManager.setContent('Jack and Jill. [[Describe Jill]] Jack said hello.');
        });
        
        // Click send
        await page.locator('#send-button').click();
        
        // Wait for processing to complete
        await expect(page.locator('#status-message')).toContainText('complete', { timeout: 10000 });
        
        // Check content
        const content = await page.evaluate(() => window.RPChat.storyManager.getContent());
        expect(content).toContain('Jack and Jill. Jill has red pigtails. Jack said hello.');
        expect(content).not.toContain('[[Describe Jill]]');
	});

	test('should handle background text {{ }} context', async ({ page }) => {
        await page.evaluate(() => {
            window.RPChat.storyManager.setContent('{{Background info}} Once upon a time. [[Describe Jill]]');
        });
        
        await page.locator('#send-button').click();
        await expect(page.locator('#status-message')).toContainText('complete', { timeout: 10000 });
        
        const content = await page.evaluate(() => window.RPChat.storyManager.getContent());
        expect(content).toContain('{{Background info}}');
        expect(content).toContain('Once upon a time. Jill has red pigtails.');
    });

    test('should continue from end if no prompt present', async ({ page }) => {
        await page.evaluate(() => {
            window.RPChat.storyManager.setContent('Jack went up the hill.');
        });
        
        await page.locator('#send-button').click();
        await expect(page.locator('#status-message')).toContainText('complete', { timeout: 10000 });
        
        const content = await page.evaluate(() => window.RPChat.storyManager.getContent());
        expect(content).toContain('Jack went up the hill. They lived happily ever after.');
    });

    test('should show error for unterminated brackets', async ({ page }) => {
        await page.evaluate(() => {
            window.RPChat.storyManager.setContent('Jack and [[ Jill');
        });
        
        await page.locator('#send-button').click();
        
        await expect(page.locator('#status-message')).toContainText('Unterminated', { timeout: 10000 });
        await expect(page.locator('#status-message')).toHaveClass(/error/);
    });

    test('should clear story content', async ({ page }) => {
        await page.evaluate(() => {
            window.RPChat.storyManager.setContent('Some text');
        });
        
        page.on('dialog', dialog => dialog.accept());
        await page.locator('#clear-chat').click();
        
        const content = await page.evaluate(() => window.RPChat.storyManager.getContent());
        expect(content).toBe('');
    });
});
