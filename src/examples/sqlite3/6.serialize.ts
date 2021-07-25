/**
 * Executing statement in serialized mode with Database.serialize
 */

import {
  verbose,
} from 'sqlite3'

const sqlite3 = verbose()

// open the database connection
const db = new sqlite3.Database(':memory:', err => {
  if(err) {
    console.error(err.message)
  }
})

db.serialize(() => {
  // Queries scheduled here will be serialized.
  db.run('CREATE TABLE greetings(message text)')
  .run(`INSERT INTO greetings(message)
        VALUES('Hi'),
              ('Hello'),
              ('Welcome')`)
  .each('SELECT message FROM greetings', (err, row) => {
    if(err) {
      throw err
    }
    console.log(row.message)
  })
})

// clse the database connection
db.close(err => {
  if(err) {
    console.error(err.message)
    return
  }
})