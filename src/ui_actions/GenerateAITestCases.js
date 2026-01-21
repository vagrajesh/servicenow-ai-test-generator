/**
 * UI Action: Generate AI Test Cases
 * Description: Generates test cases using Azure OpenAI for the current user story
 */

(function() {
    try {
        // Get current story sys_id
        var storyId = current.getUniqueValue();
        
        if (!storyId) {
            gs.addErrorMessage('Unable to get user story ID');
            return;
        }
        
        // Show info message
        gs.addInfoMessage('Generating test cases with AI... This may take up to 60 seconds. Please wait.');
        
        // Create generator instance
        var generator = new AzureOpenAITestGenerator();
        
        // Generate test cases
        var result = generator.generateTestCases(storyId);
        
        // Handle result
        if (result.success) {
            gs.addInfoMessage(result.message);
            
            // Log details
            if (result.successCount) {
                gs.info('Generated ' + result.successCount + ' test cases for story: ' + current.number);
            }
            
            // Optionally reload the form to show related tests
            action.setRedirectURL(current);
            
        } else {
            gs.addErrorMessage('Failed to generate test cases: ' + result.message);
            gs.error('AI Test Generation failed for story ' + current.number + ': ' + result.message);
        }
        
    } catch (e) {
        gs.addErrorMessage('Error generating test cases: ' + e);
        gs.error('UI Action error: ' + e);
    }
})();