import {
  BaseUPbitSocket,
  BaseBot,
  types as I,
  DbTradeTickType,
  DbCandleMinuteType,
  readyTrade,
} from './'
import { v4 as uuidv4 } from 'uuid'
import {
  floor,
  toNumber,
  remove,
  uniq,
} from 'lodash'
import {
  format,
} from 'fecha'
import {
  readyCandle,
} from './database'
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

  protected newAPI(market: string): I.WrapAPI {
    return new TradeMockAPI(market)
  }

  async open() {
    if(this.getCodes(I.ReqType.Ticker).length !== 0) {
      throw new Error('"mock" 모드에서는 "ticker" 를 제공하지 않는다.')
    }
    if(this.getCodes(I.ReqType.Orderbook).length !== 0) {
      throw new Error('"mock" 모드에서는 "orderbook" 을 제공하지 않는다.')
    }
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
      await Promise.all(bots.map(bot => bot['trigger'](converted)))
    }
    await this.finish()
  }

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

  protected newAPI(market: string): I.WrapAPI {
    return new CandleMockAPI(market)
  }

  addBot<B extends BaseBot>(...bots: B[]): void {
    bots.forEach(bot => {
      const data: {
        [min: number]: {
          id: string
          ohlcs: I.OHLCType[]
          limit: number
        }[]
      } = {}
      const pt = /(\d+):(\d+)/
      Object.keys(bot.candleSubers).forEach(id => {
        const res = pt.exec(id)
        const min = Number.parseInt(res[1])
        const limit = Number.parseInt(res[2])
        if(!data[min]) {
          data[min] = []
        }
        data[min].push({
          id,
          ohlcs: [],
          limit,
        })
      })
      const api = this.getAPI(bot.code)
      bot['triggerB'] = async function(min: 1|3|5|10|15|30|60|240, ohlc: I.OHLCType): Promise<void> {
        await api.setCandle(ohlc)
        const dd = data[min]
        await Promise.all(dd.map(d => {
          d.ohlcs.unshift(ohlc)
          if(d.ohlcs.length > d.limit) {
            d.ohlcs.pop()
          }
          return this._candleSubers[d.id].subscribers.map(sub => sub.next(d.ohlcs))
        }).flat())
        return
      }
    })
    super.addBot(...bots)
  }

  async open(): Promise<void> {
    const bots = this.getBots()
    const keys = ['1', '3', '5', '10', '15', '30', '60', '240']
    // const comins = bots.map(bot => {
    //   return keys.filter(key => bot.subscribers[key]).map(min => `${bot.code}:${min}`)
    // }).flat()
    const pt = /(\d+):(\d+)/
    const comins = uniq(bots.map(bot => {
      const ids = Object.keys(bot.candleSubers)
      return ids.map(id => pt.exec(id)[1]).map(min => `${bot.code}:${min}`)
    }).flat())
    const table = await readyCandle(this.args.filename, this.args.tableName, {
      comins,
      from: this.args.params.from,
      to: this.args.params.to,
    })
    await this.start()
    for await (const c of table.each()) {
      const converted = this.convertCandleType(c)
      const ps = this.getBots(I.ReqType.Trade, c.market).map(bot => {
        return bot['triggerB'](c.unit as 1|3|5|10|15|30|60|240, converted)
      })
      await Promise.all(ps)
    }
    await this.finish()
  }

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



type Subscribers<T> = {
  observable: Observable<T>
  subscribers: If.SubscriptionObserver<T>[]
}

abstract class BaseMockAPI implements I.WrapAPI {
  private _orders: {[uuid: string]: I.OrderDetailType} = {}
  private _waitings: I.OrderDetailType[] = []
  protected _subscribers: {
    ['BID']?: Subscribers<number>
    ['ASK']?: Subscribers<number>
    ['BOTH']?: Subscribers<number>
  } = {}

  constructor(public readonly market: string) {
  }

  abstract getPrice(bid_ask?: 'BID'|'ASK'): number
  abstract getTime(bid_ask?: 'BID'|'ASK'): number

