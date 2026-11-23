// Top-level `await using` makes this a module: the function below is
// module-scoped and cannot overwrite the core global.
declare function openResource(): { [Symbol.asyncDispose](): Promise<void> };

await using resource = openResource();

function initColorBox(): void {}

initColorBox();
