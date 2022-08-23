import {
  BaseUPbitSocket,
  BaseBot,
  AbstractOrderMarket,
  types as I,
  DbTradeTickType,
  DbCandleMinuteType,
  readyTrade,
} from './'
import {
  upbit_types as Iu,
} from 'cryptocurrency.api'
import { v4 as uuidv4 } from 'uuid'
import {
  floor,
} from 'lodash'
import {
  format,
} from 'fecha'
import { AbstractOrder } from './order'
import {
  toNumber,
  uniq,
} from 'lodash'
import { readyCandle } from './database'
import {
  Observable,
  types as If,
} from 'fourdollar'



export class UPbitTradeMock extends BaseUPbitSocket {
  private args: {
    filename: string
    tableName: string
    params: {
      daysAgo: number
      to?: string
    }
  }

  constructor(filename: string, tableName: string, params: {
    daysAgo: number
    to?: string
  }) {
    super()
    this.args = {
      filename,
      tableName,
      params,
    }
  }

  // addBot<B extends BaseBot>(...bots: B[]): void {
  //   bots.forEach(bot => bot.constructor.prototype.prototype = TradeMock)
  //   super.addBot(...bots)
  // }

  async open() {
    if(this.getCodes(I.ReqType.Ticker).length !== 0) {
      throw new Error('"mock" 모드에서는 "ticker" 를 제공하지 않는다.')
    }
    if(this.getCodes(I.ReqType.Orderbook).length !== 0) {
      throw new Error('"mock" 모드에서는 "orderbook" 을 제공하지 않는다.')
    }
    // todo:
    // const bots = this.getBots(I.ReqType.Trade)
    // bots.forEach(bot => {
    //   bot['_furtiveCbs'] = []
    // })
    const codes = this.getCodes(I.ReqType.Trade)
    const table = await readyTrade(this.args.filename, this.args.tableName, {
      codes,
      daysAgo: this.args.params.daysAgo,
      to: this.args.params.to,
    })
    await this.start()
    for await (let tr of table.each()) {
      const converted = this.convertTradeType(tr)
      const bots = this.getBots(I.ReqType.Trade, converted.code)
      // todo:
      // bots.forEach(b => b['_furtiveCbs'].forEach(cb => cb(tr)))
      await Promise.all(bots.map(bot => bot['trigger'](converted)))
    }
    await this.finish()
  }

  // newOrderMarket(bot: BaseBot): AbstractOrderMarket {
  //   return new OrderMarketMock(bot)
  // }

  // newOrder(bot: BaseBot): AbstractOrder {
  //   throw new Error("'UPbitTradeMock' 모드에서는 'newOrder()'를 지원하지 않는다.")
  // }

  private convertTradeType(tr: DbTradeTickType): I.TradeType {
    return {
      type: I.ReqType.Trade,
      code: tr.market,
      trade_price: tr.trade_price,
      trade_volume: toNumber(tr.trade_volume),
      ask_bid: tr.ask_bid,
      prev_closing_price: tr.prev_closing_price,
      change: '',
      change_price: tr.change_price,
      trade_date: tr.trade_date_utc,
      trade_time: tr.trade_time_utc,
      trade_timestamp: tr.timestamp,
      timestamp: tr.timestamp,
      sequential_id: tr.sequential_id,
      stream_type: 'REALTIME',
    }
  }

  close = null
}



export class UPbitCandleMock extends BaseUPbitSocket {
  private args: {
    filename: string
    tableName: string
    params: {
      from: string
      to?: string
    }
    override: 'yes'|'no'
  }
  // private wraps: {
  //   [index: string]: {
  //     [index: number]: ((ohlc: I.OHLCType) => Promise<void>)[]
  //   }
  // }

  constructor(filename: string, tableName: string, params: {
    from: string
    to?: string
  }, override: 'yes'|'no' = 'no') {
    super()
    this.args = {
      filename,
      tableName,
      params,
      override,
    }
  }

