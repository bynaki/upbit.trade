/**
 * Query the first row in the result set
 */

import {
  verbose,
} from 'sqlite3'


const sqlite3 = verbose()

// open the database
const db = new sqlite3.Database('./assets/chinook.db')

const sql = `SELECT PlaylistID id,
                    Name name
             FROM playlists
             WHERE PlaylistId = ?`
const playlistId = 1

// first row only
db.get(sql, [playlistId], (err, row) => {
  if(err) {
    console.error(err.message)
    return
  }
  row
  ? console.log(row.id, row.name)
  : console.log(`No playlist found with the id ${playlistId}`)
})

// close the database connection
db.close()