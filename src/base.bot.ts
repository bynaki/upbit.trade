import * as I from './types'
import {
  Logger,
} from 'fourdollar'
import {
  BaseUPbitSocket,
} from './socket'
import {
  OHLCMaker,
} from './utils'
import {
  AbstractOrder,
  AbstractOrderMarket,
} from './order'



export abstract class BaseBot extends Logger {
  private _queue: {
    trade: I.ResType[]
    orderbook: I.ResType[]
    ticker: I.ResType[]
  } = {
    trade: [],
    orderbook: [],
    ticker: [],
  }
  private _latests: {
    trade: I.ResType
    orderbook: I.ResType
    ticker: I.ResType
  } = {
    trade: null,
    orderbook: null,
    ticker: null,
  }
  private _socket: BaseUPbitSocket = null
  private _ohlcMaker: OHLCMaker = null
  private _candleCallbacks: {
    callback: string
    args: {
      minutes: number
      limit: number
    }
  }[] = null

  constructor(public readonly code: string) {
    super(code)
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

  newOrder(): AbstractOrder {
    return this._socket.newOrder(this)
  }
  newOrderMarket(): AbstractOrderMarket {
    return this._socket.newOrderMarket(this)
  }

  get hasCandleEvent() {
    return this.getCandleCallbacks().length !== 0
  }

  async trigger<T extends I.ResType>(data: T) {
    this._latests[data.type] = data
    if((this.onTrade || this.hasCandleEvent) && this._latests[I.ReqType.Trade] === null) {
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
        const res = this._queue[data.type][0]
        if(data.type === I.ReqType.Trade && this.hasCandleEvent) {
          await Promise.all([this._trigger(res), this._triggerCandle(res as I.TradeType)])
        } else {
          await this._trigger(res)
        }
        this._queue[data.type].shift()
      }
    } else {
      this._queue[data.type].push(data)
    }
  }

  private async _trigger(data: I.ResType) {
    switch(data.type) {
      case I.ReqType.Trade:
        return this.onTrade && this.onTrade(data as I.TradeType)
      case I.ReqType.Orderbook:
        return this.onOrderbook(data as I.OrderbookType)
      case I.ReqType.Ticker:
        return this.onTicker(data as I.TickerType)
      default:
        throw new Error(`'${data.type}' is unknown type.`)
    }
  }

  private async _triggerCandle(tr: I.TradeType) {
    const callbacks = this.getCandleCallbacks()
    this._ohlcMaker.push(tr)
    for(const cb of callbacks) {
      const os = this._ohlcMaker.as(cb.args.minutes)
      if(os.length !== 0) {
        await this[cb.callback](os)
      }
    }
  }

  getCandleCallbacks() {
    if(this._candleCallbacks) {
      return this._candleCallbacks
    }
    this._candleCallbacks = []
    if(listeners[this.constructor.name] && listeners[this.constructor.name][I.EventType.Candle]) {
      this._candleCallbacks = listeners[this.constructor.name][I.EventType.Candle]
      let limit = this._candleCallbacks.reduce((max, l) => Math.max(l.args.minutes * l.args.limit, max), 0)
      if(limit !== 0) {
        this._ohlcMaker = new OHLCMaker(limit)
      }
    }
    return this._candleCallbacks
  }

  _start<S extends BaseUPbitSocket>(socket: S): Promise<void> {
    this._socket = socket
    if(this.start) {
      return this.start(socket)
    }
  }

  _finish(): Promise<void> {
    if(this.finish) {
      return this.finish()
    }
  }

  abstract start(socket: BaseUPbitSocket): Promise<void>
  abstract finish(): Promise<void>
  abstract onTrade(data: I.TradeType): Promise<void>
  abstract onOrderbook(data: I.OrderbookType): Promise<void>
  abstract onTicker(data: I.TickerType): Promise<void>
}



const listeners: {
  [key: string]: {
    [key: string]: {
      callback: string
      args: any
    }[]
  }
} = {}


// function addEventListener(event: I.EventType.Candle, callback: (ohlcs: I.OHLCType[]) => Promise<void>, args: {
//   minutes: number
//   limit: number
// }): void
function addEventListener<B extends BaseBot, E extends I.EventType>(
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
  (minutes: 1|3|5|10|15|30|60|240, limit: number)
  : (target: BaseBot, property: string, descriptor: PropertyDescriptor) => PropertyDescriptor
}

export const addCandleListener: DecoCandleListenerType = (minutes: 1|3|5|10|15|30|60|240, limit: number) => {
  return (target: BaseBot, property: string, descriptor: PropertyDescriptor) => {
    addEventListener(target, I.EventType.Candle, property, {
      minutes,
      limit,
    })
    return descriptor
  }
}



// export abstract class BaseCandleBot extends BaseSocketBot {
//   private _ohlcMaker: OHLCMaker = null

//   constructor(code: string) {
//     super(code)
//   }

//   _start<S extends BaseUPbitSocket>(socket?: S): Promise<void> {
//     if(listeners[this.constructor.name] && listeners[this.constructor.name][I.EventType.Candle]) {
//       const candleListeners = listeners[this.constructor.name][I.EventType.Candle]
//       let limit = candleListeners.reduce((max, l) => Math.max(l.args.minutes * l.args.limit, max), 0)
//       if(limit !== 0) {
//         this._ohlcMaker = new OHLCMaker(limit)
//       }
//     }
//     return super._start(socket)
//   }

//   async onTrade(tr: I.TradeType): Promise<boolean|void> {
//     if(listeners[this.constructor.name] && listeners[this.constructor.name][I.EventType.Candle]) {
//       this._ohlcMaker.push(tr)
//       const candleListeners = listeners[this.constructor.name][I.EventType.Candle]
//       for(let i = 0; i < candleListeners.length; i++) {
//         const os = this._ohlcMaker.as(candleListeners[i].args.minutes)
//         if(os.length !== 0) {
//           await this[candleListeners[i].callback](os)
//         }
//       }
//     }
//   }
  
//   onOrderbook = null
//   onTicker = null
// }


// BaseSocketBot.writer.link = new FileWriter('./log/bot.log', '1d')
// BaseSocketBot.format = ':name: < :time:\n:msg:'
