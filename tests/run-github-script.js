// Executes a github-script block extracted from a workflow YAML with mocked
// `github` / `context` / `core`, so the embedded logic is testable offline.
//
// Usage: node run-github-script.js <script.js> <fixture.json>
//
// Fixture shape:
//   env      — extra process.env entries (PROTECTED_PATHS, REQUIRED_REVIEWER, …)
//   pr       — the pull request object (returned by pulls.get, also used as
//              context.payload.pull_request)
//   files    — array returned when the script paginates pulls.listFiles
//   reviews  — array returned when the script paginates pulls.listReviews
//   comments — array returned when the script paginates issues.listComments
//   commentError — when true, issues.createComment throws, simulating a
//              token without pull-requests: write
//
// The exit code is the test result: 0 = the script finished normally,
// 1 = the script signalled a policy failure (process.exit(1) / core.setFailed),
// 2 = the script crashed (thrown error) — a crash must never satisfy a test
// that expects a policy failure. Everything that can throw — reading the
// fixture, compiling the extracted script, running it — happens inside the
// same .then(), so a syntax error or a malformed fixture is a crash (exit 2)
// too, not a false pass on an expected_exit=1 case.
const fs = require('fs');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

Promise.resolve().then(() => {
  const [, , scriptPath, fixturePath] = process.argv;
  const script = fs.readFileSync(scriptPath, 'utf8');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  Object.assign(process.env, fixture.env || {});

  const paged = (data) => async () => ({ data });
  const github = {
    rest: {
      pulls: {
        get: async () => ({ data: fixture.pr }),
        listFiles: paged(fixture.files || []),
        listReviews: paged(fixture.reviews || []),
      },
      issues: {
        listComments: paged(fixture.comments || []),
        // The body is echoed so tests can assert on what would be posted.
        createComment: async ({ body }) => {
          if (fixture.commentError) throw new Error('simulated API failure');
          console.log(`[createComment] ${body}`);
          return {};
        },
      },
    },
    paginate: async (endpoint) => (await endpoint()).data,
  };

  const context = {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    payload: { pull_request: fixture.pr },
  };

  const core = {
    setFailed: (message) => { console.error(message); process.exitCode = 1; },
    setOutput: () => {},
    warning: (message) => console.warn(message),
  };

  return new AsyncFunction('github', 'context', 'core', script)(github, context, core);
}).catch((error) => { console.error(error.stack ?? error.message); process.exit(2); });
