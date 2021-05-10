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

  get codes() {
    return Object.assign([], this._codes)
  }
}



type Constructor<T> = new (code: string) => T

export class UPbitSocket extends Logger {
  static url = 'wss://api.upbit.com/websocket/v1'

  private _ws: WebSocket = null
  private _uuid: string
  private _codes: string[]
  private _botManager: BotManager
  private _isAlive: boolean = false

  constructor(codes: string[], private readonly pingSec: number = 120 * 1000) {
    super('UPbitSocket')
    this._codes = Object.assign([], codes)
    this._uuid = uuidv4()
    this._botManager = new BotManager(this._codes)
  }

  // on(event: 'open', listener: (event: I.OpenEvent) => void): void
  // on(event: 'error', listener: (event: I.ErrorEvent) => void): void
  // on(event: 'close', listener: (event: I.CloseEvent) => void): void
  // on(event: 'open'|'error'|'close', listener: any) {
  //   switch(event) {
  //     case 'open':
  //       this._ws.onopen = listener
  //       break
  //     case 'error':
  //       this._ws.onerror = listener
  //       break
  //     case 'close':
  //       this._ws.onclose = listener
  //       break
  //     default:
  //       throw new Error('only open|close|error')
  //   }
  // }

  private _req(reqData: any[], bot: BaseSocketBot) {
    if(bot.onTrade && !reqData.some(i => i['type'] === 'trade')) {
      reqData.push({type: 'trade', codes: this._codes, isOnlyRealtime: true})
    }
    if(bot.onOrderbook && !reqData.some(i => i['type'] === 'orderbook')) {
      reqData.push({type: 'orderbook', codes: this._codes, isOnlyRealtime: true})
    }
    if(bot.onTicker && !reqData.some(i => i['type'] === 'ticker')) {
      reqData.push({type: 'ticker', codes: this._codes, isOnlyRealtime: true})
    }
  }

  private _reqCodes(req: I.ReqType) {
    return this._botManager.getBots(req)
      .map(b => b.code)
      .reduce((p: string[], c) => {
        if(p.every(pp => pp !== c)) {
          p.push(c)
        }
        return p
      }, [])
  }

  requests(): unknown[] {
    const req = []
    req.push({ticket: this._uuid})
    let codes = this._reqCodes(I.ReqType.Trade)
    if(codes.length !== 0) {
      req.push({type: I.ReqType.Trade, codes, isOnlyRealtime: true})
    }
    codes = this._reqCodes(I.ReqType.Orderbook)
    if(codes.length !== 0) {
      req.push({type: I.ReqType.Orderbook, codes, isOnlyRealtime: true})
    }
    codes = this._reqCodes(I.ReqType.Ticker)
    if(codes.length !== 0) {
      req.push({type: I.ReqType.Ticker, codes, isOnlyRealtime: true})
    }
    return req
  }

  async start(): Promise<void> {
    await this.close()
    this._ws = new WebSocket(UPbitSocket.url)
    this._ws.onmessage = e => {
      const data = JSON.parse(e.data.toString('utf-8'))
      const bots = this.getBots(data.type, data.code)
      bots.forEach(b => b.trigger(data))
    }
    for(const bot of this.getBots()) {
      if(bot.init) {
        await bot.init()
      }
    }
    const req = this.requests()
    //console.log(req)
    return new Promise<void>((resolve, reject) => {
      this._ws.once('open', () => {
        try {
          this._ws.send(JSON.stringify(req))
          this._ws.on('close', () => {
            this.log('closed')
          })
          this._ws.on('pong', (data) => {
            this._isAlive = true
            this.log('alive')
          })
          const id = setInterval(() => {
            this._isAlive = false
            if(!this._ws) {
              clearInterval(id)
              return
            }
            if(this._ws.readyState === I.SocketState.Open) {
              this._ws.ping()
            }
          }, this.pingSec)
          this.log('opened')
          resolve()
        } catch(e) {
          reject(e)
        }
      })
    })
  }

  get isAlive(): boolean {
    return this._isAlive
  }

  restart(): Promise<void> {
    return this.start()
  }

  async close(): Promise<void> {
    if(this._ws) {
      this._ws.terminate()
      this._ws = null
      this._isAlive = false
      for(const bot of this.getBots()) {
        if(bot.onClose) {
          await bot.onClose()
        }
      }
    }
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

// BaseSocketBot.writer.link = new FileWriter('./log/socket.log', '1d')