/**
 * Connecting to the in-memory database
 */


import {
  verbose,
} from 'sqlite3'

const sqlite3 = verbose()

// open database in memory
const db = new sqlite3.Database(':memory:', err => {
  if(err) {
    console.error(err.message)
    return
  }
  console.log('Connected to the in-memory SQlite database.')
})

// close the database connection
db.close(err => {
  if(err) {
    console.error(err.message)
    return
  }
  console.log('Close the database connection.')
})
