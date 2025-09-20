# VAL-001: Prototype Testing Script
## Facilitator's Guide for 20-Developer Testing Sessions

*Version: 1.0*  
*Session Duration: 90 minutes*  
*Equipment Required: Voice prototype, screen recording, consent forms*

---

## Pre-Session Checklist

### Technical Setup (15 min before)
- [ ] Voice prototype application installed and tested
- [ ] Microphone calibrated and tested
- [ ] Screen recording software ready
- [ ] Backup demo environment prepared
- [ ] Test data/repositories configured
- [ ] Network connectivity verified

### Materials
- [ ] Consent form (printed/digital)
- [ ] Pre-test survey loaded
- [ ] Task cards prepared
- [ ] Note-taking template ready
- [ ] Post-test interview questions
- [ ] Incentive gift card ready

---

## Session Script

### Opening (5 minutes)

**Facilitator Script:**
```
"Welcome, and thank you for participating in our developer workflow study. 
I'm [Name], and I'll be facilitating today's session.

We're testing a new voice-controlled terminal interface designed to enhance 
developer productivity. This is a prototype, so we're testing the concept, 
not your abilities. Any difficulties you encounter help us improve the system.

The session will last about 90 minutes and includes:
1. A brief survey about your current workflow
2. A tutorial on the voice system
3. Some hands-on tasks
4. A discussion about your experience

Please think aloud as you work - tell me what you're thinking, what confuses you, 
or what delights you. There are no wrong answers.

Before we begin, please review and sign this consent form. The session will be 
recorded for research purposes only. Do you have any questions?"
```

### Part 1: Pre-Test Survey (10 minutes)

**Administer survey via tablet/laptop**

Key questions to probe if time permits:
- "Tell me about your typical terminal workflow"
- "What are your biggest terminal-related pain points?"
- "Have you used voice assistants before? What was that experience like?"

---

## Part 2: Tutorial & Onboarding (15 minutes)

### System Introduction (5 minutes)

**Facilitator Script:**
```
"Let me introduce you to the voice-controlled terminal system. 
The key concept is using natural language to execute terminal commands 
while maintaining safety through our 'Execute' confirmation system."
```

**Demonstrate:**
1. Wake word activation: "Terminal"
2. Basic command: "List all files"
3. Safety mechanism: "Run npm install" → waits → "Execute"
4. Context awareness: "Show me the error from the last command"

### Hands-On Practice (10 minutes)

**Guided Practice Tasks:**
```bash
1. "Navigate to the home directory"
2. "Show me what's in this folder"  
3. "Create a new directory called test-project"
4. "Run echo hello world" [wait] "Execute"
5. "Show me the last five commands I ran"
```

**Observe and note:**
- Microphone positioning issues
- Voice clarity/volume adjustments needed
- Understanding of Execute mechanism
- Initial comfort level

---

## Part 3: Structured Tasks (45 minutes)

### Task Set A: Basic Navigation & Operations (15 minutes)

**Task Card A1: File System Navigation**
```
Starting in the home directory:
1. Find the project folder named "sample-app"
2. List all JavaScript files in the src directory
3. Open the README file to see what this project does
4. Search for files containing the word "config"
5. Navigate back to the home directory

Success Metrics:
- Commands recognized correctly: ___/5
- Time to complete: _____ seconds
- Retries needed: _____
- Frustration points: _____
```

**Task Card A2: Git Operations**
```
In the sample-app directory:
1. Check the git status
2. View the last 3 commits
3. Create a new branch called "feature-test"
4. Stage all modified files
5. Commit with message "Test voice commit"

Note: For commit, system should require "Execute" confirmation
```

### Task Set B: Development Workflow (15 minutes)

**Task Card B1: Build & Test**
```
Project: sample-node-app
1. Install project dependencies
2. Run the linting checks
3. Execute the test suite
4. Build the production bundle
5. Start the development server

Measure:
- Natural vs learned commands used
- Confidence in destructive operations
- Error recovery strategies
```

**Task Card B2: Debugging Scenario**
```
Scenario: The app is throwing an error
1. Run the app and observe the error
2. Search the codebase for the error message
3. View the problematic file
4. Check the recent changes to that file
5. Ask for help understanding the error

AI Integration Point:
"Explain this error" should trigger AI assistance
```

### Task Set C: Complex Workflows (15 minutes)

**Task Card C1: Multi-Step Deployment**
```
Deploy the sample app to staging:
1. Ensure all tests pass
2. Bump the version number
3. Build the production bundle
4. Create a git tag
5. Push to staging branch
6. Verify deployment status

Critical: Multiple "Execute" gates should be required
```

**Task Card C2: AI-Assisted Development**
```
Create a new feature:
1. Ask: "Help me create a new API endpoint for user authentication"
2. Follow AI suggestions to:
   - Create necessary files
   - Install required packages
   - Write initial code
   - Add tests
3. Run the tests to verify

Measure AI interaction naturalness
```