  addBot<B extends BaseBot>(...bots: B[]): void {
    bots.forEach(bot => {
      const ohlcs: {
        [min: number]: {
          ohlcs: I.OHLCType[]
          limit: number
        }
      } = {}
      bot['triggerB'] = async function(min: 1|3|5|10|15|30|60|240, ohlc: I.OHLCType): Promise<void> {
        if(!ohlcs[min]) {
          ohlcs[min] = {
            ohlcs: [],
            limit: 10,
          }
        }
        const data = ohlcs[min]
        data.ohlcs.unshift(ohlc)
        if(data.ohlcs.length > data.limit) {
          data.ohlcs.pop()
        }
        await Promise.all(this._subscribers[min].subscribers.map(sub => sub.next(data.ohlcs)))
        return
      }
    })
    super.addBot(...bots)
  }

  async open(): Promise<void> {
    // const wraps: {
    //   [code: string]: {
    //     [min: number]: (ohlc: I.OHLCType) => Promise<void>
    //   },
    // } = {}
    const bots = this.getBots()
    const keys = ['1', '3', '5', '10', '15', '30', '60', '240']
    const comins = bots.map(bot => {
      return keys.filter(key => bot.subscribers[key]).map(min => `${bot.code}:${min}`)
    }).flat()
    const table = await readyCandle(this.args.filename, this.args.tableName, {
      comins,
      from: this.args.params.from,
      to: this.args.params.to,
    })
    await this.start()
    for await (const c of table.each()) {
      const converted = this.convertCandleType(c)
      this.getBots(I.ReqType.Trade, c.market).map(bot => {
        return bot['triggerB'](c.unit as 1|3|5|10|15|30|60|240, converted)
      })
      // await Promise.all(this.wraps[c.market][c.unit].map(wrap => () => wrap(converted)))
      // await Promise.all(this.wraps[c.market][c.unit].map(wrap => wrap(converted)))
    }
    await this.finish()
  }

  // newOrderMarket(bot: BaseBot): AbstractOrderMarket {
  //   return new OrderMarketMock(bot)
  // }

  // newOrder(bot: BaseBot): AbstractOrder {
  //   throw new Error("'UPbitTradeMock' 모드에서는 'newOrder()'를 지원하지 않는다.")
  // }

  private convertCandleType(dbCandle: DbCandleMinuteType): I.OHLCType {
    return {
      close: dbCandle.trade_price,
      high: dbCandle.high_price,
      low: dbCandle.low_price,
      open: dbCandle.opening_price,
      timestamp: new Date(dbCandle.candle_date_time_utc + '+00:00').getTime(),
      volume: toNumber(dbCandle.candle_acc_trade_volume),
    }
  }

  close = null
}



/**
 * 시장가 주문 Mock
 */
class OrderMarketMock extends AbstractOrderMarket {
  private furtherBids: I.OrderDetailType[] = []
  private furtherAsks: I.OrderDetailType[] = []

  /**
   * 생성자
   * @param bot 
   */
  constructor(private readonly bot: BaseBot) {
    super(bot.code)
  }

  async updateStatus(): Promise<Iu.OrderDetailType> {
    return await this.updateStatusAsk() || await this.updateStatusBid()
  }

  async updateStatusBid(): Promise<Iu.OrderDetailType> {
    if(!this.statusBid) {
      return null
    }
    while(this.furtherBids.length !== 0) {
      this.updateHistory(this.furtherBids.shift())
    }
    return this.statusBid
  }

  async updateStatusAsk(): Promise<Iu.OrderDetailType> {
    if(!this.statusAsk) {
      return null
    }
    while(this.furtherAsks.length !== 0) {
      this.updateHistory(this.furtherAsks.shift())
    }
    return this.statusAsk
  }

  /**
   * 주문 취소
   * @returns 
   */
  cancel() {
    return this.updateStatus()
  }
  cancelWaiting = null

