// Replace with actual user story sys_id
var storyId = 'dadd2697838d321028c37296feaad377';

var generator = new AzureOpenAITestGenerator();
var result = generator.generateTestCases(storyId);

gs.info('=== AI Test Generation Result ===');
gs.info(JSON.stringify(result, null, 2));

if (result.success) {
    gs.info('✅ Successfully generated ' + result.successCount + ' test cases');
} else {
    gs.error('❌ Generation failed: ' + result.message);
}