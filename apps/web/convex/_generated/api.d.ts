/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from 'convex/server';
import type * as agents from '../agents.js';
import type * as auth from '../auth.js';
import type * as authSessions from '../authSessions.js';
import type * as constants from '../constants.js';
import type * as crons from '../crons.js';
import type * as csrf from '../csrf.js';
import type * as healthCheck from '../healthCheck.js';
import type * as rateLimit from '../rateLimit.js';
import type * as todos from '../todos.js';

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  auth: typeof auth;
  authSessions: typeof authSessions;
  constants: typeof constants;
  crons: typeof crons;
  csrf: typeof csrf;
  healthCheck: typeof healthCheck;
  rateLimit: typeof rateLimit;
  todos: typeof todos;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, 'public'>
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, 'internal'>
>;
