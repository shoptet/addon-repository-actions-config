// Selecting by data-testid is flagged; the addon's own markup carrying the
// attribute is not.
import React from 'react';

type Props = { label: string };

export const Badge = ({ label }: Props) => <span data-testid="badge">{label}</span>;

export const cart = document.querySelector('[data-testid="cart"]');
