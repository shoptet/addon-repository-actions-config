// Classic-runtime React import and components used only through JSX are used;
// the addon's own markup may carry data-testid.
import React from 'react';

type Props = { label: string };

const Inner = ({ label }: Props) => <span data-testid="badge">{label}</span>;

export const Badge = ({ label }: Props) => (
  <div className="badge">
    <Inner label={label} />
  </div>
);
