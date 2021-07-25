/**
 * Executing statements in parallel with Database.parallelize
 */

import {
  verbose,
  Database
} from 'sqlite3'

const sqlite3 = verbose()

// open a database connection
const db = new sqlite3.Database(':memory:', err => {
  if(err) {
    console.error(err.message)
  }
})

db.parallelize(() => {
  dbSum(1, 2, db)
  dbSum(2, 2, db)
  dbSum(3, 3, db)
  dbSum(4, 4, db)
  dbSum(5, 5, db)
})

// close the database connection
db.close(err => {
  if(err) {
    console.log(err.message)
    return
  }
})

function dbSum(a: number, b: number, db: Database) {
  db.get('SELECT (? + ?) sum', [a, b], (err, row) => {
    if(err) {
      console.error(err.message)
      return
    }
    console.log(`The sum of ${a} and ${b} is ${row.sum}`)
  })
}