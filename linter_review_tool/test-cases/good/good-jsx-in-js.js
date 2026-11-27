// JSX in a `.js` file (Vite / CRA templates) is linted like the same code in
// a `.jsx` file (CZ3TDR1-968): no parse error, and a component or the classic
// `React` import used only from JSX is not an unused variable.
import React from 'react';

function Title({ text }) {
  return <h1 className="addon-title">{text}</h1>;
}

export function Banner({ text }) {
  return (
    <section>
      <Title text={text} />
    </section>
  );
}

export const isSmaller = (a, b) => a < b;
