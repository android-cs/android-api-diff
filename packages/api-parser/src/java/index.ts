import {
  CharStream,
  CommonTokenStream,
  ParseTreeWalker,
  type ParseTree,
} from 'antlr4';
import {
  createApiFile,
  createImportResolver,
  useStructEditor,
  type ApiFile,
  type ClassMemberParam,
  type Nullability,
} from '../share.ts';
import JavaLexer from './JavaLexer.ts';
import JavaParser, {
  AnnotationContext,
  ClassBodyDeclarationContext,
  ClassOrInterfaceModifierContext,
  FormalParameterContext,
  FormalParameterListContext,
  InterfaceBodyDeclarationContext,
  InterfaceMethodDeclarationContext,
  ModifierContext,
  ReceiverParameterContext,
  TypeDeclarationContext,
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

const getSignatureAnnotationTexts = (
  annotations: (AnnotationContext | null | undefined)[],
) => {
  return annotations
    .filter((annotation) => {
      const name = getAnnotationName(annotation).toLowerCase();
      return (
        nullableAnnotationNames.has(name) || nonNullAnnotationNames.has(name)
      );
    })
    .map((annotation) => annotation!.getText());
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

const getDeclarationModifiers = (
  ctx: unknown,
): (ModifierContext | ClassOrInterfaceModifierContext)[] => {
  let current = getParent(ctx);
  while (current) {
    if (
      current instanceof ClassBodyDeclarationContext ||
      current instanceof InterfaceBodyDeclarationContext
    ) {
      return current.modifier_list();
    }
    if (current instanceof TypeDeclarationContext) {
      return current.classOrInterfaceModifier_list();
    }
    current = getParent(current);
  }
  return [];
};

const hasAbstractModifier = (ctx: unknown) => {
  return getDeclarationModifiers(ctx).some((modifier) => {
    const classModifier =
      modifier instanceof ModifierContext
        ? modifier.classOrInterfaceModifier()
        : modifier;
    return !!classModifier?.ABSTRACT();
  });
};

const hasStaticModifier = (ctx: unknown) => {
  return getDeclarationModifiers(ctx).some((modifier) => {
    const classModifier =
      modifier instanceof ModifierContext
        ? modifier.classOrInterfaceModifier()
        : modifier;
    return !!classModifier?.STATIC();
  });
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
  resolveImports: ReturnType<typeof createImportResolver>,
  memberImports: Set<number>,
): ClassMemberParam[] => {
  if (!nodes?.length) return [];
  return nodes
    .flatMap((node): ClassMemberParam[] => {
      if (node instanceof ReceiverParameterContext) {
        const typeCtx = node.typeType();
        const { type, nullability } = getTypeInfo(typeCtx);
        resolveImports([
          type,
          ...getSignatureAnnotationTexts(typeCtx.annotation_list()),
        ]).forEach((index) => memberImports.add(index));
        return [{ type, ...(nullability ? { nullability } : {}) }];
      }
      if (node instanceof FormalParameterContext) {
        const annotations = getFormalParameterAnnotations(node);
        const typeCtx = node.typeType();
        const { type, nullability } = getTypeInfo(typeCtx, annotations);
        resolveImports([
          type,
          ...getSignatureAnnotationTexts([
            ...annotations,
            ...typeCtx.annotation_list(),
          ]),
        ]).forEach((index) => memberImports.add(index));
        return [
          {
            name: node.variableDeclaratorId().identifier().getText(),
            type,
            ...(nullability ? { nullability } : {}),
          },
        ];
      }
      if (node instanceof FormalParameterListContext) {
        return getParamList(node.children, resolveImports, memberImports);
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

export const parseJavaFile = (text: string): ApiFile => {
  const chars = new CharStream(text);
  const lexer = new JavaLexer(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new JavaParser(tokens);
  const result = parser.compilationUnit();
  if (result.exception) {
    throw result.exception;
  }
  const packageName =
    result.packageDeclaration()?.qualifiedName().getText() ?? '';
  const sourceImports = result.importDeclaration_list().map((ctx) => {
    return `${ctx.STATIC() ? 'static ' : ''}${ctx.qualifiedName().getText()}${
      ctx.MUL() ? '.*' : ''
    }`;
  });
  const resolveImports = createImportResolver(sourceImports);
  const listener = new JavaListener();
  const { addMember, enterStruct, exitStruct, structs, clearUseless } =
    useStructEditor();
  listener.enterClassDeclaration = (ctx) => {
    enterStruct(
      ctx.identifier().getText(),
      ctx.identifier().start.line,
      'class',
      hasAbstractModifier(ctx),
    );
  };
  listener.exitClassDeclaration = exitStruct;
  listener.enterConstructorDeclaration = (ctx) => {
    const id = ctx.identifier();
    const name = id.getText();
    const memberImports = new Set<number>();
    const parameters = getParamList(
      ctx.formalParameters().children,
      resolveImports,
      memberImports,
    );
    addMember({
      kind: 'constructor',
      name,
      type: toMethodType(parameters, name),
      loc: id.start.line,
      imports: Array.from(memberImports).sort((a, b) => a - b),
      parameters,
      parameterCount: parameters.length,
    });
  };
  listener.enterMethodDeclaration = (ctx) => {
    const id = ctx.identifier();
    const name = id.getText();
    const returnAnnotations = getAncestorModifierAnnotations(ctx);
    const returnType = ctx.typeTypeOrVoid();
    const returnInfo = getReturnTypeInfo(returnType, returnAnnotations);
    const memberImports = new Set(
      resolveImports([
        returnInfo.type,
        ...getSignatureAnnotationTexts([
          ...returnAnnotations,
          ...(returnType.typeType()?.annotation_list() ?? []),
        ]),
      ]),
    );
    const parameters = getParamList(
      ctx.formalParameters().children,
      resolveImports,
      memberImports,
    );
    addMember({
      kind: 'method',
      name,
      type: toMethodType(parameters, returnInfo.type),
      loc: id.start.line,
      imports: Array.from(memberImports).sort((a, b) => a - b),
      ...(hasAbstractModifier(ctx) ? { isAbstract: true } : {}),
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
    const annotations = getAncestorModifierAnnotations(ctx);
    const typeCtx = ctx.typeType();
    const typeInfo = getTypeInfo(typeCtx, annotations);
    addMember({
      kind: 'field',
      name,
      type: typeInfo.type,
      loc: id.start.line,
      imports: resolveImports([
        typeInfo.type,
        ...getSignatureAnnotationTexts([
          ...annotations,
          ...typeCtx.annotation_list(),
        ]),
      ]),
      ...(hasStaticModifier(ctx) ? { isStatic: true } : {}),
      ...(typeInfo.nullability
        ? { fieldNullability: typeInfo.nullability }
        : {}),
    });
  };
  listener.enterInterfaceDeclaration = (ctx) => {
    enterStruct(
      ctx.identifier().getText(),
      ctx.identifier().start.line,
      'interface',
    );
  };
  listener.exitInterfaceDeclaration = exitStruct;
  listener.enterInterfaceMethodDeclaration = (ctx) => {
    const b = ctx.interfaceCommonBodyDeclaration();
    const id = b.identifier();
    const name = id.getText();
    const returnAnnotations = [
      ...getAncestorModifierAnnotations(ctx),
      ...getInterfaceMethodModifierAnnotations(ctx),
      ...b.annotation_list(),
    ];
    const returnType = b.typeTypeOrVoid();
    const returnInfo = getReturnTypeInfo(returnType, returnAnnotations);
    const memberImports = new Set(
      resolveImports([
        returnInfo.type,
        ...getSignatureAnnotationTexts([
          ...returnAnnotations,
          ...(returnType.typeType()?.annotation_list() ?? []),
        ]),
      ]),
    );
    const parameters = getParamList(
      b.formalParameters().children,
      resolveImports,
      memberImports,
    );
    addMember({
      kind: 'method',
      name,
      type: toMethodType(parameters, returnInfo.type),
      loc: id.start.line,
      imports: Array.from(memberImports).sort((a, b) => a - b),
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
    const annotations = getAncestorModifierAnnotations(ctx);
    const typeCtx = ctx.typeType();
    const typeInfo = getTypeInfo(typeCtx, annotations);
    addMember({
      kind: 'constant',
      name,
      type: typeInfo.type,
      loc: id.start.line,
      imports: resolveImports([
        typeInfo.type,
        ...getSignatureAnnotationTexts([
          ...annotations,
          ...typeCtx.annotation_list(),
        ]),
      ]),
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
  return createApiFile(packageName, sourceImports, structs);
};
