/**
 * Querying all rows with all() method
 */

import {
  verbose,
} from 'sqlite3'


const sqlite3 = verbose()

// open the database
const db = new sqlite3.Database('./assets/chinook.db')

const sql = `SELECT DISTINCT Name name FROM playlists
             ORDER BY name`

db.all(sql, [], (err, rows) => {
  if(err) {
    throw err
  }
  rows.forEach(row => {
    console.log(row.name)
  })
})

// close the database connection
db.close()