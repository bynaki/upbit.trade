import {
  UPbit,
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  v4 as uuidv4,
} from 'uuid'
import {
  format,
} from 'fecha'
import {
  floor,
  ceil,
  floorOrderbook,
} from './utils'


export class BalanceError extends Error {
  constructor(message?: string) {
    super(message)
  }
}

export class OrderError extends Error {
  constructor(message?: string) {
    super(message)
  }
}


export interface IOrder {
  status: Iu.OrderType
  updateStatus(): Promise<Iu.OrderDetailType>
  statusBid(): Promise<Iu.OrderDetailType>
  statusAsk(): Promise<Iu.OrderDetailType>
  cancel(): Promise<Iu.OrderType>
  // bid(params: {
  //   market: string
  //   price: number
  //   volume: number
  // }): Promise<Iu.OrderType>
  // ask(price: number)
  bidMarket(params: {
    market: string
    price: number
  }): Promise<Iu.OrderType>
  askMarket(): Promise<Iu.OrderType>
}


export class Order implements IOrder {
  private _statusBid: Iu.OrderType = null
  private _statusAsk: Iu.OrderType = null

  constructor(private readonly api: UPbit) {
  }

  get status(): Iu.OrderType {
    return this._statusAsk || this._statusBid
  }

  async updateStatus(): Promise<Iu.OrderDetailType> {
    return await this.statusAsk() || await this.statusBid()
  }

  async statusBid(): Promise<Iu.OrderDetailType> {
    if(!this._statusBid) {
      return null
    }
    const res = (await this.api.getOrderDetail({
      uuid: this._statusBid.uuid
    })).data
    this._statusBid = res
    return res
  }

  async statusAsk(): Promise<Iu.OrderDetailType> {
    if(!this._statusAsk) {
      return null
    }
    const res = (await this.api.getOrderDetail({
      uuid: this._statusAsk.uuid
    })).data
    this._statusBid = res
    return res
  }

