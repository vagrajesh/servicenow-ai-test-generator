/**
 * Script Include: AzureOpenAITestGenerator
 * Description: Generates test cases using Azure OpenAI for ServiceNow Test Management 2.0
 * Type: Server-side only
 * Version: 1.0
 */

var AzureOpenAITestGenerator = Class.create();
AzureOpenAITestGenerator.prototype = {
    initialize: function() {
        // Azure OpenAI Configuration from System Properties
        this.AZURE_ENDPOINT = gs.getProperty('azure.openai.endpoint');
        this.AZURE_API_KEY = gs.getProperty('azure.openai.api.key');
        this.DEPLOYMENT_NAME = gs.getProperty('azure.openai.deployment.name');
        this.API_VERSION = gs.getProperty('azure.openai.api.version', '2024-02-15-preview');
        this.TIMEOUT = parseInt(gs.getProperty('azure.openai.timeout', '60000'));
        
        // Logging prefix
        this.LOG_PREFIX = 'AzureOpenAITestGenerator';
        
        // Validate configuration
        this._validateConfiguration();
    },

    /**
     * Generate test cases for a user story
     * @param {String} storyId - User story sys_id
     * @returns {Object} - Result with created test cases
     */
    generateTestCases: function(storyId) {
        try {
            gs.info(this.LOG_PREFIX + ': Starting test case generation for story: ' + storyId);
            
            // Get user story details
            var story = this._getUserStory(storyId);
            if (!story.success) {
                return story;
            }

            // Build the prompt
            var prompts = this._buildPrompt(story.data);
            
            // Call Azure OpenAI
            var aiResponse = this._callAzureOpenAI(prompts);
            
            if (!aiResponse.success) {
                return aiResponse;
            }

            // Parse and create test cases
            var result = this._createTestCases(aiResponse.data, storyId);
            
            return result;
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.generateTestCases: ' + e);
            return {
                success: false,
                message: 'Error generating test cases: ' + e,
                error: e.toString()
            };
        }
    },

    /**
     * Validate Azure OpenAI configuration
     * @private
     */
    _validateConfiguration: function() {
        var errors = [];
        
        if (!this.AZURE_ENDPOINT) {
            errors.push('azure.openai.endpoint system property is not configured');
        }
        if (!this.AZURE_API_KEY) {
            errors.push('azure.openai.api.key system property is not configured');
        }
        if (!this.DEPLOYMENT_NAME) {
            errors.push('azure.openai.deployment.name system property is not configured');
        }
        
        if (errors.length > 0) {
            gs.error(this.LOG_PREFIX + ' Configuration errors: ' + errors.join(', '));
            throw 'Azure OpenAI not configured properly. Check system properties.';
        }
    },

    /**
     * Get user story details
     * @param {String} storyId - User story sys_id
     * @returns {Object} - Story details
     * @private
     */
    _getUserStory: function(storyId) {
        try {
            var gr = new GlideRecord('rm_story');
            if (!gr.get(storyId)) {
                return {
                    success: false,
                    message: 'User story not found: ' + storyId
                };
            }
            
            // Extract story details
            var storyData = {
                sys_id: gr.getUniqueValue(),
                number: gr.getValue('number') || '',
                title: gr.getValue('short_description') || '',
                description: gr.getValue('description') || '',
                acceptance_criteria: gr.getValue('acceptance_criteria') || '',
                application: gr.getValue('business_service') || '',
                priority: gr.getValue('priority') || '3',
                state: gr.getValue('state') || ''
            };
            
            // Validate required fields
            if (!storyData.title) {
                return {
                    success: false,
                    message: 'User story must have a title/short_description'
                };
            }
            
            gs.info(this.LOG_PREFIX + ': Retrieved story ' + storyData.number + ' - ' + storyData.title);
            
            return {
                success: true,
                data: storyData
            };
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._getUserStory: ' + e);
            return {
                success: false,
                message: 'Error retrieving user story: ' + e
            };
        }
    },

    /**
     * Build AI prompts
     * @param {Object} story - Story data
     * @returns {Object} - System and user prompts
     * @private
     */
    _buildPrompt: function(story) {
        var systemPrompt = "You are an expert QA test case generator for ServiceNow Test Management 2.0. " +
            "Your role is to analyze user stories and generate comprehensive, structured test cases that can be " +
            "directly inserted into ServiceNow's Test Management 2.0 tables.\n\n" +
            "Your output must be in valid JSON format that matches ServiceNow's Test Management 2.0 data structure exactly.";
        
        var userPrompt = "Generate test cases for the following user story:\n\n" +
            "**User Story Number:** " + (story.number || 'N/A') + "\n" +
            "**User Story Title:** " + story.title + "\n\n" +
            "**User Story Description:**\n" + (story.description || 'No description provided') + "\n\n" +
            "**Acceptance Criteria:**\n" + (story.acceptance_criteria || 'No acceptance criteria provided') + "\n\n" +
            "**Additional Context:**\n" +
            "- Application: " + (story.application || 'Not specified') + "\n" +
            "- Priority: " + story.priority + "\n" +
            "- Test Type: functional\n\n" +
            "---\n\n" +
            "**INSTRUCTIONS:**\n" +
            "1. Analyze the user story, description, and acceptance criteria\n" +
            "2. Generate comprehensive test cases covering:\n" +
            "   - Happy path scenarios\n" +
            "   - Edge cases\n" +
            "   - Negative test cases\n" +
            "   - Boundary conditions\n" +
            "   - Integration points (if applicable)\n\n" +
            "3. For each test case, create:\n" +
            "   - A clear, descriptive test name\n" +
            "   - Short description (one-line summary)\n" +
            "   - Detailed description\n" +
            "   - Multiple test steps with specific actions\n" +
            "   - Expected results for each step\n" +
            "   - Test data (if needed)\n\n" +
            "4. Return your response in the following JSON structure ONLY. Do not include any explanatory text, markdown formatting, or code blocks. Return pure JSON:\n\n" +
            '{\n' +
            '  "test_cases": [\n' +
            '    {\n' +
            '      "testData": {\n' +
            '        "name": "Test case name (clear and descriptive)",\n' +
            '        "short_description": "Brief one-line summary",\n' +
            '        "description": "Detailed description of what this test validates",\n' +
            '        "test_type": "functional",\n' +
            '        "priority": "High",\n' +
            '        "state": "draft",\n' +
            '        "assignment_group": "",\n' +
            '        "assigned_to": "",\n' +
            '        "application": ""\n' +
            '      },\n' +
            '      "versionData": {\n' +
            '        "version": "1.0",\n' +
            '        "state": "draft",\n' +
            '        "short_description": "Initial version",\n' +
            '        "description": "First version of test case",\n' +
            '        "priority": "High"\n' +
            '      },\n' +
            '      "stepsData": [\n' +
            '        {\n' +
            '          "order": 100,\n' +
            '          "step": "Clear description of the action to perform",\n' +
            '          "expected_result": "Clear description of expected outcome",\n' +
            '          "test_data": "Any specific test data needed (optional)",\n' +
            '          "description": ""\n' +
            '        },\n' +
            '        {\n' +
            '          "order": 200,\n' +
            '          "step": "Next step description",\n' +
            '          "expected_result": "Expected outcome for this step",\n' +
            '          "test_data": "",\n' +
            '          "description": ""\n' +
            '        }\n' +
            '      ]\n' +
            '    }\n' +
            '  ]\n' +
            '}\n\n' +
            "**PRIORITY MAPPING (CRITICAL):**\n" +
            "- Use \"High\" for critical/priority 1 tests\n" +
            "- Use \"Medium\" for moderate/priority 2-3 tests\n" +
            "- Use \"Low\" for minor/priority 4 tests\n" +
            "- Priority must match in both testData and versionData\n\n" +
            "**REQUIREMENTS:**\n" +
            "- Generate at least 3-5 test cases minimum\n" +
            "- Each test case should have 3-8 steps\n" +
            "- Step order MUST increment by 100 (100, 200, 300, etc.)\n" +
            "- Be specific and actionable in step descriptions\n" +
            "- Use imperative verbs for step actions (e.g., \"Click\", \"Enter\", \"Verify\")\n" +
            "- Include realistic test data where applicable\n" +
            "- Cover positive, negative, and edge case scenarios\n" +
            "- test_type should be \"functional\" unless otherwise specified\n" +
            "- state should be \"draft\" for all new test cases\n" +
            "- Ensure all JSON is properly formatted and valid\n" +
            "- Do NOT wrap the JSON in markdown code blocks\n" +
            "- Do NOT include any text before or after the JSON\n" +
            "- Structure must have \"test_cases\" array containing objects with \"testData\", \"versionData\", and \"stepsData\"";

        return {
            system: systemPrompt,
            user: userPrompt
        };
    },

    /**
     * Call Azure OpenAI API
     * @param {Object} prompts - System and user prompts
     * @returns {Object} - API response
     * @private
     */
    _callAzureOpenAI: function(prompts) {
        try {
            gs.info(this.LOG_PREFIX + ': Calling Azure OpenAI API');
            
            var request = new sn_ws.RESTMessageV2();
            var endpoint = this.AZURE_ENDPOINT + '/openai/deployments/' + 
                          this.DEPLOYMENT_NAME + '/chat/completions?api-version=' + 
                          this.API_VERSION;
            
            request.setEndpoint(endpoint);
            request.setHttpMethod('POST');
            request.setRequestHeader('Content-Type', 'application/json');
            request.setRequestHeader('api-key', this.AZURE_API_KEY);
            request.setHttpTimeout(this.TIMEOUT);
            
            var payload = {
                messages: [
                    {
                        role: "system",
                        content: prompts.system
                    },
                    {
                        role: "user",
                        content: prompts.user
                    }
                ],
                temperature: 0.8,
                max_tokens: 4000,
                response_format: { type: "json_object" }
            };
            
            request.setRequestBody(JSON.stringify(payload));
            
            gs.info(this.LOG_PREFIX + ': Sending request to: ' + endpoint);
            var response = request.execute();
            var httpStatus = response.getStatusCode();
            var responseBody = response.getBody();
            
            gs.info(this.LOG_PREFIX + ': Azure OpenAI Response Status: ' + httpStatus);
            
            if (httpStatus == 200) {
                var jsonResponse = JSON.parse(responseBody);
                
                // Extract content from response
                if (!jsonResponse.choices || jsonResponse.choices.length === 0) {
                    gs.error(this.LOG_PREFIX + ': No choices in API response');
                    return {
                        success: false,
                        message: 'No response from Azure OpenAI'
                    };
                }
                
                var content = jsonResponse.choices[0].message.content;
                gs.info(this.LOG_PREFIX + ': Received response content (length: ' + content.length + ')');
                
                // Parse the JSON content
                var parsedContent = this._parseAIResponse(content);
                
                return {
                    success: true,
                    data: parsedContent
                };
            } else {
                gs.error(this.LOG_PREFIX + ': Azure OpenAI Error: ' + responseBody);
                return {
                    success: false,
                    message: 'API Error: ' + httpStatus + ' - ' + responseBody
                };
            }
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._callAzureOpenAI error: ' + e);
            return {
                success: false,
                message: 'Error calling Azure OpenAI: ' + e
            };
        }
    },

    /**
     * Parse AI response and clean JSON
     * @param {String} content - AI response content
     * @returns {Object} - Parsed JSON
     * @private
     */
    _parseAIResponse: function(content) {
        try {
            // Remove markdown code blocks if present
            var cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            
            // Find JSON boundaries
            var startIdx = cleanContent.indexOf('{');
            var endIdx = cleanContent.lastIndexOf('}');
            
            if (startIdx === -1 || endIdx === -1) {
                throw 'No valid JSON found in response';
            }
            
            cleanContent = cleanContent.substring(startIdx, endIdx + 1);
            
            // Parse JSON
            var parsed = JSON.parse(cleanContent);
            
            // Validate structure
            if (!parsed.test_cases || !Array.isArray(parsed.test_cases)) {
                throw 'Response missing test_cases array';
            }
            
            gs.info(this.LOG_PREFIX + ': Successfully parsed ' + parsed.test_cases.length + ' test cases from AI response');
            
            return parsed;
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._parseAIResponse: ' + e);
            gs.error(this.LOG_PREFIX + ': Raw content: ' + content);
            throw 'Failed to parse AI response: ' + e;
        }
    },

    /**
     * Create test cases in ServiceNow
     * @param {Object} aiData - Parsed AI response
     * @param {String} storyId - User story sys_id
     * @returns {Object} - Creation results
     * @private
     */
    _createTestCases: function(aiData, storyId) {
        try {
            var utils = new TestManagementUtils();
            var results = [];
            var successCount = 0;
            var failureCount = 0;
            
            // Validate AI response structure
            if (!aiData.test_cases || !Array.isArray(aiData.test_cases)) {
                return {
                    success: false,
                    message: 'Invalid AI response format: missing test_cases array'
                };
            }
            
            gs.info(this.LOG_PREFIX + ': Creating ' + aiData.test_cases.length + ' test cases');
            
            // Loop through each test case from AI
            for (var i = 0; i < aiData.test_cases.length; i++) {
                var testCase = aiData.test_cases[i];
                
                try {
                    // Validate structure
                    if (!testCase.testData || !testCase.versionData || !testCase.stepsData) {
                        gs.error(this.LOG_PREFIX + ': Test case ' + (i + 1) + ' missing required fields');
                        results.push({
                            success: false,
                            message: 'Test case ' + (i + 1) + ' missing testData, versionData, or stepsData'
                        });
                        failureCount++;
                        continue;
                    }
                    
                    // Extract the three objects
                    var testData = testCase.testData;
                    var versionData = testCase.versionData;
                    var stepsData = testCase.stepsData;
                    
                    // Add story reference
                    testData.parent = storyId;
                    
                    // Map priority if needed
                    testData.priority = this._mapPriority(testData.priority);
                    versionData.priority = this._mapPriority(versionData.priority);
                    
                    // Create the test
                    var result = utils.createCompleteTest(testData, versionData, stepsData);
                    
                    if (result.success) {
                        successCount++;
                        gs.info(this.LOG_PREFIX + ': Successfully created test case ' + (i + 1) + ': ' + testData.name);
                    } else {
                        failureCount++;
                        gs.error(this.LOG_PREFIX + ': Failed to create test case ' + (i + 1) + ': ' + result.message);
                    }
                    
                    results.push(result);
                    
                } catch (e) {
                    gs.error(this.LOG_PREFIX + ': Error creating test case ' + (i + 1) + ': ' + e);
                    results.push({
                        success: false,
                        message: 'Error creating test case ' + (i + 1) + ': ' + e
                    });
                    failureCount++;
                }
            }
            
            var finalMessage = 'Created ' + successCount + ' of ' + aiData.test_cases.length + ' test cases';
            if (failureCount > 0) {
                finalMessage += ' (' + failureCount + ' failed)';
            }
            
            gs.info(this.LOG_PREFIX + ': ' + finalMessage);
            
            return {
                success: successCount > 0,
                message: finalMessage,
                totalGenerated: aiData.test_cases.length,
                successCount: successCount,
                failureCount: failureCount,
                results: results
            };
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._createTestCases error: ' + e);
            return {
                success: false,
                message: 'Error creating test cases: ' + e,
                error: e.toString()
            };
        }
    },

    /**
     * Map priority values
     * @param {String} priority - Priority value from AI
     * @returns {String} - Mapped priority
     * @private
     */
    _mapPriority: function(priority) {
        if (!priority) return 'Medium';
        
        var p = String(priority).toLowerCase().trim();
        
        // Map numeric priorities
        if (p === '1' || p === '1-critical' || p === '1-high') return 'High';
        if (p === '4' || p === '4-low') return 'Low';
        
        // Map text priorities
        if (p.indexOf('high') >= 0 || p.indexOf('critical') >= 0) return 'High';
        if (p.indexOf('low') >= 0) return 'Low';
        
        // Default to Medium
        return 'Medium';
    },

    type: 'AzureOpenAITestGenerator'
};