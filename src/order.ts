import {
  UPbit,
  upbit_types as Iu,
} from 'cryptocurrency.api'


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


export class Order {
  private _status: Iu.OrderType = null

  constructor(private readonly api: UPbit) {
  }

  get status() {
    return this._status
  }

  async updateStatus(): Promise<Iu.OrderDetailType> {
    if(!this.status) {
      return null
    }
    const s = (await this.api.getOrderDetail({
      uuid: this.status.uuid,
    })).data
    this._status = s
    return s
  }

  async cancel() {
    const status = await this.updateStatus()
    if(status.state !== 'wait') {
      throw new OrderError(`cancel 할 수 있는 상태가 아니다. (side: ${this.status.side}, ord_type: ${this.status.ord_type}, state: ${this.status.state})`)
    }
    const res = await this.api.cancel({
      uuid: status.uuid
    })
    this._status = res.data
    return this.status
  }

  async bidMarket(params: {
    market: string
    price: number
    id?: string
  }) {
    if(this.status) {
      throw new OrderError(`bid 할 수 있는 상태가 아니다. (side: ${this.status.side}, ord_type: ${this.status.ord_type}, state: ${this.status.state})`)
    }
    const chance = (await this.api.getOrdersChance({market: params.market})).data
    const fee = chance.bid_fee
    const min = chance.market.bid.min_total
    const balance = Math.floor(chance.bid_account.balance / min) * min
    const price = Math.max(Math.min(Math.floor(params.price / min) * min, balance), min)
    if(price + (price * fee) > balance) {
      throw new BalanceError(`'balance'가 'price' 보다 적다. (balace: ${balance}, price: ${price}, fee: ${fee})`)
    }
    const orderParams: Iu.OrderPriceParam = {
      market: params.market,
      side: 'bid',
      ord_type: 'price',
      price,
    }
    if(params.id) {
      orderParams.identifier = `${params.id}_${new Date().getTime()}`
    }
    const res = (await this.api.order(orderParams)).data
    if(orderParams.identifier) {
      res.identifier = orderParams.identifier
    }
    this._status = res
    return this.status
  }

  async askMarket(id?: string) {
    const status = await this.updateStatus()
    if(!status) {
      throw new OrderError('아직 bid 하지 않았다.')
    }
    if(status.side !== 'bid') {
      throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
    }
    if(status.ord_type === 'limit') {
      if(status.state !== 'done') {
        throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
      }
    }
    if(status.ord_type === 'price') {
      if(!(status.state === 'done' || status.state === 'cancel')) {
        throw new OrderError(`ask 할 상태가 아니다. (side: ${status.side}, ord_type: ${status.ord_type}, state: ${status.state})`)
      }
    }
    const chance = (await this.api.getOrdersChance({market: status.market})).data
    const trade = (await this.api.getTradesTicks({ market: status.market })).data[0]
    //
    const price = trade.trade_price
    const vol = status.executed_volume
    const min = chance.market.ask.min_total
    const balance = chance.ask_account.balance
    const volume = Math.ceil(Math.max(Math.min(vol, balance), (min / price)) * 100000000) / 100000000
    if(balance < volume) {
      throw new BalanceError(`balance가 volume 보다 작다. (balance: ${balance}, volume: ${volume})`)
    }
    const params: Iu.OrderMarketParam = {
      market: status.market,
      side: 'ask',
      ord_type: 'market',
      volume,
    }
    if(id) {
      params.identifier = `${id}_${new Date().getTime()}`
    }
    const res = (await this.api.order(params)).data
    this._status = res
    return this.status
  }
}
