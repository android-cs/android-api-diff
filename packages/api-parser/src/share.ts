export type Nullability = 'nullable' | 'non-null';

export interface ClassMemberParam {
  name?: string;
  type: string;
  nullability?: Nullability;
}

interface ClassMemberBase {
  name: string;
  type: string;
  loc: number;
  parameterCount?: number;
}

export interface ClassFieldMember extends ClassMemberBase {
  kind: 'field';
  fieldNullability?: Nullability;
}

export interface ClassConstantMember extends ClassMemberBase {
  kind: 'constant';
  fieldNullability?: Nullability;
}

export interface ClassMethodMember extends ClassMemberBase {
  kind: 'method';
  isAbstract?: true;
  returnType: string;
  returnNullability?: Nullability;
  parameters: ClassMemberParam[];
  parameterCount: number;
}

export interface ClassConstructorMember extends ClassMemberBase {
  kind: 'constructor';
  parameters: ClassMemberParam[];
  parameterCount: number;
}

export type ClassMember =
  | ClassFieldMember
  | ClassConstantMember
  | ClassMethodMember
  | ClassConstructorMember;

export interface ClassStruct {
  name: string;
  loc: number;
  isInterface?: true;
  isAbstract?: true;
  members: ClassMember[];
  children?: ClassStruct[];
}

export interface TempClassStruct extends ClassStruct {
  parent?: TempClassStruct;
  children: TempClassStruct[];
}

export const useStructEditor = () => {
  const tempAllStructs: TempClassStruct[] = [];
  const structs: TempClassStruct[] = [];
  let currentStruct: TempClassStruct | undefined;
  const enterStruct = (
    name: string,
    loc: number,
    kind: 'class' | 'interface',
    isAbstract = false,
  ) => {
    const v: TempClassStruct = {
      name,
      loc,
      ...(kind === 'interface' ? { isInterface: true as const } : {}),
      ...(isAbstract ? { isAbstract: true as const } : {}),
      members: [],
      children: [],
    };
    tempAllStructs.push(v);
    const parent = currentStruct;
    if (parent) {
      v.parent = parent;
      parent.children.push(v);
    } else {
      structs.push(v);
    }
    currentStruct = v;
  };
  const exitStruct = () => {
    currentStruct = currentStruct?.parent;
  };
  const hasCurrentStruct = () => {
    return !!currentStruct;
  };
  const addMember = (value: ClassMember) => {
    if (!currentStruct) {
      throw new Error('No current struct to add member to');
    }
    currentStruct.members.push(value);
  };
  const clearUseless = () => {
    for (const v of tempAllStructs) {
      delete v.parent;
      if (v.children.length === 0) {
        // @ts-ignore
        delete v.children;
      }
    }
  };
  return {
    enterStruct,
    exitStruct,
    hasCurrentStruct,
    addMember,
    structs,
    clearUseless,
  };
};
