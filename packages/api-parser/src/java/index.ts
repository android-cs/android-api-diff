import {
  CharStream,
  CommonTokenStream,
  ParseTreeWalker,
  type ParseTree,
} from 'antlr4';
import {
  useStructEditor,
  type ClassMemberParam,
  type ClassStruct,
  type Nullability,
} from '../share.ts';
import JavaLexer from './JavaLexer.ts';
import JavaParser, {
  AnnotationContext,
  ClassBodyDeclarationContext,
  FormalParameterContext,
  FormalParameterListContext,
  InterfaceBodyDeclarationContext,
  InterfaceMethodDeclarationContext,
  ModifierContext,
  ReceiverParameterContext,
  TypeTypeContext,
} from './JavaParser.ts';
import JavaListener from './JavaParserListener.ts';

const nullableAnnotationNames = new Set(['nullable', 'recentlynullable']);
const nonNullAnnotationNames = new Set([
  'nonnull',
  'notnull',
  'recentlynonnull',
]);
const primitiveTypeNames = new Set([
  'boolean',
  'byte',
  'char',
  'double',
  'float',
  'int',
  'long',
  'short',
  'void',
]);

const getAnnotationName = (
  annotation: AnnotationContext | null | undefined,
): string => {
  return annotation?.qualifiedName().getText().split('.').at(-1) ?? '';
};

const getAnnotationNullability = (
  annotations: (AnnotationContext | null | undefined)[],
): Nullability | undefined => {
  const names = annotations.map((annotation) =>
    getAnnotationName(annotation).toLowerCase(),
  );
  if (names.some((name) => nullableAnnotationNames.has(name))) {
    return 'nullable';
  }
  if (names.some((name) => nonNullAnnotationNames.has(name))) {
    return 'non-null';
  }
};

const getModifierAnnotations = (modifiers: ModifierContext[]) => {
  return modifiers
    .map((modifier) => modifier.classOrInterfaceModifier()?.annotation())
    .filter((annotation) => !!annotation?.getText());
};

const getParent = (ctx: unknown): unknown => {
  const value = ctx as { parentCtx?: unknown; parent?: unknown };
  return value.parentCtx ?? value.parent;
};

const getAncestorModifierAnnotations = (ctx: unknown) => {
  let current = getParent(ctx);
  while (current) {
    if (
      current instanceof ClassBodyDeclarationContext ||
      current instanceof InterfaceBodyDeclarationContext
    ) {
      return getModifierAnnotations(current.modifier_list());
    }
    current = getParent(current);
  }
  return [];
};

const getInterfaceMethodModifierAnnotations = (
  ctx: InterfaceMethodDeclarationContext,
) => {
  return ctx
    .interfaceMethodModifier_list()
    .map((modifier) => modifier.annotation())
    .filter((annotation) => !!annotation?.getText());
};

const getJavaTypeText = (typeCtx: TypeTypeContext): string => {
  let text = typeCtx.getText();
  for (const annotation of typeCtx.annotation_list()) {
    const annotationText = annotation.getText();
    if (text.startsWith(annotationText)) {
      text = text.substring(annotationText.length);
    }
  }
  return text;
};

const getTypeNullability = (
  typeText: string,
  annotations: (AnnotationContext | null | undefined)[],
): Nullability | undefined => {
  const annotationNullability = getAnnotationNullability(annotations);
  if (annotationNullability) return annotationNullability;
  return primitiveTypeNames.has(typeText) ? 'non-null' : undefined;
};

const getTypeInfo = (
  typeCtx: TypeTypeContext,
  annotations: (AnnotationContext | null | undefined)[] = [],
): { type: string; nullability?: Nullability } => {
  const type = getJavaTypeText(typeCtx);
  const nullability = getTypeNullability(type, [
    ...annotations,
    ...typeCtx.annotation_list(),
  ]);
  return {
    type,
    ...(nullability ? { nullability } : {}),
  };
};

const getReturnTypeInfo = (
  typeTypeOrVoid: ReturnType<JavaParser['typeTypeOrVoid']>,
  annotations: (AnnotationContext | null | undefined)[] = [],
): { type: string; nullability?: Nullability } => {
  const typeCtx = typeTypeOrVoid.typeType();
  if (typeCtx) return getTypeInfo(typeCtx, annotations);
  return {
    type: typeTypeOrVoid.getText(),
    nullability: 'non-null',
  };
};

const getFormalParameterAnnotations = (ctx: FormalParameterContext) => {
  return [
    ...ctx
      .variableModifier_list()
      .map((modifier) => modifier.annotation())
      .filter((annotation) => !!annotation?.getText()),
    ...ctx.annotation_list(),
  ];
};

