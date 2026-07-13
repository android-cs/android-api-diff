// Generated from ./src/grammar/AIDL.g4 by ANTLR 4.13.2

import { ParseTreeListener } from 'antlr4';

import { CompilationUnitContext } from './AIDLParser.ts';
import { PackageDeclarationContext } from './AIDLParser.ts';
import { ImportDeclarationContext } from './AIDLParser.ts';
import { TypeDeclarationContext } from './AIDLParser.ts';
import { InterfaceDeclarationContext } from './AIDLParser.ts';
import { InterfaceBodyContext } from './AIDLParser.ts';
import { NestedTypeDeclarationContext } from './AIDLParser.ts';
import { ParcelableDeclarationContext } from './AIDLParser.ts';
import { ParcelableBodyContext } from './AIDLParser.ts';
import { LanguageHeadersContext } from './AIDLParser.ts';
import { LanguageHeaderContext } from './AIDLParser.ts';
import { FieldDeclarationContext } from './AIDLParser.ts';
import { VariableDeclaratorsContext } from './AIDLParser.ts';
import { VariableDeclaratorContext } from './AIDLParser.ts';
import { EnumDeclarationContext } from './AIDLParser.ts';
import { EnumConstantContext } from './AIDLParser.ts';
import { ConstDeclarationContext } from './AIDLParser.ts';
import { ConstantDeclarationContext } from './AIDLParser.ts';
import { MethodDeclarationContext } from './AIDLParser.ts';
import { ParameterListContext } from './AIDLParser.ts';
import { ParameterContext } from './AIDLParser.ts';
import { DirectionContext } from './AIDLParser.ts';
import { AnnotationContext } from './AIDLParser.ts';
import { AnnotationValuesContext } from './AIDLParser.ts';
import { AnnotationValueContext } from './AIDLParser.ts';
import { AnnotationArrayContext } from './AIDLParser.ts';
import { TypeContext } from './AIDLParser.ts';
import { PrimitiveTypeContext } from './AIDLParser.ts';
import { GenericTypeContext } from './AIDLParser.ts';
import { TypeArgumentContext } from './AIDLParser.ts';
import { TypeListContext } from './AIDLParser.ts';
import { QualifiedNameContext } from './AIDLParser.ts';
import { ExpressionContext } from './AIDLParser.ts';
import { LogicalOrExpressionContext } from './AIDLParser.ts';
import { LogicalAndExpressionContext } from './AIDLParser.ts';
import { BitwiseOrExpressionContext } from './AIDLParser.ts';
import { BitwiseXorExpressionContext } from './AIDLParser.ts';
import { BitwiseAndExpressionContext } from './AIDLParser.ts';
import { EqualityExpressionContext } from './AIDLParser.ts';
import { RelationalExpressionContext } from './AIDLParser.ts';
import { ShiftExpressionContext } from './AIDLParser.ts';
import { AdditiveExpressionContext } from './AIDLParser.ts';
import { MultiplicativeExpressionContext } from './AIDLParser.ts';
import { UnaryExpressionContext } from './AIDLParser.ts';
import { PrimaryExpressionContext } from './AIDLParser.ts';
import { LiteralContext } from './AIDLParser.ts';
import { AttributesContext } from './AIDLParser.ts';

/**
 * This interface defines a complete listener for a parse tree produced by
 * `AIDLParser`.
 */
