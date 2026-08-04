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
//
// The exit code is the test result: scripts signal failure via process.exit(1)
// or core.setFailed, success by finishing normally.
const fs = require('fs');

const [, , scriptPath, fixturePath] = process.argv;
const script = fs.readFileSync(scriptPath, 'utf8');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

Object.assign(process.env, fixture.env || {});

// Paginated endpoints carry their fixture data on the function object so the
// paginate mock can return it regardless of which endpoint is passed in.
const paged = (data) => Object.assign(async () => ({ data }), { __page: data });
const github = {
  rest: {
    pulls: {
      get: async () => ({ data: fixture.pr }),
      listFiles: paged(fixture.files || []),
      listReviews: paged(fixture.reviews || []),
    },
    issues: {
      listComments: paged(fixture.comments || []),
      createComment: async () => ({}),
    },
  },
  paginate: async (endpoint) => endpoint.__page ?? [],
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

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
new AsyncFunction('github', 'context', 'core', script)(github, context, core)
  .catch((error) => { console.error(error.message); process.exit(1); });
