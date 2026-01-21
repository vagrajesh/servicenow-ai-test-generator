// Test creating a test case manually
var utils = new TestManagementUtils();

var testData = {
    name: 'Test - Login Functionality',
    short_description: 'Verify user can login successfully',
    description: 'This test validates the login process',
    test_type: 'functional',
    priority: 'High',
    state: 'draft'
};

var versionData = {
    version: '1.0',
    state: 'draft',
    short_description: 'Initial version',
    description: 'First version of test case'
};

var stepsData = [
    {
        order: 100,
        step: 'Navigate to login page',
        expected_result: 'Login page displays',
        test_data: 'URL: /login'
    },
    {
        order: 200,
        step: 'Enter username and password',
        expected_result: 'Credentials accepted',
        test_data: 'user: admin'
    },
    {
        order: 300,
        step: 'Click Login button',
        expected_result: 'User logged in successfully',
        test_data: ''
    }
];

var result = utils.createCompleteTest(testData, versionData, stepsData);
gs.info('Result: ' + JSON.stringify(result, null, 2));

if (result.success) {
    gs.info('✅ Test created successfully!');
    gs.info('Test ID: ' + result.testId);
    gs.info('Version ID: ' + result.versionId);
    gs.info('Steps created: ' + result.stepIds.length);
} else {
    gs.error('❌ Test creation failed: ' + result.message);
}