import {
  // verbose,
  Database as sqlite3,
} from 'sqlite3'
import {
  Database as DB,
  open,
  ISqlite,
} from 'sqlite'
import {
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  UPbitSequence,
  getConfig,
} from './'



type TableType = {
  type: string
  name: string
  tbl_name: string
  rootpage: number
  sql: string
}

export interface DbTradeTickType extends Iu.TradeTickType {
  trade_volume: any
}

export interface DbCandleMinuteType extends Iu.CandleMinuteType {
  candle_acc_trade_price: any
  candle_acc_trade_volume: any
}

export async function ready<T>(filename: string, tableName: string): Promise<DbTable<T>> {
  const db = new Database(filename)
  const table = db.ready<T>(tableName)
  if(table === null) {
    throw new Error(`'${filename}' 데이터베이스에 '${tableName}' 테이블이 없다.`)
  }
  return table
}

export async function readyTrade(filename: string, tableName: string, params: {
  codes: string[]
  daysAgo: number
  to?: string
}, override: 'yes'|'no' = 'no'): Promise<DbTable<DbTradeTickType>> {
  let {codes, daysAgo}  = params
  if(!daysAgo) {
    daysAgo = 0
  }
  const db = new Database(filename)
  const table: DbTable<DbTradeTickType> = await db.ready(tableName)
  if(table && override === 'no') {
    return table
  }
  if(table && override === 'yes') {
    await db.dropTable(tableName)
  }
  await db.createTable(tableName, {
    market: 'TEXT',
    trade_date_utc: 'TEXT',
    trade_time_utc: 'TEXT',
    timestamp: 'INTEGER',
    trade_price: 'INTEGER',
    trade_volume: 'TEXT',
    prev_closing_price: 'INTEGER',
    change_price: 'INTEGER',
    ask_bid: 'TEXT',
    sequential_id: 'INTEGER PRIMARY KEY',
  }, codes, 'sequential_id')
  const api = new UPbitSequence(getConfig('./config.json').upbit_keys)
  let to
  let count = 0
  for(let day = 0; day <= daysAgo; day++) {
    if(day === 0) {
      to = params.to
    } else {
      to = undefined
    }
    for(const code of codes) {
      for await (const trs of api.chunkTradesTicks({
        market: code,
        daysAgo: day,
        to,
      })) {
        count += trs.length
        await db.insert(tableName, trs)
      }
    }
    // const inserts = []
    // for(const code of codes) {
    //   for await (const trs of api.chunkTradesTicks({
    //     market: code,
    //     daysAgo: day,
    //     to,
    //   })) {
    //     count += trs.length
    //     inserts.push(db.insert(tableName, trs))
    //   }
    // }
    // await Promise.all(inserts)
  }
  return ready(filename, tableName)
}

export async function readyCandle(filename: string, tableName: string, params: {
  codes: string[]
  min: 1|3|5|15|10|30|60|240
  from: string
  to?: string
}, override: 'yes'|'no' = 'no'): Promise<DbTable<DbCandleMinuteType>> {
  const {codes, min, from, to} = params
  const db = new Database(filename)
  const table: DbTable<DbCandleMinuteType> = await db.ready(tableName)
  if(table && override === 'no') {
    return table
  }
  if(table && override === 'yes') {
    await db.dropTable(tableName)
  }
  await db.createTable(tableName, {
    market: 'TEXT',
    candle_date_time_utc: 'TEXT',
    candle_date_time_kst: 'TEXT',
    opening_price: 'INTEGER',
    high_price: 'INTEGER',
    low_price: 'INTEGER',
    trade_price: 'INTEGER',
    timestamp: 'INTEGER PRIMARY KEY',
    candle_acc_trade_price: 'TEXT',
    candle_acc_trade_volume: 'TEXT',
    unit: 'INTEGER'
  }, codes, 'timestamp')
  const api = new UPbitSequence(getConfig('./config.json').upbit_keys)
  let count = 0
  for(const code of codes) {
    for await (let cs of api.chunkCandlesMinutes(min, {
      market: code,
      from,
      to,
    })) {
      count += cs.length
      await db.insert(tableName, cs)
    }
  }
  // const inserts = []
  // for(const code of codes) {
  //   for await (let cs of api.chunkCandlesMinutes(min, {
  //     market: code,
  //     from,
  //     to,
  //   })) {
  //     count += cs.length
  //     inserts.push(db.insert.call(db, cs))
  //   }
  // }
  // await Promise.all(inserts)
  return ready(filename, tableName)
}



