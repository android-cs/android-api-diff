import { CharStream, CommonTokenStream, ParseTreeWalker } from 'antlr4';
import {
  useStructEditor,
  type ClassMemberParam,
  type ClassStruct,
  type Nullability,
} from '../share.ts';
import AIDLLexer from './AIDLLexer.ts';
import AIDLListener from './AIDLListener.ts';
import {
  AnnotationContext,
  AttributesContext,
  TypeContext,
} from './AIDLParser.ts';
import AIDLParser from './AIDLParser.ts';

const nullableAnnotationNames = new Set(['nullable']);

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
};

const getAttributeAnnotations = (
  attributes: AttributesContext | null | undefined,
) => {
  return attributes?.annotation_list() ?? [];
};

const getTypeInfo = (
  typeCtx: TypeContext,
  annotations: (AnnotationContext | null | undefined)[] = [],
): { type: string; nullability?: Nullability } => {
  const nullability = getAnnotationNullability(annotations);
  return {
    type: typeCtx.getText(),
    ...(nullability ? { nullability } : {}),
  };
};

const getQualifiedNameTail = (name: string) => {
  return name.split('.').at(-1) ?? name;
};

const toMethodType = (parameters: ClassMemberParam[], returnType: string) => {
  return `(${parameters.map((param) => param.type).join(', ')}) -> ${returnType}`;
};

export const getAIDLStructList = (text: string): ClassStruct[] => {
  const chars = new CharStream(text);
  const lexer = new AIDLLexer(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new AIDLParser(tokens);
  const result = parser.compilationUnit();
  if (result.exception) {
    throw result.exception;
  }
  const listener = new AIDLListener();
  const {
    addMember,
    enterStruct,
    exitStruct,
    hasCurrentStruct,
    structs,
    clearUseless,
  } =
    useStructEditor();
  listener.enterInterfaceDeclaration = (ctx) => {
    enterStruct(ctx.IDENTIFIER().getText(), ctx.IDENTIFIER().symbol.line);
  };
  listener.exitInterfaceDeclaration = exitStruct;
  listener.enterParcelableDeclaration = (ctx) => {
    enterStruct(
      getQualifiedNameTail(ctx.qualifiedName(0).getText()),
      ctx.qualifiedName(0).start.line,
    );
  };
  listener.exitParcelableDeclaration = exitStruct;
  listener.enterMethodDeclaration = (ctx) => {
    if (!hasCurrentStruct()) return;
    const id = ctx.IDENTIFIER();
    const name = id.getText();
    const returnInfo = getTypeInfo(
      ctx.type_(),
      getAttributeAnnotations(ctx.attributes()),
    );
    const parameters = (ctx.parameterList()?.parameter_list() || []).map(
      (parameter): ClassMemberParam => {
        const typeInfo = getTypeInfo(
          parameter.type_(),
          parameter.annotation_list(),
        );
        return {
          name: parameter.variableDeclarator().IDENTIFIER().getText(),
          type: typeInfo.type,
          ...(typeInfo.nullability
            ? { nullability: typeInfo.nullability }
            : {}),
        };
      },
    );
    addMember({
      kind: 'method',
      name,
      type: toMethodType(parameters, returnInfo.type),
      loc: id.symbol.line,
      returnType: returnInfo.type,
      ...(returnInfo.nullability
        ? { returnNullability: returnInfo.nullability }
        : {}),
      parameters,
      parameterCount: parameters.length,
    });
  };
  listener.enterFieldDeclaration = (ctx) => {
    if (!hasCurrentStruct()) return;
    const typeInfo = getTypeInfo(
      ctx.type_(),
      getAttributeAnnotations(ctx.attributes()),
    );
    for (const declarator of ctx.variableDeclarators().variableDeclarator_list()) {
      const id = declarator.IDENTIFIER();
      addMember({
        kind: 'field',
        name: id.getText(),
        type: typeInfo.type,
        loc: id.symbol.line,
        ...(typeInfo.nullability
          ? { fieldNullability: typeInfo.nullability }
          : {}),
      });
    }
  };
  listener.enterConstantDeclaration = (ctx) => {
    if (!hasCurrentStruct()) return;
    const declaration = ctx.constDeclaration();
    const id = declaration.IDENTIFIER();
    const typeInfo = getTypeInfo(
      declaration.type_(),
      getAttributeAnnotations(declaration.attributes()),
    );
    addMember({
      kind: 'constant',
      name: id.getText(),
      type: typeInfo.type,
      loc: id.symbol.line,
      ...(typeInfo.nullability
        ? { fieldNullability: typeInfo.nullability }
        : {}),
    });
  };
  ParseTreeWalker.DEFAULT.walk(listener, result);
  clearUseless();
  return structs;
};
