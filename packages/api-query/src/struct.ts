import type { ClassStruct } from '@android-cs/api-parser';

export const findStructByName = (
  list: ClassStruct[] | undefined,
  name: string,
): ClassStruct | undefined => {
  if (!list?.length) return;
  const v = list.find((v) => v.name === name);
  if (v) return v;
  for (const struct of list) {
    const v2 = findStructByName(struct.children, name);
    if (v2) return v2;
  }
};

export const findStructByPath = (
  list: ClassStruct[] | undefined,
  paths: string[],
): ClassStruct | undefined => {
  if (!list?.length || paths.length === 0) return;
  let currentList: ClassStruct[] | undefined = list;
  let current: ClassStruct | undefined;
  for (const name of paths) {
    current = currentList?.find((v) => v.name === name);
    if (!current) return;
    currentList = current.children;
  }
  return current;
};
