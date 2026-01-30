/**
 * UI Action: Generate AI Test Cases
 * Table: rm_story (User Story)
 * Purpose: Generate test cases using Azure OpenAI from user story details
 */

(function() {
    
    // ==========================================
    // STEP 1: VALIDATE USER STORY
    // ==========================================
    
    // Check if story has required fields
    if (!current.short_description) {
        gs.addErrorMessage('User story must have a title (short description) to generate test cases.');
        return;
    }
    
    // Get story details
    var storyId = current.getUniqueValue();
    var storyNumber = current.getValue('number');
    var storyTitle = current.getValue('short_description');
    
    // Log the action
    gs.info('UI Action: Generate AI Test Cases triggered for story: ' + storyNumber);
    
    // ==========================================
    // STEP 2: VALIDATE STORY WITH VALIDATOR
    // ==========================================
    
    var validator = new AITestGenerationValidator();
    var validation = validator.validateStory(current);
    
    // Show warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
        for (var i = 0; i < validation.warnings.length; i++) {
            gs.addInfoMessage('⚠️ Warning: ' + validation.warnings[i]);
        }
    }
    
    // If validation fails, stop
    if (!validation.valid) {
        var errorMsg = 'Cannot generate test cases: ' + validation.errors.join(', ');
        gs.addErrorMessage(errorMsg);
        gs.error('UI Action: ' + errorMsg);
        return;
    }
    
    // ==========================================
    // STEP 3: INFORM USER - GENERATION STARTING
    // ==========================================
    
    var infoMessage = '🤖 Generating AI test cases for story ' + storyNumber + '...\n' +
                     'This process may take 30-90 seconds. Please wait.\n' +
                     'Do not close or refresh this page.';
    
    gs.addInfoMessage(infoMessage);
    
    gs.info('UI Action: Starting generation for story ' + storyNumber + ' (' + storyId + ')');
    
    // ==========================================
    // STEP 4: CALL AI GENERATOR
    // ==========================================
    
    try {
        var generator = new AzureOpenAITestGenerator();
        var result = generator.generateTestCases(storyId);
        
        // ==========================================
        // STEP 5: HANDLE SUCCESS
        // ==========================================
        
        if (result.success) {
            
            // Build success message
            var successMessage = '✅ Success! Generated ' + result.totalGenerated + ' test cases for story ' + storyNumber + '.\n\n';
            
            if (result.failureCount > 0) {
                successMessage += '⚠️ Note: ' + result.failureCount + ' test case(s) failed to create.\n\n';
            }
            
            successMessage += '📋 Tests are now linked to this story and visible in the "Related Tests" section below.\n';
            successMessage += '⏱️ Generation completed in ' + (result.duration || 'unknown') + ' seconds.';
            
            gs.addInfoMessage(successMessage);
            
            // ==========================================
            // STEP 6: ADD WORK NOTES WITH TEST DETAILS
            // ==========================================
            
            var workNote = '🤖 AI Test Case Generation Summary\n';
            workNote += '═══════════════════════════════════════\n';
            workNote += 'Story: ' + storyNumber + ' - ' + storyTitle + '\n';
            workNote += 'Generated: ' + result.totalGenerated + ' test cases\n';
            workNote += 'Duration: ' + (result.duration || 'N/A') + ' seconds\n';
            workNote += 'Status: ' + (result.failureCount > 0 ? 'Partial Success' : 'Complete Success') + '\n';
            workNote += '───────────────────────────────────────\n';
            
            // List created tests (limit to first 10)
            if (result.createdTests && result.createdTests.length > 0) {
                workNote += 'Created Tests:\n';
                
                var displayCount = Math.min(result.createdTests.length, 10);
                
                for (var j = 0; j < displayCount; j++) {
                    var test = result.createdTests[j];
                    workNote += '  ' + (j + 1) + '. ' + test.testName + '\n';
                }
                
                if (result.createdTests.length > 10) {
                    workNote += '  ... and ' + (result.createdTests.length - 10) + ' more\n';
                }
            }
            
            workNote += '───────────────────────────────────────\n';
            workNote += 'All tests are linked to this story.\n';
            workNote += 'Review tests in the "Related Tests" section.\n';
            workNote += '═══════════════════════════════════════\n';
            
            // Add work notes to story
            current.work_notes = workNote;
            current.update();
            
            gs.info('UI Action: Successfully generated ' + result.totalGenerated + ' tests');
            
            // ==========================================
            // STEP 7: SHOW CREATED TESTS SUMMARY
            // ==========================================
            
            if (result.createdTests && result.createdTests.length > 0) {
                var testSummary = '\n📝 Test Cases Created:\n';
                testSummary += '─────────────────────────────────\n';
                
                for (var k = 0; k < Math.min(result.createdTests.length, 5); k++) {
                    var testItem = result.createdTests[k];
                    testSummary += '• ' + testItem.testName + '\n';
                }
                
                if (result.createdTests.length > 5) {
                    testSummary += '• ... and ' + (result.createdTests.length - 5) + ' more\n';
                }
                
                gs.addInfoMessage(testSummary);
            }
            
        } else {
            
            // ==========================================
            // STEP 8: HANDLE FAILURE
            // ==========================================
            
            var errorMessage = '❌ Failed to generate test cases: ' + result.message;
            gs.addErrorMessage(errorMessage);
            gs.error('UI Action: Generation failed - ' + result.message);
            
            // Add failure note to work notes
            var failureNote = '🤖 AI Test Case Generation Failed\n';
            failureNote += '═══════════════════════════════════════\n';
            failureNote += 'Story: ' + storyNumber + '\n';
            failureNote += 'Error: ' + result.message + '\n';
            failureNote += 'Time: ' + new GlideDateTime() + '\n';
            failureNote += '═══════════════════════════════════════\n';
            failureNote += 'Please check:\n';
            failureNote += '  • Story has sufficient description\n';
            failureNote += '  • Acceptance criteria are clear\n';
            failureNote += '  • System configuration is correct\n';
            failureNote += '  • Azure OpenAI service is available\n';
            
            current.work_notes = failureNote;
            current.update();
            
            // Send notification to admins
            try {
                gs.eventQueue('ai.test.generation.failed', current, storyId, result.message);
            } catch (notifyError) {
                gs.error('UI Action: Failed to send notification: ' + notifyError);
            }
        }
        
    } catch (e) {
        
        // ==========================================
        // STEP 9: HANDLE EXCEPTION
        // ==========================================
        
        var exceptionMessage = '❌ An error occurred while generating test cases: ' + e;
        gs.addErrorMessage(exceptionMessage);
        gs.error('UI Action: Exception in test generation - ' + e);
        
        // Add exception note to work notes
        var exceptionNote = '🤖 AI Test Case Generation Error\n';
        exceptionNote += '═══════════════════════════════════════\n';
        exceptionNote += 'Story: ' + storyNumber + '\n';
        exceptionNote += 'Exception: ' + e + '\n';
        exceptionNote += 'Time: ' + new GlideDateTime() + '\n';
        exceptionNote += '═══════════════════════════════════════\n';
        exceptionNote += 'Please contact your system administrator.\n';
        
        current.work_notes = exceptionNote;
        current.update();
        
        // Send notification to admins
        try {
            gs.eventQueue('ai.test.generation.failed', current, storyId, e.toString());
        } catch (notifyError) {
            gs.error('UI Action: Failed to send notification: ' + notifyError);
        }
    }
    
    // ==========================================
    // STEP 10: REFRESH FORM TO SHOW TESTS
    // ==========================================
    
    // Redirect back to the current record to refresh and show related tests
    action.setRedirectURL(current);
    
    gs.info('UI Action: Generation process completed for story ' + storyNumber);
    
})();