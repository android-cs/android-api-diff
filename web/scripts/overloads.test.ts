import assert from 'node:assert/strict';
import test from 'node:test';
import { hasConcurrentOverloads } from '../src/views/home/overloads.ts';

test('does not treat signatures from different tags as overloads', () => {
  assert.equal(
    hasConcurrentOverloads([
      { members: [{ signature: '(Rect, int) -> Bitmap' }] },
      { members: [{ signature: '(Rect) -> Bitmap' }] },
      { members: [{ signature: '(Rect, Listener) -> boolean' }] },
    ]),
    false,
  );
});

test('detects overloads that coexist in one tag', () => {
  assert.equal(
    hasConcurrentOverloads([
      {
        members: [
          { signature: '(String) -> void' },
          { signature: '(String, int) -> void' },
        ],
      },
    ]),
    true,
  );
});