export class DbTable<T> {
  private _codes: string[] = null
  private _orderBy: string = null

  constructor(protected readonly db: Database
  , protected readonly tableName: string) {}

  async getCodes(): Promise<string[]> {
    if(!this._codes) {
      const cc: string = await this.db.get(`select codes from tables where table = '${this.tableName}'`)
      this._codes = cc.split(',')
    }
    return this._codes
  }

  async getOrderBy(): Promise<string> {
    if(!this._orderBy) {
      this._orderBy = await this.db.get(`select order_by from tables where table = '${this.tableName}'`)
    }
    return this._orderBy
  }

  get codes(): string[] {
    return this._codes
  }

  get orderBy(): string {
    return this._orderBy
  }

  async * each(): AsyncGenerator<T> {
    const length = 500
    let offset = 0
    let trs = []
    const orderBy = await this.getOrderBy()
    do {
      trs = await this.get(orderBy, offset, length)
      for(let tr of trs) {
        yield tr
      }
      offset += trs.length
    } while(trs.length !== 0)
  }

  async get(orderBy: string, offset: number, length: number): Promise<T[]> {
    const sql = `SELECT * FROM ${this.tableName}
      ORDER BY ${orderBy} ASC
      LIMIT ${length} OFFSET ${offset}`
    return this.db.all(sql)
    // return (await this.db.all(sql)).map(d => this.toNativeValues(d))
  }

  // private toNativeValues(val: {
  //   market: string
  //   trade_date_utc: string
  //   trade_time_utc: string
  //   timestamp: number
  //   trade_price: number
  //   trade_volume: string
  //   prev_closing_price: number
  //   change_price: number
  //   ask_bid: 'ASK'|'BID'
  //   sequential_id: number
  // }): DbTradeTickType {
  //   return Object.assign(val, {trade_volume: toNumber(val.trade_volume)})
  // }
}



class Database {
  protected db: DB
  
  constructor(protected readonly filename: string) {
  }

  async ready<T>(tableName: string): Promise<DbTable<T>> {
    if(!this.db) {
      this.db = await open({
        filename: this.filename,
        driver: sqlite3,
      })
    }
    const tables = await this.tables()
    const exists = tables.some(t => t.name === tableName)
    if(exists) {
      return new DbTable<T>(this, tableName)
    } else {
      await this.run(`create table tables (
        table TEXT,
        codes TEXT,
        order_by TEXT
      )`)
      return null
      // throw new Error(`'${this.filename}' 데이터베이스에 '${tableName}' 테이블이 없다.`)
    }
  }

  async tables(): Promise<TableType[]> {
    return this.db.all('select * from sqlite_master')
  }

  async dropTable(tableName: string) {
    return Promise.all([this.db.run(`drop table ${tableName}`)
    , this.db.run(`delete from tables where table = '${tableName}'`)])
  }

  async createTable(tableName: string, schema: {[index: string]: string}, codes: string[], orderBy: string) {
    const columns = Object.keys(schema)
    await this.run(`create table ${tableName} (${columns.map(c => `${c} ${schema[c]}`).join(', ')})`)
    await this.run(`insert into tables values ('${tableName}', '${codes.join(', ')}', '${orderBy}')`)
  }

  async insert<T>(tableName: string, values: T[]) {
    const sql = (await this.tables()).filter(t => t.name === tableName).map(t => t.sql)[0]
    const dbVals = values.map(val => {
      const keys = Object.keys(val)
      const vv = keys.map(key => {
        const reg = new RegExp(`${key} (\\w+)`)
        if(reg.exec(sql)[1].toLowerCase() === 'text') {
          return `'${val[key]}'`
        } else {
          return `${val[key]}`
        }
      })
      return `(${vv.join(', ')})`
    }).join(', ')
    return this.db.run(`INSERT INTO ${tableName} VALUES ` + dbVals)
  }

  all(sql: ISqlite.SqlType, ...params: any[]): Promise<any[]> {
    return this.db.all(sql, ...params)
  }

  get(sql: ISqlite.SqlType, ...params: any[]): Promise<any> {
    return this.db.get(sql, ...params)
  }

  run(sql: ISqlite.SqlType, ...params: any[]): Promise<any> {
    return this.db.run(sql, ...params)
  }
}