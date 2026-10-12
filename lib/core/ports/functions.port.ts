export interface FunctionsPort {
  /**
   * Triggers or schedules a serverless execution on a cloud system/environment.
   */
  executeFunction(
    functionId: string,
    data?: string,
    async?: boolean,
    path?: string,
    method?: string,
    headers?: Record<string, string>
  ): Promise<any>;
}
