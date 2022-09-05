import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'
import * as I from './types'
import {
  BaseBot,
} from './base.bot'
import {
  logger,
  stop,
} from 'fourdollar'
import {
  SimpleOrder,
} from './order'
import {
  api,
} from './utils'
import {
  uniq,
  floor,
  remove,
} from 'lodash'
import {
  format,
} from 'fecha'




class API implements I.WrapAPI {
  private _bidTr: I.TradeType
  private _askTr: I.TradeType

  constructor(public readonly market: string) {
  }

  setTrade(tr: I.TradeType): void {
    switch(tr.ask_bid) {
      case 'BID': {
        this._bidTr = tr
        break
      }
      case 'ASK': {
        this._askTr = tr
        break
      }
      default: {
        throw new Error('"BID"도 "ASK"도 아니다.')
      }
    }
  }

  getPrice(bid_ask?: 'BID'|'ASK'): number {
    switch(bid_ask) {
      case 'BID': {
        if(!this._bidTr) {
          throw new Error('아직 "price"가 없다.')
        }
        return this._bidTr.trade_price
      }
      case 'ASK': {
        if(!this._askTr) {
          throw new Error('아직 "price"가 없다.')
        }
        return this._askTr.trade_price
      }
      default: {
        if(!(this._bidTr || this._askTr)) {
          throw new Error('아직 "price"가 없다.')
        }
        if(!this._bidTr && this._askTr) {
          return this._askTr.trade_price
        }
        if(!this._askTr && this._bidTr) {
          return this._bidTr.trade_price
        }
        if(this._bidTr.sequential_id > this._askTr.sequential_id) {
          return this._bidTr.trade_price
        } else {
          return this._askTr.trade_price
        }
      }
    }
  }

  getTime(bid_ask?: 'BID'|'ASK'): number {
    switch(bid_ask) {
      case 'BID': {
        if(!this._bidTr) {
          throw new Error('아직 "time"이 없다.')
        }
        return this._bidTr.trade_timestamp
      }
      case 'ASK': {
        if(!this._askTr) {
          throw new Error('아직 "time"이 없다.')
        }
        return this._askTr.trade_timestamp
      }
      default: {
        if(!(this._bidTr || this._askTr)) {
          throw new Error('아직 "time"이 없다.')
        }
        if(!this._bidTr && this._askTr) {
          return this._askTr.trade_timestamp
        }
        if(!this._askTr && this._bidTr) {
          return this._bidTr.trade_timestamp
        }
        if(this._bidTr.sequential_id > this._askTr.sequential_id) {
          return this._bidTr.trade_timestamp
        } else {
          return this._askTr.trade_timestamp
        }
      }
    }
  }

  async getOrdersChance(): Promise<I.OrderChanceType> {
    return (await api.getOrdersChance({market: this.market})).data
  }

  async getOrderDetail(uuid: string): Promise<I.OrderDetailType> {
    return (await api.getOrderDetail({uuid})).data
  }

  async cancel(uuid: string): Promise<I.OrderType> {
    return (await api.cancel({uuid})).data
  }

  async order(params: I.OrderLimitParam | I.OrderPriceParam | I.OrderMarketParam): Promise<I.OrderType> {
    return (await api.order(params)).data
  }
}



export abstract class BaseUPbitSocket {
  private _isStarted = false
  private _botConst: {
    trade: {
      [code: string]: BaseBot[]
    }
    orderbook: {
      [code: string]: BaseBot[]
    }
    ticker: {
      [code: string]: BaseBot[]
    }
  } = null
  private _bots: BaseBot[] = []
  protected _apis: {[market: string]: I.WrapAPI} = {}

  constructor() {
  }

  newSimpleOrder(name: string, market: string, asset: number): SimpleOrder {
    const order = new SimpleOrder(name, market, asset)
    order.setApi(this.getAPI(market))
    return order
  }

  getBots(req?: I.ReqType, code?: string): BaseBot[]
  getBots(evt?: I.EventType, code?: string): BaseBot[]
  getBots(type?: any, code?: any): BaseBot[] {
    switch(type) {
      case I.ReqType.Trade:
      case I.ReqType.Orderbook:
      case I.ReqType.Ticker: {
        return this._getReqBots(type, code)
      }
      default: {
        return this._getEventBots(type, code)
      }
    }
  }

  private _getReqBots(req?: I.ReqType, code?: string): BaseBot[] {
    if(this._botConst === null) {
      this._botConst = {
        trade: {},
        orderbook: {},
        ticker: {},
      }
      this._bots.forEach(bot => {
        if(bot.usingEvent(I.EventType.Trade)) {
          if(!this._botConst.trade[bot.code]) {
            this._botConst.trade[bot.code] = []
          }
          // if(this._botConst.trade[bot.code].some(b => b.name === bot.name)) {
          //   return
          // }
          this._botConst.trade[bot.code].push(bot)
        }
        if(bot.usingEvent(I.EventType.Orderbook)) {
          if(!this._botConst.orderbook[bot.code]) {
            this._botConst.orderbook[bot.code] = []
          }
          // if(this._botConst.orderbook[bot.code].some(b => b.name === bot.name)) {
          //   return
          // }
          this._botConst.orderbook[bot.code].push(bot)
        }
        if(bot.usingEvent(I.EventType.Ticker)) {
          if(!this._botConst.ticker[bot.code]) {
            this._botConst.ticker[bot.code] = []
          }
          // if(this._botConst.ticker[bot.code].some(b => b.name === bot.name)) {
          //   return
          // }
          this._botConst.ticker[bot.code].push(bot)
        }
      })
    }
    if(!req) {
      const bots: BaseBot[] = []
      bots.push(...this.getBots(I.ReqType.Trade))
      bots.push(...this.getBots(I.ReqType.Orderbook))
      bots.push(...this.getBots(I.ReqType.Ticker))
      return uniq(bots)
    }
    if(!code) {
      return Object.keys(this._botConst[req])
      .map(code => this._botConst[req][code])
      .reduce((sum, bots) => {
        sum.push(...bots)
        return sum
      }, [])
    }
    return this._botConst[req][code]
  }

