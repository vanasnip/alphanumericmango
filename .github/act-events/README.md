# Act Event Payloads

This directory contains sample event payloads for testing GitHub Actions workflows locally with `act`.

## Event Files

### `push.json`
Sample payload for push events to the main branch. Use this to test workflows triggered by code pushes.

```bash
act push -e .github/act-events/push.json
```

### `pull_request.json`
Sample payload for pull request events. Use this to test PR validation workflows.

```bash
act pull_request -e .github/act-events/pull_request.json
```

### `schedule.json`
Sample payload for scheduled workflow runs (cron jobs).

```bash
act schedule -e .github/act-events/schedule.json
```

### `workflow_dispatch.json`
Sample payload for manually triggered workflows with custom inputs.

```bash
act workflow_dispatch -e .github/act-events/workflow_dispatch.json
```

### `release.json`
Sample payload for release events, including asset information.

```bash
act release -e .github/act-events/release.json
```

## Usage Examples

### Test specific workflows with custom events:

```bash
# Test main CI workflow with push event
act push -e .github/act-events/push.json -j main-ci

# Test PR validation with pull request event
act pull_request -e .github/act-events/pull_request.json -j pr-validation

# Test deployment workflow with manual trigger
act workflow_dispatch -e .github/act-events/workflow_dispatch.json -j deploy

# Test release workflow
act release -e .github/act-events/release.json -j release-workflow
```

### Customize event payloads:

1. Copy an existing event file
2. Modify the values to match your test scenario
3. Use the custom file with act

```bash
cp .github/act-events/push.json .github/act-events/my-custom-push.json
# Edit my-custom-push.json
act push -e .github/act-events/my-custom-push.json
```

## Event Payload Structure

Each event file follows the GitHub webhook payload format. Key fields include:

- `repository`: Repository information
- `sender`: User who triggered the event
- `action`: Specific action type (for events like PRs)
- Event-specific data (commits, pull request details, etc.)

## Tips

- Use realistic data in your test payloads to catch edge cases
- Update commit SHAs and timestamps for time-sensitive workflows
- Customize user information to test permissions and notifications
- Use different branch names to test branch-specific logic