  async cancel(): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status) {
      throw new OrderError('매수/매도가 없다.')
    }
    // if(status.state !== 'wait') {
    //   throw new OrderError(`cancel 할 수 있는 상태가 아니다. (side: ${this.status.side}, ord_type: ${this.status.ord_type}, state: ${this.status.state})`)
    // }
    const res = (await this.api.cancel({
      uuid: status.uuid
    })).data
    if(status.side === 'bid') {
      this._statusBid = res
    } else {
      this._statusAsk = res
    }
    return res
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
  }): Promise<Iu.OrderType> {
    if(this.status) {
      const status = await this.updateStatus()
      if(!(status.side === 'bid' && status.ord_type === 'limit' && status.state === 'cancel')) {
        throw new OrderError(`bid 할 수 있는 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
      }
    }
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
    return this._statusBid
  }

  async ask(price: number) {
    const status = await this.updateStatus()
    if(!status) {
      throw new OrderError('아직 bid 하지 않았다.')
    }
    if(status.side === 'bid') {
      if(status.ord_type === 'limit') {
        if(status.state !== 'done') {
          throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
        }
      } else if(status.ord_type === 'price') {
        if(status.state !== 'cancel') {
          throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
        }
      }
    }
    if(status.side === 'ask') {
      if(!(status.ord_type === 'limit' && status.state === 'cancel')) {
        throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
      }
    }
    price = floorOrderbook(price)
    const volume = await this.suitedAskVol(status.market
      , price
      , (await this.statusBid()).executed_volume)
    const params: Iu.OrderLimitParam = {
      market: status.market,
      side: 'ask',
      ord_type: 'limit',
      price: price,
      volume: ceil(volume, 8),
    }
    this._statusAsk = (await this.api.order(params)).data
    return this._statusAsk
  }

  /**
   * 시장가 매수
   * params: {market: 마켓코드, price: 이 가격에 매수가 아니라 이 양만큼 매수 한다. 10000이라면 10000KRW 이다. }
   * @param params 
   * @returns 
   */
  async bidMarket(params: {
    market: string
    price: number
  }): Promise<Iu.OrderType> {
    if(this.status) {
      const status = await this.updateStatus()
      if(!(status.side === 'bid' && status.ord_type === 'limit' && status.state === 'cancel')) {
        throw new OrderError(`bid 할 수 있는 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
      }
    }
    const price = await this.suitedBidVol(params.market, params.price)
    const orderParams: Iu.OrderPriceParam = {
      market: params.market,
      side: 'bid',
      ord_type: 'price',
      price,
    }
    this._statusBid = (await this.api.order(orderParams)).data
    return this._statusBid
  }

  async askMarket(): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status) {
      throw new OrderError('아직 bid 하지 않았다.')
    }
    if(status.side === 'bid') {
      if(status.ord_type === 'limit') {
        if(status.state !== 'done') {
          throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
        }
      } else if(status.ord_type === 'price') {
        if(status.state !== 'cancel') {
          throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
        }
      }
    }
    if(status.side === 'ask') {
      if(!(status.ord_type === 'limit' && status.state === 'cancel')) {
        throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
      }
    }
    const trade = (await this.api.getTradesTicks({ market: status.market })).data[0]
    const volume = await this.suitedAskVol(status.market
      , trade.trade_price
      , status.executed_volume)
    const params: Iu.OrderMarketParam = {
      market: status.market,
      side: 'ask',
      ord_type: 'market',
      volume: ceil(volume, 8),
    }
    this._statusAsk = (await this.api.order(params)).data
    return this._statusAsk
  }

  private async suitedBidVol(market: string, volume: number): Promise<number> {
    const chance = (await this.api.getOrdersChance({market})).data
    const fee = chance.bid_fee
    const min = chance.market.bid.min_total
    const balance = chance.bid_account.balance
    if(volume < min) {
      throw new OrderError(`주문금액이 최소주문금액 보다 적다. (volume: ${volume}, min: ${min})`)
    }
    if(balance < min + (min * fee)) {
      throw new BalanceError(`금액이 최소주문금액 보다 부족하다. (balance: ${balance}, min: ${min}, fee: ${fee})`)
    }
    const suit = Math.floor(Math.min(volume, balance) / min) * min
    return suit
  }

  private async suitedAskVol(market: string, price: number, volume: number): Promise<number> {
    const chance = (await this.api.getOrdersChance({market})).data
    const min = chance.market.ask.min_total
    const balance = chance.ask_account.balance
    const minVol = ceil(min / price, 8)
    if(balance < minVol) {
      throw new BalanceError(`Balance가 최소주문량 보다 적자. (balance: ${balance}, minVol: ${minVol})`)
    }
    const suit = Math.max(volume, minVol)
    return suit
  }
}


export class OrderMock implements IOrder {
  private _statusBid: Iu.OrderDetailType = null
  private _statusAsk: Iu.OrderDetailType = null

  constructor(private readonly api: UPbit) {
  }

  private _status<T>(): T {
    return (this._statusAsk || this._statusBid) as any
  }

  get status(): Iu.OrderType {
    return this._statusAsk || this._statusBid
  }

  async updateStatus(): Promise<Iu.OrderDetailType> {
    return await this.statusAsk() || await this.statusBid()
  }

  async statusBid(): Promise<Iu.OrderDetailType> {
    return this._statusBid
  }

  async statusAsk(): Promise<Iu.OrderDetailType> {
    return this._statusAsk
  }

  async cancel() {
    return this.updateStatus()
  }

