export interface QueryExpression {
  type:
    | 'equal'
    | 'notEqual'
    | 'lessThan'
    | 'lessThanEqual'
    | 'greaterThan'
    | 'greaterThanEqual'
    | 'search'
    | 'orderAsc'
    | 'orderDesc'
    | 'limit'
    | 'offset'
    | 'select'
    | 'contains';
  attribute?: string;
  value?: any;
}

export interface ListRowsResult<T> {
  total: number;
  rows: T[];
}

export interface DatabasePort {
  getRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T>;
  
  listRows<T>(
    databaseId: string,
    tableId: string,
    queries?: QueryExpression[] | string[],
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<ListRowsResult<T>>;

  createRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string | null,
    data: Partial<T>,
    permissions?: string[],
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T>;

  updateRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Partial<T>,
    permissions?: string[],
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<T>;

  deleteRow(
    databaseId: string,
    tableId: string,
    rowId: string,
    options?: { jwt?: string; forceSystem?: boolean }
  ): Promise<void>;
}
