import * as I from './types'
import {
  Logger,
  // FileWriter,
} from 'fourdollar'
import {
  BaseUPbitSocket,
} from './socket'
import {
  OHLCMaker,
} from './utils'


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
  protected _latests: {
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
    this._latests[data.type] = data
    if(this.onTrade && this._latests[I.ReqType.Trade] === null) {
      return
    }
    if(this.onOrderbook && this._latests[I.ReqType.Orderbook] === null) {
      return
    }
    if(this.onTicker && this._latests[I.ReqType.Ticker] === null) {
      return
    }
    if(this._queue[data.type].length === 0) {
      this._queue[data.type].push(data)
      while(this._queue[data.type].length !== 0) {
        const release = await this._trigger(this._queue[data.type][0])
        if(release) {
          this._queue[data.type] = []
        } else {
          this._queue[data.type].shift()
        }
      }
    } else {
      this._queue[data.type].push(data)
    }
  }

  private async _trigger<T extends I.ResType>(data: T) {
    switch(data.type) {
      case I.ReqType.Trade:
        this._latests.trade = data
        return this.onTrade(data as any)
      case I.ReqType.Orderbook:
        this._latests.orderbook = data
        return this.onOrderbook(data as any)
      case I.ReqType.Ticker:
        this._latests.ticker = data
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
    if(this._latests[type] === null) {
      return null
    }
    return Object.assign({}, this._latests[type])
  }

  _start<S extends BaseUPbitSocket>(socket?: S): Promise<void> {
    if(this.start) {
      return this.start(socket)
    }
  }

  _finish(): Promise<void> {
    if(this.finish) {
      return this.finish()
    }
  }

  abstract start<S extends BaseUPbitSocket>(socket?: S): Promise<void>
  abstract finish(): Promise<void>
  abstract onTrade(data: I.TradeType): Promise<boolean|void>
  abstract onOrderbook(data: I.OrderbookType): Promise<boolean|void>
  abstract onTicker(data: I.TickerType): Promise<boolean|void>
}


const listeners: {
  [key: string]: {
    [key: string]: {
      callback: (...data) => void
      args: any
    }[]
  }
} = {}


// function addEventListener(event: I.EventType.Candle, callback: (ohlcs: I.OHLCType[]) => Promise<void>, args: {
//   minutes: number
//   limit: number
// }): void
function addEventListener<B extends BaseSocketBot, E extends I.EventType>(
  target: B , event: E , callback , args?) {
  if(!listeners[target.constructor.name]) {
    listeners[target.constructor.name] = {}
  }
  if(!listeners[target.constructor.name][event]) {
    listeners[target.constructor.name][event] = []
  }
  listeners[target.constructor.name][event].push({
    callback,
    args,
  })
}


type DecoCandleListenerType = {
  (minutes: number, limit: number)
  : (target: BaseCandleBot, property: string, descriptor: PropertyDescriptor) => PropertyDescriptor
}

export const addCandleListener: DecoCandleListenerType = (minutes: number, limit: number) => {
  return (target: BaseCandleBot, property: string, descriptor: PropertyDescriptor) => {
    addEventListener(target, I.EventType.Candle, (...data) => {
      return descriptor.value.call(target, ...data)
    }, {
      minutes,
      limit,
    })
    return descriptor
  }
}


export abstract class BaseCandleBot extends BaseSocketBot {
  private _ohlcMaker: OHLCMaker = null

  constructor(code: string) {
    super(code)
  }

  _start<S extends BaseUPbitSocket>(socket?: S): Promise<void> {
    if(listeners[this.constructor.name] && listeners[this.constructor.name][I.EventType.Candle]) {
      const candleListeners = listeners[this.constructor.name][I.EventType.Candle]
      let limit = candleListeners.reduce((max, l) => Math.max(l.args.minutes * l.args.limit, max), 0)
      if(limit !== 0) {
        this._ohlcMaker = new OHLCMaker(limit)
      }
    }
    return super._start()
  }

  async onTrade(tr: I.TradeType): Promise<boolean|void> {
    if(listeners[this.constructor.name] && listeners[this.constructor.name][I.EventType.Candle]) {
      this._ohlcMaker.push(tr)
      const candleListeners = listeners[this.constructor.name][I.EventType.Candle]
      for(let i = 0; i < candleListeners.length; i++) {
        const os = this._ohlcMaker.as(candleListeners[i].args.minutes)
        if(os.length !== 0) {
          await candleListeners[i].callback(os)
        }
      }
    }
  }
  
  onOrderbook = null
  onTicker = null
}


// BaseSocketBot.writer.link = new FileWriter('./log/bot.log', '1d')
// BaseSocketBot.format = ':name: < :time:\n:msg:'
