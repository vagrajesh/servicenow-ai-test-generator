/**
 * Script Include: TestManagementUtils
 * Description: Utility functions for creating Test Management 2.0 test cases
 * Type: Classless
 * API: Available for Client and Server side
 * Version: 1.0
 */

var TestManagementUtils = Class.create();
TestManagementUtils.prototype = {
    initialize: function() {
        // Test Management 2.0 table names
        this.TEST_TABLE = 'sn_test_management_test';
        this.TEST_VERSION_TABLE = 'sn_test_management_test_version';
        this.TEST_STEP_VERSION_TABLE = 'sn_test_management_step';
        
        // Logging prefix
        this.LOG_PREFIX = 'TestManagementUtils';
    },

    /**
     * Create a complete test with version and steps
     * @param {Object} testData - Test details
     * @param {Object} versionData - Version details
     * @param {Array} stepsData - Array of step objects
     * @returns {Object} - Created test, version, and steps sys_ids
     */

	createCompleteTest: function(testData, versionData, stepsData) {
		try {
			// Validate inputs
			if (!testData || !testData.name) {
				throw 'testData.name is required';
			}
			if (!versionData) {
				throw 'versionData is required';
			}
			if (!stepsData || !Array.isArray(stepsData)) {
				throw 'stepsData must be an array';
			}

			// Create Test
			var testId = this.createTest(testData);
			if (!testId) {
				throw 'Failed to create test';
			}

			// Set test reference
			versionData.test = testId;
			
			// CRITICAL FIX: Always copy test short_description to version
			if (testData.short_description) {
				versionData.short_description = testData.short_description;
			}
			
			// Create Test Version
			var versionId = this.createTestVersion(versionData);
			if (!versionId) {
				throw 'Failed to create test version';
			}

			// Create Test Steps
			var stepIds = this.createTestSteps(versionId, stepsData);

			gs.info(this.LOG_PREFIX + ': Successfully created test ' + testId + 
				' with version ' + versionId + ' and ' + stepIds.length + ' steps');

			return {
				success: true,
				testId: testId,
				versionId: versionId,
				stepIds: stepIds,
				message: 'Test created successfully with ' + stepIds.length + ' steps'
			};
		} catch (e) {
			gs.error(this.LOG_PREFIX + '.createCompleteTest: ' + e);
			return {
				success: false,
				message: 'Error creating test: ' + e,
				testId: null,
				versionId: null,
				stepIds: []
			};
		}
	},

    /**
     * Create a test
     * @param {Object} data - Test data
     * @returns {String} - sys_id of created test
     */
    createTest: function(data) {
        try {
            // Validate required fields
            if (!data.name) {
                gs.error(this.LOG_PREFIX + '.createTest: name is required');
                return null;
            }

            var gr = new GlideRecord(this.TEST_TABLE);
            gr.initialize();
            
            // Set mandatory fields
            gr.setValue('name', data.name);
            gr.setValue('short_description', data.short_description || data.name);
            
            // Set optional fields
            if (data.description) gr.setValue('description', data.description);
            if (data.test_type) gr.setValue('test_type', data.test_type);
            if (data.priority) gr.setValue('priority', data.priority);
            if (data.state) gr.setValue('state', data.state);
            if (data.assignment_group) gr.setValue('assignment_group', data.assignment_group);
            if (data.assigned_to) gr.setValue('assigned_to', data.assigned_to);
            if (data.application) gr.setValue('application', data.application);
            if (data.parent) gr.setValue('parent', data.parent); // Link to User Story
            
            var sysId = gr.insert();
            
            if (sysId) {
                gs.info(this.LOG_PREFIX + ': Test created: ' + sysId + ' - ' + data.name);
                return sysId;
            }
            
            gs.error(this.LOG_PREFIX + '.createTest: Failed to insert test record');
            return null;
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.createTest: ' + e);
            return null;
        }
    },

    /**
     * Create a test version
     * @param {Object} data - Version data
     * @returns {String} - sys_id of created version
     */
    /**
 * Create a test version
 * @param {Object} data - Version data
 * @returns {String} - sys_id of created version
 */
	createTestVersion: function(data) {
		try {
			if (!data.test) {
				gs.error(this.LOG_PREFIX + '.createTestVersion: test sys_id is required');
				return null;
			}

			var gr = new GlideRecord(this.TEST_VERSION_TABLE);
			gr.initialize();
			
			gr.setValue('test', data.test);
			gr.setValue('version', data.version || '1.0');
			gr.setValue('state', data.state || 'draft');
			
			// FIX: Use short_description directly if provided, otherwise generate default
			if (data.short_description) {
				gr.setValue('short_description', data.short_description);
			} else {
				gr.setValue('short_description', 'Version ' + (data.version || '1.0'));
			}
			
			if (data.description) {
				gr.setValue('description', data.description);
			} else {
				gr.setValue('description', 'Version ' + (data.version || '1.0') + ' of test case');
			}
			
			if (data.priority) gr.setValue('priority', data.priority);
			
			var sysId = gr.insert();
			
			if (sysId) {
				gs.info(this.LOG_PREFIX + ': Test Version created: ' + sysId + ' - Version ' + (data.version || '1.0'));
				return sysId;
			}
			
			gs.error(this.LOG_PREFIX + '.createTestVersion: Failed to insert version record');
			return null;
		} catch (e) {
			gs.error(this.LOG_PREFIX + '.createTestVersion: ' + e);
			return null;
		}
	},

    /**
     * Create multiple test steps
     * @param {String} versionId - Test version sys_id
     * @param {Array} stepsData - Array of step objects
     * @returns {Array} - Array of created step sys_ids
     */
    createTestSteps: function(versionId, stepsData) {
        var stepIds = [];
        
        try {
            if (!versionId) {
                gs.error(this.LOG_PREFIX + '.createTestSteps: versionId is required');
                return stepIds;
            }
            
            if (!stepsData || !Array.isArray(stepsData)) {
                gs.error(this.LOG_PREFIX + '.createTestSteps: stepsData must be an array');
                return stepIds;
            }

            for (var i = 0; i < stepsData.length; i++) {
                var stepData = stepsData[i];
                var stepId = this.createTestStep(versionId, stepData);
                if (stepId) {
                    stepIds.push(stepId);
                }
            }
            
            gs.info(this.LOG_PREFIX + ': Created ' + stepIds.length + ' test steps for version: ' + versionId);
            return stepIds;
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.createTestSteps: ' + e);
            return stepIds;
        }
    },

    /**
     * Create a single test step
     * @param {String} versionId - Test version sys_id
     * @param {Object} data - Step data
     * @returns {String} - sys_id of created step
     */
    createTestStep: function(versionId, data) {
        try {
            if (!versionId) {
                gs.error(this.LOG_PREFIX + '.createTestStep: versionId is required');
                return null;
            }

            var gr = new GlideRecord(this.TEST_STEP_VERSION_TABLE);
            gr.initialize();
            
            gr.setValue('test_version', versionId);
            gr.setValue('order', data.order || 100);
            gr.setValue('step', data.step || data.description || '');
            
            if (data.expected_result) gr.setValue('expected_result', data.expected_result);
            if (data.test_data) gr.setValue('test_data', data.test_data);
            if (data.description) gr.setValue('description', data.description);
            
            var sysId = gr.insert();
            
            if (!sysId) {
                gs.error(this.LOG_PREFIX + '.createTestStep: Failed to insert step record');
            }
            
            return sysId;
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.createTestStep: ' + e);
            return null;
        }
    },

    /**
     * Validate test data structure
     * @param {Object} testData - Test data to validate
     * @returns {Object} - Validation result
     */
    validateTestData: function(testData) {
        var errors = [];
        
        if (!testData) {
            errors.push('testData is null or undefined');
            return {valid: false, errors: errors};
        }
        
        if (!testData.name || testData.name.trim() === '') {
            errors.push('testData.name is required');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Validate version data structure
     * @param {Object} versionData - Version data to validate
     * @returns {Object} - Validation result
     */
    validateVersionData: function(versionData) {
        var errors = [];
        
        if (!versionData) {
            errors.push('versionData is null or undefined');
            return {valid: false, errors: errors};
        }
        
        if (!versionData.version) {
            errors.push('versionData.version is required');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Validate steps data structure
     * @param {Array} stepsData - Steps data to validate
     * @returns {Object} - Validation result
     */
    validateStepsData: function(stepsData) {
        var errors = [];
        
        if (!stepsData) {
            errors.push('stepsData is null or undefined');
            return {valid: false, errors: errors};
        }
        
        if (!Array.isArray(stepsData)) {
            errors.push('stepsData must be an array');
            return {valid: false, errors: errors};
        }
        
        if (stepsData.length === 0) {
            errors.push('stepsData array is empty');
        }
        
        for (var i = 0; i < stepsData.length; i++) {
            if (!stepsData[i].step && !stepsData[i].description) {
                errors.push('Step ' + i + ' is missing step description');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    type: 'TestManagementUtils'
};