  // 지정가 매수
  protected _makeBid(price: number, time: number) {
    const status: I.OrderDetailType[] = this._waitings.filter(
      o => o.ord_type === 'limit' && o.side === 'bid' && o.state === 'wait')
    .filter(o => o.price >= price)
    .map((o): I.OrderDetailType => {
      return {
        uuid: o.uuid,
        side: 'bid',
        ord_type: 'limit',
        price: o.price,
        state: 'done',
        market: o.market,
        created_at: o.created_at,
        volume: o.volume,
        remaining_volume: 0,
        reserved_fee: o.reserved_fee,
        remaining_fee: 0,
        paid_fee: o.reserved_fee,
        locked: 0,
        executed_volume: o.volume,
        trades_count: 1,
        trades: [
          {
            market: o.market,
            uuid: uuidv4(),
            price: o.price,
            volume: o.volume,
            funds: floor(o.price * o.volume, 5),
            trend: null,
            created_at: format(new Date(time), 'isoDateTime'),
            side: 'bid',
          },
        ],
      }
    })
    this._waitings.push(...status)
  }

  protected _makeAsk(price: number, time: number) {
    const status: I.OrderDetailType[] = this._waitings.filter(
      o => o.side === 'ask' && o.ord_type === 'limit' && o.state === 'wait')
    .filter(o => o.price <= price)
    .map(o => {
      return {
        uuid: o.uuid,
        side: 'ask',
        ord_type: 'limit',
        price: o.price,
        state: 'done',
        market: o.market,
        created_at: o.created_at,
        volume: o.volume,
        remaining_volume: 0,
        reserved_fee: 0,
        remaining_fee: 0,
        paid_fee: floor(o.price * o.volume * 0.0005, 8),
        locked: 0,
        executed_volume: o.volume,
        trades_count: 1,
        trades: [
          {
            market: o.market,
            uuid: uuidv4(),
            price: o.price,
            volume: o.volume,
            funds: floor(o.price * o.volume, 5),
            trend: null,
            created_at: format(new Date(time), 'isoDateTime'),
            side: 'ask',
          },
        ],
      }
    })
    this._waitings.push(...status)
  }

  // 시장가 매수
  protected _takeBid(price: number, time: number) {
    const status: I.OrderDetailType[] = this._waitings.filter(
      o => o.ord_type === 'price' && o.side === 'bid' && o.state === 'wait')
    .map(o => {
      const volume = o.price / price
      return {
        uuid: o.uuid,
        side: 'bid',
        ord_type: 'price',
        price: o.price,
        state: 'cancel',
        market: o.market,
        created_at: o.created_at,
        volume: null,
        remaining_volume: null,
        reserved_fee: floor(o.price * 0.0005, 8),
        remaining_fee: 0,
        paid_fee: floor(o.price * 0.0005, 8),
        locked: 0,
        executed_volume: floor(volume, 8),
        trades_count: 1,
        trades: [
          {
            market: o.market,
            uuid: uuidv4(),
            price,
            volume: floor(volume, 8),
            funds: floor(price * volume, 4),
            trend: null,
            created_at: format(new Date(time), 'isoDateTime'),
            side: 'bid',
          },
        ],
      }
    })
    this._waitings.push(...status)
  }

  // 시장가 매도
  protected _takeAsk(price: number, time: number) {
    const status: I.OrderDetailType[] = this._waitings.filter(
      o => o.ord_type === 'market' && o.side === 'ask' && o.state === 'wait')
    .map(o => {
      return {
        uuid: o.uuid,
        side: 'ask',
        ord_type: 'market',
        price: null,
        state: 'done',
        market: o.market,
        created_at: o.created_at,
        volume: o.volume,
        remaining_volume: 0,
        reserved_fee: 0,
        remaining_fee: 0,
        paid_fee: floor(price * o.volume * 0.0005, 8),
        locked: 0,
        executed_volume: o.volume,
        trades_count: 1,
        trades: [
          {
            market: o.market,
            uuid: uuidv4(),
            price: price,
            volume: o.volume,
            funds: floor(price * o.volume, 5),
            trend: null,
            created_at: format(new Date(time), 'isoDateTime'),
            side: 'ask',
          },
        ],
      }
    })
    this._waitings.push(...status)
  }

  async getOrderDetail(uuid: string): Promise<I.OrderDetailType> {
    const ws = this._waitings.filter(o => o.uuid === uuid)
    if(ws.length !== 0) {
      this._orders[uuid] = ws[ws.length - 1]
      remove(this._waitings, o => o.uuid === uuid)
    }
    return this._orders[uuid]
  }