---

## Part 4: Free Exploration (10 minutes)

**Facilitator Script:**
```
"Now I'd like you to use the system naturally for your own workflow. 
Feel free to try any commands you'd typically use in your daily work. 
There's a practice repository available, or you can work with your own projects."
```

**Observe without intervening:**
- Natural command formulation
- Workflow integration attempts  
- Creative use cases
- Frustration tolerance
- Safety mechanism usage

**Silent observation notes:**
- Commands attempted: _____
- Success rate: _____
- Innovative uses: _____
- Abandonment points: _____

---

## Part 5: Post-Test Interview (10 minutes)

### Structured Questions

**Overall Experience**
1. "How would you describe your experience using voice control for terminal commands?"
2. "What surprised you most about the system?"
3. "What frustrated you most?"

**Adoption Likelihood**
4. "On a scale of 1-10, how likely would you be to use this in your daily workflow?"
5. "What would need to change for you to increase that rating?"
6. "In what scenarios would you definitely use/not use voice control?"

**Feature Feedback**
7. "How did you feel about the 'Execute' safety mechanism?"
8. "Were there commands you wanted to say but couldn't figure out how?"
9. "How was the AI assistance integration?"

**Workflow Integration**
10. "How would this fit into your current development setup?"
11. "What other tools would this need to integrate with?"
12. "Would you use this in an office environment? Why/why not?"

### Open Discussion Prompts

- "Tell me about a moment where the system delighted you"
- "Describe a situation where voice would be particularly valuable"
- "What's your biggest concern about using voice for programming?"
- "How could we make this more useful for developers like you?"

---

## Data Collection Forms

### Observation Checklist

**Voice Interaction Quality**
- [ ] Clear command articulation
- [ ] Natural language use vs learned commands
- [ ] Frequency of retries
- [ ] Microphone positioning issues
- [ ] Background noise interference

**Safety & Trust**
- [ ] Execute mechanism understanding
- [ ] Hesitation before destructive commands
- [ ] Trust building over session
- [ ] Error recovery behavior
- [ ] Safety bypass attempts

**Productivity Indicators**
- [ ] Task completion speed
- [ ] Command efficiency
- [ ] Context switching smoothness
- [ ] Multitasking ability
- [ ] Flow state achievement

**Learning Curve**
- [ ] Time to first successful command
- [ ] Improvement rate over session
- [ ] Command vocabulary expansion
- [ ] Feature discovery rate
- [ ] Help-seeking behavior

### Quantitative Metrics Form

| Metric | Task A | Task B | Task C | Free |
|--------|--------|--------|--------|------|
| Commands Attempted | | | | |
| Commands Successful | | | | |
| Recognition Accuracy % | | | | |
| Avg Response Time (ms) | | | | |
| Execute Gates Triggered | | | | |
| Errors Encountered | | | | |
| Time to Complete (min) | | | | |
| Cognitive Load (1-10) | | | | |
| Satisfaction (1-10) | | | | |

---

## Critical Incidents Log

Document any of these if they occur:

**Positive Incidents**
- "Aha" moments
- Workflow breakthroughs
- Unexpected use cases
- High satisfaction expressions

**Negative Incidents**
- Task abandonment
- High frustration events
- Safety concerns raised
- Technical failures

**Template:**
```
Time: _____
Task: _____
Incident Type: Positive/Negative
Description: _____
User Quote: "_____"
Resolution: _____
Impact on Session: _____
```

---

## Session Closing (5 minutes)

**Facilitator Script:**
```
"Thank you so much for your time and valuable feedback today. 
Your insights will directly influence how we develop this system.

Here's your gift card as a token of our appreciation. 
We'll analyze all the feedback and may reach out with follow-up questions.

Would you be interested in participating in future testing sessions 
or trying the beta version when it's ready?

Do you have any final thoughts or questions before we wrap up?"
```

**Post-Session Actions:**
1. Save all recordings and files
2. Complete observation summary
3. Upload data within 2 hours
4. Send thank-you email
5. Schedule debrief if needed

---

## Facilitator Notes Section

### Common Issues & Responses

**Issue: Participant speaks too softly**
Response: "Feel free to speak in your normal voice - the system is calibrated for natural speech"

**Issue: Frustration with recognition errors**
Response: "Remember, this helps us identify what needs improvement. Your frustration is valuable data"

**Issue: Participant goes silent**
Prompt: "What are you thinking right now?" or "Walk me through your thought process"

**Issue: Technical failure**
Response: "Let's switch to our backup system" [Have demo videos ready]

### Red Flags to Escalate
- Participant expresses privacy concerns
- Accessibility issues discovered
- Critical safety mechanism failures
- Severe usability problems (>3 task abandonments)

---

*End of Testing Script*