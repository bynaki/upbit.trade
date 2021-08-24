import {
  // verbose,
  Database as sqlite3,
} from 'sqlite3'
import {
  Database,
  open,
} from 'sqlite'
import {
  upbit_types as Iu,
  UPbit,
  RequestError,
} from 'cryptocurrency.api'
import {
  existsSync,
} from 'fs'
import { toNumber } from 'lodash'
import {
  format,
} from 'fecha'
import {
  UPbitSequence,
  getConfig,
} from './'



// const sqlite3 = verbose().Database


// async function getTradesTicks(api: UPbit, params: Iu.TradeTickParam): Promise<Iu.Response<Iu.TradeTickType[]>> {
//   try {
//     const res = await api.getTradesTicks(params)
//     return res
//   } catch(e) {
//     if(e instanceof RequestError) {
//       if(e.status === 429) {
//         await stop(1000)
//         return getTradesTicks(api, params)
//       } else {
//         throw e
//       }
//     }
//   }
// }

// export async function getCandlesMinutes(api: UPbit, min: 1|3|5|15|10|30|60|240, params: Iu.CandleParam): Promise<Iu.Response<Iu.CandleMinuteType[]>> {
//   try {
//     const res = await api.getCandlesMinutes(min, params)
//     return res
//   } catch(e) {
//     if(e instanceof RequestError) {
//       if(e.status === 429) {
//         await stop(1000)
//         return getCandlesMinutes(api, min, params)
//       } else {
//         throw e
//       }
//     }
//   }
// }


export abstract class BaseDb {
  protected db: Database
  private _codes: string[] = null

  constructor(protected readonly filename: string) {
  }

  protected convertCodeName(code: string) {
    const converted = code.replace('-', '_')
    return code === converted? code.replace('_', '-') : converted
  }

  async getCodes(): Promise<string[]> {
    this.codes = (await this.db.all('SELECT code FROM codes')).map(row => row.code)
    return this.codes
  }

  get codes(): string[] {
    return this._codes
  }

  protected set codes(codes: string[]) {
    this._codes = codes
  }

