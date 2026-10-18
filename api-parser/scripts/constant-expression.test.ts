import assert from 'node:assert/strict';
import { getJavaConstantExpressionKey as key } from '../src/index.ts';

for (const source of [
  'true',
  'false',
  '42',
  '0xff',
  '077',
  '0b1010',
  '1_000L',
  '.5f',
  '1.',
  '1e-3',
  '0x1.fp+2',
  "'A'",
  "' '",
  String.raw`'\n'`,
  String.raw`'\''`,
  String.raw`'\\'`,
  '+1',
  '-1',
  '~0',
  '!false',
  '(1 + 2) * 3',
  '9 / 3 % 2',
  '1 << 4',
  '-1 >> 2',
  '-1 >>> 2',
  '1 < 2',
  '1 <= 2',
  '2 > 1',
  '2 >= 1',
  '1 == 2',
  '1 != 2',
  '1 & 2 ^ 3 | 4',
  'true && false || true',
  'true ? 1 : (false ? 2 : 3)',
  '(byte) 127',
  '(short) 1',
  '(char) 65',
  '(int) 1L',
  '(long) 1',
  '(float) 1',
  '(double) 1',
  '(boolean) true',
  '"a" + "b" == "ab"',
  '(String) "a" == "a"',
  '(java.lang.String) "a" == "a"',
  '"""\nhello\n""" == "hello\\n"',
  "('_'<<24)|('C'<<16)|('M'<<8)|'D'",
]) {
  assert.notEqual(key(source), undefined, source);
}

for (const source of [
  '',
  ' ',
  '/* only comment */',
  'null',
  'this',
  'super',
  'FLAG',
  'Integer.MAX_VALUE',
  'Flags.VALUE | 1',
  'getValue()',
  'Math.abs(-1)',
  '"x".length()',
  'array[0]',
  'new Integer(1)',
  'new int[]{1}',
  'int.class',
  'x = 1',
  'x += 1',
  'x <<= 1',
  '++x',
  '--x',
  'x++',
  'x--',
  '1++',
  '1 + ++2',
  'true ? 1 : getValue()',
  'false && getValue()',
  '(Integer) 1',
  '(int[]) null',
  '(String & Runnable) "a"',
  '(Object) "x" instanceof String',
  '() -> 1',
  'Integer::valueOf',
  'switch (1) { default -> 2; }',
  '1 +',
  '(1',
  '1 2',
  '1; 2',
  '1 @',
  '1 /* unfinished',
]) {
  assert.equal(key(source), undefined, source);
}

assert.equal(key('1<<4'), key(' 1 /* shift */ <<\n 4 // trailing\n'));
assert.equal(key('1 + +2'), key('1+ /* unary plus */ +2'));
assert.equal(key('1 - -2'), key('1- /* unary minus */ -2'));
for (const [left, right] of [
  ['16', '0x10'],
  ['16', '1 << 4'],
  ['1', '(1)'],
  ['1', '1L'],
  ["' '", "'\\t'"],
  ['"a b" == "a b"', '"ab" == "ab"'],
  ['"/*x*/" == ""', '"" == ""'],
  ['"""\na b\n""" == ""', '"""\nab\n""" == ""'],
]) {
  assert.notEqual(key(left), undefined, left);
  assert.notEqual(key(right), undefined, right);
  assert.notEqual(key(left), key(right), `${left} vs ${right}`);
}

console.log('constant expression tests passed');
