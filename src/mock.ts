import {
  BaseUPbitSocket,
  BaseSocketBot,
  AbstractOrderMarket,
  types as I,
  DbTable,
  DbTradeTickType,
  DbCandleMinuteType,
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
} from 'lodash'



export class UPbitTradeMock extends BaseUPbitSocket {
  constructor(private readonly db: DbTable<DbTradeTickType>) {
    super(db.codes)
  }

  async open(): Promise<void> {
    await this.start()
    for await (let tr of this.db.each()) {
      const converted = this.convertTradeType(tr)
      const bots = this.getBots(I.ReqType.Trade, converted.code)
      await Promise.all(bots.map(bot => bot.trigger(converted)))
    }
    this.finish()
  }

  async close(): Promise<boolean> {
    return
  }

  newOrderMarket(bot: BaseSocketBot): AbstractOrderMarket {
    return new OrderMarketMock(bot)
  }

  newOrder(bot: BaseSocketBot): AbstractOrder {
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
}


// export class UPbitCandleMock extends BaseUPbitSocket {
//   constructor(private readonly db: CandleDb) {
//     super(db.codes)
//   }

//   async open(): Promise<void> {
//     this.start()
//     for await (c of this.db.each()) {
//       c
//     }
//     const codes = await this.db.getCodes()
//     for(let code of codes) {
//       const bots = this.getBots(I.ReqType.Trade, code)
//     }
//     this.finish()
//   }
// }



/**
 * 시장가 주문 Mock
 */
class OrderMarketMock extends AbstractOrderMarket {
  /**
   * 생성자
   * @param bot 
   */
  constructor(private readonly bot: BaseSocketBot) {
    super(bot.code)
  }

  async updateStatus(): Promise<Iu.OrderDetailType> {
    return await this.updateStatusAsk() || await this.updateStatusBid()
  }

  async updateStatusBid(): Promise<Iu.OrderDetailType> {
    return this.statusBid
  }

  async updateStatusAsk(): Promise<Iu.OrderDetailType> {
    return this.statusAsk
  }

  /**
   * 주문 취소
   * @returns 
   */
  cancel() {
    return this.updateStatus()
  }
  
  wait = null
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
        const status2: Iu.OrderDetailType = {
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
        }
        this.updateHistory(status1)
        this.updateHistory(status2)
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
        const status2: Iu.OrderDetailType = {
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
        }
        this.updateHistory(status1)
        this.updateHistory(status2)
        return status1
      } catch(e) {
        return this.processError('ask', e, err)
      }
    } else {
      return status
    }
  }
}