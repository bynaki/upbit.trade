/**
 * Connecting to a disk file database
 */


import {
  verbose,
  OPEN_READWRITE,
} from 'sqlite3'

const sqlite3 = verbose()

// open the database
const db = new sqlite3.Database('./assets/chinook.db', OPEN_READWRITE, err => {
  if(err) {
    console.error(err.message)
    return
  }
  console.log('Connected to the database.')
})

db.serialize(() => {
  db.each(`SELECT PlaylistId as id,
            Name as name
            FROM playlists`, (err, row) => {
    if(err) {
      console.error(err.message)
    }
    console.log(row.id + '\t' + row.name)
  })
})

db.close(err => {
  if(err) {
    console.error(err.message)
  }
  console.log('Close the database connection.')
})