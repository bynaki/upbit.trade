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
import { toNumber } from 'lodash'



type SqlMasterType = {
  type: string
  name: string
  tbl_name: string
  rootpage: number
  sql: string
}

export interface TableType {
  name: string
  create_date: number
  order_by: string
}

export interface TradeTableType extends TableType {
  params: {
    codes: string[]
    daysAgo: number
    to?: string
  }
}

export interface CandleTableType extends TableType {
  params: {
    comins: string[]
    from: string
    to?: string
  }
}

export interface DbTradeTickType extends Iu.TradeTickType {
  trade_volume: any
}

export interface DbCandleMinuteType extends Iu.CandleMinuteType {
  candle_acc_trade_price: any
  candle_acc_trade_volume: any
}

function subset(a: string[], b: string[]) {
  return a.every(i => b.some(j => i === j))
}



export async function readyTrade(filename: string, tableName: string, params?: {
  codes: string[]
  daysAgo: number
  // utc이다.
  to?: string
}): Promise<DbTable<DbTradeTickType, TradeTableType>> {
  const db = new Database(filename)
  const table: DbTable<DbTradeTickType, TradeTableType> = await db.ready(tableName)
  if(!table && !params) {
    throw new Error(`'${filename}' 데이터베이스에 '${tableName}' 테이블이 없다.`)
  }
  if(table && !params) {
    return table
  }
  let {codes, daysAgo}  = params
  if(!daysAgo) {
    daysAgo = 0
  }
  if(table) {
    const pp: {
      codes: string[]
      daysAgo: number
      to?: string
    } = (await table.getType()).params
    if(subset(codes, pp.codes) && params.daysAgo === pp.daysAgo && params.to === pp.to) {
      return table
    } else {
      await db.dropTable(tableName)
    }
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
    sequential_id: 'INTEGER',
  }, JSON.stringify(params), 'sequential_id')
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
  }
  return db.ready(tableName)
}

export async function readyCandle(filename: string, tableName: string, params?: {
  comins: string[]
  // 2021-08-24T00:00:00+00:00 형식이고 +00:00 생략하면 kst 이다.
  from: string
  to?: string
}): Promise<DbTable<DbCandleMinuteType, CandleTableType>> {
  const db = new Database(filename)
  const table: DbTable<DbCandleMinuteType, CandleTableType> = await db.ready(tableName)
  if(!table && !params) {
    throw new Error(`'${filename}' 데이터베이스에 '${tableName}' 테이블이 없다.`)
  }
  if(table && !params) {
    return table
  }
  const {comins, from, to} = params
  if(table) {
    const pp: {
      comins: string[]
      from: string
      to?: string
    } = (await table.getType()).params
    if(subset(comins, pp.comins) && from === pp.from && to === pp.to) {
      return table
    } else {
      await db.dropTable(tableName)
    }
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
  }, JSON.stringify(params), 'timestamp')
  const api = new UPbitSequence(getConfig('./config.json').upbit_keys)
  let count = 0
  for(const comin of comins) {
    const matchs = comin.match(/(\w+-\w+):(\d+)/)
    const code = matchs[1]
    const min = toNumber(matchs[2])
    for await (let cs of api.chunkCandlesMinutes(min as any, {
      market: code,
      from,
      to,
    })) {
      count += cs.length
      await db.insert(tableName, cs)
    }
  }
  return db.ready(tableName)
}



export class DbTable<T, TT extends TableType> {
  private tt: TT = null

  constructor(protected readonly db: Database
  , protected readonly tableName: string) {}

  async getType(): Promise<TT> {
    if(!this.tt) {
      this.tt = await this.db.getTableType(this.tableName)
    }
    return this.tt
  }

  async * each(code?: string): AsyncGenerator<T> {
    const length = 100000
    let offset = 0
    let trs = []
    const orderBy = (await this.getType()).order_by
    do {
      trs = await this.get({
        orderBy,
        length,
        code,
        offset,
      })
      for(let tr of trs) {
        yield tr
      }
      offset += trs.length
    } while(trs.length !== 0)
  }

  async get(params: {
    orderBy: string
    length: number
    code?: string
    offset?: number
  }): Promise<T[]> {
    let {orderBy, length, code, offset} = params
    if(offset === undefined) {
      offset = 0
    }
    if(code) {
      const sql = `SELECT * FROM ${this.tableName}
        WHERE market = '${code}'
        ORDER BY ${orderBy} ASC
        LIMIT ${length} OFFSET ${offset}`
      return this.db.all(sql)
    } else {
      const sql = `SELECT * FROM ${this.tableName}
        ORDER BY ${orderBy} ASC
        LIMIT ${length} OFFSET ${offset}`
      return this.db.all(sql)
    }
  }

  async count(code?: string): Promise<number> {
    let sql: string
    if(code) {
      sql = `SELECT COUNT(*) FROM ${this.tableName}
        WHERE market = '${code}'`
    } else {
      sql = `SELECT COUNT(*) FROM ${this.tableName}`
    }
    return (await this.db.get(sql))['COUNT(*)']
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

  async ready<T, TT extends TableType>(tableName: string): Promise<DbTable<T, TT>> {
    if(!this.db) {
      this.db = await open({
        filename: this.filename,
        driver: sqlite3,
      })
    }
    if(!await this.sqlMaster('tables')) {
      await this.run(`create table tables (
        name text,
        create_date integer,
        params text,
        order_by text
      );`)
    }
    if(await this.sqlMaster(tableName)) {
      return new DbTable(this, tableName)
    } else {
      return null
      // throw new Error(`'${this.filename}' 데이터베이스에 '${tableName}' 테이블이 없다.`)
    }
  }

  async sqlMaster(tableName: string): Promise<SqlMasterType> {
    return this.db.get(`select * from sqlite_master where type = 'table' and name = '${tableName}'`)
  }

  async getTableType<T extends TableType>(tableName: string): Promise<T> {
    const tTable = await this.db.get(`select * from tables where name = '${tableName}'`)
    return {
      name: tTable.name,
      create_date: tTable.create_date,
      params: JSON.parse(tTable.params),
      order_by: tTable.order_by,
    } as any
  }

  async dropTable(tableName: string) {
    return Promise.all([this.db.run(`drop table ${tableName}`)
    , this.db.run(`delete from tables where name = '${tableName}'`)])
  }

  async createTable(tableName: string, schema: {[index: string]: string}, params: string, orderBy: string) {
    const columns = Object.keys(schema)
    await this.run(`create table ${tableName} (${columns.map(c => `${c} ${schema[c]}`).join(', ')})`)
    await this.run(`insert into tables values ('${tableName}', ${Date.now()}, '${params}', '${orderBy}')`)
  }

  async insert<T>(tableName: string, values: T[]) {
    const sql = (await this.sqlMaster(tableName)).sql
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