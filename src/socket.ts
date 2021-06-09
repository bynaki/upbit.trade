import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'
import * as I from './types'
import {
  BaseSocketBot
} from './base.bot'
import {
  Logger,
  // FileWriter,
} from 'fourdollar'
import {
  UPbit,
  upbit_types as Iu,
  RequestError,
} from 'cryptocurrency.api'


class BotManager {
  private _bots: BaseSocketBot[] = []
  private _botConst = {}
  private _codes: string[]
  private _edited: boolean = true

  constructor(codes: string[]) {
    this._codes = Object.assign([], codes)
  }

  private _initConst() {
    this._botConst[I.ReqType.Trade] = {}
    this._botConst[I.ReqType.Orderbook] = {}
    this._botConst[I.ReqType.Ticker] = {}
    this._codes.forEach(code => {
      this._botConst[I.ReqType.Trade][code] = []
      this._botConst[I.ReqType.Orderbook][code] = []
      this._botConst[I.ReqType.Ticker][code] = []
    })
    this._bots.forEach(b => this._constBot(b))
  }

  private _constBot<B extends BaseSocketBot>(bot: B) {
    if(bot.onTrade) {
      (this._botConst[I.ReqType.Trade][bot.code] as BaseSocketBot[]).push(bot)
    }
    if(bot.onOrderbook) {
      (this._botConst[I.ReqType.Orderbook][bot.code] as BaseSocketBot[]).push(bot)
    }
    if(bot.onTicker) {
      (this._botConst[I.ReqType.Ticker][bot.code] as BaseSocketBot[]).push(bot)
    }
  }

  getBots<B extends BaseSocketBot>(reqType?: I.ReqType, code?: string): B[] {
    if(!reqType) {
      return this._bots as B[]
    }
    if(!code) {
      switch(reqType) {
        case I.ReqType.Trade:
          return this._bots.filter(b => b.onTrade) as B[]
        case I.ReqType.Orderbook:
          return this._bots.filter(b => b.onOrderbook) as B[]
        case I.ReqType.Ticker:
          return this._bots.filter(b => b.onTicker) as B[]
        default:
          throw new Error(`Unknown '${reqType}'.`)
      }
    }
    if(this._edited) {
      this._initConst()
      this._edited = false
    }
    return this._botConst[reqType][code]
  }

  getCodes(req: I.ReqType) {
    return this.getBots(req)
      .map(b => b.code)
      .reduce((p: string[], c) => {
        if(p.every(pp => pp !== c)) {
          p.push(c)
        }
        return p
      }, [])
  }

  addBotClass<B extends BaseSocketBot>(botClass: Constructor<B>) {
    for(const c of this._codes) {
      const bot = new botClass(c)
      this.addBot(bot)
    }
  }

  addBot<B extends BaseSocketBot>(bot: B) {
    if(this._codes.every(c => c !== bot.code)) {
      throw new Error(`'${bot.code}' is not service.`)
    }
    if(this._bots.some(b => b.name === bot.name)) {
      throw new Error(`'${bot.name}' already exists.`)
    }
    this._bots.push(bot)
    this._edited = true
  }
}



type Constructor<T> = new (code: string) => T


export abstract class BaseUPbitSocket extends Logger {
  private _codes: string[]
  private _botManager: BotManager
  private _isStarted = false

  constructor(codes: string[]) {
    super()
    this._codes = Object.assign([], codes)
    this._botManager = new BotManager(this._codes)
  }

  protected async start(): Promise<boolean> {
    for(const bot of this.getBots()) {
      if(bot.start) {
        await bot.start(this)
      }
    }
    this._isStarted = true
    return true
  }

  protected async finish(): Promise<boolean> {
    if(!this._isStarted) {
      return false
    }
    for(const bot of this.getBots()) {
      if(bot.finish) {
        await bot.finish()
      }
    }
    this._isStarted = false
    return true
  }

  get codes() {
    return this._codes
  }

  getBots<B extends BaseSocketBot>(): B[]
  getBots<B extends BaseSocketBot>(reqType: I.ReqType): B[]
  getBots<B extends BaseSocketBot>(reqType: I.ReqType, code: string): B[]
  getBots<B extends BaseSocketBot>(reqType?: I.ReqType, code?: string): B[] {
    return this._botManager.getBots(reqType, code)
  }

  addBotClass<B extends BaseSocketBot>(botClass: Constructor<B>) {
    return this._botManager.addBotClass(botClass)
  }

  addBot<B extends BaseSocketBot>(bot: B) {
    return this._botManager.addBot(bot)
  }

