/**
 * Script Include: AITestGenerationValidator
 * Description: Validates user stories before AI test generation
 * Version: 1.0
 */

var AITestGenerationValidator = Class.create();
AITestGenerationValidator.prototype = {
    initialize: function() {
        this.LOG_PREFIX = 'AITestGenerationValidator';
    },

    /**
     * Validate if story is ready for test generation
     * @param {GlideRecord} storyGr - User story GlideRecord
     * @returns {Object} - Validation result
     */
    validateStory: function(storyGr) {
        var errors = [];
        var warnings = [];
        
        // Check if story exists
        if (!storyGr || !storyGr.isValidRecord()) {
            return {
                valid: false,
                errors: ['Invalid user story record'],
                warnings: []
            };
        }
        
        // Required: Short description (title)
        if (!storyGr.short_description || storyGr.short_description.toString().trim() === '') {
            errors.push('Story must have a title (short description)');
        }
        
        // Recommended: Description
        if (!storyGr.description || storyGr.description.toString().trim() === '') {
            warnings.push('Story description is empty - AI may generate less accurate test cases');
        }
        
        // Recommended: Acceptance criteria
        if (!storyGr.acceptance_criteria || storyGr.acceptance_criteria.toString().trim() === '') {
            warnings.push('Acceptance criteria is empty - AI may generate generic test cases');
        }
        
        // Check description length (too short)
        var descLength = storyGr.description ? storyGr.description.toString().length : 0;
        if (descLength > 0 && descLength < 50) {
            warnings.push('Story description is very short (' + descLength + ' chars) - consider adding more details');
        }
        
        // Check if description is too long (API limits)
        if (descLength > 5000) {
            warnings.push('Story description is very long (' + descLength + ' chars) - may hit API token limits');
        }
        
        // Check state (optional - adjust based on your workflow)
        var state = storyGr.state.toString();
        if (state === '-1' || state === '1') { // Draft or Awaiting Approval
            warnings.push('Story is in ' + storyGr.state.getDisplayValue() + ' state - consider moving to active state first');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    },

    /**
     * Get validation summary message
     * @param {Object} validation - Validation result
     * @returns {String} - Summary message
     */
    getValidationMessage: function(validation) {
        var msg = '';
        
        if (!validation.valid) {
            msg = 'Validation failed:\n';
            for (var i = 0; i < validation.errors.length; i++) {
                msg += '  • ' + validation.errors[i] + '\n';
            }
        }
        
        if (validation.warnings.length > 0) {
            if (msg) msg += '\n';
            msg += 'Warnings:\n';
            for (var j = 0; j < validation.warnings.length; j++) {
                msg += '  ⚠ ' + validation.warnings[j] + '\n';
            }
        }
        
        return msg;
    },

    type: 'AITestGenerationValidator'
};