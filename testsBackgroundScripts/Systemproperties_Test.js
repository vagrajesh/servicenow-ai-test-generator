// Test system properties configuration
gs.info('=== Testing Azure OpenAI Configuration ===');
gs.info('Endpoint: ' + gs.getProperty('azure.openai.endpoint'));
gs.info('API Key configured: ' + (gs.getProperty('azure.openai.api.key') ? 'Yes' : 'No'));
gs.info('Deployment: ' + gs.getProperty('azure.openai.deployment.name'));
gs.info('API Version: ' + gs.getProperty('azure.openai.api.version'));
gs.info('Timeout: ' + gs.getProperty('azure.openai.timeout'));