  protected getCodes(req: I.ReqType): string[] {
    return this._botManager.getCodes(req)
  }

  abstract open(): Promise<void>
  abstract close(): Promise<boolean>
}


export class UPbitSocket extends BaseUPbitSocket {
  static url = 'wss://api.upbit.com/websocket/v1'

  private _ws: WebSocket = null
  private _uuid: string

  constructor(codes: string[], private readonly pingSec: number = 120 * 1000) {
    super(codes)
    this._uuid = uuidv4()
  }

  requests(): unknown[] {
    const req = []
    req.push({ticket: this._uuid})
    let codes = this.getCodes(I.ReqType.Trade)
    if(codes.length !== 0) {
      // req.push({type: I.ReqType.Trade, codes, isOnlyRealtime: true})
      req.push({type: I.ReqType.Trade, codes})
    }
    codes = this.getCodes(I.ReqType.Orderbook)
    if(codes.length !== 0) {
      // req.push({type: I.ReqType.Orderbook, codes, isOnlyRealtime: true})
      req.push({type: I.ReqType.Orderbook, codes})
    }
    codes = this.getCodes(I.ReqType.Ticker)
    if(codes.length !== 0) {
      // req.push({type: I.ReqType.Ticker, codes, isOnlyRealtime: true})
      req.push({type: I.ReqType.Ticker, codes})
    }
    return req
  }

  async open(): Promise<void> {
    await this.start()
    return this.resume()
  }

  private resume(): Promise<void> {
    const req = this.requests()
    let ws = new WebSocket(UPbitSocket.url)
    this._ws = ws
    return new Promise<void>((resolve, reject) => {
      ws.on('message', data => {
        const d = JSON.parse(data.toString('utf-8'))
        const bots = this.getBots(d.type, d.code)
        bots.forEach(b => b.trigger(d))
      })
      ws.on('close', (code, reason) => {
        this.log('closed -----', `code: ${code}, reason: ${reason}`)
        ws = null
        if(this._ws !== null) {
          this.log('resume -----')
          this.resume()
        }
      })
      ws.on('pong', data => {
      })
      ws.once('open', () => {
        ws.send(JSON.stringify(req))
        const id = setInterval(() => {
          if(ws === null) {
            clearInterval(id)
            return
          }
          if(ws.readyState === I.SocketState.Open) {
            ws.ping()
          }
        }, this.pingSec)
        this.log('opened -----')
        resolve()
      })
    })
  }

  async close(): Promise<boolean> {
    if(this._ws) {
      const ws = this._ws
      this._ws = null
      ws.terminate()
      return this.finish()
    } else {
      return false
    }
  }

  get uuid(): string {
    return this._uuid
  }

  get state(): I.SocketState {
    if(this._ws) {
      return this._ws.readyState
    }
    return I.SocketState.Closed
  }
}


export class UPbitSocketMock extends BaseUPbitSocket {
  constructor(codes: string[], private readonly count: number, private readonly api: UPbit) {
    super(codes)
  }

  async open() {
    await this.start()
    for(const code of this.getCodes(I.ReqType.Trade)) {
      let count = this.count
      let cursor
      const data: Iu.TradeTickType[] = []
      while(count > 0) {
        try {
          const res = await this.api.getTradesTicks({
            market: code,
            count: 1000,
            cursor,
          })
          cursor = res.data[res.data.length - 1].sequential_id
          data.push(...res.data)
          count -= res.data.length
        } catch(e) {
          console.log(e)
          if(e instanceof RequestError) {
          } else {
            throw e
          }
        }
      }
      const trs = this.convertTradeType(data.reverse())
      const bots = this.getBots(I.ReqType.Trade, code)
      for(const tr of trs) {
        for(const b of bots) {
          await b.trigger(tr)
        }
      }
    }
  }

  async close() {
    return this.finish()
  }

  convertTradeType(data: Iu.TradeTickType[]): I.TradeType[] {
    return data.map(d => {
      return {
        type: I.ReqType.Trade,
        code: d.market,
        trade_price: d.trade_price,
        trade_volume: d.trade_volume,
        ask_bid: d.ask_bid,
        prev_closing_price: d.prev_closing_price,
        change: '',
        change_price: d.change_price,
        trade_date: d.trade_date_utc,
        trade_time: d.trade_time_utc,
        trade_timestamp: d.timestamp,
        timestamp: d.timestamp,
        sequential_id: d.sequential_id,
        stream_type: 'REALTIME',
      }
    })
  }
}
