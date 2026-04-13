/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(1) + 'B';
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M';
  if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'K';
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(2);
}
