import {
  verbose,
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

const sqlite3 = verbose().Database


export class TradeDB {
  private db: Database
  private _already = false

  constructor(private readonly filename: string) {
  }

  private convertCodeName(code: string) {
    const converted = code.replace('-', '_')
    return code === converted? code.replace('_', '-') : converted
  }

  get already(): boolean {
    return this._already
  }

  async codes(): Promise<string[]> {
    return (await this.db.all('SELECT code FROM codes')).map(row => row.code)
  }

  async ready(codes: string[]) {
    if(existsSync(this.filename)) {
      this.db = await open({
        filename: this.filename,
        driver: sqlite3,
      })
      this._already = true
      return this.codes()
    }
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
    return this.codes()
  }

  async insert(opts: {
    api: UPbit
    code: string
    daysAgo: number
    to?: string
  }): Promise<number> {
    let {api, code, daysAgo} = opts
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