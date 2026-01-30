/**
 * Script Include: AzureOpenAITestGenerator
 * Description: Generates test cases using Azure OpenAI for ServiceNow Test Management 2.0
 * Type: Server-side only
 * Version: 1.0
 */
var AzureOpenAITestGenerator = Class.create();
AzureOpenAITestGenerator.prototype = {
    
    /**
     * Initialize the generator with configuration from system properties
     */
    initialize: function() {
        // Azure OpenAI Configuration from System Properties
        this.AZURE_ENDPOINT = gs.getProperty('azure.openai.endpoint');
        this.AZURE_API_KEY = gs.getProperty('azure.openai.api.key');
        this.DEPLOYMENT_NAME = gs.getProperty('azure.openai.deployment.name');
        this.API_VERSION = gs.getProperty('azure.openai.api.version', '2024-02-15-preview');
        this.TIMEOUT = parseInt(gs.getProperty('azure.openai.timeout', '60000'));
        this.TEST_CASE_COUNT = parseInt(gs.getProperty('azure.openai.test.case.count', '8'));
        
        // Logging prefix
        this.LOG_PREFIX = 'AzureOpenAITestGenerator';
        
        // Validate configuration
        this._validateConfiguration();
    },

    /**
     * Validate that all required configuration is present
     * @returns {Object} - {valid: boolean, errors: []}
     */
    _validateConfiguration: function() {
        var errors = [];
        
        if (!this.AZURE_ENDPOINT) {
            errors.push('Azure OpenAI endpoint not configured');
        }
        
        if (!this.AZURE_API_KEY) {
            errors.push('Azure OpenAI API key not configured');
        }
        
        if (!this.DEPLOYMENT_NAME) {
            errors.push('Azure OpenAI deployment name not configured');
        }
        
        if (errors.length > 0) {
            gs.error(this.LOG_PREFIX + ': Configuration errors: ' + errors.join(', '));
            return {
                valid: false,
                errors: errors
            };
        }
        
        gs.debug(this.LOG_PREFIX + ': Configuration validated successfully');
        return {
            valid: true,
            errors: []
        };
    },

    /**
     * Main entry point - Generate test cases for a user story
     * @param {String} storyId - User story sys_id
     * @returns {Object} - {success: boolean, message: string, totalGenerated: number, results: []}
     */
    generateTestCases: function(storyId) {
        var startTime = new Date().getTime();
        
        try {
            gs.info(this.LOG_PREFIX + ': Starting test case generation for story: ' + storyId);
            
            // Validate configuration
            var configValidation = this._validateConfiguration();
            if (!configValidation.valid) {
                return {
                    success: false,
                    message: 'Configuration error: ' + configValidation.errors.join(', '),
                    totalGenerated: 0,
                    successCount: 0,
                    failureCount: 0,
                    createdTests: []
                };
            }
            
            // Get user story
            var storyResult = this._getUserStory(storyId);
            if (!storyResult.success) {
                return {
                    success: false,
                    message: storyResult.message,
                    totalGenerated: 0,
                    successCount: 0,
                    failureCount: 0,
                    createdTests: []
                };
            }
            
            var story = storyResult.data;
            
            // Validate story
            var validator = new AITestGenerationValidator();
            var validation = validator.validateStory(story);
            
            if (!validation.valid) {
                return {
                    success: false,
                    message: 'Story validation failed: ' + validation.errors.join(', '),
                    totalGenerated: 0,
                    successCount: 0,
                    failureCount: 0,
                    createdTests: []
                };
            }
            
            // Build prompts
            var prompts = this._buildPrompt(story);
            if (!prompts) {
                return {
                    success: false,
                    message: 'Failed to build AI prompt',
                    totalGenerated: 0,
                    successCount: 0,
                    failureCount: 0,
                    createdTests: []
                };
            }
            
            // Call Azure OpenAI
            gs.info(this.LOG_PREFIX + ': Calling Azure OpenAI API...');
            var apiResult = this._callAzureOpenAI(prompts);
            
            if (!apiResult.success) {
                var endTime = new Date().getTime();
                var duration = Math.round((endTime - startTime) / 1000);
                
                var failResult = {
                    success: false,
                    message: apiResult.message,
                    totalGenerated: 0,
                    successCount: 0,
                    failureCount: 0,
                    createdTests: []
                };
                
                this._logGeneration(storyId, failResult, duration, null);
                return failResult;
            }
            
            // Parse AI response
            gs.info(this.LOG_PREFIX + ': Parsing AI response...');
            var aiData = this._parseAIResponse(apiResult.data);
            
            if (!aiData || !aiData.test_cases) {
                var endTime = new Date().getTime();
                var duration = Math.round((endTime - startTime) / 1000);
                
                var parseFailResult = {
                    success: false,
                    message: 'Failed to parse AI response',
                    totalGenerated: 0,
                    successCount: 0,
                    failureCount: 0,
                    createdTests: []
                };
                
                this._logGeneration(storyId, parseFailResult, duration, apiResult.rawResponse);
                return parseFailResult;
            }
            
            // Create test cases
            gs.info(this.LOG_PREFIX + ': Creating test cases in ServiceNow...');
            var createResult = this._createTestCases(aiData, storyId);
            
            var endTime = new Date().getTime();
            var duration = Math.round((endTime - startTime) / 1000);
            
            // Log generation
            this._logGeneration(storyId, createResult, duration, apiResult.rawResponse);
            
            // Prepare final result
            var finalResult = {
                success: createResult.success,
                message: createResult.success ? 
                    'Successfully generated ' + createResult.successCount + ' of ' + 
                    (createResult.successCount + createResult.failureCount) + ' test cases' :
                    'Failed to generate test cases: ' + createResult.message,
                totalGenerated: createResult.successCount,
                successCount: createResult.successCount,
                failureCount: createResult.failureCount,
                createdTests: createResult.createdTests,
                duration: duration,
                storyId: storyId
            };
            
            gs.info(this.LOG_PREFIX + ': Generation complete in ' + duration + ' seconds');
            return finalResult;
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.generateTestCases: ' + e);
            var endTime = new Date().getTime();
            var duration = Math.round((endTime - startTime) / 1000);
            
            var errorResult = {
                success: false,
                message: 'Exception: ' + e,
                totalGenerated: 0,
                successCount: 0,
                failureCount: 0,
                createdTests: []
            };
            
            this._logGeneration(storyId, errorResult, duration, null);
            return errorResult;
        }
    },

    /**
     * Retrieve user story from database
     * @param {String} storyId - User story sys_id
     * @returns {Object} - {success: boolean, data: object, message: string}
     */
    _getUserStory: function(storyId) {
        try {
            var storyGr = new GlideRecord('rm_story');
            
            if (!storyGr.get(storyId)) {
                return {
                    success: false,
                    message: 'User story not found: ' + storyId,
                    data: null
                };
            }
            
            // Extract story data
            var story = {
                sys_id: storyGr.getUniqueValue(),
                number: storyGr.getValue('number'),
                short_description: storyGr.getValue('short_description'),
                description: storyGr.getValue('description'),
                acceptance_criteria: storyGr.getValue('acceptance_criteria'),
                priority: storyGr.getDisplayValue('priority'),
                state: storyGr.getDisplayValue('state'),
                application: storyGr.getValue('application'),
                application_name: storyGr.getDisplayValue('application')
            };
            
            gs.debug(this.LOG_PREFIX + ': Retrieved story: ' + story.number);
            
            return {
                success: true,
                data: story,
                message: 'Story retrieved successfully'
            };
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._getUserStory: ' + e);
            return {
                success: false,
                message: 'Error retrieving story: ' + e,
                data: null
            };
        }
    },

    /**
     * Build AI prompts from user story data
     * @param {Object} story - User story object
     * @returns {Object} - {system: string, user: string}
     */
    _buildPrompt: function(story) {
        try {
            // Extract story data
            var storyNumber = story.number || 'N/A';
            var storyTitle = story.short_description || 'Untitled Story';
            var storyDescription = story.description || 'No description provided';
            var acceptanceCriteria = story.acceptance_criteria || 'No acceptance criteria provided';
            var application = story.application_name || 'Not specified';
            var priority = story.priority || 'Medium';
            
            // Clean up text
            storyDescription = this._cleanText(storyDescription);
            acceptanceCriteria = this._cleanText(acceptanceCriteria);
            
            // Build system prompt
            var systemPrompt = 
                "You are an expert Quality Assurance test case generator for ServiceNow Test Management 2.0. " +
                "Your role is to create comprehensive, detailed, and professional test cases from user stories. " +
                "\n\n" +
                "**YOUR EXPERTISE:**\n" +
                "- Deep knowledge of software testing methodologies (positive, negative, edge cases, boundary conditions)\n" +
                "- Understanding of user story format and acceptance criteria\n" +
                "- Expertise in test case structure and best practices\n" +
                "- Ability to identify all critical test scenarios\n" +
                "\n\n" +
                "**YOUR OUTPUT:**\n" +
                "- Must be valid JSON only (no markdown, no code blocks, no explanations)\n" +
                "- Must follow the exact structure provided\n" +
                "- Must include diverse test scenarios (happy path, negative, edge cases)\n" +
                "- Test steps must be clear, actionable, and use imperative verbs\n" +
                "- Expected results must be specific and measurable\n" +
                "\n\n" +
                "**QUALITY STANDARDS:**\n" +
                "- Professional language and formatting\n" +
                "- Comprehensive coverage of acceptance criteria\n" +
                "- Clear, unambiguous test steps\n" +
                "- Realistic test data examples\n" +
                "- Logical step ordering (increments of 100)\n" +
                "\n\n" +
                "Generate test cases that a professional QA engineer would create.";

            // Build user prompt
            var userPrompt = 
                "Generate comprehensive test cases for the following user story:\n" +
                "\n" +
                "**USER STORY INFORMATION:**\n" +
                "─────────────────────────────────────────────────────────────\n" +
                "Story Number:     " + storyNumber + "\n" +
                "Story Title:      " + storyTitle + "\n" +
                "\n" +
                "Description:\n" +
                storyDescription + "\n" +
                "\n" +
                "Acceptance Criteria:\n" +
                acceptanceCriteria + "\n" +
                "\n" +
                "Application:      " + application + "\n" +
                "Priority:         " + priority + "\n" +
                "─────────────────────────────────────────────────────────────\n" +
                "\n\n" +
                
                "**REQUIREMENTS:**\n" +
                "- Generate at least " + this.TEST_CASE_COUNT + " test cases minimum\n" +
                "- Each test case should have 3-8 steps\n" +
                "- Step order MUST increment by 100 (100, 200, 300, etc.)\n" +
                "- Cover positive scenarios, negative scenarios, edge cases, and boundary conditions\n" +
                "- Use imperative verbs for steps (Navigate, Click, Enter, Verify, Select, etc.)\n" +
                "- Include realistic test data where applicable\n" +
                "\n\n" +
                
                "**CRITICAL FIELD MAPPING RULES:**\n" +
                "1. testData.short_description AND versionData.short_description MUST be IDENTICAL\n" +
                "2. Both should contain: Brief one-line summary of what the TEST validates\n" +
                "3. Example: \"Verify user can login with valid credentials\"\n" +
                "4. DO NOT use generic text like \"Version 1.0\" or \"Initial version\" for versionData.short_description\n" +
                "5. versionData.short_description = testData.short_description (ALWAYS)\n" +
                "\n\n" +
                
                "**OUTPUT FORMAT (Valid JSON Only):**\n" +
                "{\n" +
                "  \"test_cases\": [\n" +
                "    {\n" +
                "      \"testData\": {\n" +
                "        \"name\": \"Test - Brief descriptive name\",\n" +
                "        \"short_description\": \"One-line summary of what this test validates\",\n" +
                "        \"description\": \"Detailed description of the test purpose and scope\",\n" +
                "        \"test_type\": \"functional\",\n" +
                "        \"priority\": \"High\",\n" +
                "        \"state\": \"draft\"\n" +
                "      },\n" +
                "      \"versionData\": {\n" +
                "        \"version\": \"1.0\",\n" +
                "        \"short_description\": \"SAME as testData.short_description (CRITICAL)\",\n" +
                "        \"description\": \"Version 1.0 - Initial test version\",\n" +
                "        \"state\": \"draft\",\n" +
                "        \"priority\": \"High\"\n" +
                "      },\n" +
                "      \"stepsData\": [\n" +
                "        {\n" +
                "          \"order\": 100,\n" +
                "          \"step\": \"Navigate to [specific page/screen]\",\n" +
                "          \"expected_result\": \"[Specific expected outcome]\",\n" +
                "          \"test_data\": \"[Relevant test data if applicable]\",\n" +
                "          \"description\": \"[Optional additional context]\"\n" +
                "        },\n" +
                "        {\n" +
                "          \"order\": 200,\n" +
                "          \"step\": \"Enter [specific data] in [field name]\",\n" +
                "          \"expected_result\": \"[Specific validation or behavior]\",\n" +
                "          \"test_data\": \"[Example: username: testuser@example.com]\",\n" +
                "          \"description\": \"[Optional context]\"\n" +
                "        }\n" +
                "      ]\n" +
                "    }\n" +
                "  ]\n" +
                "}\n" +
                "\n\n" +
                
                "**EXAMPLES OF GOOD TEST CASES:**\n" +
                "\n" +
                "✅ CORRECT Example:\n" +
                "{\n" +
                "  \"testData\": {\n" +
                "    \"name\": \"Test - User Login Success\",\n" +
                "    \"short_description\": \"Verify user can login with valid credentials\",\n" +
                "    \"test_type\": \"functional\",\n" +
                "    \"priority\": \"High\"\n" +
                "  },\n" +
                "  \"versionData\": {\n" +
                "    \"version\": \"1.0\",\n" +
                "    \"short_description\": \"Verify user can login with valid credentials\",\n" +
                "    \"priority\": \"High\"\n" +
                "  },\n" +
                "  \"stepsData\": [\n" +
                "    {\n" +
                "      \"order\": 100,\n" +
                "      \"step\": \"Navigate to login page\",\n" +
                "      \"expected_result\": \"Login page displays with email and password fields\",\n" +
                "      \"test_data\": \"URL: /login\"\n" +
                "    },\n" +
                "    {\n" +
                "      \"order\": 200,\n" +
                "      \"step\": \"Enter valid email address\",\n" +
                "      \"expected_result\": \"Email field accepts input without validation errors\",\n" +
                "      \"test_data\": \"email: testuser@example.com\"\n" +
                "    }\n" +
                "  ]\n" +
                "}\n" +
                "\n" +
                "❌ INCORRECT Example:\n" +
                "{\n" +
                "  \"testData\": {\n" +
                "    \"short_description\": \"Verify user can login with valid credentials\"\n" +
                "  },\n" +
                "  \"versionData\": {\n" +
                "    \"short_description\": \"Initial version\"  ← WRONG! Must match testData\n" +
                "  }\n" +
                "}\n" +
                "\n\n" +
                
                "**TEST SCENARIO COVERAGE:**\n" +
                "Ensure you generate test cases covering:\n" +
                "1. Happy Path: Standard successful flow through the feature\n" +
                "2. Negative Cases: Invalid inputs, missing required fields, unauthorized access\n" +
                "3. Edge Cases: Boundary values, special characters, maximum lengths\n" +
                "4. Integration Points: How feature interacts with other system components\n" +
                "5. Error Handling: How system responds to errors and exceptions\n" +
                "\n\n" +
                
                "**REMEMBER:**\n" +
                "- Output ONLY valid JSON (no markdown code blocks like ```json)\n" +
                "- testData.short_description MUST equal versionData.short_description\n" +
                "- Step order increments by 100 (100, 200, 300, ...)\n" +
                "- Be specific and actionable in all steps and expected results\n" +
                "- Provide realistic test data examples\n" +
                "\n" +
                "Generate the test cases now.";
            
            return {
                system: systemPrompt,
                user: userPrompt
            };
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._buildPrompt: ' + e);
            return null;
        }
    },

    /**
     * Clean text - remove excess whitespace and line breaks
     * @param {String} text - Text to clean
     * @returns {String} - Cleaned text
     */
    _cleanText: function(text) {
        if (!text) return '';
        
        // Replace multiple spaces/tabs with single space
        text = text.replace(/\s+/g, ' ');
        
        // Replace multiple line breaks with double line break
        text = text.replace(/\n{3,}/g, '\n\n');
        
        // Trim leading/trailing whitespace
        text = text.trim();
        
        return text;
    },

    /**
     * Call Azure OpenAI API
     * @param {Object} prompts - {system: systemPrompt, user: userPrompt}
     * @returns {Object} - {success: boolean, data: string, usage: object, rawResponse: object}
     */
    _callAzureOpenAI: function(prompts) {
        try {
            // Build endpoint
            var endpoint = this.AZURE_ENDPOINT + 
                          '/openai/deployments/' + this.DEPLOYMENT_NAME + 
                          '/chat/completions?api-version=' + this.API_VERSION;
            
            gs.info(this.LOG_PREFIX + ': Calling Azure OpenAI...');
            gs.debug(this.LOG_PREFIX + ': Endpoint: ' + endpoint);
            
            // Build request
            var request = new sn_ws.RESTMessageV2();
            request.setEndpoint(endpoint);
            request.setHttpMethod('POST');
            request.setRequestHeader('Content-Type', 'application/json');
            request.setRequestHeader('api-key', this.AZURE_API_KEY);
            request.setHttpTimeout(this.TIMEOUT);
            
            // Build payload
            var payload = {
                messages: [
                    {
                        role: 'system',
                        content: prompts.system
                    },
                    {
                        role: 'user',
                        content: prompts.user
                    }
                ],
                temperature: 0.8,
                max_tokens: 8000,
                response_format: { type: 'json_object' }
            };
            
            request.setRequestBody(JSON.stringify(payload));
            
            // Execute request
            var startTime = new GlideDateTime();
            var response = request.execute();
            var endTime = new GlideDateTime();
            
            var statusCode = response.getStatusCode();
            var responseBody = response.getBody();
            
            gs.info(this.LOG_PREFIX + ': API Response Status: ' + statusCode);
            
            if (statusCode == 200) {
                var responseObj = JSON.parse(responseBody);
                
                // Extract content
                var content = responseObj.choices[0].message.content;
                
                // Extract usage data
                var usage = responseObj.usage || {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                };
                
                gs.info(this.LOG_PREFIX + ': Token Usage - Prompt: ' + usage.prompt_tokens + 
                       ', Completion: ' + usage.completion_tokens + 
                       ', Total: ' + usage.total_tokens);
                
                return {
                    success: true,
                    data: content,
                    usage: usage,
                    rawResponse: responseObj
                };
                
            } else {
                gs.error(this.LOG_PREFIX + ': API Error ' + statusCode + ': ' + responseBody);
                return {
                    success: false,
                    message: 'API returned status ' + statusCode + ': ' + responseBody,
                    usage: null
                };
            }
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._callAzureOpenAI: ' + e);
            return {
                success: false,
                message: 'Exception calling Azure OpenAI: ' + e,
                usage: null
            };
        }
    },

    /**
     * Parse AI response into structured data
     * @param {String} content - Raw AI response content
     * @returns {Object} - Parsed test cases object
     */
    _parseAIResponse: function(content) {
        try {
            gs.debug(this.LOG_PREFIX + ': Parsing AI response...');
            
            // Remove markdown code blocks if present
            var cleanContent = content;
            
            // Remove ```json and ``` if present
            cleanContent = cleanContent.replace(/```json\n?/g, '');
            cleanContent = cleanContent.replace(/```\n?/g, '');
            cleanContent = cleanContent.trim();
            
            // Parse JSON
            var parsed = JSON.parse(cleanContent);
            
            // Validate structure
            if (!parsed.test_cases || !Array.isArray(parsed.test_cases)) {
                gs.error(this.LOG_PREFIX + ': Invalid response structure - missing test_cases array');
                return null;
            }
            
            gs.info(this.LOG_PREFIX + ': Successfully parsed ' + parsed.test_cases.length + ' test cases');
            
            return parsed;
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._parseAIResponse: ' + e);
            gs.error(this.LOG_PREFIX + ': Failed to parse content: ' + content.substring(0, 500));
            return null;
        }
    },

    /**
     * Create test cases from AI response
     * @param {Object} aiData - Parsed AI response with test cases
     * @param {String} storyId - User story sys_id
     * @returns {Object} - Creation results
     */
    _createTestCases: function(aiData, storyId) {
        var createdTests = [];
        var successCount = 0;
        var failureCount = 0;
        
        // Validate inputs
        if (!aiData || !aiData.test_cases || aiData.test_cases.length === 0) {
            return {
                success: false,
                successCount: 0,
                failureCount: 0,
                message: 'No test cases in AI response',
                createdTests: []
            };
        }
        
        // Get story details for reference
        var storyNumber = '';
        var storyTitle = '';
        var storyGr = new GlideRecord('rm_story');
        if (storyGr.get(storyId)) {
            storyNumber = storyGr.getValue('number');
            storyTitle = storyGr.getValue('short_description');
            gs.info(this.LOG_PREFIX + ': Creating tests for story ' + storyNumber + ' (' + storyId + ')');
        }

        // Loop through each test case
        for (var i = 0; i < aiData.test_cases.length; i++) {
            var testCase = aiData.test_cases[i];
            
            try {
                // Prepare Test Data
                var testData = {
                    name: testCase.testData.name,
                    short_description: testCase.testData.short_description,
                    description: testCase.testData.description || '',
                    test_type: testCase.testData.test_type || 'functional',
                    priority: this._mapPriority(testCase.testData.priority),
                    state: testCase.testData.state || 'draft',
                    parent: storyId  // Link to User Story
                };
                
                // Add story reference to description
                if (storyNumber) {
                    testData.description = 
                        'Generated from User Story: ' + storyNumber + ' - ' + storyTitle + '\n\n' +
                        testData.description;
                }
                
                gs.info(this.LOG_PREFIX + ': Test #' + (i+1) + ' will be linked to story: ' + storyId);
                
                // Prepare Version Data
                var versionData = {
                    version: testCase.versionData.version || '1.0',
                    short_description: testCase.versionData.short_description,
                    description: testCase.versionData.description || '',
                    state: testCase.versionData.state || 'draft',
                    priority: this._mapPriority(testCase.versionData.priority)
                };
                
                // Prepare Steps Data
                var stepsData = testCase.stepsData || [];
                
                // Create complete test
                var utils = new TestManagementUtils();
                var result = utils.createCompleteTest(testData, versionData, stepsData, storyId);
                
                if (result.success) {
                    successCount++;
                    createdTests.push({
                        testId: result.testId,
                        versionId: result.versionId,
                        stepIds: result.stepIds,
                        testName: testData.name,
                        linkedToStory: storyId
                    });
                    
                    gs.info(this.LOG_PREFIX + ': ✅ Created and linked test: ' + testData.name);
                } else {
                    failureCount++;
                    gs.error(this.LOG_PREFIX + ': ❌ Failed to create test: ' + result.message);
                }
                
            } catch (e) {
                failureCount++;
                gs.error(this.LOG_PREFIX + ': Error creating test case: ' + e);
            }
        }

        // Verify story linkage
        this._verifyStoryLinkage(storyId, createdTests);
        
        return {
            success: successCount > 0,
            successCount: successCount,
            failureCount: failureCount,
            createdTests: createdTests,
            storyId: storyId,
            message: successCount > 0 ? 
                'Created ' + successCount + ' test cases successfully' :
                'Failed to create any test cases'
        };
    },

    /**
     * Verify that tests are properly linked to story
     * @param {String} storyId - User story sys_id
     * @param {Array} createdTests - Array of created test objects
     */
    /**
 * Verify that tests are properly linked to story via M2M table
 * @param {String} storyId - User story sys_id
 * @param {Array} createdTests - Array of created test objects
 */
    _verifyStoryLinkage: function(storyId, createdTests) {
        try {
            gs.info(this.LOG_PREFIX + ': Verifying story linkage via M2M...');
            
            var m2mTable = 'sn_test_management_m2m_task_test';
            
            // Count M2M links for this story
            var m2mGr = new GlideRecord(m2mTable);
            m2mGr.addQuery('task', storyId);
            m2mGr.query();
            var linkedCount = m2mGr.getRowCount();
            
            gs.info(this.LOG_PREFIX + ': ✅ Total M2M links for this story: ' + linkedCount);
            gs.info(this.LOG_PREFIX + ': ✅ Tests created in this session: ' + createdTests.length);
            
            // Verify each test's M2M link
            for (var i = 0; i < createdTests.length; i++) {
                var test = createdTests[i];
                
                var checkGr = new GlideRecord(m2mTable);
                checkGr.addQuery('task', storyId);
                checkGr.addQuery('test', test.testId);
                checkGr.query();
                
                if (checkGr.next()) {
                    gs.debug(this.LOG_PREFIX + ':   ✅ ' + test.testName + ' → Linked via M2M');
                } else {
                    gs.error(this.LOG_PREFIX + ':   ❌ ' + test.testName + ' → M2M link MISSING');
                }
            }
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._verifyStoryLinkage: ' + e);
        }
    },

    /**
     * Map priority from various formats to ServiceNow values
     * @param {String} priority - Priority value from AI
     * @returns {String} - Mapped priority (High, Medium, Low)
     */
    _mapPriority: function(priority) {
        if (!priority) {
            return 'Medium'; // Default
        }
        
        // Normalize to string and lowercase
        var priorityStr = String(priority).toLowerCase().trim();
        
        // Map various AI outputs to ServiceNow values
        var priorityMap = {
            // High priority variants
            'high': 'High',
            '1': 'High',
            'critical': 'High',
            'urgent': 'High',
            
            // Medium priority variants
            'medium': 'Medium',
            '2': 'Medium',
            '3': 'Medium',
            'normal': 'Medium',
            'moderate': 'Medium',
            
            // Low priority variants
            'low': 'Low',
            '4': 'Low',
            '5': 'Low',
            'minor': 'Low'
        };
        
        // Return mapped value or default
        return priorityMap[priorityStr] || 'Medium';
    },

    /**
     * Check if a field exists on a table
     * @param {String} tableName - Table name
     * @param {String} fieldName - Field name
     * @returns {Boolean} - True if field exists
     */
    _fieldExists: function(tableName, fieldName) {
        try {
            var fieldGr = new GlideRecord('sys_dictionary');
            fieldGr.addQuery('name', tableName);
            fieldGr.addQuery('element', fieldName);
            fieldGr.query();
            
            return fieldGr.hasNext();
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._fieldExists: ' + e);
            return false;
        }
    },

    /**
     * Log generation attempt with cost tracking
     * @param {String} storyId - User story sys_id
     * @param {Object} result - Generation result
     * @param {Number} duration - Duration in seconds
     * @param {Object} apiResponse - Raw API response
     */
    _logGeneration: function(storyId, result, duration, apiResponse) {
        try {
            var logGr = new GlideRecord('u_ai_test_generation_log');
            logGr.initialize();
            
            // Basic info
            logGr.setValue('u_story', storyId);
            logGr.setValue('u_generated_at', new GlideDateTime());
            logGr.setValue('u_success', result.success);
            logGr.setValue('u_test_count', result.successCount || 0);
            logGr.setValue('u_failed_count', result.failureCount || 0);
            logGr.setValue('u_error_message', result.message || '');
            logGr.setValue('u_generated_by', gs.getUserID());
            logGr.setValue('u_duration_seconds', duration);
            
            // Cost tracking
            if (apiResponse && apiResponse.usage) {
                var usage = apiResponse.usage;
                
                logGr.setValue('u_input_tokens', usage.prompt_tokens || 0);
                logGr.setValue('u_output_tokens', usage.completion_tokens || 0);
                logGr.setValue('u_total_tokens', usage.total_tokens || 0);
                logGr.setValue('u_model', this.DEPLOYMENT_NAME);
                
                // Calculate cost
                var costCalc = new AIUsageCostCalculator();
                var cost = costCalc.calculateCost(
                    usage.prompt_tokens || 0,
                    usage.completion_tokens || 0,
                    this.DEPLOYMENT_NAME
                );
                
                logGr.setValue('u_input_cost', cost.inputCost);
                logGr.setValue('u_output_cost', cost.outputCost);
                logGr.setValue('u_estimated_cost', cost.totalCost);
                
                gs.info(this.LOG_PREFIX + ': Cost for this generation: $' + cost.totalCost);
                gs.info(this.LOG_PREFIX + ': Tokens - Input: ' + usage.prompt_tokens + 
                       ', Output: ' + usage.completion_tokens + 
                       ', Total: ' + usage.total_tokens);
            }
            
            logGr.insert();
            gs.debug(this.LOG_PREFIX + ': Generation logged successfully');
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._logGeneration: ' + e);
        }
    },

    type: 'AzureOpenAITestGenerator'
};