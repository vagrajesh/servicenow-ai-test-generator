Table of Contents

Overview
Features
Architecture
Prerequisites
Installation
Configuration
Usage
API Documentation
Testing
Troubleshooting
Contributing
License
Support


🎯 Overview
This solution integrates Azure OpenAI with ServiceNow Test Management 2.0 to automatically generate comprehensive test cases from Agile user stories. With a single click, QA teams can generate 5-10 detailed test cases complete with steps, expected results, and test data.
The Problem

Manual test case creation takes 2-4 hours per user story
Inconsistent test coverage across stories
QA teams are bottlenecks in agile sprints
Limited QA resources struggle to keep pace with development

The Solution

AI-powered generation creates test cases in 30-60 seconds
Comprehensive coverage including positive, negative, and edge cases
Structured output with detailed steps and expected results
Native integration with ServiceNow Test Management 2.0


✨ Features

✅ One-Click Generation - Generate test cases directly from user story form
✅ Intelligent AI - Leverages GPT-4 for high-quality test case creation
✅ Comprehensive Coverage - Generates 5-10 test cases per story
✅ Detailed Steps - Each test includes 3-8 detailed steps
✅ Native Integration - Works seamlessly with Test Management 2.0
✅ Configurable - Adjust number of test cases, prompt behavior
✅ Error Handling - Robust error handling and user feedback
✅ Audit Trail - Full logging and usage tracking
✅ Validation - Pre-generation story validation
✅ Cost Tracking - Monitor API usage and costs


🏗️ Architecture
┌─────────────┐
│  QA User    │
└──────┬──────┘
       │ Clicks "Generate AI Test Cases"
       ▼
┌──────────────────────────────────────┐
│     ServiceNow Instance              │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  AzureOpenAITestGenerator      │ │
│  │  (Script Include)              │ │
│  └────────────┬───────────────────┘ │
│               │                     │
│               │ HTTPS               │
│               ▼                     │
└───────────────────────────────────────┘
                │
    ════════════╪════════════
                │  Internet
    ════════════╪════════════
                │
                ▼
┌───────────────────────────────────────┐
│     Azure OpenAI Service              │
│                                       │
│  ┌────────────────────────────────┐  │
│  │  GPT-4 Model                   │  │
│  │  Generates Test Cases          │  │
│  └────────────────────────────────┘  │
└───────────────────────────────────────┘
                │
                │ Returns JSON
                ▼
┌───────────────────────────────────────┐
│     ServiceNow Database               │
│                                       │
│  • sn_test_management_test            │
│  • sn_test_management_test_version    │
│  • sn_test_management_step            │
└───────────────────────────────────────┘
Tech Stack:

Platform: ServiceNow (San Diego+)
AI Service: Azure OpenAI (GPT-4 / GPT-3.5-Turbo)
Language: JavaScript (Server-side)
Integration: REST API (HTTPS)
Plugins Required: Test Management 2.0, Agile Development 2.0


📦 Prerequisites
ServiceNow Requirements

Platform Version: San Diego or later
Plugins:

Test Management 2.0 (com.snc.test_management.2.0)
Agile Development 2.0 (com.snc.sdlc.agile.2.0)


Roles:

admin - For installation and configuration
test_admin or test_manager - For generating test cases


Network Access:

Outbound HTTPS (port 443) to *.openai.azure.com



Azure Requirements

Azure Subscription with OpenAI service enabled
Azure OpenAI Resource created
Deployment:

Model: GPT-4 or GPT-3.5-Turbo
Deployment name (e.g., gpt-4)


API Key with appropriate permissions
Endpoint URL (e.g., https://your-resource.openai.azure.com)

User Requirements

User stories must have:

✅ Short Description (title) - Required
⚠️ Description - Recommended
⚠️ Acceptance Criteria - Recommended

Navigate to: **System Definition → Script Includes**

**Create 3 Script Includes:**

1. **TestManagementUtils**
   - Name: `TestManagementUtils`
   - API Name: `TestManagementUtils`
   - Client callable: ✅ Checked
   - Active: ✅ Checked
   - Script: Copy from `src/script_includes/TestManagementUtils.js`

2. **AzureOpenAITestGenerator**
   - Name: `AzureOpenAITestGenerator`
   - API Name: `AzureOpenAITestGenerator`
   - Client callable: ❌ Unchecked
   - Active: ✅ Checked
   - Script: Copy from `src/script_includes/AzureOpenAITestGenerator.js`

3. **AITestGenerationValidator**
   - Name: `AITestGenerationValidator`
   - API Name: `AITestGenerationValidator`
   - Client callable: ❌ Unchecked
   - Active: ✅ Checked
   - Script: Copy from `src/script_includes/AITestGenerationValidator.js`

#### 3b. Create UI Action

Navigate to: **System UI → UI Actions**

Click **New:**
- Name: `Generate AI Test Cases`
- Table: `rm_story`
- Action name: `generate_ai_test_cases`
- Show update: ✅ Checked
- Form button: ✅ Checked
- Active: ✅ Checked
- Script: Copy from `src/ui_actions/GenerateAITestCases.js`

#### 3c. Create System Properties

Navigate to: **System Properties → System Properties**

Create 6 properties (or import XML from `src/system_properties/`):

| Name | Type | Value | Description |
|------|------|-------|-------------|
| `azure.openai.endpoint` | String | (your Azure endpoint) | Azure OpenAI endpoint URL |
| `azure.openai.api.key` | Password | (your API key) | API key (encrypted) |
| `azure.openai.deployment.name` | String | `gpt-4` | Deployment name |
| `azure.openai.api.version` | String | `2024-02-15-preview` | API version |
| `azure.openai.timeout` | Integer | `60000` | Timeout in milliseconds |
| `azure.openai.test.case.count` | Integer | `5` | Number of test cases to generate |


 Usage
For QA Engineers
Generate Test Cases

Navigate to a User Story

Go to: Agile → Stories → All
Open any user story


Click Generate Button

Look for button: "Generate AI Test Cases"
Click it


Wait for Generation

Process takes 30-90 seconds
Success message will appear


Review Generated Tests

Scroll to Related Tests section
Click on any test to review details


Edit if Needed

Open test case
Review and modify as needed
Execute when ready



Best Practices
✅ DO:

Write clear user story titles
Include detailed descriptions
Provide specific acceptance criteria
Review generated tests before execution
Edit tests to match your context

❌ DON'T:

Generate without acceptance criteria (will get generic tests)
Use on stories with missing descriptions
Execute tests without review
Expect 100% accuracy (AI needs human review)

For QA Managers
Monitor Usage
Navigate to: Reports → View/Run
Create report on: u_ai_test_generation_log
Key Metrics:

Total generations per week
Success rate
Average duration
Users utilizing feature
Stories with AI-generated tests