  /**
   * 시장가 매수
   * @param price 이 가격에 매수가 아니라 이 양만큼 매수 한다. 10000이라면 10000KRW 이다.
   * @param err error 콜백
   * @returns 
   */
  async bid(price: number, err?: (err) => void): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status || (status.side === 'bid' && status.state === 'cancel')) {
      try {
        const tr = this.bot.latest(I.ReqType.Trade)
        const volume = price / tr.trade_price
        const uuid = uuidv4()
        const status1: Iu.OrderType = {
          uuid,
          side: 'bid',
          ord_type: 'price',
          price: price,
          state: 'wait',
          market: this.market,
          created_at: format(new Date(tr.timestamp), 'isoDateTime'),
          volume: null,
          remaining_volume: null,
          reserved_fee: floor(price * 0.0005, 8),
          remaining_fee: floor(price * 0.0005, 8),
          paid_fee: 0,
          locked: floor(price + (price * 0.0005), 8),
          executed_volume: 0,
          trades_count: 0,
        }
        this.updateHistory(status1)
        const cb = (tr: I.TradeType) => {
          if(tr.ask_bid === 'ASK') {
            this.furtherBids.push({
              uuid,
              side: 'bid',
              ord_type: 'price',
              price: price,
              state: 'cancel',
              market: this.market,
              created_at: format(new Date(tr.timestamp), 'isoDateTime'),
              volume: null,
              remaining_volume: null,
              reserved_fee: floor(price * 0.0005, 8),
              remaining_fee: 0,
              paid_fee: floor(price * 0.0005, 8),
              locked: 0,
              executed_volume: floor(volume, 8),
              trades_count: 1,
              trades: [
                {
                  market: this.market,
                  uuid: uuidv4(),
                  price: tr.trade_price,
                  volume: floor(volume, 8),
                  funds: floor(tr.trade_price * volume, 4),
                  created_at: format(new Date(tr.timestamp), 'isoDateTime'),
                  side: 'bid',
                },
              ],
            })
            this.removeFurtiveCb(cb)
          }
        }
        this.addFurtiveCb(cb)
        return status1
      } catch(e) {
        return this.processError('bid', e, err)
      }
    } else {
      return status
    }
  }

  /**
   * 시장가 매도
   * @param err error 콜백
   * @returns 
   */
  async ask(err?: (err) => void): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status) {
      return null
    }
    if((status.side === 'bid' && status.state === 'done')
    || (status.side === 'bid' && status.ord_type === 'price' && status.state === 'cancel')
    || (status.side === 'ask' && status.state === 'cancel')) {
      try {
        const tr = this.bot.latest(I.ReqType.Trade)
        const volume = status.executed_volume
        const uuid = uuidv4()
        const status1: Iu.OrderType = {
          uuid,
          side: 'ask',
          ord_type: 'market',
          price: null,
          state: 'wait',
          market: status.market,
          created_at: format(new Date(tr.timestamp), 'isoDateTime'),
          volume: floor(volume, 8),
          remaining_volume: floor(volume, 8),
          reserved_fee: 0,
          remaining_fee: 0,
          paid_fee: 0,
          locked: floor(volume, 8),
          executed_volume: 0,
          trades_count: 0,
        }
        this.updateHistory(status1)
        const cb = (tr: I.TradeType) => {
          if(tr.ask_bid === 'BID') {
            this.furtherAsks.push({
              uuid,
              side: 'ask',
              ord_type: 'market',
              price: null,
              state: 'done',
              market: status.market,
              created_at: format(new Date(tr.timestamp), 'isoDateTime'),
              volume: floor(volume, 8),
              remaining_volume: 0,
              reserved_fee: 0,
              remaining_fee: 0,
              paid_fee: floor(tr.trade_price * volume * 0.0005, 8),
              locked: 0,
              executed_volume: floor(volume, 8),
              trades_count: 1,
              trades: [
                {
                  market: status.market,
                  uuid: uuidv4(),
                  price: tr.trade_price,
                  volume: floor(volume, 8),
                  funds: floor(tr.trade_price * volume, 4),
                  created_at: format(new Date(tr.timestamp), 'isoDateTime'),
                  side: 'ask',
                },
              ],
            })
            this.removeFurtiveCb(cb)
          }
        }
        this.addFurtiveCb(cb)
        return status1
      } catch(e) {
        return this.processError('ask', e, err)
      }
    } else {
      return status
    }
  }

  private addFurtiveCb(cb: (tr: I.TradeType) => void): boolean {
    if(this.bot['_furtiveCbs'].some(cc => cc === cb)) {
      return false
    }
    this.bot['_furtiveCbs'].push(cb)
    return true
  }

  private removeFurtiveCb(cb: (tr: I.TradeType) => void): void {
    this.bot['_furtiveCbs'] = this.bot['_furtiveCbs'].filter(cc => cc !== cb)
  }
}




// export class TradeMock extends BaseBot {
//   constructor(code: string) {
//     super(code)
//   }
// }




