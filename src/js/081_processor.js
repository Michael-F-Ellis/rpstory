/**
 * IterativePromptProcessor handles the parsing and sequential execution
 * of prompts within the story text.
 */
class IterativePromptProcessor {
    /**
     * @param {object} api - The API module for sending requests.
     * @param {object} config - Configuration mapping for providers and models.
     */
    constructor(api, config) {
        this.api = api;
        this.config = config;
    }

    /**
     * Parses the story text and identifies all background and prompt blocks.
     * @param {string} text - The raw story text.
     * @returns {object} { prompts: [], backgroundBlocks: [], errors: [] }
     */
    parseStory(text) {
        const prompts = [];
        const backgroundBlocks = [];
        const errors = [];

        // Check for nesting or unterminated brackets
        let openPrompt = text.split('[[').length - 1;
        let closePrompt = text.split(']]').length - 1;
        let openBG = text.split('{{').length - 1;
        let closeBG = text.split('}}').length - 1;

        if (openPrompt !== closePrompt) errors.push("Unterminated prompting brackets [[ ]]");
        if (openBG !== closeBG) errors.push("Unterminated background brackets {{ }}");

        // Use regex with exec to get indices
        const promptRegex = /\[\[(.*?)\]\]/gs; // Added 's' flag for multi-line prompts
        const bgRegex = /\{\{(.*?)\}\}/gs;     // Added 's' flag for multi-line backgrounds

        let match;
        while ((match = promptRegex.exec(text)) !== null) {
            prompts.push({
                content: match[1],
                index: match.index,
                length: match[0].length
            });
        }

        while ((match = bgRegex.exec(text)) !== null) {
            backgroundBlocks.push({
                content: match[1],
                index: match.index,
                length: match[0].length
            });
        }

        // Check for nesting
        prompts.forEach(p => {
            if (p.content.includes('[[') || p.content.includes('{{')) errors.push("Nesting brackets is not permitted.");
        });
        backgroundBlocks.forEach(b => {
             if (b.content.includes('[[') || b.content.includes('{{')) errors.push("Nesting brackets is not permitted.");
        });

        return { prompts, backgroundBlocks, errors };
    }

    /**
     * Processes all prompts in the story sequentially.
     * @param {string} text - The full story text.
     * @param {object} options - { provider, model, temperature, systemPrompt, apiKey }
     * @param {function} onProgress - Callback for each success { index, length, response, text }.
     * @param {function} onError - Callback for failure.
     */
    async processPrompts(text, options, onProgress, onError) {
        let currentText = text;
        let iteration = 0;
        const maxIterations = 50; // Safeguard against infinite loops

        console.log("Starting processPrompts, text length:", text.length);
        
        while (iteration < maxIterations) {
            iteration++;
            const { prompts, backgroundBlocks, errors } = this.parseStory(currentText);
            console.log(`Iteration ${iteration}: Found ${prompts.length} prompts, ${backgroundBlocks.length} backgrounds`);

            if (errors.length > 0) {
                console.error("Processor errors:", errors);
                onError(errors.join('\n'));
                return;
            }

            if (prompts.length === 0) {
                console.log("No more prompts found, breaking loop.");
                break; 
            }

            // Process the first prompt found
            const prompt = prompts[0];
            console.log(`Processing prompt: [[${prompt.content}]] at index ${prompt.index}`);
            
            // Gather context: Preceding text + Background blocks that precede this prompt
            const precedingText = currentText.substring(0, prompt.index);
            const activeBackgrounds = backgroundBlocks
                .filter(b => b.index < prompt.index)
                .map(b => `{{${b.content}}}`)
                .join('\n');

            const fullPrompt = `${activeBackgrounds}\n\n${precedingText}\n\n[USER INSTRUCTION: ${prompt.content}]`;

            try {
                console.log("Fetching AI response for prompt...");
                const response = await this._fetchAIResponse(fullPrompt, options);
                console.log("Received AI response, length:", response.length);
                
                // Amend the text
                const before = currentText.substring(0, prompt.index);
                const after = currentText.substring(prompt.index + prompt.length);
                currentText = before + response + after;

                // Notify progress
                onProgress({
                    index: prompt.index,
                    length: prompt.length,
                    response: response,
                    updatedText: currentText
                });

            } catch (err) {
                console.error("AI Error:", err);
                onError(`AI Error at prompt "[[${prompt.content}]]": ${err.message}`);
                return; // Stop processing on failure
            }
        }

        if (iteration >= maxIterations) {
            console.error("Max iterations reached in processPrompts!");
            onError("Max iterations reached. Possible infinite loop detected.");
        }
    }

    /**
     * Handles "Continue from end" logic.
     */
    async continueStory(text, options, onProgress, onError) {
        const { backgroundBlocks, errors } = this.parseStory(text);
        if (errors.length > 0) {
            onError(errors.join('\n'));
            return;
        }

        const activeBackgrounds = backgroundBlocks
            .map(b => `{{${b.content}}}`)
            .join('\n');

        const fullPrompt = `${activeBackgrounds}\n\n${text}\n\n[Please continue the story...]`;

        try {
            const response = await this._fetchAIResponse(fullPrompt, options);
            onProgress({
                response: response,
                updatedText: text + response
            });
        } catch (err) {
            onError(`AI Error: ${err.message}`);
        }
    }

    async _fetchAIResponse(userPrompt, options) {
        return new Promise((resolve, reject) => {
            const providerId = options.provider;
            const provider = this.config.PROVIDERS.get(providerId);
            
            const messages = [];
            if (options.systemPrompt) {
                messages.push({ role: 'system', content: options.systemPrompt });
            }
            messages.push({ role: 'user', content: userPrompt });

            const requestBody = provider.prepareRequestBody(
                options.model,
                messages,
                null, // maxTokens
                options.temperature
            );

            const onSuccess = (data) => {
                try {
                    const content = this.api.extractResponseContent(data);
                    resolve(content);
                } catch (e) {
                    reject(e);
                }
            };

            const onApiError = (err) => reject(err);

            if (provider.apiFormat === 'gemini-native') {
                const endpoint = provider.endpoint.replace('{{model}}', options.model) + `?key=${options.apiKey}`;
                this.api.sendGeminiRequest(endpoint, requestBody, onSuccess, onApiError);
            } else {
                this.api.sendRequest(provider.endpoint, options.apiKey, requestBody, onSuccess, onApiError);
            }
        });
    }
}
