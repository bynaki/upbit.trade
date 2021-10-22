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
} from './utils'
import {
  format,
} from 'fecha'
import { AbstractOrder } from './order'
import {
  toNumber,
  uniq,
} from 'lodash'
import { readyCandle } from './database'
import { OHLCType } from './types'



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

  async open() {
    if(this.getCodes(I.ReqType.Ticker).length !== 0) {
      throw new Error('"mock" 모드에서는 "onTicker()" 를 제공하지 않는다.')
    }
    if(this.getCodes(I.ReqType.Orderbook).length !== 0) {
      throw new Error('"mock" 모드에서는 "onOrderbook()" 을 제공하지 않는다.')
    }
    const bots = this.getBots(I.ReqType.Trade)
    bots.forEach(bot => {
      bot['_furtiveCbs'] = []
    })
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
      bots.forEach(b => b['_furtiveCbs'].forEach(cb => cb(tr)))
      await Promise.all(bots.map(bot => bot.trigger(converted)))
    }
    await this.finish()
  }

  newOrderMarket(bot: BaseBot): AbstractOrderMarket {
    return new OrderMarketMock(bot)
  }

  newOrder(bot: BaseBot): AbstractOrder {
    throw new Error("'UPbitTradeMock' 모드에서는 'newOrder()'를 지원하지 않는다.")
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
  private wraps: {
    [index: string]: {
      [index: number]: ((ohlc: OHLCType) => Promise<void>)[]
    }
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

  async open(): Promise<void> {
    this.wraps = {}
    this.getBots().forEach(bot => {
      if(!this.wraps[bot.code]) {
        this.wraps[bot.code] = {}
      }
      const cbs = bot.getCandleCallbacks()
      cbs.forEach(cb => {
        if(!this.wraps[bot.code][cb.args.minutes]) {
          this.wraps[bot.code][cb.args.minutes] = []
        }
        const ohlcSeq: OHLCType[] = []
        this.wraps[bot.code][cb.args.minutes].push((ohlc: OHLCType): Promise<void> => {
          ohlcSeq.unshift(ohlc)
          if(ohlcSeq.length > cb.args.limit) {
            ohlcSeq.pop()
          }
          const copy: OHLCType[] = []
          ohlcSeq.forEach(o => copy.push(Object.assign({}, o)))
          return bot[cb.callback](copy)
        })
      })
    })
    //
    const comins = uniq(this.getBots().map(bot => bot.getCandleCallbacks()
      .map(cb => `${bot.code}:${cb.args.minutes}`)).flat())
    const table = await readyCandle(this.args.filename, this.args.tableName, {
      comins,
      from: this.args.params.from,
      to: this.args.params.to,
    })
    await this.start()
    for await (const c of table.each()) {
      const converted = this.convertCandleType(c)
      // await Promise.all(this.wraps[c.market][c.unit].map(wrap => () => wrap(converted)))
      await Promise.all(this.wraps[c.market][c.unit].map(wrap => wrap(converted)))
    }
    await this.finish()
  }

  newOrderMarket(bot: BaseBot): AbstractOrderMarket {
    return new OrderMarketMock(bot)
  }

  newOrder(bot: BaseBot): AbstractOrder {
    throw new Error("'UPbitTradeMock' 모드에서는 'newOrder()'를 지원하지 않는다.")
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