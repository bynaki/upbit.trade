import {
  UPbit,
  RequestError,
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  format,
} from 'fecha'
import {
  ceil,
  floorOrderbook,
} from './utils'
import {
  ensureDirSync,
  WriteStream,
  createWriteStream,
} from 'fs-extra'
import {
  dirname,
} from 'path'
import {
  readFile,
} from 'fs/promises'
import * as I from './types'


// export class BalanceError extends Error {
//   constructor(message?: string) {
//     super(message)
//   }
// }

// export class OrderError extends Error {
//   constructor(message?: string) {
//     super(message)
//   }
// }


// export interface IBaseOrder {
//   status: Iu.OrderType
//   updateStatus(): Promise<Iu.OrderDetailType>
//   updateStatusBid(): Promise<Iu.OrderDetailType>
//   updateStatusAsk(): Promise<Iu.OrderDetailType>
//   cancel(): Promise<Iu.OrderType>
// }

// export interface IOrderMarket extends IBaseOrder {
//   bid(params: {
//     market: string
//     price: number
//   }, err?: (err) => void
//   , cb?: (status: Iu.OrderDetailType) => void): Promise<Iu.OrderType>
//   ask(err?: (err) => void
//   , cb?: (status: Iu.OrderDetailType) => void): Promise<Iu.OrderType>
// }

// export interface IOrder extends IBaseOrder {
//   bid(params: {
//     market: string
//     price: number
//     volume: number
//   }, err?: (err) => void
//   , cb?: (status: Iu.OrderDetailType) => void): Promise<Iu.OrderType>
//   ask(price: number
//   , err?: (err) => void
//   , cb?: (status: Iu.OrderDetailType) => void): Promise<Iu.OrderType>
// }


abstract class BaseOrder {
  public static readonly minTotal = 5000

  protected _statusBid: Iu.OrderType = null
  protected _statusAsk: Iu.OrderType = null
  protected _errorBid: any = null
  protected _errorAsk: any = null
  protected _canceling = false

  constructor(protected readonly api: UPbit) {
  }

  get status(): Iu.OrderType {
    return this._statusAsk || this._statusBid
  }

  get statusBid(): Iu.OrderType {
    return this._statusBid
  }

  get statusAsk(): Iu.OrderType {
    return this._statusAsk
  }

  get error(): any {
    return this._errorAsk || this._errorBid
  }

  get errorBid(): any {
    return this._errorBid
  }

  get errorAsk(): any {
    return this._errorAsk
  }

  async updateStatus(): Promise<Iu.OrderDetailType> {
    return await this.updateStatusAsk() || await this.updateStatusBid()
  }

  async updateStatusBid(): Promise<Iu.OrderDetailType> {
    if(!this._statusBid) {
      return null
    }
    this._statusBid = (await this.api.getOrderDetail({uuid: this._statusBid.uuid})).data
    return this._statusBid as Iu.OrderDetailType
  }

  async updateStatusAsk(): Promise<Iu.OrderDetailType> {
    if(!this._statusAsk) {
      return null
    }
    this._statusAsk = (await this.api.getOrderDetail({uuid: this._statusAsk.uuid})).data
    return this._statusAsk as Iu.OrderDetailType
  }

  async cancel(): Promise<Iu.OrderType> {
    if(this._canceling === true) {
      return this.status
    }
    if(!this.status) {
      return null
    }
    this._canceling = true
    try {
      const res = (await this.api.cancel({
        uuid: this.status.uuid
      })).data
      if(this.status.side === 'bid') {
        this._statusBid = res
      } else {
        this._statusAsk = res
      }
      return res
    } catch(e) {
      return null
    }
  }

  protected async suitedBidVol(market: string, volume: number): Promise<number> {
    const chance = (await this.api.getOrdersChance({market})).data
    const min = chance.market.bid.min_total
    const balance = chance.bid_account.balance
    volume = Math.max(volume, min)
    const suit = Math.floor(Math.min(volume, balance) / min) * min
    return suit
  }

  protected async suitedAskVol(market: string, price: number, volume: number): Promise<number> {
    const chance = (await this.api.getOrdersChance({market})).data
    const balance = chance.ask_account.balance
    let suit = Math.min(volume, balance)
    if((balance - suit) < (chance.market.ask.min_total / price)) {
      suit = balance
    }
    return suit
  }

