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
  Order,
  OrderMarket,
  AbstractOrderMarket,
  AbstractOrder,
} from './order'
import { uniq } from 'lodash'



// type Constructor<B extends MyBaseBot> = new (code: string) => B



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

  constructor() {
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
        bot['trigger'] = async function<T extends I.ResType>(data: T) {
          this._latests[data.type] = data
          if([I.EventType.Trade, I.EventType.Orderbook, I.EventType.Ticker]
            .some(type => this.usingEvent(type as I.EventType) && this._latests[type] === null)) {
            return
          }
          if(this._queue[data.type].length === 0) {
            this._queue[data.type].push(data)
            while(this._queue[data.type].length !== 0) {
              const res = this._queue[data.type][0]
              await Promise.all(this._subscribers[res.type].subscribers.map(sub => sub.next(res)))
              if(this._queue[data.type].length !== 0) {
                this._queue[data.type].shift()
              }
            }
          } else {
            this._queue[data.type].push(data)
          }
        }
        this._bots.push(bot)
      }
    })
    this._botConst = null
  }

  // newOrder<B extends BaseBot>(bot: B): AbstractOrder {
  //   return new Order(bot.code)
  // }

  // newOrderMarket<B extends BaseBot>(bot: B): AbstractOrderMarket {
  //   return new OrderMarket(bot.code)
  // }

  // private _addBot<B extends BaseBot>(bot: B) {
  //   this._bots.push(bot)
  //   if(bot.usingEvent(I.EventType.Trade)) {
  //     if(!this._botConst.trade[bot.code]) {
  //       this._botConst.trade[bot.code] = []
  //     }
  //     if(this._botConst.trade[bot.code].some(b => b.name === bot.name)) {
  //       return
  //     }
  //     this._botConst.trade[bot.code].push(bot)
  //   }
  //   if(bot.usingEvent(I.EventType.Orderbook)) {
  //     if(!this._botConst.orderbook[bot.code]) {
  //       this._botConst.orderbook[bot.code] = []
  //     }
  //     if(this._botConst.orderbook[bot.code].some(b => b.name === bot.name)) {
  //       return
  //     }
  //     this._botConst.orderbook[bot.code].push(bot)
  //   }
  //   if(bot.usingEvent(I.EventType.Ticker)) {
  //     if(!this._botConst.ticker[bot.code]) {
  //       this._botConst.ticker[bot.code] = []
  //     }
  //     if(this._botConst.ticker[bot.code].some(b => b.name === bot.name)) {
  //       return
  //     }
  //     this._botConst.ticker[bot.code].push(bot)
  //   }
  // }

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

  // protected getCodes(req: I.ReqType): string[] {
  //   return Object.keys(this._botConst[req])
  // }

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
        const d = JSON.parse(data.toString('utf-8'))
        const bots = this.getBots(d.type, d.code)
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



// export abstract class BaseUPbitSocket extends Logger {
//   private _isStarted = false
//   private _botConst: {
//     trade: {
//       [index: string]: BaseBot[]
//     }
//     orderbook: {
//       [index: string]: BaseBot[]
//     }
//     ticker: {
//       [index: string]: BaseBot[]
//     }
//   } = {
//     trade: {},
//     orderbook: {},
//     ticker: {},
//   }

//   constructor() {
//     super()
//   }

//   getBots<T extends BaseBot>(): T[]
//   getBots<T extends BaseBot>(req: I.ReqType): T[]
//   getBots<T extends BaseBot>(req: I.ReqType, code?: string): T[]
//   getBots(req?: I.ReqType, code?: string): BaseBot[] {
//     if(!req) {
//       const bots: BaseBot[] = []
//       bots.push(...this.getBots(I.ReqType.Trade))
//       bots.push(...this.getBots(I.ReqType.Orderbook))
//       bots.push(...this.getBots(I.ReqType.Ticker))
//       return uniq(bots)
//     }
//     if(!code) {
//       return Object.keys(this._botConst[req])
//       .map(code => this._botConst[req][code])
//       .reduce((sum, bots) => {
//         sum.push(...bots)
//         return sum
//       }, [])
//     }
//     return this._botConst[req][code]
//   }

//   addBotClass<B extends BaseBot>(botClass: Constructor<B>, codes: string[]) {
//     return this.addBot(...codes.map(code => new botClass(code)))
//   }

//   addBot<B extends BaseBot>(...bots: B[]) {
//     bots.forEach(b => this._addBot(b))
//   }

//   newOrder<B extends BaseBot>(bot: B): AbstractOrder {
//     return new Order(bot.code)
//   }

//   newOrderMarket<B extends BaseBot>(bot: B): AbstractOrderMarket {
//     return new OrderMarket(bot.code)
//   }