  async getOrdersChance(): Promise<I.OrderChanceType> {
    const res = /^([A-Z]{3,3})-([A-Z]{3,3})$/.exec(this.market)
    const bidAcc = res[1]
    const askAcc = res[2]
    return {
      bid_fee: 0.0005,
      ask_fee: 0.0005,
      maker_bid_fee: 0.0005,
      maker_ask_fee: 0.0005,
      market: {
        id: this.market,
        name: `${askAcc}/${bidAcc}`,
        order_types: [ 'limit' ],
        order_sides: [ 'ask', 'bid' ],
        bid: { currency: bidAcc, min_total: 5000 },
        ask: { currency: askAcc, min_total: 5000 },
        max_total: 1000000000,
        state: 'active'
      },
      bid_account: {
        currency: bidAcc,
        balance: 99999999999,
        locked: 0,
        avg_buy_price: 0,
        avg_buy_price_modified: true,
        unit_currency: 'KRW'
      },
      ask_account: {
        currency: askAcc,
        balance: 99999999999,
        locked: 0,
        avg_buy_price: 0,
        avg_buy_price_modified: false,
        unit_currency: 'KRW'
      }
    }
  }

  async order(params: I.OrderLimitParam | I.OrderPriceParam | I.OrderMarketParam): Promise<I.OrderType> {
    switch(params.ord_type) {
      case 'limit': {
        if(params.side === 'bid') {
          const krw = params.price * params.volume
          const status: I.OrderType = {
            uuid: uuidv4(),
            side: 'bid',
            ord_type: 'limit',
            price: params.price,
            state: 'wait',
            market: params.market,
            created_at: format(new Date(this.getTime()), 'isoDateTime'),
            volume: params.volume,
            remaining_volume: params.volume,
            reserved_fee: floor(krw * 0.0005, 8),
            remaining_fee: floor(krw * 0.0005, 8),
            paid_fee: 0,
            locked: floor(krw + (krw * 0.0005), 8),
            executed_volume: 0,
            trades_count: 0,
          }
          const detail: I.OrderDetailType = Object.assign({}, status, {trades: []}) as any
          this._waitings.push(detail)
          return status
        }
        if(params.side === 'ask') {
          const status: I.OrderType = {
            uuid: uuidv4(),
            side: 'ask',
            ord_type: 'limit',
            price: params.price,
            state: 'wait',
            market: params.market,
            created_at: format(new Date(this.getTime()), 'isoDateTime'),
            volume: params.volume,
            remaining_volume: params.volume,
            reserved_fee: 0,
            remaining_fee: 0,
            paid_fee: 0,
            locked: params.volume,
            executed_volume: 0,
            trades_count: 0,
          }
          const detail: I.OrderDetailType = Object.assign({}, status, {trades: []}) as any
          this._waitings.push(detail)
          return status
        }
      }
      case 'price': {
        const status: I.OrderType = {
          uuid: uuidv4(),
          side: params.side,
          ord_type: 'price',
          price: params.price,
          state: 'wait',
          market: this.market,
          created_at: format(new Date(this.getTime()), 'isoDateTime'),
          volume: null,
          remaining_volume: null,
          reserved_fee: floor(params.price * 0.0005, 8),
          remaining_fee: floor(params.price * 0.0005, 8),
          paid_fee: 0,
          locked: floor(params.price + (params.price * 0.0005), 8),
          executed_volume: 0,
          trades_count: 0,
        }
        const detail: I.OrderDetailType = Object.assign({}, status, {trades: []}) as any
        this._waitings.push(detail)
        return status
      }
      case 'market': {
        const status: I.OrderType = {
          uuid: uuidv4(),
          side: params.side,
          ord_type: 'market',
          price: null,
          state: 'wait',
          market: this.market,
          created_at: format(new Date(this.getTime()), 'isoDateTime'),
          volume: floor(params.volume, 8),
          remaining_volume: floor(params.volume, 8),
          reserved_fee: 0,
          remaining_fee: 0,
          paid_fee: 0,
          locked: floor(params.volume, 8),
          executed_volume: 0,
          trades_count: 0,
        }
        const detail: I.OrderDetailType = Object.assign({}, status, {trades: []}) as any
        this._waitings.push(detail)
        return status
      }
    }
  }

  async cancel(uuid: string): Promise<I.OrderType> {
    const s = await this.getOrderDetail(uuid)
    if(s.ord_type === 'price' || s.ord_type === 'market') {
      throw new Error('시장가 매매는 취소할 수 없다.')
    }
    if(s.state !== 'wait') {
      throw new Error('매매를 취소 할 수 있는 상태가 아니다.')
    }
    this._waitings = this._waitings.filter(s => !((s.uuid === uuid) && (s.state === 'done')))
    this._waitings.push(Object.assign({}, s, {
      state: 'cancel',
    }))
    return s as any
  }

