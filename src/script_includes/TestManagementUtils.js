/**
 * Script Include: TestManagementUtils
 * Description: Utility functions for creating Test Management 2.0 test cases
 * Type: Classless
 * API: Available for Client and Server side
 * Version: 1.0
 */


var TestManagementUtils = Class.create();
TestManagementUtils.prototype = {
    
    /**
     * Initialize with table names and configuration
     */
    initialize: function() {
        // Table names
        this.TEST_TABLE = 'sn_test_management_test';
        this.TEST_VERSION_TABLE = 'sn_test_management_test_version';
        this.TEST_STEP_TABLE = 'sn_test_management_step';
        
        // Logging prefix
        this.LOG_PREFIX = 'TestManagementUtils';
        
        gs.debug(this.LOG_PREFIX + ': Initialized');
    },

    /**
     * Create a complete test with version and steps
     * @param {Object} testData - Test details
     * @param {Object} versionData - Version details
     * @param {Array} stepsData - Array of step objects
     * @returns {Object} - {success: boolean, testId: string, versionId: string, stepIds: array, message: string}
     */
    /**
 * Create a complete test with version and steps, then link to story
 * @param {Object} testData - Test details
 * @param {Object} versionData - Version details
 * @param {Array} stepsData - Array of step objects
 * @param {String} storyId - User story sys_id (for M2M linking)
 * @returns {Object} - {success: boolean, testId: string, versionId: string, stepIds: array, m2mId: string, message: string}
 */
    createCompleteTest: function(testData, versionData, stepsData, storyId) {
        try {
            gs.debug(this.LOG_PREFIX + ': Creating complete test...');
            
            // Validate inputs
            if (!testData || !testData.name) {
                throw 'testData.name is required';
            }
            
            if (!testData.short_description) {
                throw 'testData.short_description is required';
            }
            
            if (!versionData) {
                throw 'versionData is required';
            }
            
            if (!stepsData || !Array.isArray(stepsData)) {
                throw 'stepsData must be an array';
            }
            
            // Log what we're about to create
            gs.info(this.LOG_PREFIX + ': Creating test: ' + testData.name);
            
            // REMOVE parent from testData (we'll use M2M instead)
            delete testData.parent;
            
            // Step 1: Create Test Record
            var testId = this.createTest(testData);
            if (!testId) {
                throw 'Failed to create test record';
            }
            
            gs.info(this.LOG_PREFIX + ': ✅ Test created with ID: ' + testId);
            
            // Step 2: Prepare Version Data
            versionData.test = testId;
            
            // CRITICAL FIX: Copy short_description from test to version
            if (testData.short_description) {
                versionData.short_description = testData.short_description;
            }
            
            // Step 3: Create Test Version Record
            var versionId = this.createTestVersion(versionData);
            if (!versionId) {
                throw 'Failed to create test version record';
            }
            
            gs.info(this.LOG_PREFIX + ': ✅ Version created with ID: ' + versionId);
            
            // Step 4: Create Test Steps
            var stepIds = this.createTestSteps(versionId, stepsData);
            
            gs.info(this.LOG_PREFIX + ': ✅ Created ' + stepIds.length + ' test steps');
            
            // Step 5: Link test to story via M2M table
            var m2mId = null;
            if (storyId) {
                m2mId = this.linkTestToStory(storyId, testId);
                
                if (m2mId) {
                    gs.info(this.LOG_PREFIX + ': ✅ Linked test to story via M2M: ' + m2mId);
                } else {
                    gs.warn(this.LOG_PREFIX + ': ⚠️  Failed to create M2M link');
                }
            }
            
            // Verify short_description match
            this._verifyShortDescriptionMatch(testId, versionId);
            
            // Return success
            gs.info(this.LOG_PREFIX + ': Successfully created complete test structure');
            
            return {
                success: true,
                testId: testId,
                versionId: versionId,
                stepIds: stepIds,
                m2mId: m2mId,
                message: 'Test created successfully with ' + stepIds.length + ' steps' +
                        (m2mId ? ' and linked to story' : '')
            };
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.createCompleteTest: ' + e);
            return {
                success: false,
                testId: null,
                versionId: null,
                stepIds: [],
                m2mId: null,
                message: 'Error creating test: ' + e
            };
        }
    },

    /**
     * Create a test record in sn_test_management_test table
     * @param {Object} data - Test data
     * @returns {String} - Test sys_id or null
     */
    createTest: function(data) {
        try {
            gs.debug(this.LOG_PREFIX + ': Creating test record...');
            
            var gr = new GlideRecord(this.TEST_TABLE);
            gr.initialize();
            
            // Required fields
            if (data.name) {
                gr.setValue('name', data.name);
            } else {
                gs.error(this.LOG_PREFIX + ': Test name is required');
                return null;
            }
            
            if (data.short_description) {
                gr.setValue('short_description', data.short_description);
                gs.debug(this.LOG_PREFIX + ': Setting test short_description: ' + data.short_description);
            } else {
                gs.warn(this.LOG_PREFIX + ': Test short_description not provided');
            }
            
            // Optional fields
            if (data.description) {
                gr.setValue('description', data.description);
            }
            
            if (data.test_type) {
                gr.setValue('test_type', data.test_type);
            }
            
            if (data.priority) {
                gr.setValue('priority', data.priority);
            }
            
            if (data.state) {
                gr.setValue('state', data.state);
            }
            
            // Link to parent user story
            if (data.parent) {
                gr.setValue('parent', data.parent);
                gs.debug(this.LOG_PREFIX + ': Linking test to story: ' + data.parent);
            }
            
            // Insert the record
            var testId = gr.insert();
            
            if (testId) {
                gs.info(this.LOG_PREFIX + ': Test record created: ' + testId);
                gs.debug(this.LOG_PREFIX + ': Test name: ' + data.name);
                return testId;
            } else {
                gs.error(this.LOG_PREFIX + ': Failed to insert test record');
                return null;
            }
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.createTest: ' + e);
            return null;
        }
    },

    /**
     * Create a test version record in sn_test_management_test_version table
     * @param {Object} data - Version data
     * @returns {String} - Version sys_id or null
     */
    createTestVersion: function(data) {
        try {
            gs.debug(this.LOG_PREFIX + ': Creating test version record...');
            
            var gr = new GlideRecord(this.TEST_VERSION_TABLE);
            gr.initialize();
            
            // Required: Link to test
            if (data.test) {
                gr.setValue('test', data.test);
            } else {
                gs.error(this.LOG_PREFIX + ': Test reference is required for version');
                return null;
            }
            
            // Version number
            if (data.version) {
                gr.setValue('version', data.version);
            } else {
                gr.setValue('version', '1.0'); // Default version
            }
            
            // Short description (CRITICAL - must match test)
            if (data.short_description) {
                gr.setValue('short_description', data.short_description);
                gs.info(this.LOG_PREFIX + ': Setting version short_description: ' + data.short_description);
            } else {
                // Fallback to version number if not provided
                gr.setValue('short_description', 'Version ' + (data.version || '1.0'));
                gs.warn(this.LOG_PREFIX + ': Version short_description not provided, using default');
            }
            
            // Optional fields
            if (data.description) {
                gr.setValue('description', data.description);
            }
            
            if (data.state) {
                gr.setValue('state', data.state);
            } else {
                gr.setValue('state', 'draft'); // Default state
            }
            
            if (data.priority) {
                gr.setValue('priority', data.priority);
            }
            
            // Insert the record
            var versionId = gr.insert();
            
            if (versionId) {
                gs.info(this.LOG_PREFIX + ': Version record created: ' + versionId);
                gs.debug(this.LOG_PREFIX + ': Version: ' + (data.version || '1.0'));
                return versionId;
            } else {
                gs.error(this.LOG_PREFIX + ': Failed to insert version record');
                return null;
            }
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.createTestVersion: ' + e);
            return null;
        }
    },

    /**
     * Create multiple test step records
     * @param {String} versionId - Test version sys_id
     * @param {Array} stepsData - Array of step objects
     * @returns {Array} - Array of created step sys_ids
     */
    createTestSteps: function(versionId, stepsData) {
        var stepIds = [];
        
        if (!versionId) {
            gs.error(this.LOG_PREFIX + ': Version ID is required to create steps');
            return stepIds;
        }
        
        if (!stepsData || stepsData.length === 0) {
            gs.warn(this.LOG_PREFIX + ': No steps data provided');
            return stepIds;
        }
        
        gs.debug(this.LOG_PREFIX + ': Creating ' + stepsData.length + ' test steps...');
        
        // Create each step
        for (var i = 0; i < stepsData.length; i++) {
            var stepData = stepsData[i];
            
            gs.debug(this.LOG_PREFIX + ': Creating step ' + (i + 1) + ' of ' + stepsData.length);
            
            var stepId = this.createTestStep(versionId, stepData);
            
            if (stepId) {
                stepIds.push(stepId);
                gs.debug(this.LOG_PREFIX + ': Step ' + (i + 1) + ' created: ' + stepId);
            } else {
                gs.error(this.LOG_PREFIX + ': Failed to create step ' + (i + 1));
            }
        }
        
        gs.info(this.LOG_PREFIX + ': Successfully created ' + stepIds.length + ' of ' + stepsData.length + ' steps');
        
        return stepIds;
    },

    /**
     * Create a single test step record
     * @param {String} versionId - Test version sys_id
     * @param {Object} data - Step data
     * @returns {String} - Step sys_id or null
     */
    createTestStep: function(versionId, data) {
        try {
            var gr = new GlideRecord(this.TEST_STEP_TABLE);
            gr.initialize();
            
            // Required: Link to version
            if (versionId) {
                gr.setValue('test_version', versionId);
            } else {
                gs.error(this.LOG_PREFIX + ': Version ID is required for step');
                return null;
            }
            
            // Order (required for sequencing)
            if (data.order) {
                gr.setValue('order', data.order);
            } else {
                gs.error(this.LOG_PREFIX + ': Step order is required');
                return null;
            }
            
            // Step description (required)
            if (data.step) {
                gr.setValue('step', data.step);
            } else {
                gs.error(this.LOG_PREFIX + ': Step description is required');
                return null;
            }
            
            // Optional fields
            if (data.expected_result) {
                gr.setValue('expected_result', data.expected_result);
            }
            
            if (data.test_data) {
                gr.setValue('test_data', data.test_data);
            }
            
            if (data.description) {
                gr.setValue('description', data.description);
            }
            
            // Insert the record
            var stepId = gr.insert();
            
            if (stepId) {
                gs.debug(this.LOG_PREFIX + ': Step created: ' + stepId + ' (Order: ' + data.order + ')');
                return stepId;
            } else {
                gs.error(this.LOG_PREFIX + ': Failed to insert step record');
                return null;
            }
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.createTestStep: ' + e);
            return null;
        }
    },

    /**
     * Verify that test and version short_description match
     * @param {String} testId - Test sys_id
     * @param {String} versionId - Version sys_id
     */
    _verifyShortDescriptionMatch: function(testId, versionId) {
        try {
            // Get test short_description
            var testGr = new GlideRecord(this.TEST_TABLE);
            if (!testGr.get(testId)) {
                gs.error(this.LOG_PREFIX + ': Cannot verify - test not found: ' + testId);
                return;
            }
            var testShortDesc = testGr.getValue('short_description');
            
            // Get version short_description
            var versionGr = new GlideRecord(this.TEST_VERSION_TABLE);
            if (!versionGr.get(versionId)) {
                gs.error(this.LOG_PREFIX + ': Cannot verify - version not found: ' + versionId);
                return;
            }
            var versionShortDesc = versionGr.getValue('short_description');
            
            // Compare
            gs.info(this.LOG_PREFIX + ': ========================================');
            gs.info(this.LOG_PREFIX + ': SHORT DESCRIPTION VERIFICATION');
            gs.info(this.LOG_PREFIX + ': ========================================');
            gs.info(this.LOG_PREFIX + ': Test short_description:    "' + testShortDesc + '"');
            gs.info(this.LOG_PREFIX + ': Version short_description: "' + versionShortDesc + '"');
            
            if (testShortDesc === versionShortDesc) {
                gs.info(this.LOG_PREFIX + ': ✅ SHORT DESCRIPTIONS MATCH!');
            } else {
                gs.error(this.LOG_PREFIX + ': ❌ SHORT DESCRIPTIONS DO NOT MATCH!');
                gs.error(this.LOG_PREFIX + ': This is a bug - they should be identical');
            }
            gs.info(this.LOG_PREFIX + ': ========================================');
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '._verifyShortDescriptionMatch: ' + e);
        }
    },

    /**
     * Get test record by sys_id
     * @param {String} testId - Test sys_id
     * @returns {Object} - Test data or null
     */
    getTest: function(testId) {
        try {
            var gr = new GlideRecord(this.TEST_TABLE);
            
            if (!gr.get(testId)) {
                gs.warn(this.LOG_PREFIX + ': Test not found: ' + testId);
                return null;
            }
            
            return {
                sys_id: gr.getUniqueValue(),
                number: gr.getValue('number'),
                name: gr.getValue('name'),
                short_description: gr.getValue('short_description'),
                description: gr.getValue('description'),
                test_type: gr.getValue('test_type'),
                priority: gr.getValue('priority'),
                state: gr.getValue('state'),
                parent: gr.getValue('parent')
            };
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.getTest: ' + e);
            return null;
        }
    },

    /**
     * Get test version record by sys_id
     * @param {String} versionId - Version sys_id
     * @returns {Object} - Version data or null
     */
    getTestVersion: function(versionId) {
        try {
            var gr = new GlideRecord(this.TEST_VERSION_TABLE);
            
            if (!gr.get(versionId)) {
                gs.warn(this.LOG_PREFIX + ': Version not found: ' + versionId);
                return null;
            }
            
            return {
                sys_id: gr.getUniqueValue(),
                test: gr.getValue('test'),
                version: gr.getValue('version'),
                short_description: gr.getValue('short_description'),
                description: gr.getValue('description'),
                state: gr.getValue('state'),
                priority: gr.getValue('priority')
            };
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.getTestVersion: ' + e);
            return null;
        }
    },

    /**
     * Get all steps for a test version
     * @param {String} versionId - Version sys_id
     * @returns {Array} - Array of step objects
     */
    getTestSteps: function(versionId) {
        var steps = [];
        
        try {
            var gr = new GlideRecord(this.TEST_STEP_TABLE);
            gr.addQuery('test_version', versionId);
            gr.orderBy('order');
            gr.query();
            
            while (gr.next()) {
                steps.push({
                    sys_id: gr.getUniqueValue(),
                    test_version: gr.getValue('test_version'),
                    order: gr.getValue('order'),
                    step: gr.getValue('step'),
                    expected_result: gr.getValue('expected_result'),
                    test_data: gr.getValue('test_data'),
                    description: gr.getValue('description')
                });
            }
            
            gs.debug(this.LOG_PREFIX + ': Retrieved ' + steps.length + ' steps for version: ' + versionId);
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.getTestSteps: ' + e);
        }
        
        return steps;
    },

    /**
     * Delete a complete test including version and steps
     * @param {String} testId - Test sys_id
     * @returns {Boolean} - True if deleted successfully
     */
    deleteCompleteTest: function(testId) {
        try {
            gs.info(this.LOG_PREFIX + ': Deleting complete test: ' + testId);
            
            // Get all versions for this test
            var versionGr = new GlideRecord(this.TEST_VERSION_TABLE);
            versionGr.addQuery('test', testId);
            versionGr.query();
            
            var versionCount = 0;
            var stepCount = 0;
            
            // Delete each version and its steps
            while (versionGr.next()) {
                var versionId = versionGr.getUniqueValue();
                
                // Delete steps for this version
                var stepGr = new GlideRecord(this.TEST_STEP_TABLE);
                stepGr.addQuery('test_version', versionId);
                stepGr.deleteMultiple();
                stepCount += stepGr.getRowCount();
                
                versionCount++;
            }
            
            // Delete all versions
            versionGr.initialize();
            versionGr.addQuery('test', testId);
            versionGr.deleteMultiple();
            
            // Delete the test
            var testGr = new GlideRecord(this.TEST_TABLE);
            if (testGr.get(testId)) {
                testGr.deleteRecord();
            }
            
            gs.info(this.LOG_PREFIX + ': Deleted test, ' + versionCount + ' versions, and ' + stepCount + ' steps');
            
            return true;
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.deleteCompleteTest: ' + e);
            return false;
        }
    },

    /**
     * Count tests linked to a user story
     * @param {String} storyId - User story sys_id
     * @returns {Number} - Count of linked tests
     */
    countTestsForStory: function(storyId) {
        try {
            var gr = new GlideRecord(this.TEST_TABLE);
            gr.addQuery('parent', storyId);
            gr.query();
            
            var count = gr.getRowCount();
            gs.debug(this.LOG_PREFIX + ': Found ' + count + ' tests for story: ' + storyId);
            
            return count;
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.countTestsForStory: ' + e);
            return 0;
        }
    },

    /**
     * Validate test data before creation
     * @param {Object} data - Test data to validate
     * @returns {Object} - {valid: boolean, errors: array}
     */
    validateTestData: function(data) {
        var errors = [];
        
        // Required fields
        if (!data.name || data.name.trim() === '') {
            errors.push('Test name is required');
        }
        
        if (!data.short_description || data.short_description.trim() === '') {
            errors.push('Test short_description is required');
        }
        
        // Field length checks
        if (data.name && data.name.length > 100) {
            errors.push('Test name exceeds 100 characters');
        }
        
        if (data.short_description && data.short_description.length > 200) {
            errors.push('Short description exceeds 200 characters');
        }
        
        // Valid values
        var validTestTypes = ['functional', 'performance', 'security', 'integration', 'regression'];
        if (data.test_type && validTestTypes.indexOf(data.test_type) === -1) {
            errors.push('Invalid test_type: ' + data.test_type);
        }
        
        var validPriorities = ['High', 'Medium', 'Low'];
        if (data.priority && validPriorities.indexOf(data.priority) === -1) {
            errors.push('Invalid priority: ' + data.priority);
        }
        
        var validStates = ['draft', 'ready', 'published', 'retired'];
        if (data.state && validStates.indexOf(data.state) === -1) {
            errors.push('Invalid state: ' + data.state);
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Validate step data before creation
     * @param {Object} data - Step data to validate
     * @returns {Object} - {valid: boolean, errors: array}
     */
    validateStepData: function(data) {
        var errors = [];
        
        // Required fields
        if (!data.order && data.order !== 0) {
            errors.push('Step order is required');
        }
        
        if (!data.step || data.step.trim() === '') {
            errors.push('Step description is required');
        }
        
        // Field length checks
        if (data.step && data.step.length > 4000) {
            errors.push('Step description exceeds 4000 characters');
        }
        
        if (data.expected_result && data.expected_result.length > 4000) {
            errors.push('Expected result exceeds 4000 characters');
        }
        
        if (data.test_data && data.test_data.length > 4000) {
            errors.push('Test data exceeds 4000 characters');
        }
        
        // Order should be positive
        if (data.order < 0) {
            errors.push('Step order must be a positive number');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    /**
 * Link a test to a user story via M2M table
 * @param {String} storyId - User story sys_id
 * @param {String} testId - Test sys_id
 * @returns {String} - M2M record sys_id or null
 */
    linkTestToStory: function(storyId, testId) {
        try {
            if (!storyId || !testId) {
                gs.error(this.LOG_PREFIX + ': Both storyId and testId are required');
                return null;
            }
            
            var m2mTable = 'sn_test_management_m2m_task_test';
            
            // Check if link already exists
            var checkGr = new GlideRecord(m2mTable);
            checkGr.addQuery('task', storyId);  // Assuming field is 'task'
            checkGr.addQuery('test', testId);   // Assuming field is 'test'
            checkGr.query();
            
            if (checkGr.next()) {
                gs.info(this.LOG_PREFIX + ': M2M link already exists');
                return checkGr.getUniqueValue();
            }
            
            // Create M2M link
            var m2mGr = new GlideRecord(m2mTable);
            m2mGr.initialize();
            m2mGr.setValue('task', storyId);  // Link to story
            m2mGr.setValue('test', testId);   // Link to test
            
            var m2mId = m2mGr.insert();
            
            if (m2mId) {
                gs.info(this.LOG_PREFIX + ': Created M2M link: ' + m2mId);
                gs.info(this.LOG_PREFIX + ':   Story: ' + storyId);
                gs.info(this.LOG_PREFIX + ':   Test: ' + testId);
                return m2mId;
            } else {
                gs.error(this.LOG_PREFIX + ': Failed to create M2M link');
                return null;
            }
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.linkTestToStory: ' + e);
            return null;
        }
    },

    type: 'TestManagementUtils'
};