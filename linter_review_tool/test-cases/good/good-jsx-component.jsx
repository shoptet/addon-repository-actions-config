// Plain JSX: the same reference tracking as TSX.
import React from 'react';

const Item = ({ name }) => <li>{name}</li>;

export const Items = ({ names }) => (
  <ul>
    {names.map((name) => (
      <Item key={name} name={name} />
    ))}
  </ul>
);
