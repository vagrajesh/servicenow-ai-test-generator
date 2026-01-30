var AITestGenerationValidator = Class.create();
AITestGenerationValidator.prototype = {
    
    initialize: function() {
        this.LOG_PREFIX = 'AITestGenerationValidator';
    },
    
    /**
     * Validate if a story is ready for test generation
     * @param {GlideRecord} storyGr - User story GlideRecord or object
     * @returns {Object} - {valid: boolean, errors: [], warnings: []}
     */
    validateStory: function(storyGr) {
        var errors = [];
        var warnings = [];
        
        try {
            // Required: Short description (title)
            var shortDesc = '';
            if (typeof storyGr.getValue === 'function') {
                shortDesc = storyGr.getValue('short_description') || '';
            } else {
                shortDesc = storyGr.short_description || '';
            }
            
            if (!shortDesc || shortDesc.trim() === '') {
                errors.push('Story must have a title (short description)');
            }
            
            // Recommended: Description
            var description = '';
            if (typeof storyGr.getValue === 'function') {
                description = storyGr.getValue('description') || '';
            } else {
                description = storyGr.description || '';
            }
            
            if (!description || description.trim() === '') {
                warnings.push('Story description is empty. AI will generate generic tests.');
            } else if (description.length < 50) {
                warnings.push('Story description is very short (' + description.length + ' chars). Consider adding more detail for better test generation.');
            } else if (description.length > 5000) {
                warnings.push('Story description is very long (' + description.length + ' chars). This may hit token limits.');
            }
            
            // Recommended: Acceptance criteria
            var acceptanceCriteria = '';
            if (typeof storyGr.getValue === 'function') {
                acceptanceCriteria = storyGr.getValue('acceptance_criteria') || '';
            } else {
                acceptanceCriteria = storyGr.acceptance_criteria || '';
            }
            
            if (!acceptanceCriteria || acceptanceCriteria.trim() === '') {
                warnings.push('Story has no acceptance criteria. Tests will be based on description only.');
            }
            
            // Check state
            var state = '';
            if (typeof storyGr.getValue === 'function') {
                state = storyGr.getValue('state') || '';
            } else {
                state = storyGr.state || '';
            }
            
            if (state === '1' || state === 'draft') {
                warnings.push('Story is in Draft state. Consider moving to Work in Progress before generating tests.');
            }
            
            // Log validation results
            if (errors.length > 0) {
                gs.warn(this.LOG_PREFIX + ': Validation failed: ' + errors.join(', '));
            }
            
            if (warnings.length > 0) {
                gs.info(this.LOG_PREFIX + ': Validation warnings: ' + warnings.join(', '));
            }
            
            return {
                valid: errors.length === 0,
                errors: errors,
                warnings: warnings
            };
            
        } catch (e) {
            gs.error(this.LOG_PREFIX + '.validateStory: ' + e);
            return {
                valid: false,
                errors: ['Exception during validation: ' + e],
                warnings: []
            };
        }
    },
    
    /**
     * Get a formatted validation message
     * @param {Object} validation - Validation result object
     * @returns {String} - Formatted message
     */
    getValidationMessage: function(validation) {
        var message = '';
        
        if (!validation.valid) {
            message = 'Validation Errors:\n';
            for (var i = 0; i < validation.errors.length; i++) {
                message += '  • ' + validation.errors[i] + '\n';
            }
        }
        
        if (validation.warnings && validation.warnings.length > 0) {
            if (message) message += '\n';
            message += 'Warnings:\n';
            for (var j = 0; j < validation.warnings.length; j++) {
                message += '  • ' + validation.warnings[j] + '\n';
            }
        }
        
        return message;
    },
    
    type: 'AITestGenerationValidator'
};