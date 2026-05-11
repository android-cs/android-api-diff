// @ts-check
/**
 * @type {import('prettier').Config}
 */
export default {
  singleQuote: true,
  overrides: [
    {
      files: '*.ts',
      options: {
        parser: 'babel-ts',
      },
    },
  ],
};
