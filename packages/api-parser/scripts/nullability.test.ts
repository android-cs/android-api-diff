import assert from 'node:assert/strict';
import { getAIDLStructList, getJavaStructList } from '../src/index.ts';

const findMember = <T extends { name: string }>(members: T[], name: string) => {
  const member = members.find((item) => item.name === name);
  assert.ok(member, `Expected member ${name}`);
  return member;
};

const javaStructs = getJavaStructList(`
import android.annotation.NonNull;
import android.annotation.Nullable;

public class Example {
  @Nullable String maybeName;
  @android.annotation.NonNull String sureName;
  String unknownName;
  int count;

  Example(@NonNull String name) {}

  @Nullable String findName(@Nullable String key, @NonNull Object token) {
    return null;
  }

  public @NonNull String strictName() {
    return "";
  }

  String inferName(String key) {
    return key;
  }

  void setName(@Nullable String name) {}
}

interface ExampleApi {
  @Nullable String findName(@NonNull String key);
}
`);

const javaExample = javaStructs.find((item) => item.name === 'Example');
assert.ok(javaExample);

const maybeName = findMember(javaExample.members, 'maybeName');
assert.equal(maybeName.kind, 'field');
assert.equal(maybeName.fieldNullability, 'nullable');

const sureName = findMember(javaExample.members, 'sureName');
assert.equal(sureName.kind, 'field');
assert.equal(sureName.fieldNullability, 'non-null');

const unknownName = findMember(javaExample.members, 'unknownName');
assert.equal(unknownName.kind, 'field');
assert.equal(Object.hasOwn(unknownName, 'fieldNullability'), false);

const count = findMember(javaExample.members, 'count');
assert.equal(count.kind, 'field');
assert.equal(count.fieldNullability, 'non-null');

const constructor = findMember(javaExample.members, 'Example');
assert.equal(constructor.kind, 'constructor');
assert.equal(constructor.parameters[0]?.nullability, 'non-null');

const findName = findMember(javaExample.members, 'findName');
assert.equal(findName.kind, 'method');
assert.equal(findName.returnNullability, 'nullable');
assert.equal(findName.parameters[0]?.name, 'key');
assert.equal(findName.parameters[0]?.nullability, 'nullable');
assert.equal(findName.parameters[1]?.name, 'token');
assert.equal(findName.parameters[1]?.nullability, 'non-null');

const strictName = findMember(javaExample.members, 'strictName');
assert.equal(strictName.kind, 'method');
assert.equal(strictName.returnNullability, 'non-null');

const inferName = findMember(javaExample.members, 'inferName');
assert.equal(inferName.kind, 'method');
assert.equal(Object.hasOwn(inferName, 'returnNullability'), false);
assert.equal(Object.hasOwn(inferName.parameters[0]!, 'nullability'), false);

const setName = findMember(javaExample.members, 'setName');
assert.equal(setName.kind, 'method');
assert.equal(setName.returnType, 'void');
assert.equal(setName.returnNullability, 'non-null');
assert.equal(setName.parameters[0]?.nullability, 'nullable');

const javaInterface = javaStructs.find((item) => item.name === 'ExampleApi');
assert.ok(javaInterface);
const interfaceFindName = findMember(javaInterface.members, 'findName');
assert.equal(interfaceFindName.kind, 'method');
assert.equal(interfaceFindName.returnNullability, 'nullable');
assert.equal(interfaceFindName.parameters[0]?.nullability, 'non-null');

const aidlStructs = getAIDLStructList(`
package android.app;

interface IExample {
  @nullable String findName(@nullable String key, int count);
  String requiredName(String key);
  const String KIND = "kind";
}

parcelable ExampleParcelable {
  @nullable String maybeName;
  String sureName;
  int count;
}
`);

const aidlInterface = aidlStructs.find((item) => item.name === 'IExample');
assert.ok(aidlInterface);

const aidlFindName = findMember(aidlInterface.members, 'findName');
assert.equal(aidlFindName.kind, 'method');
assert.equal(aidlFindName.returnNullability, 'nullable');
assert.equal(aidlFindName.parameters[0]?.nullability, 'nullable');
assert.equal(aidlFindName.parameters[1]?.nullability, 'non-null');

const requiredName = findMember(aidlInterface.members, 'requiredName');
assert.equal(requiredName.kind, 'method');
assert.equal(requiredName.returnNullability, 'non-null');
assert.equal(requiredName.parameters[0]?.nullability, 'non-null');

const kind = findMember(aidlInterface.members, 'KIND');
assert.equal(kind.kind, 'constant');
assert.equal(kind.fieldNullability, 'non-null');

const aidlParcelable = aidlStructs.find(
  (item) => item.name === 'ExampleParcelable',
);
assert.ok(aidlParcelable);

const aidlMaybeName = findMember(aidlParcelable.members, 'maybeName');
assert.equal(aidlMaybeName.kind, 'field');
assert.equal(aidlMaybeName.fieldNullability, 'nullable');

const aidlSureName = findMember(aidlParcelable.members, 'sureName');
assert.equal(aidlSureName.kind, 'field');
assert.equal(aidlSureName.fieldNullability, 'non-null');

const aidlCount = findMember(aidlParcelable.members, 'count');
assert.equal(aidlCount.kind, 'field');
assert.equal(aidlCount.fieldNullability, 'non-null');

console.log('nullability parser tests passed');