  async count(code: string): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${this.convertCodeName(code)}`
    const res = await this.db.get(sql)
    return res.count
  }

  async ready(codes: string[], variables: string): Promise<boolean> {
    if(existsSync(this.filename)) {
      this.db = await open({
        filename: this.filename,
        driver: sqlite3,
      })
      await this.getCodes()
      return true
    }
    if(!codes) {
      throw new Error(`${this.filename} database가 없기 때문에 인수를 전달해야 한다.`)
    }
    this.db = await open({
      filename: this.filename,
      driver: sqlite3,
    })
    await this.db.run('CREATE TABLE codes(code TEXT PRIMARY KEY)')
    await this.db.run('INSERT INTO codes(code) VALUES ' + codes.map(c => '(?)').join(','), codes)
    const cs = await this.getCodes()
    for(let code of cs) {
      await this.db.run(`CREATE TABLE ${this.convertCodeName(code)} (
        ${variables}
      )`)
    }
    return false
  }

  abstract each(code: string): AsyncGenerator<any, void, unknown>
}


export class TradeDb extends BaseDb {
  api: UPbitSequence

  constructor(filename: string) {
    super(filename)
    this.api = new UPbitSequence(getConfig('./config.json').upbit_keys)
  }

  ready(): Promise<boolean>
  async ready(codes: string[], opts: {
    daysAgo: number
    to?: string
  }): Promise<boolean>
  async ready(codes?: string[], opts?: {
    daysAgo: number
    to?: string
  }): Promise<boolean> {
    const already = await super.ready(codes, `
      market TEXT,
      trade_date_utc TEXT,
      trade_time_utc TEXT,
      timestamp INTEGER,
      trade_price INTEGER,
      trade_volume TEXT,
      prev_closing_price INTEGER,
      change_price INTEGER,
      ask_bid TEXT,
      sequential_id INTEGER PRIMARY KEY
    `)
    if(already) {
      return true
    }
    if(!codes || !opts) {
      throw new Error(`${this.filename} database가 없기 때문에 인수를 전달해야 한다.`)
    }
    for(let code of this.codes) {
      await this.insert(code, opts)
    }
    return false
  }

  async * each(code: string): AsyncGenerator<Iu.TradeTickType, void, unknown> {
    const length = 500
    let offset = 0
    let trs = []
    do {
      trs = await this.get(code, offset, length)
      for(let tr of trs) {
        yield tr
      }
      offset += trs.length
    } while(trs.length !== 0)
  }

  async get(code: string, offset: number, length: number): Promise<Iu.TradeTickType[]> {
    const sql = `SELECT * FROM ${this.convertCodeName(code)}
      ORDER BY sequential_id ASC
      LIMIT ${length} OFFSET ${offset}`
    return (await this.db.all(sql)).map(d => this.toNativeValues(d))
  }

  private toNativeValues(val: {
    market: string
    trade_date_utc: string
    trade_time_utc: string
    timestamp: number
    trade_price: number
    trade_volume: string
    prev_closing_price: number
    change_price: number
    ask_bid: 'ASK'|'BID'
    sequential_id: number
  }): Iu.TradeTickType {
    return Object.assign(val, {trade_volume: toNumber(val.trade_volume)})
  }

  private async insert(code: string, opts: {
    daysAgo: number
    to?: string // utc
  }): Promise<number> {
    let {daysAgo}  = opts
    const table = this.convertCodeName(code)
    let count = 0
    let to
    for(let day = 0; day <= daysAgo; day++) {
      if(day === 0) {
        to = opts.to
      } else {
        to = undefined
      }
      for await (let trs of this.api.chunkTradesTicks({
        market: code,
        daysAgo: day,
        to,
      })) {
        await this.db.run(`INSERT INTO ${table} VALUES ` + 
          trs.map(tr => this.toDbValues(tr)).join(','))
        count += trs.length
      }
    }
    return count
  }

  private toDbValues(tr: Iu.TradeTickType) {
    return `(
      '${tr.market}',
      '${tr.trade_date_utc}',
      '${tr.trade_time_utc}',
      ${tr.timestamp},
      ${tr.trade_price},
      '${tr.trade_volume}',
      ${tr.prev_closing_price},
      ${tr.change_price},
      '${tr.ask_bid}',
      ${tr.sequential_id}
    )`
  }
}



export class CandleDb extends BaseDb {
  private api: UPbitSequence

  constructor(filename: string) {
    super(filename)
    this.api = new UPbitSequence(getConfig().upbit_keys)
  }

  ready(): Promise<boolean>
  ready(codes: string[], opts: {
    min: 1|3|5|15|10|30|60|240
    from: string
    to?: string
  }): Promise<boolean>
  async ready(codes?: string[], opts?: {
    min: 1|3|5|15|10|30|60|240
    from: string
    to?: string
  }): Promise<boolean> {
    const already = await super.ready(codes, `
      market TEXT,
      candle_date_time_utc TEXT,
      candle_date_time_kst TEXT,
      opening_price INTEGER,
      high_price INTEGER,
      low_price INTEGER,
      trade_price INTEGER,
      timestamp INTEGER PRIMARY KEY,
      candle_acc_trade_price TEXT,
      candle_acc_trade_volume TEXT,
      unit INTEGER
    `)
    if(already) {
      return true
    }
    if(!codes || !opts) {
      throw new Error(`${this.filename} database가 없기 때문에 인수를 전달해야 한다.`)
    }
    for(let code of this.codes) {
      await this.insert(code, opts)
    }
    return false
  }

  private async insert(code: string, opts: {
    min: 1|3|5|15|10|30|60|240
    from: string
    to?: string
  }): Promise<number> {
    const {min, from, to} = opts
    const table = this.convertCodeName(code)
    let count = 0
    for await (let cs of this.api.chunkCandlesMinutes(min, {
      market: code,
      from,
      to,
    })) {
      await this.db.run(`INSERT INTO ${table} VALUES ` + 
        cs.map(c => this.toDbValues(c)).join(','))
      count += cs.length
    }
    return count
  }

  async * each(code: string): AsyncGenerator<Iu.CandleMinuteType, void, unknown> {
    const length = 500
    let offset = 0
    let trs = []
    do {
      trs = await this.get(code, offset, length)
      for(let tr of trs) {
        yield tr
      }
      offset += trs.length
    } while(trs.length !== 0)
  }

  async get(code: string, offset: number, length: number): Promise<Iu.CandleMinuteType[]> {
    const sql = `SELECT * FROM ${this.convertCodeName(code)}
      ORDER BY timestamp ASC
      LIMIT ${length} OFFSET ${offset}`
    return (await this.db.all(sql)).map(d => this.toNativeValues(d))
  }

  private toNativeValues(val: {
    market: string
    candle_date_time_utc: string
    candle_date_time_kst: string
    opening_price: number
    high_price: number
    low_price: number
    trade_price: number
    timestamp: number
    candle_acc_trade_price: string
    candle_acc_trade_volume: string
    unit: number
  }): Iu.CandleMinuteType {
    return Object.assign(val, {
      candle_acc_trade_price: toNumber(val.candle_acc_trade_price),
      candle_acc_trade_volume: toNumber(val.candle_acc_trade_volume),
    })
  }

  private toDbValues(c: Iu.CandleMinuteType) {
    return `(
      '${c.market}',
      '${c.candle_date_time_utc}',
      '${c.candle_date_time_kst}',
      ${c.opening_price},
      ${c.high_price},
      ${c.low_price},
      ${c.trade_price},
      ${c.timestamp},
      '${c.candle_acc_trade_price}',
      '${c.candle_acc_trade_volume}',
      ${c.unit}
    )`
  }
}