  // protected processError(side: 'bid'|'ask', err: any, errCb: (err) => void) {
  //   if(side === 'bid') {
  //     this._errorBid = err
  //   } else {
  //     this._errorAsk = err
  //   }
  //   if(err instanceof RequestError) {
  //     // 잔고 부족, 최소주문금액
  //     if(err.code === 'insufficient_funds_bid'
  //     || err.code === 'under_min_total_bid'
  //     || err.code === 'insufficient_funds_ask'
  //     || err.code === 'under_min_total_ask') {
  //       return null
  //     }
  //   }
  //   if(errCb) {
  //     errCb(err)
  //   } else {
  //     throw err
  //   }
  //   return null
  // }

  protected processError(side: 'bid'|'ask', err: any, errCb: (err) => void) {
    if(side === 'bid') {
      this._errorBid = err
    } else {
      this._errorAsk = err
    }
    if(errCb) {
      errCb(err)
    } else {
      throw err
    }
    return null
  }

  abstract bid(...args: any[]): Promise<Iu.OrderType>
  abstract ask(...args: any[]): Promise<Iu.OrderType>
}



export class Order extends BaseOrder {
  constructor(api: UPbit) {
    super(api)
  }

  /**
   * 지정가 매수
   * params: {market: 마켓 코드, price: 주문할 가격, volume: 주문량이 아니라 주문할 금액이다. 예를 들어 'KRW-BTC'이고 '10000'이라면 '10000KRW' 금액으로 주문한다.} params
   * @param
   * @returns
   */
  async bid(params: {
    market: string
    price: number
    volume: number
  }, err?: (err) => void): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status || (status.side === 'bid' && status.ord_type === 'limit' && status.state === 'cancel')) {
      try {
        const price = floorOrderbook(params.price)
        const volume = await this.suitedBidVol(params.market, params.volume)
        const orderParams: Iu.OrderLimitParam = {
          market: params.market,
          side: 'bid',
          ord_type: 'limit',
          price,
          volume: ceil(volume / price, 8),
        }
        this._statusBid = (await this.api.order(orderParams)).data
        this._canceling = false
        return this._statusBid
      } catch(e) {
        return this.processError('bid', e, err)
      }
    } else {
      return status
    }
  }

  async ask(params: {
    price: number
  }, err?: (err) => void) {
    const status = await this.updateStatus()
    if(!status) {
      return null
    }
    if((status.side === 'bid' && status.state === 'done')
    || (status.side === 'bid' && status.ord_type === 'price' && status.state === 'cancel')
    || (status.side === 'ask' && status.state === 'cancel')) {
      try {
        const price = floorOrderbook(params.price)
        const volume = await this.suitedAskVol(status.market, price, this.statusBid.executed_volume)
        const orderParams: Iu.OrderLimitParam = {
          market: status.market,
          side: 'ask',
          ord_type: 'limit',
          price: price,
          volume,
        }
        this._statusAsk = (await this.api.order(orderParams)).data
        this._canceling = false
        return this._statusAsk
      } catch(e) {
        return this.processError('bid', e, err)
      }
    } else {
      return status
    }
  }
}



export class OrderMarket extends BaseOrder {
  constructor(api: UPbit) {
    super(api)
  }

