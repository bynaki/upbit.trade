import {
  verbose,
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
import * as I from './types'
import {
  existsSync,
} from 'fs'
import { stop } from 'fourdollar'



// const sqlite3 = verbose().Database


export class TradeDb {
  private db: Database
  private _codes: string[] = null

  constructor(private readonly filename: string) {
  }

  private convertCodeName(code: string) {
    const converted = code.replace('-', '_')
    return code === converted? code.replace('_', '-') : converted
  }

  async codes(): Promise<string[]> {
    return (await this.db.all('SELECT code FROM codes')).map(row => row.code)
  }

  staticCodes(): string[] {
    return this._codes
  }

  ready(): Promise<number>
  ready(codes: string[], opts: {
    api: UPbit
    daysAgo: number
    to?: string
  }): Promise<number>
  async ready(codes?: string[], opts?: {
    api: UPbit
    daysAgo: number
    to?: string
  }): Promise<number> {
    if(existsSync(this.filename)) {
      this.db = await open({
        filename: this.filename,
        driver: sqlite3,
      })
      this._codes = await this.codes()
      return 0
    }
    if(!codes || !opts) {
      throw new Error(`${this.filename} database가 없기 때문에 인수를 전달해야 한다.`)
    }
    this._codes = codes
    this.db = await open({
      filename: this.filename,
      driver: sqlite3,
    })
    await this.db.run('CREATE TABLE codes(code TEXT PRIMARY KEY)')
    await this.db.run('INSERT INTO codes(code) VALUES ' + codes.map(c => '(?)').join(','), codes)
    for(let code of codes) {
      await this.db.run(`CREATE TABLE ${this.convertCodeName(code)} (
        market TEXT,
        trade_date_utc TEXT,
        trade_time_utc TEXT,
        timestamp INTEGER,
        trade_price INTEGER,
        trade_volume INTEGER,
        prev_closing_price INTEGER,
        change_price INTEGER,
        ask_bid TEXT,
        sequential_id INTEGER PRIMARY KEY
      )`)
    }
    let count = 0
    for(let code of await this.codes()) {
      count += await this.insert(code, opts)
    }
    return count
  }

  async count(code: string): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${this.convertCodeName(code)}`
    const res = await this.db.get(sql)
    return res.count
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

  get(code: string, offset: number, length: number): Promise<Iu.TradeTickType[]> {
    const sql = `SELECT * FROM ${this.convertCodeName(code)}
      ORDER BY sequential_id ASC
      LIMIT ${length} OFFSET ${offset}`
    return this.db.all(sql)
  }

  private async insert(code: string, opts: {
    api: UPbit
    daysAgo: number
    to?: string
  }): Promise<number> {
    let {api, daysAgo}  = opts
    const getTradesTicks = async (params: Iu.TradeTickParam): Promise<Iu.Response<Iu.TradeTickType[]>> => {
      try {
        return api.getTradesTicks(params)
      } catch(e) {
        if(e instanceof RequestError) {
          if(e.status === 429) {
            await stop(1000)
            return getTradesTicks(params)
          } else {
            throw e
          }
        }
      }
    }
    const table = this.convertCodeName(code)
    let count = 0
    let to
    for(let day = 0; day <= daysAgo; day++) {
      if(day === 0) {
        to = opts.to
      } else {
        to = undefined
      }
      let res: Iu.TradeTickType[] = (await getTradesTicks({
        market: code,
        count: 500,
        daysAgo: day,
        to,
      })).data
      while(res.length !== 0) {
        await this.db.run(`INSERT INTO ${table} VALUES ` + 
          res.map(tr => this.toValues(tr)).join(','))
        count += res.length
        res = (await getTradesTicks({
          market: code,
          count: 500,
          daysAgo: day,
          cursor: res[res.length - 1].sequential_id
        })).data
      }
    }
    return count
  }

  private toValues(tr: Iu.TradeTickType) {
    return `(
      '${tr.market}',
      '${tr.trade_date_utc}',
      '${tr.trade_time_utc}',
      ${tr.timestamp},
      ${tr.trade_price},
      ${tr.trade_volume},
      ${tr.prev_closing_price},
      ${tr.change_price},
      '${tr.ask_bid}',
      ${tr.sequential_id}
    )`
  }
}