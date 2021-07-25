/**
 * Insert one row into a table
 */

import {
  verbose,
} from 'sqlite3'

const sqlite3 = verbose()

const db = new sqlite3.Database(':memory:')

db.serialize(() => {
  db.run('CREATE TABLE langs(name text)')
  // insert one row into the langs table
  .run(`INSERT INTO langs(name) VALUES(?)`, ['C'], function(err) {
    if(err) {
      console.log(err.message)
      return
    }
    // get the last insert id
    console.log(`A row has been inserted with rowid ${this.lastID}`)
  })
  // close the database connection
  .close()
})
