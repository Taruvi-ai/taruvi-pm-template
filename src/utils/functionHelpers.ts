import { taruviFunctionsProvider, type FunctionMeta } from "../providers/refineProviders";

/**
 * Execute a serverless function on the Taruvi platform
 *
 * @param functionSlug - The slug of the function to execute
 * @param params - Parameters to pass to the function
 * @param options - Additional options (async mode, etc.)
 * @returns Promise with the function execution result
 *
 * @example
 * // Synchronous execution - wait for result
 * const result = await executeFunction("calculate-total", { items: [1, 2, 3] });
 * console.log(result);
 *
 * @example
 * // Asynchronous execution - returns task info for background processing
 * const taskInfo = await executeFunction("process-data", {
 *   dataset: "large_file.csv"
 * }, { async: true });
 * console.log("Task ID:", taskInfo.task_id);
 */
export const executeFunction = async <T = unknown>(
  functionSlug: string,
  params: Record<string, unknown> = {},
  options?: FunctionMeta
): Promise<T> => {
  try {
    const meta: FunctionMeta = {
      kind: "function",
      async: options?.async ?? false,
    };

    const response = await taruviFunctionsProvider.create({
      resource: functionSlug,
      variables: params,
      meta,
    });

    return response.data as T;
  } catch (error) {
    console.error(`Failed to execute function ${functionSlug}:`, error);
    throw error;
  }
};

/**
 * Execute a serverless function without waiting for the result (fire and forget)
 * Useful for notifications, logging, and non-critical background tasks
 *
 * @param functionSlug - The slug of the function to execute
 * @param params - Parameters to pass to the function
 *
 * @example
 * // Send notification without blocking form submission
 * const onSubmitHandler = async (data: any) => {
 *   try {
 *     const result = await onFinish(data);
 *
 *     if (result?.data) {
 *       // Fire and forget - don't block form submission
 *       executeFunctionAsync("send-mattermost-notification", {
 *         action: "created",
 *         ticket: result.data
 *       }).catch(err => console.error("Notification error:", err));
 *     }
 *   } catch (error) {
 *     throw error;
 *   }
 * };
 *
 * @example
 * // Simple fire-and-forget notification
 * executeFunctionAsync("send-notification", {
 *   message: "Order completed",
 *   userId: 123
 * }).catch(err => console.error("Notification error:", err));
 */
export const executeFunctionAsync = async (
  functionSlug: string,
  params: Record<string, unknown> = {}
): Promise<void> => {
  try {
    await executeFunction(functionSlug, params, { kind: "function", async: true });
  } catch (error) {
    // Silent fail for fire-and-forget operations
    console.error(`Background function execution failed for ${functionSlug}:`, error);
  }
};
