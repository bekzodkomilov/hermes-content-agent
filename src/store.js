export const schema = [
 `CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, created INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, photo TEXT, facts TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0)`,
 `CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, photo TEXT, source TEXT, facts TEXT NOT NULL, caption TEXT, status TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL, message_id INTEGER)`,
 `CREATE TABLE IF NOT EXISTS sessions (admin TEXT PRIMARY KEY, draft TEXT NOT NULL, revision INTEGER NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS draft_status ON drafts(status, created)`
];
export const sql = (env,q,...v) => env.DB.prepare(q).bind(...v);
export async function initialize(env) { await env.DB.batch(schema.map(q=>env.DB.prepare(q))); }
export async function claimJob(env,id) {
 const r=await sql(env,'INSERT OR IGNORE INTO jobs(id,created) VALUES(?,?)',id,Date.now()).run();
 return r.meta.changes === 1;
}
export async function claimDraft(env,id,rev,status) {
 return sql(env,"UPDATE drafts SET status=? WHERE id=? AND revision=? AND status='pending' RETURNING *",status,id,rev).first();
}
export async function newDraft(env,id,source,facts) {
 await sql(env,"INSERT INTO drafts(id,source,facts,status,created) VALUES(?,?,?,'generating',?)",id,source||null,facts,Date.now()).run();
 return sql(env,'SELECT * FROM drafts WHERE id=?',id).first();
}