//   private _addBot<B extends BaseBot>(bot: B) {
//     if(bot.onTrade || bot.hasCandleEvent) {
//       if(!this._botConst.trade[bot.code]) {
//         this._botConst.trade[bot.code] = []
//       }
//       if(this._botConst.trade[bot.code].some(b => b.name === bot.name)) {
//         return
//       }
//       this._botConst.trade[bot.code].push(bot)
//     }
//     if(bot.onOrderbook) {
//       if(!this._botConst.orderbook[bot.code]) {
//         this._botConst.orderbook[bot.code] = []
//       }
//       if(this._botConst.orderbook[bot.code].some(b => b.name === bot.name)) {
//         return
//       }
//       this._botConst.orderbook[bot.code].push(bot)
//     }
//     if(bot.onTicker) {
//       if(!this._botConst.ticker[bot.code]) {
//         this._botConst.ticker[bot.code] = []
//       }
//       if(this._botConst.ticker[bot.code].some(b => b.name === bot.name)) {
//         return
//       }
//       this._botConst.ticker[bot.code].push(bot)
//     }
//   }

//   protected getCodes(req: I.ReqType): string[] {
//     return Object.keys(this._botConst[req])
//   }

//   protected async start(): Promise<boolean> {
//     await Promise.all(this.getBots().map(b => b._start(this)))
//     this._isStarted = true
//     return true
//   }

//   protected async finish(): Promise<boolean> {
//     if(!this._isStarted) {
//       return false
//     }
//     await Promise.all(this.getBots().map(b => b._finish()))
//     this._isStarted = false
//     return true
//   }

//   abstract open(): Promise<void>
//   abstract close(): Promise<boolean>
// }


// export class UPbitSocket extends BaseUPbitSocket {
//   static url = 'wss://api.upbit.com/websocket/v1'

//   private _ws: WebSocket = null
//   private _exit: boolean = false
//   private _uuid: string

//   constructor(private readonly pingSec: number = 120 * 1000) {
//     super()
//     this._uuid = uuidv4()
//   }

//   requests(): unknown[] {
//     const req = []
//     req.push({ticket: this._uuid})
//     let codes = this.getCodes(I.ReqType.Trade)
//     if(codes.length !== 0) {
//       // req.push({type: I.ReqType.Trade, codes, isOnlyRealtime: true})
//       req.push({type: I.ReqType.Trade, codes})
//     }
//     codes = this.getCodes(I.ReqType.Orderbook)
//     if(codes.length !== 0) {
//       // req.push({type: I.ReqType.Orderbook, codes, isOnlyRealtime: true})
//       req.push({type: I.ReqType.Orderbook, codes})
//     }
//     codes = this.getCodes(I.ReqType.Ticker)
//     if(codes.length !== 0) {
//       // req.push({type: I.ReqType.Ticker, codes, isOnlyRealtime: true})
//       req.push({type: I.ReqType.Ticker, codes})
//     }
//     return req
//   }

//   async open(): Promise<void> {
//     await this.start()
//     return this.resume()
//   }

//   private resume(): Promise<void> {
//     const req = this.requests()
//     let ws = new WebSocket(UPbitSocket.url)
//     this._ws = ws
//     return new Promise<void>((resolve, reject) => {
//       ws.on('message', data => {
//         const d = JSON.parse(data.toString('utf-8'))
//         const bots = this.getBots(d.type, d.code)
//         bots.forEach(b => b.trigger(d))
//       })
//       ws.on('close', (code, reason) => {
//         this.log('closed -----', `code: ${code}, reason: ${reason}`)
//         ws = null
//         if(this._ws !== null) {
//           this.log('resume -----')
//           this.resume()
//         } else if(this._exit) {
//           global.process.exit()
//         }
//       })
//       ws.on('pong', data => {
//       })
//       ws.once('open', () => {
//         ws.send(JSON.stringify(req))
//         const id = setInterval(() => {
//           if(ws === null) {
//             clearInterval(id)
//             return
//           }
//           if(ws.readyState === I.SocketState.Open) {
//             ws.ping()
//           }
//         }, this.pingSec)
//         this.log('opened -----')
//         resolve()
//       })
//     })
//   }

//   async close(exit: boolean = false): Promise<boolean> {
//     if(this._ws) {
//       const ws = this._ws
//       this._ws = null
//       await this.finish()
//       ws.terminate()
//       this._exit = exit
//       return true
//     } else {
//       return false
//     }
//   }

//   get uuid(): string {
//     return this._uuid
//   }

//   get state(): I.SocketState {
//     if(this._ws) {
//       return this._ws.readyState
//     }
//     return I.SocketState.Closed
//   }
// }


