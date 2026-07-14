export {
  renderAndroidApiCode,
  toAndroidApiMemberResult,
} from './code-render.ts';
import { queryAndroidApi } from './query.ts';
import type {
  AndroidApiCodeResult,
  AndroidApiQueryRuntime,
  QueryAndroidApiOptions,
} from './types.ts';
import { renderAndroidApiCode } from './code-render.ts';

export const generateAndroidApiCode = async (
  runtime: AndroidApiQueryRuntime,
  options: QueryAndroidApiOptions,
): Promise<AndroidApiCodeResult> => {
  return renderAndroidApiCode(await queryAndroidApi(runtime, options));
};
