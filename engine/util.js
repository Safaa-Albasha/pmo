'use strict';
const DAY = 86400000;

function parseDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  return Date.parse(s + 'T00:00:00Z');
}

function isDate(s) {
  const t = parseDate(s);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

function addDays(s, n) {
  return new Date(parseDate(s) + n * DAY).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / DAY);
}

function round(n, d = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

module.exports = { parseDate, isDate, addDays, daysBetween, round };
