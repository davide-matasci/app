// Read-only test: can SQLite on this machine sort a large result (which makes it
// spill into a temporary file)? Runs the same kind of query as a sync page, three
// ways. Prints only row counts and errors. Run from the data directory:
//
//   linux --root /data/alpine sh -c 'cd /var/lib/sn && \
//     node --require /opt/sn/.pnp.cjs /opt/sn/sqlite-temp-test.js'
const APP = process.env.SN_APP || '/opt/sn'
const sqlite3 = require('module').createRequire(`${APP}/packages/syncing-server/package.json`)('sqlite3')
const dbPath = `${process.cwd()}/home_server.sqlite`

const query = `select * from items where deleted = 0 order by updated_at_timestamp asc limit 600`

function run(label, pragmas) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY)
    db.serialize(() => {
      for (const pragma of pragmas) db.run(pragma)
      db.all(query, (error, rows) => {
        console.log(`${label}: ${error ? 'FAILED ' + error.message : `ok, ${rows.length} rows`}`)
        db.close(resolve)
      })
    })
  })
}

;(async () => {
  await run('default settings (may spill to a temp file)', [])
  await run('temp files in memory (temp_store = MEMORY)', ['PRAGMA temp_store = MEMORY'])
  await run('larger cache, no spill (cache_size = 64 MB)', ['PRAGMA cache_size = -65536'])
})()