  async bidMarket(params: {
    market: string
    price: number
  }): Promise<Iu.OrderType> {
    if(this.status) {
      const status = await this.updateStatus()
      if(!(status.side === 'bid' && status.ord_type === 'limit' && status.state === 'cancel')) {
        throw new OrderError(`bid 할 수 있는 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
      }
    }
    const tick = (await this.api.getTradesTicks({market: params.market})).data[0]
    const price = await this.suitedBidVol(params.market, params.price)
    const volume = price / tick.trade_price
    const uuid = uuidv4()
    this._statusBid = {
      uuid,
      side: 'bid',
      ord_type: 'price',
      price: price,
      state: 'cancel',
      market: params.market,
      created_at: format(new Date(tick.timestamp), 'isoDateTime'),
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
          market: params.market,
          uuid: uuidv4(),
          price: tick.trade_price,
          volume: floor(volume, 8),
          funds: floor(tick.trade_price * volume, 4),
          created_at: format(new Date(tick.timestamp), 'isoDateTime'),
          side: 'bid',
        },
      ],
    }
    return {
      uuid,
      side: 'bid',
      ord_type: 'price',
      price: price,
      state: 'wait',
      market: params.market,
      created_at: format(new Date(tick.timestamp), 'isoDateTime'),
      volume: null,
      remaining_volume: null,
      reserved_fee: floor(params.price * 0.0005, 8),
      remaining_fee: floor(params.price * 0.0005, 8),
      paid_fee: 0,
      locked: floor(params.price + (params.price * 0.0005), 8),
      executed_volume: 0,
      trades_count: 0,
    }
  }

  async askMarket(): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status) {
      throw new OrderError('아직 bid 하지 않았다.')
    }
    if(status.side === 'bid') {
      if(status.ord_type === 'limit') {
        if(status.state !== 'done') {
          throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
        }
      } else if(status.ord_type === 'price') {
        if(status.state !== 'cancel') {
          throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
        }
      }
    }
    if(status.side === 'ask') {
      if(!(status.ord_type === 'limit' && status.state === 'cancel')) {
        throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
      }
    }
    const tick = (await this.api.getTradesTicks({ market: status.market })).data[0]
    const volume = status.executed_volume
    const uuid = uuidv4()
    this._statusAsk = {
      uuid,
      side: 'ask',
      ord_type: 'market',
      price: null,
      state: 'done',
      market: status.market,
      created_at: format(new Date(tick.timestamp), 'isoDateTime'),
      volume: floor(volume, 8),
      remaining_volume: 0,
      reserved_fee: 0,
      remaining_fee: 0,
      paid_fee: floor(tick.trade_price * volume * 0.0005, 8),
      locked: 0,
      executed_volume: floor(volume, 8),
      trades_count: 1,
      trades: [
        {
          market: status.market,
          uuid: uuidv4(),
          price: tick.trade_price,
          volume: floor(volume, 8),
          funds: floor(tick.trade_price * volume, 4),
          created_at: format(new Date(tick.timestamp), 'isoDateTime'),
          side: 'ask',
        },
      ],
    }
    return {
      uuid,
      side: 'ask',
      ord_type: 'market',
      price: null,
      state: 'wait',
      market: status.market,
      created_at: format(new Date(tick.timestamp), 'isoDateTime'),
      volume: floor(volume, 8),
      remaining_volume: floor(volume, 8),
      reserved_fee: 0,
      remaining_fee: 0,
      paid_fee: 0,
      locked: floor(volume, 8),
      executed_volume: 0,
      trades_count: 0,
    }
  }

  private async suitedBidVol(market: string, volume: number): Promise<number> {
    const chance = (await this.api.getOrdersChance({market})).data
    const min = chance.market.bid.min_total
    if(volume < min) {
      throw new OrderError(`주문금액이 최소주문금액 보다 적다. (volume: ${volume}, min: ${min})`)
    }
    const suit = Math.floor(volume / min) * min
    return suit
  }

  private async suitedAskVol(market: string, price: number, volume: number): Promise<number> {
    const chance = (await this.api.getOrdersChance({market})).data
    const min = chance.market.ask.min_total
    const minVol = floor(min / price, 8)
    const suit = Math.max(volume, minVol)
    return suit
  }
}
