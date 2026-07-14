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
  return findStructPathByPath(list, paths)?.at(-1);
};

export const findStructPathByPath = (
  list: ClassStruct[] | undefined,
  paths: string[],
): ClassStruct[] | undefined => {
  if (!list?.length || paths.length === 0) return;
  let currentList: ClassStruct[] | undefined = list;
  const result: ClassStruct[] = [];
  for (const name of paths) {
    const current: ClassStruct | undefined = currentList?.find(
      (v) => v.name === name,
    );
    if (!current) return;
    result.push(current);
    currentList = current.children;
  }
  return result;
};
