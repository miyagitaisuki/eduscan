import * as schema from './schema';

export { schema };
export type Schema = typeof schema;

// Kiểu chung cho mọi driver (node-postgres trong production, PGlite trong kiểm thử).
// Cả hai đều dùng cùng bộ query builder của Drizzle nên code truy vấn không đổi.
export type Db = any;
