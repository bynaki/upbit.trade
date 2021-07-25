/**
 * Updating Data in SQLite Database from a Node.js Application
 */

 import {
  Database,
} from 'sqlite3'

// open the database connection
const db = new Database(':memory:')

const languages = ['C++', 'Python', 'Java', 'C#', 'Go', 'C']

// construct the insert statement with multiple placehoders
// based on the number of rows
const placeholders = languages.map(lan => '(?)').join(',')
const sqlInsert = 'INSERT INTO langs(name) VALUES ' + placeholders

// update statement
const data = ['Ansi C', 'C']
const sqlUpdate = `UPDATE langs
              SET name = ?
              WHERE name = ?`

db.serialize(() => {
  // create table
  db.run('CREATE TABLE langs(name text)')

  // insert rows
  db.run(sqlInsert, languages, function(err) {
    if(err) {
      console.error(err.message)
      return
    }
    console.log(`Rows inserted ${this.changes}`)
  })

  // update
  db.run(sqlUpdate, data, function(err) {
    if(err) {
      console.error(err.message)
      return
    }
    console.log(`Row(s) updated: ${this.changes}`)
  })
})

// close the database connection
db.close()