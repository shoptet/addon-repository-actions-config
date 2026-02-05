# Test Cases for Shoptet Addon Review System

This directory contains test cases demonstrating good and bad coding practices according to Shoptet's 8 blocking rules.

## Structure

- `good/` - Code examples that pass all rules
- `bad/` - Code examples that violate specific rules

## Usage

Run the review helper script on test cases to verify the system works:

```bash
npm run review test-cases/bad/
```

## Expected Results

### Good Test Cases
All files in `good/` should pass with **exit code 0** and no blockers.

### Bad Test Cases

| File | Expected Violations |
|------|---------------------|
| `bad-no-cache.js` | Rule 1: Missing /cache/ in Shoptet API calls |
| `bad-shoptet-overwrite.js` | Rule 3: Overwriting Shoptet objects |
| `bad-no-delegation.js` | Rule 4: Direct event listeners instead of delegation |
| `bad-var-usage.js` | Rule 7: Using var instead of const/let |
| `bad-console.js` | Rule 6: Console statements in code |
| `bad-deep-nesting.js` | Rule 5: Nesting depth exceeds 4 levels |
| `bad-dead-code.js` | Rule 8: Unused variables, unreachable code |

## Testing Individual Files

```bash
npm run review test-cases/bad/bad-no-cache.js
npm run review test-cases/good/good-event-delegation.js
```

## Verification

All bad-*.js files should trigger blockers. All good-*.js files should pass cleanly.
