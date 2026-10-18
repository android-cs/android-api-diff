import { CharStream, CommonTokenStream, ErrorListener, Token } from 'antlr4';
import JavaLexer from './JavaLexer.ts';
import JavaParser, {
  BinaryOperatorExpressionContext,
  CastExpressionContext,
  type ExpressionContext,
  PrimaryExpressionContext,
  TernaryExpressionContext,
  UnaryOperatorExpressionContext,
} from './JavaParser.ts';

const unaryOperators = new Set(['+', '-', '~', '!']);
const binaryOperators = new Set([
  '*',
  '/',
  '%',
  '+',
  '-',
  '<<',
  '>>',
  '>>>',
  '<',
  '<=',
  '>',
  '>=',
  '==',
  '!=',
  '&',
  '^',
  '|',
  '&&',
  '||',
]);

const isSelfContainedConstantExpression = (
  expression: ExpressionContext,
): boolean => {
  if (expression instanceof PrimaryExpressionContext) {
    const primary = expression.primary();
    const literal = primary.literal();
    if (literal) return !literal.NULL_LITERAL();
    const nested = primary.expression();
    return !!nested && isSelfContainedConstantExpression(nested);
  }
  if (expression instanceof UnaryOperatorExpressionContext) {
    return (
      unaryOperators.has(expression._prefix.text) &&
      isSelfContainedConstantExpression(expression.expression())
    );
  }
  if (expression instanceof BinaryOperatorExpressionContext) {
    // The grammar represents shifts as multiple '<' / '>' tokens, without _bop.
    const operator =
      expression._bop?.text ??
      (expression.children ?? [])
        .slice(1, -1)
        .map((child) => child.getText())
        .join('');
    return (
      binaryOperators.has(operator) &&
      expression.expression_list().every(isSelfContainedConstantExpression)
    );
  }
  if (expression instanceof TernaryExpressionContext) {
    return expression
      .expression_list()
      .every(isSelfContainedConstantExpression);
  }
  if (expression instanceof CastExpressionContext) {
    const types = expression.typeType_list();
    const type = types[0];
    return (
      types.length === 1 &&
      !!type &&
      expression.annotation_list().length === 0 &&
      type.annotation_list().length === 0 &&
      type.LBRACK_list().length === 0 &&
      (!!type.primitiveType() ||
        type.getText() === 'String' ||
        type.getText() === 'java.lang.String') &&
      isSelfContainedConstantExpression(expression.expression())
    );
  }
  // Names, calls, field/array access, creation, assignment, ++/--, etc.
  // are deliberately unsupported, including references to other constants.
  return false;
};

/**
 * Checks the supported constant-expression syntax, not Java types or values.
 * The source is expected to be valid Android Java. AIDL initializers are also
 * checked as Java because they will be emitted into a Java stub.
 * Returns a token-boundary-preserving key, ignoring only hidden-channel trivia.
 */
export const getJavaConstantExpressionKey = (
  source: string,
): string | undefined => {
  let hasError = false;
  const errorListener = new ErrorListener();
  errorListener.syntaxError = () => {
    hasError = true;
  };
  const lexer = new JavaLexer(new CharStream(source));
  lexer.removeErrorListeners();
  lexer.addErrorListener(errorListener);
  const tokens = new CommonTokenStream(lexer);
  const parser = new JavaParser(tokens);
  parser.removeErrorListeners();
  parser.addErrorListener(errorListener);
  const expression = parser.expression();
  tokens.fill();
  if (
    hasError ||
    tokens.LA(1) !== Token.EOF ||
    !isSelfContainedConstantExpression(expression)
  )
    return undefined;
  return JSON.stringify(
    tokens.tokens
      .filter(
        (token) =>
          token.channel === Token.DEFAULT_CHANNEL && token.type !== Token.EOF,
      )
      .map((token) => [token.type, token.text]),
  );
};
