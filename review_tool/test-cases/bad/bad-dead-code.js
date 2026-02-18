import {unusedFunction} from './utils';

const unusedVariable = 'test';
let neverUsed = 123;

function neverCalled() {
  return true;
}

function processData(data) {
  return data;
  console.log('This is unreachable');
  const alsoUnreachable = 'never executed';
}