  /**
   * 시장가 매수
   * params: {market: 마켓코드, price: 이 가격에 매수가 아니라 이 양만큼 매수 한다. 10000이라면 10000KRW 이다. }
   * @param params 
   * @returns 
   */
  async bid(params: {
    market: string
    price: number
  }, err?: (err) => void
  , cb?: (status: Iu.OrderDetailType) => void): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(status && status.side === 'bid') {
      if(status.state === 'wait' || status.state === 'done') {
        return status
      }
      if(status.ord_type === 'price' && status.state === 'cancel') {
        return status
      }
    }
    if(status && status.side === 'ask' && status.state === 'wait') {
      return this.cancel()
    }
    try {
      const price = await this.suitedBidVol(params.market, params.price)
      const orderParams: Iu.OrderPriceParam = {
        market: params.market,
        side: 'bid',
        ord_type: 'price',
        price,
      }
      this._statusBid = (await this.api.order(orderParams)).data
      if(cb) {
        let count = 0
        const id = setInterval(async () => {
          if(count++ >= 5) {
            clearInterval(id)
            return
          }
          const status = await this.updateStatusBid()
          if(status.state !== 'wait') {
            cb(status)
            clearInterval(id)
          }
        }, 1000)
      }
      this._canceling = false
      return this._statusBid
    } catch(e) {
      return this.processError('bid', e, err)
    }
  }

  async ask(
    err?: (err) => void
    , cb?: (status: Iu.OrderDetailType) => void
  ): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status) {
      return null
    }
    if((status.side === 'bid' && status.state === 'done')
    || (status.side === 'bid' && status.ord_type === 'price' && status.state === 'cancel')
    || (status.side === 'ask' && status.state === 'cancel')) {
      try {
        const price = (await this.api.getOrderbook({markets: ['KRW-BTC']})).data[0].orderbook_units[0].bid_price
        const volume = await this.suitedAskVol(status.market, price, status.executed_volume)
        const params: Iu.OrderMarketParam = {
          market: status.market,
          side: 'ask',
          ord_type: 'market',
          volume,
        }
        this._statusAsk = (await this.api.order(params)).data
        if(cb) {
          let count = 0
          const id = setInterval(async () => {
            if(count++ >= 5) {
              clearInterval(id)
              return
            }
            const status = await this.updateStatusAsk()
            if(status.state !== 'wait') {
              cb(status)
              clearInterval(id)
            }
          }, 1000)
        }
        this._canceling = false
        return this._statusAsk
      } catch(e) {
        return this.processError('bid', e, err)
      }
    } else {
      return status
    }
  }
}



export class OrderHistory<C> {
  private _stream: WriteStream

  constructor(public readonly path: string) {
    const dir = dirname(path)
    ensureDirSync(dir)
    this._stream = createWriteStream(path, {
      flags: 'a',
    })
  }

  append(order: BaseOrder, comment?: C): Promise<I.HistoryType<C>>  {
    const t = new Date()
    const contents = {
      time_stamp: t.getTime(),
      time: format(t, 'isoDateTime'),
      comment,
      bid: order.statusBid as Iu.OrderDetailType,
      bid_error: order.errorBid,
      ask: order.statusAsk as Iu.OrderDetailType,
      ask_error: order.errorAsk,
    }
    const stringify = '\n\n' + JSON.stringify(contents, null, 2)
    return new Promise((resolve, reject) => {
      this._stream.write(stringify, err => {
        if(err) {
          reject(err)
          return
        }
        resolve(contents)
      })
    })
  }

  async read(): Promise<I.HistoryType<C>[]> {
    const stringify = (await readFile(this.path)).toString()
    const splited = stringify.split('\n\n')
    splited.splice(0, 1)
    return splited.map(h => JSON.parse(h))
  }
}



// export class OrderMock implements IOrder {
//   private _statusBid: Iu.OrderDetailType = null
//   private _statusAsk: Iu.OrderDetailType = null

//   constructor(private readonly api: UPbit) {
//   }

//   private _status<T>(): T {
//     return (this._statusAsk || this._statusBid) as any
//   }

//   get status(): Iu.OrderType {
//     return this._statusAsk || this._statusBid
//   }

//   async updateStatus(): Promise<Iu.OrderDetailType> {
//     return await this.updateStatusAsk() || await this.updateStatusBid()
//   }

//   async updateStatusBid(): Promise<Iu.OrderDetailType> {
//     return this._statusBid
//   }

//   async updateStatusAsk(): Promise<Iu.OrderDetailType> {
//     return this._statusAsk
//   }

//   async cancel() {
//     return this.updateStatus()
//   }

