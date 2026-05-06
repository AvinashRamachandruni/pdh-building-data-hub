export function buildMongoUri(
  server: string | undefined,
  db: string | undefined,
  defaultDb: string,
): string {
  const rawServer = server?.trim() || 'mongodb://localhost:27017';
  const normalizedServer = rawServer.match(/^mongodb(\+srv)?:\/\//i)
    ? rawServer.replace(/\/+$/, '')
    : `mongodb://${rawServer.replace(/^\/+/, '').replace(/\/+$/, '')}`;

  const dbName = db?.trim() || defaultDb;
  return `${normalizedServer}/${dbName}`;
}