const getParamList = (
  nodes: ParseTree[] | undefined | null,
): ClassMemberParam[] => {
  if (!nodes?.length) return [];
  return nodes
    .flatMap((node): ClassMemberParam[] => {
      if (node instanceof ReceiverParameterContext) {
        const { type, nullability } = getTypeInfo(node.typeType());
        return [{ type, ...(nullability ? { nullability } : {}) }];
      }
      if (node instanceof FormalParameterContext) {
        const { type, nullability } = getTypeInfo(
          node.typeType(),
          getFormalParameterAnnotations(node),
        );
        return [
          {
            name: node.variableDeclaratorId().identifier().getText(),
            type,
            ...(nullability ? { nullability } : {}),
          },
        ];
      }
      if (node instanceof FormalParameterListContext) {
        return getParamList(node.children);
      }
      return [];
    })
    .filter((param) => !!param.type);
};

const toMethodType = (parameters: ClassMemberParam[], returnType: string) => {
  return `(${parameters.map((param) => param.type).join(', ')}) -> ${returnType}`;
};

const getQualifiedNameTail = (name: string) => {
  return name.split('.').at(-1) ?? name;
};

export const getJavaStructList = (text: string): ClassStruct[] => {
  const chars = new CharStream(text);
  const lexer = new JavaLexer(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new JavaParser(tokens);
  const result = parser.compilationUnit();
  if (result.exception) {
    throw result.exception;
  }
  const listener = new JavaListener();
  const { addMember, enterStruct, exitStruct, structs, clearUseless } =
    useStructEditor();
  listener.enterClassDeclaration = (ctx) => {
    enterStruct(ctx.identifier().getText(), ctx.identifier().start.line);
  };
  listener.exitClassDeclaration = exitStruct;
  listener.enterConstructorDeclaration = (ctx) => {
    const id = ctx.identifier();
    const name = id.getText();
    const parameters = getParamList(ctx.formalParameters().children);
    addMember({
      kind: 'constructor',
      name,
      type: toMethodType(parameters, name),
      loc: id.start.line,
      parameters,
      parameterCount: parameters.length,
    });
  };
  listener.enterMethodDeclaration = (ctx) => {
    const id = ctx.identifier();
    const name = id.getText();
    const returnInfo = getReturnTypeInfo(ctx.typeTypeOrVoid(), [
      ...getAncestorModifierAnnotations(ctx),
    ]);
    const parameters = getParamList(ctx.formalParameters().children);
    addMember({
      kind: 'method',
      name,
      type: toMethodType(parameters, returnInfo.type),
      loc: id.start.line,
      returnType: returnInfo.type,
      ...(returnInfo.nullability
        ? { returnNullability: returnInfo.nullability }
        : {}),
      parameters,
      parameterCount: parameters.length,
    });
  };
  listener.enterFieldDeclaration = (ctx) => {
    const id = ctx
      .variableDeclarators()
      .variableDeclarator(0)
      .variableDeclaratorId()
      .identifier();
    const name = id.getText();
    const typeInfo = getTypeInfo(ctx.typeType(), [
      ...getAncestorModifierAnnotations(ctx),
    ]);
    addMember({
      kind: 'field',
      name,
      type: typeInfo.type,
      loc: id.start.line,
      ...(typeInfo.nullability
        ? { fieldNullability: typeInfo.nullability }
        : {}),
    });
  };
  listener.enterInterfaceDeclaration = (ctx) => {
    enterStruct(ctx.identifier().getText(), ctx.identifier().start.line);
  };
  listener.exitInterfaceDeclaration = exitStruct;
  listener.enterInterfaceMethodDeclaration = (ctx) => {
    const b = ctx.interfaceCommonBodyDeclaration();
    const id = b.identifier();
    const name = id.getText();
    const returnInfo = getReturnTypeInfo(b.typeTypeOrVoid(), [
      ...getAncestorModifierAnnotations(ctx),
      ...getInterfaceMethodModifierAnnotations(ctx),
      ...b.annotation_list(),
    ]);
    const parameters = getParamList(b.formalParameters().children);
    addMember({
      kind: 'method',
      name,
      type: toMethodType(parameters, returnInfo.type),
      loc: id.start.line,
      returnType: returnInfo.type,
      ...(returnInfo.nullability
        ? { returnNullability: returnInfo.nullability }
        : {}),
      parameters,
      parameterCount: parameters.length,
    });
  };
  listener.enterConstDeclaration = (ctx) => {
    const id = ctx.constantDeclarator(0).identifier();
    const name = id.getText();
    const typeInfo = getTypeInfo(ctx.typeType(), [
      ...getAncestorModifierAnnotations(ctx),
    ]);
    addMember({
      kind: 'constant',
      name,
      type: typeInfo.type,
      loc: id.start.line,
      ...(typeInfo.nullability
        ? { fieldNullability: typeInfo.nullability }
        : {}),
    });
  };
  ParseTreeWalker.DEFAULT.walk(listener, result);
  clearUseless();
  for (const struct of structs) {
    struct.name = getQualifiedNameTail(struct.name);
  }
  return structs;
};