//   async bidMarket(params: {
//     market: string
//     price: number
//   }): Promise<Iu.OrderType> {
//     if(this.status) {
//       const status = await this.updateStatus()
//       if(!(status.side === 'bid' && status.ord_type === 'limit' && status.state === 'cancel')) {
//         throw new OrderError(`bid 할 수 있는 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
//       }
//     }
//     const tick = (await this.api.getTradesTicks({market: params.market})).data[0]
//     const price = await this.suitedBidVol(params.market, params.price)
//     const volume = price / tick.trade_price
//     const uuid = uuidv4()
//     this._statusBid = {
//       uuid,
//       side: 'bid',
//       ord_type: 'price',
//       price: price,
//       state: 'cancel',
//       market: params.market,
//       created_at: format(new Date(tick.timestamp), 'isoDateTime'),
//       volume: null,
//       remaining_volume: null,
//       reserved_fee: floor(price * 0.0005, 8),
//       remaining_fee: 0,
//       paid_fee: floor(price * 0.0005, 8),
//       locked: 0,
//       executed_volume: floor(volume, 8),
//       trades_count: 1,
//       trades: [
//         {
//           market: params.market,
//           uuid: uuidv4(),
//           price: tick.trade_price,
//           volume: floor(volume, 8),
//           funds: floor(tick.trade_price * volume, 4),
//           created_at: format(new Date(tick.timestamp), 'isoDateTime'),
//           side: 'bid',
//         },
//       ],
//     }
//     return {
//       uuid,
//       side: 'bid',
//       ord_type: 'price',
//       price: price,
//       state: 'wait',
//       market: params.market,
//       created_at: format(new Date(tick.timestamp), 'isoDateTime'),
//       volume: null,
//       remaining_volume: null,
//       reserved_fee: floor(params.price * 0.0005, 8),
//       remaining_fee: floor(params.price * 0.0005, 8),
//       paid_fee: 0,
//       locked: floor(params.price + (params.price * 0.0005), 8),
//       executed_volume: 0,
//       trades_count: 0,
//     }
//   }

//   async askMarket(): Promise<Iu.OrderType> {
//     const status = await this.updateStatus()
//     if(!status) {
//       throw new OrderError('아직 bid 하지 않았다.')
//     }
//     if(status.side === 'bid') {
//       if(status.ord_type === 'limit') {
//         if(status.state !== 'done') {
//           throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
//         }
//       } else if(status.ord_type === 'price') {
//         if(status.state !== 'cancel') {
//           throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
//         }
//       }
//     }
//     if(status.side === 'ask') {
//       if(!(status.ord_type === 'limit' && status.state === 'cancel')) {
//         throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
//       }
//     }
//     const tick = (await this.api.getTradesTicks({ market: status.market })).data[0]
//     const volume = status.executed_volume
//     const uuid = uuidv4()
//     this._statusAsk = {
//       uuid,
//       side: 'ask',
//       ord_type: 'market',
//       price: null,
//       state: 'done',
//       market: status.market,
//       created_at: format(new Date(tick.timestamp), 'isoDateTime'),
//       volume: floor(volume, 8),
//       remaining_volume: 0,
//       reserved_fee: 0,
//       remaining_fee: 0,
//       paid_fee: floor(tick.trade_price * volume * 0.0005, 8),
//       locked: 0,
//       executed_volume: floor(volume, 8),
//       trades_count: 1,
//       trades: [
//         {
//           market: status.market,
//           uuid: uuidv4(),
//           price: tick.trade_price,
//           volume: floor(volume, 8),
//           funds: floor(tick.trade_price * volume, 4),
//           created_at: format(new Date(tick.timestamp), 'isoDateTime'),
//           side: 'ask',
//         },
//       ],
//     }
//     return {
//       uuid,
//       side: 'ask',
//       ord_type: 'market',
//       price: null,
//       state: 'wait',
//       market: status.market,
//       created_at: format(new Date(tick.timestamp), 'isoDateTime'),
//       volume: floor(volume, 8),
//       remaining_volume: floor(volume, 8),
//       reserved_fee: 0,
//       remaining_fee: 0,
//       paid_fee: 0,
//       locked: floor(volume, 8),
//       executed_volume: 0,
//       trades_count: 0,
//     }
//   }

//   private async suitedBidVol(market: string, volume: number): Promise<number> {
//     const chance = (await this.api.getOrdersChance({market})).data
//     const min = chance.market.bid.min_total
//     if(volume < min) {
//       throw new OrderError(`주문금액이 최소주문금액 보다 적다. (volume: ${volume}, min: ${min})`)
//     }
//     const suit = Math.floor(volume / min) * min
//     return suit
//   }

//   private async suitedAskVol(market: string, price: number, volume: number): Promise<number> {
//     const chance = (await this.api.getOrdersChance({market})).data
//     const min = chance.market.ask.min_total
//     const minVol = floor(min / price, 8)
//     const suit = Math.max(volume, minVol)
//     return suit
//   }
// }