  private _getEventBots(evt?: I.EventType, code?: string): BaseBot[] {
    if(!evt) {
      const bots: BaseBot[] = []
      bots.push(...this._getEventBots(I.EventType.Trade))
      bots.push(...this._getEventBots(I.EventType.Orderbook))
      bots.push(...this._getEventBots(I.EventType.Ticker))
      bots.push(...this._getEventBots(I.EventType.Candle))
      bots.push(...this._getEventBots(I.EventType.Start))
      bots.push(...this._getEventBots(I.EventType.Finish))
      return uniq(bots)
    }
    if(!code) {
      return this._bots.filter(bot => !!bot.subscribers[evt])
    }
    const bots = this._getEventBots(evt)
    return bots.filter(bot => bot.code === code)
  }

  addBotClass<B extends BaseBot>(botClass: new (name: string) => B, codes: string[]) {
    return this.addBot(...codes.map(code => new botClass(code)))
  }

  addBot<B extends BaseBot>(...bots: B[]) {
    bots.forEach(bot => {
      if(!this._bots.some(b => b.name === bot.name)) {
        const queue: {
          trade: I.ResType[]
          orderbook: I.ResType[]
          ticker: I.ResType[]
        } = {
          trade: [],
          orderbook: [],
          ticker: [],
        }
        bot['trigger'] = async function<T extends I.ResType>(data: T) {
          this._latests[data.type] = data
          if([I.EventType.Trade, I.EventType.Orderbook, I.EventType.Ticker]
            .some(type => this.usingEvent(type as I.EventType) && this._latests[type] === null)) {
            return
          }
          if(queue[data.type].length === 0) {
            queue[data.type].push(data)
            while(queue[data.type].length !== 0) {
              const res = queue[data.type][0]
              await Promise.all(this._subscribers[res.type].subscribers.map(sub => sub.next(res)))
              if(queue[data.type].length !== 0) {
                queue[data.type].shift()
              }
            }
          } else {
            queue[data.type].push(data)
          }
        }
        bot.setSocket(this)
        this._bots.push(bot)
      }
    })
    this._botConst = null
  }

  protected getCodes(req: I.ReqType): string[]
  protected getCodes(evt: I.EventType): string[]
  protected getCodes(evt: any): string[] {
    switch(evt) {
      case I.ReqType.Trade:
      case I.ReqType.Orderbook:
      case I.ReqType.Ticker: {
        return uniq(this.getBots(evt as any).map(bot => bot.code))
      }
      default: {
        return uniq(this._getEventBots(evt).map(bot => bot.code))
      }
    }
  }

  protected async start(): Promise<boolean> {
    await Promise.all(this.getBots().map(b => b._start(this)))
    this._isStarted = true
    return true
  }

  protected async finish(): Promise<boolean> {
    if(!this._isStarted) {
      return false
    }
    await Promise.all(this.getBots().map(b => b._finish()))
    this._isStarted = false
    return true
  }

  protected getAPI(market: string): I.WrapAPI {
    if(!this._apis[market]) {
      this._apis[market] = this.newAPI(market)
    }
    return this._apis[market]
  }

  protected abstract newAPI(market: string): I.WrapAPI
  abstract open(waiting?: number): Promise<void>
  abstract close(exit?: boolean): Promise<boolean>
}




export class UPbitSocket extends BaseUPbitSocket {
  static url = 'wss://api.upbit.com/websocket/v1'

  private _ws: WebSocket = null
  private _exit: boolean = false
  private _uuid: string

  constructor(private readonly pingSec: number = 120 * 1000) {
    super()
    this._uuid = uuidv4()
  }

  @logger()
  log(msg: string) {
    return msg
  }

  newAPI(market: string): I.WrapAPI {
    return new API(market)
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

  async open(waiting: number = 0): Promise<void> {
    await this.start()
    await this.resume()
    if(waiting !== 0) {
      while(this._ws !== null) {
        await stop(waiting)
      }
    }
  }

  private resume(): Promise<void> {
    const req = this.requests()
    let ws = new WebSocket(UPbitSocket.url)
    this._ws = ws
    return new Promise<void>((resolve, reject) => {
      ws.on('message', data => {
        // console.log('message')
        const d: I.ResType = JSON.parse(data.toString('utf-8'))
        const bots = this.getBots(d.type, d.code)
        if(d.type === I.ReqType.Trade) {
          this.getAPI(d.code)['setTrade'](d)
        }
        bots.forEach(b => b['trigger'](d))
      })
      ws.on('close', (code, reason) => {
        this.log(`${new Date().toLocaleString()} > closed -----`)
        this.log(`> code: ${code}, reason: ${reason}`)
        ws = null
        if(this._ws !== null) {
          this.log(`${new Date().toLocaleString()} > resume -----`)
          this.resume()
        } else if(this._exit) {
          global.process.exit()
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
        this.log(`${new Date().toLocaleString()} > opened -----`)
        resolve()
      })
    })
  }

  async close(exit: boolean = false): Promise<boolean> {
    if(this._ws) {
      const ws = this._ws
      await this.finish()
      this._ws = null
      this._exit = exit
      ws.terminate()
      return true
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



// type Constructor<B extends MyBaseBot> = new (code: string) => B