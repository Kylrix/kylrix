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
    options?: { jwt?: string }
  ): Promise<T>;
  
  listRows<T>(
    databaseId: string,
    tableId: string,
    queries?: QueryExpression[] | string[],
    options?: { jwt?: string }
  ): Promise<ListRowsResult<T>>;

  createRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string | null,
    data: Partial<T>,
    permissions?: string[],
    options?: { jwt?: string }
  ): Promise<T>;

  updateRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Partial<T>,
    permissions?: string[],
    options?: { jwt?: string }
  ): Promise<T>;

  deleteRow(
    databaseId: string,
    tableId: string,
    rowId: string,
    options?: { jwt?: string }
  ): Promise<void>;
}
