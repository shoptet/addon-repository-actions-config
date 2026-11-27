// JSX in a .cjs file stays a parse error: CommonJS has no JSX build, so
// the .jsx retry does not apply.
module.exports = () => <i />;
