export { resolveWorkspaceMekBytes } from './resources/helpers';
import { apiResourcesPart1 } from './resources/part1';
import { apiResourcesPart2 } from './resources/part2';
import { apiResourcesPart3 } from './resources/part3';
import { apiResourcesPart4 } from './resources/part4';
export const ApiResources = {
  ...apiResourcesPart1,
  ...apiResourcesPart2,
  ...apiResourcesPart3,
  ...apiResourcesPart4
};
