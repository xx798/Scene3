import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInserts } from '../scripts/restore-db';
test('restore parser preserves multiline quotes, semicolons and SQL-looking data', () => {
  const sql = "-- header\nDROP TABLE public.users;\nINSERT INTO public.users (id, name) VALUES (1, 'a;\nb''c -- text');";
  const rows = extractInserts(sql);
  assert.equal(rows.length, 1);
  assert.match(rows[0].sql, /a;\nb''c -- text/);
  assert.throws(() => extractInserts("INSERT INTO public.users (name) VALUES ('unfinished"));
  assert.throws(() => extractInserts('INSERT INTO public.unknown (id) VALUES (1);'));
});