export default class AIDLListener extends ParseTreeListener {
  /**
   * Enter a parse tree produced by `AIDLParser.compilationUnit`.
   * @param ctx the parse tree
   */
  enterCompilationUnit?: (ctx: CompilationUnitContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.compilationUnit`.
   * @param ctx the parse tree
   */
  exitCompilationUnit?: (ctx: CompilationUnitContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.packageDeclaration`.
   * @param ctx the parse tree
   */
  enterPackageDeclaration?: (ctx: PackageDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.packageDeclaration`.
   * @param ctx the parse tree
   */
  exitPackageDeclaration?: (ctx: PackageDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.importDeclaration`.
   * @param ctx the parse tree
   */
  enterImportDeclaration?: (ctx: ImportDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.importDeclaration`.
   * @param ctx the parse tree
   */
  exitImportDeclaration?: (ctx: ImportDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.typeDeclaration`.
   * @param ctx the parse tree
   */
  enterTypeDeclaration?: (ctx: TypeDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.typeDeclaration`.
   * @param ctx the parse tree
   */
  exitTypeDeclaration?: (ctx: TypeDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.interfaceDeclaration`.
   * @param ctx the parse tree
   */
  enterInterfaceDeclaration?: (ctx: InterfaceDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.interfaceDeclaration`.
   * @param ctx the parse tree
   */
  exitInterfaceDeclaration?: (ctx: InterfaceDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.interfaceBody`.
   * @param ctx the parse tree
   */
  enterInterfaceBody?: (ctx: InterfaceBodyContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.interfaceBody`.
   * @param ctx the parse tree
   */
  exitInterfaceBody?: (ctx: InterfaceBodyContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.nestedTypeDeclaration`.
   * @param ctx the parse tree
   */
  enterNestedTypeDeclaration?: (ctx: NestedTypeDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.nestedTypeDeclaration`.
   * @param ctx the parse tree
   */
  exitNestedTypeDeclaration?: (ctx: NestedTypeDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.parcelableDeclaration`.
   * @param ctx the parse tree
   */
  enterParcelableDeclaration?: (ctx: ParcelableDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.parcelableDeclaration`.
   * @param ctx the parse tree
   */
  exitParcelableDeclaration?: (ctx: ParcelableDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.parcelableBody`.
   * @param ctx the parse tree
   */
  enterParcelableBody?: (ctx: ParcelableBodyContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.parcelableBody`.
   * @param ctx the parse tree
   */
  exitParcelableBody?: (ctx: ParcelableBodyContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.languageHeaders`.
   * @param ctx the parse tree
   */
  enterLanguageHeaders?: (ctx: LanguageHeadersContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.languageHeaders`.
   * @param ctx the parse tree
   */
  exitLanguageHeaders?: (ctx: LanguageHeadersContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.languageHeader`.
   * @param ctx the parse tree
   */
  enterLanguageHeader?: (ctx: LanguageHeaderContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.languageHeader`.
   * @param ctx the parse tree
   */
  exitLanguageHeader?: (ctx: LanguageHeaderContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.fieldDeclaration`.
   * @param ctx the parse tree
   */
  enterFieldDeclaration?: (ctx: FieldDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.fieldDeclaration`.
   * @param ctx the parse tree
   */
  exitFieldDeclaration?: (ctx: FieldDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.variableDeclarators`.
   * @param ctx the parse tree
   */
  enterVariableDeclarators?: (ctx: VariableDeclaratorsContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.variableDeclarators`.
   * @param ctx the parse tree
   */
  exitVariableDeclarators?: (ctx: VariableDeclaratorsContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.variableDeclarator`.
   * @param ctx the parse tree
   */
  enterVariableDeclarator?: (ctx: VariableDeclaratorContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.variableDeclarator`.
   * @param ctx the parse tree
   */
  exitVariableDeclarator?: (ctx: VariableDeclaratorContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.enumDeclaration`.
   * @param ctx the parse tree
   */
  enterEnumDeclaration?: (ctx: EnumDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.enumDeclaration`.
   * @param ctx the parse tree
   */
  exitEnumDeclaration?: (ctx: EnumDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.enumConstant`.
   * @param ctx the parse tree
   */
  enterEnumConstant?: (ctx: EnumConstantContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.enumConstant`.
   * @param ctx the parse tree
   */
  exitEnumConstant?: (ctx: EnumConstantContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.constDeclaration`.
   * @param ctx the parse tree
   */
  enterConstDeclaration?: (ctx: ConstDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.constDeclaration`.
   * @param ctx the parse tree
   */
  exitConstDeclaration?: (ctx: ConstDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.constantDeclaration`.
   * @param ctx the parse tree
   */
  enterConstantDeclaration?: (ctx: ConstantDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.constantDeclaration`.
   * @param ctx the parse tree
   */
  exitConstantDeclaration?: (ctx: ConstantDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.methodDeclaration`.
   * @param ctx the parse tree
   */
  enterMethodDeclaration?: (ctx: MethodDeclarationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.methodDeclaration`.
   * @param ctx the parse tree
   */
  exitMethodDeclaration?: (ctx: MethodDeclarationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.parameterList`.
   * @param ctx the parse tree
   */
  enterParameterList?: (ctx: ParameterListContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.parameterList`.
   * @param ctx the parse tree
   */
  exitParameterList?: (ctx: ParameterListContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.parameter`.
   * @param ctx the parse tree
   */
  enterParameter?: (ctx: ParameterContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.parameter`.
   * @param ctx the parse tree
   */
  exitParameter?: (ctx: ParameterContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.direction`.
   * @param ctx the parse tree
   */
  enterDirection?: (ctx: DirectionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.direction`.
   * @param ctx the parse tree
   */
  exitDirection?: (ctx: DirectionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.annotation`.
   * @param ctx the parse tree
   */
  enterAnnotation?: (ctx: AnnotationContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.annotation`.
   * @param ctx the parse tree
   */
  exitAnnotation?: (ctx: AnnotationContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.annotationValues`.
   * @param ctx the parse tree
   */
  enterAnnotationValues?: (ctx: AnnotationValuesContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.annotationValues`.
   * @param ctx the parse tree
   */
  exitAnnotationValues?: (ctx: AnnotationValuesContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.annotationValue`.
   * @param ctx the parse tree
   */
  enterAnnotationValue?: (ctx: AnnotationValueContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.annotationValue`.
   * @param ctx the parse tree
   */
  exitAnnotationValue?: (ctx: AnnotationValueContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.annotationArray`.
   * @param ctx the parse tree
   */
  enterAnnotationArray?: (ctx: AnnotationArrayContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.annotationArray`.
   * @param ctx the parse tree
   */
  exitAnnotationArray?: (ctx: AnnotationArrayContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.type`.
   * @param ctx the parse tree
   */
  enterType?: (ctx: TypeContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.type`.
   * @param ctx the parse tree
   */
  exitType?: (ctx: TypeContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.primitiveType`.
   * @param ctx the parse tree
   */
  enterPrimitiveType?: (ctx: PrimitiveTypeContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.primitiveType`.
   * @param ctx the parse tree
   */
  exitPrimitiveType?: (ctx: PrimitiveTypeContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.genericType`.
   * @param ctx the parse tree
   */
  enterGenericType?: (ctx: GenericTypeContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.genericType`.
   * @param ctx the parse tree
   */
  exitGenericType?: (ctx: GenericTypeContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.typeArgument`.
   * @param ctx the parse tree
   */
  enterTypeArgument?: (ctx: TypeArgumentContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.typeArgument`.
   * @param ctx the parse tree
   */
  exitTypeArgument?: (ctx: TypeArgumentContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.typeList`.
   * @param ctx the parse tree
   */
  enterTypeList?: (ctx: TypeListContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.typeList`.
   * @param ctx the parse tree
   */
  exitTypeList?: (ctx: TypeListContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.qualifiedName`.
   * @param ctx the parse tree
   */
  enterQualifiedName?: (ctx: QualifiedNameContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.qualifiedName`.
   * @param ctx the parse tree
   */
  exitQualifiedName?: (ctx: QualifiedNameContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.expression`.
   * @param ctx the parse tree
   */
  enterExpression?: (ctx: ExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.expression`.
   * @param ctx the parse tree
   */
  exitExpression?: (ctx: ExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.logicalOrExpression`.
   * @param ctx the parse tree
   */
  enterLogicalOrExpression?: (ctx: LogicalOrExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.logicalOrExpression`.
   * @param ctx the parse tree
   */
  exitLogicalOrExpression?: (ctx: LogicalOrExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.logicalAndExpression`.
   * @param ctx the parse tree
   */
  enterLogicalAndExpression?: (ctx: LogicalAndExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.logicalAndExpression`.
   * @param ctx the parse tree
   */
  exitLogicalAndExpression?: (ctx: LogicalAndExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.bitwiseOrExpression`.
   * @param ctx the parse tree
   */
  enterBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.bitwiseOrExpression`.
   * @param ctx the parse tree
   */
  exitBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.bitwiseXorExpression`.
   * @param ctx the parse tree
   */
  enterBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.bitwiseXorExpression`.
   * @param ctx the parse tree
   */
  exitBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.bitwiseAndExpression`.
   * @param ctx the parse tree
   */
  enterBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.bitwiseAndExpression`.
   * @param ctx the parse tree
   */
  exitBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.equalityExpression`.
   * @param ctx the parse tree
   */
  enterEqualityExpression?: (ctx: EqualityExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.equalityExpression`.
   * @param ctx the parse tree
   */
  exitEqualityExpression?: (ctx: EqualityExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.relationalExpression`.
   * @param ctx the parse tree
   */
  enterRelationalExpression?: (ctx: RelationalExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.relationalExpression`.
   * @param ctx the parse tree
   */
  exitRelationalExpression?: (ctx: RelationalExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.shiftExpression`.
   * @param ctx the parse tree
   */
  enterShiftExpression?: (ctx: ShiftExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.shiftExpression`.
   * @param ctx the parse tree
   */
  exitShiftExpression?: (ctx: ShiftExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.additiveExpression`.
   * @param ctx the parse tree
   */
  enterAdditiveExpression?: (ctx: AdditiveExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.additiveExpression`.
   * @param ctx the parse tree
   */
  exitAdditiveExpression?: (ctx: AdditiveExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.multiplicativeExpression`.
   * @param ctx the parse tree
   */
  enterMultiplicativeExpression?: (
    ctx: MultiplicativeExpressionContext,
  ) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.multiplicativeExpression`.
   * @param ctx the parse tree
   */
  exitMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.unaryExpression`.
   * @param ctx the parse tree
   */
  enterUnaryExpression?: (ctx: UnaryExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.unaryExpression`.
   * @param ctx the parse tree
   */
  exitUnaryExpression?: (ctx: UnaryExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.primaryExpression`.
   * @param ctx the parse tree
   */
  enterPrimaryExpression?: (ctx: PrimaryExpressionContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.primaryExpression`.
   * @param ctx the parse tree
   */
  exitPrimaryExpression?: (ctx: PrimaryExpressionContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.literal`.
   * @param ctx the parse tree
   */
  enterLiteral?: (ctx: LiteralContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.literal`.
   * @param ctx the parse tree
   */
  exitLiteral?: (ctx: LiteralContext) => void;
  /**
   * Enter a parse tree produced by `AIDLParser.attributes`.
   * @param ctx the parse tree
   */
  enterAttributes?: (ctx: AttributesContext) => void;
  /**
   * Exit a parse tree produced by `AIDLParser.attributes`.
   * @param ctx the parse tree
   */
  exitAttributes?: (ctx: AttributesContext) => void;
}