  observer(bid_ask?: 'BID'|'ASK'|'BOTH'): Observable<number> {
    if(!bid_ask) {
      bid_ask = 'BOTH'
    }
    if(!this._subscribers[bid_ask]) {
      this._subscribers[bid_ask] = {
        observable: new Observable<number>(sub => {
          this._subscribers[bid_ask].subscribers.push(sub)
          return () => {
            this._subscribers[bid_ask].subscribers = 
              this._subscribers[bid_ask].subscribers.filter(s => !s.closed)
          }
        }),
        subscribers: [],
      }
    }
    return this._subscribers[bid_ask].observable
  }

  setTrade(tr: I.TradeType): Promise<void> {
    return
  }

  setCandle(ohlc: I.OHLCType): Promise<void> {
    return
  }
}



class TradeMockAPI extends BaseMockAPI {
  private _trs: {
    BID?: I.TradeType
    ASK?: I.TradeType
  } = {}

  constructor(market: string) {
    super(market)
  }

  async setTrade(tr: I.TradeType): Promise<void> {
    switch(tr.ask_bid) {
      case 'BID': {
        this._makeBid(tr.trade_price, tr.trade_timestamp)
        this._takeAsk(tr.trade_price, tr.trade_timestamp)
        break
      }
      case 'ASK': {
        this._makeAsk(tr.trade_price, tr.trade_timestamp)
        this._takeBid(tr.trade_price, tr.trade_timestamp)
        break
      }
      default: {
        throw new Error('"BID"도 "ASK"도 아니다.')
      }
    }
    this._trs[tr.ask_bid] = tr
    if(this._subscribers[tr.ask_bid]) {
      await Promise.all(this._subscribers[tr.ask_bid].subscribers.map(sub => sub.next(tr.trade_price)))
    }
  }

  getPrice(bid_ask?: 'BID'|'ASK'): number {
    if(!bid_ask) {
      bid_ask = this._initBidAsk()
    }
    if(!this._trs[bid_ask]) {
      throw new Error('아직 "price"가 없다.')
    }
    return this._trs[bid_ask].trade_price
  }

  getTime(bid_ask?: 'BID'|'ASK'): number {
    if(!bid_ask) {
      bid_ask = this._initBidAsk()
    }
    if(!this._trs[bid_ask]) {
      throw new Error('아직 "price"가 없다.')
    }
    return this._trs[bid_ask].trade_timestamp
  }

  private _initBidAsk(): 'BID'|'ASK' {
    if(this._trs['BID'] && this._trs['ASK']) {
      if(this._trs['BID'].sequential_id > this._trs['ASK'].sequential_id) {
        return 'BID'
      }
      return 'ASK'
    }
    if(this._trs['BID']) {
      return 'BID'
    }
    if(this._trs['ASK']) {
      return 'ASK'
    }
    throw new Error('아직 "price"가 없다.')
  }

}



class CandleMockAPI extends BaseMockAPI {
  private _ohlc: I.OHLCType

  constructor(market: string) {
    super(market)
  }

  async setCandle(ohlc: I.OHLCType): Promise<void> {
    // this._makeBid(ohlc.low, ohlc.timestamp)
    // this._makeAsk(ohlc.high, ohlc.timestamp)
    this._makeBid(ohlc.close, ohlc.timestamp)
    this._makeAsk(ohlc.close, ohlc.timestamp)
    this._takeBid(ohlc.close, ohlc.timestamp)
    this._takeAsk(ohlc.close, ohlc.timestamp)
    this._ohlc = ohlc
    if(this._subscribers[ohlc.close]) {
      await Promise.all(this._subscribers['BOTH'].subscribers.map(sub => sub.next(ohlc.close)))
    }
  }

  getPrice(bid_ask?: 'BID'|'ASK'): number {
    if(!this._ohlc) {
      throw new Error('아직 "price"가 없다')
    }
    return this._ohlc.close
  }

  getTime(bid_ask?: 'BID'|'ASK'): number {
    if(!this._ohlc) {
      throw new Error('아직 "time"이 없다.')
    }
    return this._ohlc.timestamp
  }

  observer(bid_ask?: 'BID'|'ASK'|'BOTH'): Observable<number> {
    return super.observer('BOTH')
  }
}