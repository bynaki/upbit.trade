import * as I from './types'
import {
  Logger,
  // FileWriter,
} from 'fourdollar'
import {
  BaseUPbitSocket,
} from './socket'



export abstract class BaseSocketBot extends Logger {
  protected _queue: {
    trade: I.ResType[]
    orderbook: I.ResType[]
    ticker: I.ResType[]
  } = {
    trade: [],
    orderbook: [],
    ticker: [],
  }
  protected _done: {
    trade: I.ResType
    orderbook: I.ResType
    ticker: I.ResType
  } = {
    trade: null,
    orderbook: null,
    ticker: null,
  }

  constructor(public readonly code: string) {
    super(code)
  }

  async trigger<T extends I.ResType>(data: T) {
    if(this._queue[data.type].length === 0) {
      this._queue[data.type].push(data)
      while(this._queue[data.type].length !== 0) {
        this._done[data.type] = this._queue[data.type][0]
        const release = await this._trigger(this._done[data.type])
        if(release) {
          this._done[data.type] = this._queue[data.type].pop()
          this._queue[data.type] = []
        } else {
          this._done[data.type] = this._queue[data.type].shift()
        }
      }
    } else {
      this._queue[data.type].push(data)
    }
  }

  private async _trigger<T extends I.ResType>(data: T) {
    switch(data.type) {
      case I.ReqType.Trade:
        this._done.trade = data
        return this.onTrade(data as any)
      case I.ReqType.Orderbook:
        this._done.orderbook = data
        return this.onOrderbook(data as any)
      case I.ReqType.Ticker:
        this._done.ticker = data
        return this.onTicker(data as any)
      default:
        throw new Error(`'${data.type}' is unknown type.`)
    }
  }

  get name() {
    return `${this.constructor.name}:${this.code}`
  }

  latest(type: I.ReqType.Trade): I.TradeType
  latest(type: I.ReqType.Orderbook): I.OrderbookType
  latest(type: I.ReqType.Ticker): I.TickerType
  latest(type: I.ReqType): any {
    if(this._queue[type].length !== 0) {
      return this._queue[type][this._queue[type].length - 1]
    } else {
      return this._done[type]
    }
  }

  abstract start<S extends BaseUPbitSocket>(socket?: S): Promise<void>
  abstract finish(): Promise<void>
  abstract onTrade(data: I.TradeType): Promise<boolean|void>
  abstract onOrderbook(data: I.OrderbookType): Promise<boolean|void>
  abstract onTicker(data: I.TickerType): Promise<boolean|void>
}


// BaseSocketBot.writer.link = new FileWriter('./log/bot.log', '1d')
// BaseSocketBot.format = ':name: < :time:\n:msg:'
