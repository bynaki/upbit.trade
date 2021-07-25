/**
 * Query rows with each() method
 */

import {
  verbose,
} from 'sqlite3'

const sqlite3 = verbose()

// open the database
const db = new sqlite3.Database('./assets/chinook.db')

const sql = `SELECT FirstName firstName,
                    LastName lastName,
                    Email email
             FROM customers
             WHERE Country = ?
             ORDER BY FirstName`

db.each(sql, ['USA'], (err, row) => {
  if(err) {
    throw err
  }
  console.log(`${row.firstName} ${row.lastName} - ${row.email}`)
})

// clsoe the database connection
db.close()