// export class CandleMock extends BaseBot {
//   private _ohlcs: {
//     [min: number]: {
//       ohlcs: I.OHLCType[],
//       limit: number,
//     },
//   } = {}

//   constructor(code: string) {
//     super(code)
//   }

//   latest(type: I.ReqType): any {
//     throw new Error('CandleMock에서는 latest()를 허용하지 않는다.')
//   }

//   observer(type: I.EventType.Trade): Observable<I.TradeType>
//   observer(type: I.EventType.Orderbook): Observable<I.OrderbookType>
//   observer(type: I.EventType.Ticker): Observable<I.TickerType>
//   observer(type: I.EventType.Candle, min: 1 | 3 | 5 | 10 | 15 | 30 | 60 | 240, limit: number): Observable<I.OHLCType[]>
//   observer(type: I.EventType.Start): Observable<BaseUPbitSocket>
//   observer(type: I.EventType.Finish): Observable<void>
//   observer(type: I.EventType, ...args: unknown[]): Observable<unknown> {
//     if(!I.EventType.Candle) {
//       throw new Error('CandleMock에서는 I.EventType.Candle 만 허용한다.')
//     }
//     return this._observerB(args[0] as 1|3|5|10|15|30|60|240, args[1] as number)
//   }

//   private _observerB(min: 1|3|5|10|15|30|60|240, limit: number): Observable<I.OHLCType[]> {
//     if(!this._subscribers[min]) {
//       this._subscribers[min] = {
//         observable: new Observable<I.OHLCType[]>(sub => {
//           this._subscribers[min].subscribers.push(sub)
//           return () => {
//             this._subscribers[min].subscribers = 
//               this._subscribers[min].subscribers.filter(s => !s.closed)
//           }
//         }),
//         subscribers: [],
//       }
//       this._ohlcs[min] = {
//         ohlcs: [],
//         limit,
//       }
//     }
//     return this._subscribers[min].observable
//   }
  
//   subscribe(type: I.EventType.Trade, sub: If.Observer<I.TradeType>): If.Subscription
//   subscribe(type: I.EventType.Orderbook, sub: If.Observer<I.OrderbookType>): If.Subscription
//   subscribe(type: I.EventType.Ticker, sub: If.Observer<I.TickerType>): If.Subscription
//   subscribe(type: I.EventType.Start, sub: If.Observer<BaseUPbitSocket>): If.Subscription
//   subscribe(type: I.EventType.Finish, sub: If.Observer<void>): If.Subscription
//   subscribe(type: I.EventType.Candle, opts: { min: 1 | 3 | 5 | 10 | 15 | 30 | 60 | 240; limit: number }, sub: If.Observer<I.OHLCType[]>): If.Subscription
//   subscribe<T>(type: I.EventType, sub: If.Observer<T>): If.Subscription
//   subscribe(type: I.EventType, arg1: any, arg2?: any): If.Subscription {
//     if(!I.EventType.Candle) {
//       throw new Error('CandleMock에서는 I.EventType.Candle 만 허용한다.')
//     }
//     return this._subscribeB(arg1, arg2)
//   }

//   private _subscribeB(opts: {
//     min: 1|3|5|10|15|30|60|240
//     limit: number
//   }, sub: If.Observer<I.OHLCType[]>): If.Subscription {
//     return this._observerB(opts.min, opts.limit).subscribe(sub)
//   }

//   async triggerB(min: 1|3|5|10|15|30|60|240, ohlc: I.OHLCType): Promise<void> {
//     const data = this._ohlcs[min]
//     data.ohlcs.unshift(ohlc)
//     if(data.ohlcs.length > data.limit) {
//       data.ohlcs.pop()
//     }
//     await Promise.all(this._subscribers[min].subscribers.map(sub => sub.next(data.ohlcs)))
//     return
//   }

//   usingEvent(type: I.EventType): boolean {
//     if(type === I.EventType.Trade && this.usingCandle()) {
//       return true
//     }
//     return false
//   }
// }


// export function tradeMock(constructor: Function) {
//   constructor.prototype = TradeMock
//   return constructor as any
// }


// @tradeMock
// class TestBot extends BaseBot {
//   constructor(name: string) {
//     super(name)
//   }
// }