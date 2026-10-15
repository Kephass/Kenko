export const database = { userId: 'alice', rows: new Map(), failure: null };
export const supabase = {
  auth: { async getSession() { return { data: { session: { user: { id: database.userId } } } }; } },
  from(table) {
    let operation, payload, upsertOptions;
    const filters = {};
    const execute = () => {
      if (database.failure) return { error: new Error(database.failure) };
      if (operation === 'add' && Array.isArray(payload)) {
        for (const row of payload) if (!database.rows.has(`${table}:${row.id}`)) database.rows.set(`${table}:${row.id}`, row);
        return { data: payload, error: null };
      }
      const key = `${table}:${payload?.id ?? payload?.user_id ?? filters.id ?? filters.user_id}`;
      if (operation === 'add' && (!upsertOptions?.ignoreDuplicates || !database.rows.has(key))) database.rows.set(key, { ...database.rows.get(key), ...payload });
      if (operation === 'update') {
        if (!database.rows.has(key)) return { error: new Error('Row missing') };
        database.rows.set(key, { ...database.rows.get(key), ...payload });
      }
      if (operation === 'delete') database.rows.delete(key);
      return { data: database.rows.get(key), error: null };
    };
    const query = {
      upsert(row, options) { operation = 'add'; payload = row; upsertOptions = options; return query; },
      update(row) { operation = 'update'; payload = row; return query; },
      delete() { operation = 'delete'; return query; },
      eq(key, value) { filters[key] = value; return query; },
      select() { return query; },
      single() { return query; },
      then(ok, fail) { return Promise.resolve(execute()).then(ok, fail); },
    };
    return query;
  },
};
