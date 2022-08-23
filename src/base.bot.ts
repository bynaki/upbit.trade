import * as I from './types'
import {
  Observable,
  types as If,
} from 'fourdollar'
import {
  BaseUPbitSocket, UPbitSocket,
} from './socket'
import {
  OHLCMaker,
} from './utils'
import {
  AbstractOrder,
  AbstractOrderMarket,
} from './order'


type Subscribers<T> = {
  observable: Observable<T>
  subscribers: If.SubscriptionObserver<T>[]
}

const preSubscriptions: {
  [name: string]: {
    [propertyKey: string]: {
      type: I.EventType
      opts: any
    }
  }
} = {}

function subs<T>(type: I.EventType, opts?: any) {
  return (target: BaseBot, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => {
    if(!preSubscriptions[target.constructor.name]) {
      preSubscriptions[target.constructor.name] = {}
    }
    preSubscriptions[target.constructor.name][propertyKey] = {type, opts}
  }
}


// decorators
export const subscribe = {
  trade: subs<(tr: I.TradeType) => any>(I.EventType.Trade),
  orderbook: subs<(ob: I.OrderbookType) => any>(I.EventType.Orderbook),
  ticker: subs<(tk: I.TickerType) => any>(I.EventType.Ticker),
  candle(min: number, limit: number = 30) {
    return subs<(ohlcs: I.OHLCType[]) => any>(I.EventType.Candle, {min, limit})
  },
  start: subs<(socket: UPbitSocket) => any>(I.EventType.Start),
  finish: subs<() => any>(I.EventType.Finish),
}



export class BaseBot {
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
  private _socket: BaseUPbitSocket
  private _ohlcMaker: OHLCMaker
  protected _subscribers: {
    [min: number]: Subscribers<I.OHLCType[]>
    [I.EventType.Trade]?: Subscribers<I.TradeType>
    [I.EventType.Orderbook]?: Subscribers<I.OrderbookType>
    [I.EventType.Ticker]?: Subscribers<I.TickerType>
    [I.EventType.Start]?: Subscribers<BaseUPbitSocket>
    [I.EventType.Finish]?: Subscribers<void>
  } = {}
  protected _preSubs: {[name: string]: {
    type: I.EventType
    opts?: any
  }} = {}

  constructor(public readonly code: string) {
    const names = this.genealogy()
    this._preSubs = names.filter(name => preSubscriptions[name])
      .map(name => preSubscriptions[name])
      .reduce((pre, next) => {
        for(let i in next) {
          pre[i] = next[i]
        }
        return pre
      }, {})
    for(let name in this._preSubs) {
      const ps = this._preSubs[name]
      if(ps.type === I.EventType.Candle) {
        this.subscribe(I.EventType.Candle, ps.opts, {
          next: this[name].bind(this),
        })
      } else {
        this.subscribe(ps.type, {
          next: this[name].bind(this)
        })
      }
    }
  }

  get name() {
    return `${this.constructor.name}:${this.code}`
  }

  genealogy(constructor?: any, gs: string[] = []): string[] {
    if(!constructor) {
      constructor = this.constructor
    }
    if(constructor.name === 'Object') {
      return gs.reverse()
    }
    gs.push(constructor.name)
    if(constructor.prototype) {
      const parent = Object.getPrototypeOf(constructor.prototype).constructor
      return this.genealogy(parent, gs)
    }
    return gs
  }

  get subscribers() {
    return this._subscribers
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

  // newOrder(): AbstractOrder {
  //   return this._socket.newOrder(this)
  // }
  // newOrderMarket(): AbstractOrderMarket {
  //   return this._socket.newOrderMarket(this)
  // }

  // get hasCandleEvent() {
  //   return this.getCandleCallbacks().length !== 0
  // }

  private _obsCandle(min: 1|3|5|10|15|30|60|240, limit: number): Observable<I.OHLCType[]> {
    if(!this._ohlcMaker) {
      this._ohlcMaker = new OHLCMaker(limit * min)
      const sub = this.observer(I.EventType.Trade).subscribe({
        next: async (tr) => {
          this._ohlcMaker.push(tr)
          const list = [1, 3, 5, 10, 15, 30, 60, 240].map(min => {
            if(this._subscribers[min]) {
              if(this._subscribers[min].subscribers.length !== 0) {
                const os = this._ohlcMaker.as(min)
                if(os.length !== 0) {
                  return Promise.all(this._subscribers[min].subscribers.map(sub => sub.next(os)))
                }
              }
            }
          })
          await Promise.all(list)
        }
      })
    } else if(this._ohlcMaker.limit < limit * min) {
      this._ohlcMaker.limit = limit * min
    }
    if(!this._subscribers) {
      this._subscribers = {}
    }
    if(!this._subscribers[min]) {
      this._subscribers[min] = {
        observable: new Observable<I.OHLCType[]>(sub => {
          this._subscribers[min].subscribers.push(sub)
          return () => {
            this._subscribers[min].subscribers =
              this._subscribers[min].subscribers.filter(s => !s.closed)
          }
        }),
        subscribers: [],
      }
    }
    return this._subscribers[min].observable
  }

  private _obs(type: I.EventType): Observable<unknown> {
    if(!this._subscribers) {
      this._subscribers = {}
    }
    if(!this._subscribers[type]) {
      this._subscribers[type] = {
        observable: new Observable(sub => {
          this._subscribers[type].subscribers.push(sub)
          return () => {
            this._subscribers[type].subscribers = 
              this._subscribers[type].subscribers.filter(s => !s.closed)
          }
        }),
        subscribers: [],
      }
    }
    return this._subscribers[type].observable
  }

  observer(type: I.EventType.Trade): Observable<I.TradeType>
  observer(type: I.EventType.Orderbook): Observable<I.OrderbookType>
  observer(type: I.EventType.Ticker): Observable<I.TickerType>
  observer(type: I.EventType.Candle, min: 1|3|5|10|15|30|60|240, limit: number): Observable<I.OHLCType[]>
  observer(type: I.EventType.Start): Observable<BaseUPbitSocket>
  observer(type: I.EventType.Finish): Observable<void>
  observer(type: I.EventType, ...args: unknown[]): Observable<unknown> {
    switch(type) {
      case I.EventType.Candle: {
        return this._obsCandle(args[0] as 1|3|5|10|15|30|60|240, args[1] as number)
      }
      default: {
        return this._obs(type)
      }
    }
  }

  subscribe(type: I.EventType.Trade, sub: If.Observer<I.TradeType>): If.Subscription
  subscribe(type: I.EventType.Orderbook, sub: If.Observer<I.OrderbookType>): If.Subscription
  subscribe(type: I.EventType.Ticker, sub: If.Observer<I.TickerType>): If.Subscription
  subscribe(type: I.EventType.Start, sub: If.Observer<BaseUPbitSocket>): If.Subscription
  subscribe(type: I.EventType.Finish, sub: If.Observer<void>): If.Subscription
  subscribe(type: I.EventType.Candle, opts: {
    min: 1|3|5|10|15|30|60|240
    limit: number
  }, sub: If.Observer<I.OHLCType[]>): If.Subscription
  subscribe<T>(type: I.EventType, sub: If.Observer<T>): If.Subscription
  subscribe(type: I.EventType, arg1: any, arg2?: any): If.Subscription {
    switch(type) {
      case I.EventType.Candle: {
        return this.observer(type, arg1.min, arg1.limit).subscribe(arg2)
      }
      default: {
        return this.observer(type as any).subscribe(arg1)
      }
    }
  }

  // async trigger<T extends I.ResType>(data: T) {
  //   this._latests[data.type] = data
  //   if([I.EventType.Trade, I.EventType.Orderbook, I.EventType.Ticker]
  //     .some(type => this.usingEvent(type as I.EventType) && this._latests[type] === null)) {
  //     return
  //   }
  //   if(this._queue[data.type].length === 0) {
  //     this._queue[data.type].push(data)
  //     while(this._queue[data.type].length !== 0) {
  //       const res = this._queue[data.type][0]
  //       await Promise.all(this._subscribers[res.type].subscribers.map(sub => sub.next(res)))
  //       if(this._queue[data.type].length !== 0) {
  //         this._queue[data.type].shift()
  //       }
  //     }
  //   } else {
  //     this._queue[data.type].push(data)
  //   }
  // }

  private _release() {
    this._queue = {
      trade: [],
      orderbook: [],
      ticker: [],
    }
  }

  async _start<S extends BaseUPbitSocket>(socket: S): Promise<void> {
    this._socket = socket
    if(this._subscribers[I.EventType.Start]) {
      await Promise.all(this._subscribers[I.EventType.Start].subscribers.map(sub => sub.next(socket)))
    }
  }

  async _finish(): Promise<void> {
    this._release()
    if(this._subscribers[I.EventType.Finish]) {
      await Promise.all(this._subscribers[I.EventType.Finish].subscribers.map(sub => sub.next()))
    }
  }

  usingEvent(type: I.EventType): boolean {
    return !!this._subscribers?.[type]
  }

  usingCandle(min?: 1|3|5|10|15|30|60|240): boolean {
    if(!!min) {
      return !!this._subscribers?.[min]
    } else {
      return [1, 3, 5, 10, 15, 30, 60, 240].some(m => !!this._subscribers?.[m])
    }
  }
}



// export abstract class BaseBot extends Logger {
//   private _queue: {
//     trade: I.ResType[]
//     orderbook: I.ResType[]
//     ticker: I.ResType[]
//   } = {
//     trade: [],
//     orderbook: [],
//     ticker: [],
//   }
//   private _latests: {
//     trade: I.ResType
//     orderbook: I.ResType
//     ticker: I.ResType
//   } = {
//     trade: null,
//     orderbook: null,
//     ticker: null,
//   }
//   private _socket: BaseUPbitSocket = null
//   private _ohlcMaker: OHLCMaker = null
//   private _candleCallbacks: {
//     callback: string
//     args: {
//       minutes: number
//       limit: number
//     }
//   }[] = null

//   constructor(public readonly code: string) {
//     super(code)
//   }

//   get name() {
//     return `${this.constructor.name}:${this.code}`
//   }

//   latest(type: I.ReqType.Trade): I.TradeType
//   latest(type: I.ReqType.Orderbook): I.OrderbookType
//   latest(type: I.ReqType.Ticker): I.TickerType
//   latest(type: I.ReqType): any {
//     if(this._latests[type] === null) {
//       return null
//     }
//     return Object.assign({}, this._latests[type])
//   }

//   newOrder(): AbstractOrder {
//     return this._socket.newOrder(this)
//   }
//   newOrderMarket(): AbstractOrderMarket {
//     return this._socket.newOrderMarket(this)
//   }

//   get hasCandleEvent() {
//     return this.getCandleCallbacks().length !== 0
//   }

//   async trigger<T extends I.ResType>(data: T) {
//     this._latests[data.type] = data
//     if((this.onTrade || this.hasCandleEvent) && this._latests[I.ReqType.Trade] === null) {
//       return
//     }
//     if(this.onOrderbook && this._latests[I.ReqType.Orderbook] === null) {
//       return
//     }
//     if(this.onTicker && this._latests[I.ReqType.Ticker] === null) {
//       return
//     }
//     if(this._queue[data.type].length === 0) {
//       this._queue[data.type].push(data)
//       while(this._queue[data.type].length !== 0) {
//         const res = this._queue[data.type][0]
//         if(data.type === I.ReqType.Trade && this.hasCandleEvent) {
//           await Promise.all([this._trigger(res), this._triggerCandle(res as I.TradeType)])
//         } else {
//           await this._trigger(res)
//         }
//         this._queue[data.type].shift()
//       }
//     } else {
//       this._queue[data.type].push(data)
//     }
//   }

//   private async _trigger(data: I.ResType) {
//     switch(data.type) {
//       case I.ReqType.Trade:
//         return this.onTrade && this.onTrade(data as I.TradeType)
//       case I.ReqType.Orderbook:
//         return this.onOrderbook(data as I.OrderbookType)
//       case I.ReqType.Ticker:
//         return this.onTicker(data as I.TickerType)
//       default:
//         throw new Error(`'${data.type}' is unknown type.`)
//     }
//   }

//   private async _triggerCandle(tr: I.TradeType) {
//     const callbacks = this.getCandleCallbacks()
//     this._ohlcMaker.push(tr)
//     for(const cb of callbacks) {
//       const os = this._ohlcMaker.as(cb.args.minutes)
//       if(os.length !== 0) {
//         await this[cb.callback](os)
//       }
//     }
//   }

//   getCandleCallbacks() {
//     if(this._candleCallbacks) {
//       return this._candleCallbacks
//     }
//     this._candleCallbacks = []
//     if(listeners[this.constructor.name] && listeners[this.constructor.name][I.EventType.Candle]) {
//       this._candleCallbacks = listeners[this.constructor.name][I.EventType.Candle]
//       let limit = this._candleCallbacks.reduce((max, l) => Math.max(l.args.minutes * l.args.limit, max), 0)
//       if(limit !== 0) {
//         this._ohlcMaker = new OHLCMaker(limit)
//       }
//     }
//     return this._candleCallbacks
//   }

//   _start<S extends BaseUPbitSocket>(socket: S): Promise<void> {
//     this._socket = socket
//     if(this.start) {
//       return this.start(socket)
//     }
//   }

//   _finish(): Promise<void> {
//     if(this.finish) {
//       return this.finish()
//     }
//   }

//   abstract start(socket: BaseUPbitSocket): Promise<void>
//   abstract finish(): Promise<void>
//   abstract onTrade(data: I.TradeType): Promise<void>
//   abstract onOrderbook(data: I.OrderbookType): Promise<void>
//   abstract onTicker(data: I.TickerType): Promise<void>
// }



// const listeners: {
//   [key: string]: {
//     [key: string]: {
//       callback: string
//       args: any
//     }[]
//   }
// } = {}


// function addEventListener(event: I.EventType.Candle, callback: (ohlcs: I.OHLCType[]) => Promise<void>, args: {
//   minutes: number
//   limit: number
// // }): void
// function addEventListener<B extends BaseBot, E extends I.EventType>(
//   target: B , event: E , callback , args?) {
//   if(!listeners[target.constructor.name]) {
//     listeners[target.constructor.name] = {}
//   }
//   if(!listeners[target.constructor.name][event]) {
//     listeners[target.constructor.name][event] = []
//   }
//   listeners[target.constructor.name][event].push({
//     callback,
//     args,
//   })
// }


// type DecoCandleListenerType<B extends BaseBot> = {
//   (minutes: 1|3|5|10|15|30|60|240, limit: number)
//   : (target: B, property: string, descriptor: PropertyDescriptor) => PropertyDescriptor
// }

// export function addCandleListener<B extends BaseBot>(minutes: 1|3|5|10|15|30|60|240, limit: number) {
//   return (target: B, property: string, descriptor: PropertyDescriptor) => {
//     addEventListener(target, I.EventType.Candle, property, {
//       minutes,
//       limit,
//     })
//     return descriptor
//   }
// }
