/**
 * Insert multiple rows into a table at a time
 */

import {
  Database,
} from 'sqlite3'

// open the database connection
const db = new Database(':memory:')

const languages = ['C++', 'Python', 'Java', 'C#', 'Go']

// construct the insert statement with multiple placehoders
// based on the number of rows
const placeholders = languages.map(lan => '(?)').join(',')
const sql = 'INSERT INTO langs(name) VALUES ' + placeholders

// output the INSERT statement
console.log(sql)

db.serialize(() => {
  // create table
  db.run('CREATE TABLE langs(name text)')
  db.run(sql, languages, function(err) {
    if(err) {
      console.error(err.message)
      return
    }
    console.log(`Rows inserted ${this.changes}`)
  })
})

// close the database connection
db.close()