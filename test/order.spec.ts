import test from 'ava'
import {
  api,
  SimpleOrder,
  types as I,
  BaseBot,
  subscribe,
  UPbitSocket,
} from '../src'
import {
  MemoryWriter,
  stop,
  logger,
} from 'fourdollar'
import {
  sum,
  floor,
} from 'lodash'
import Observable from 'zen-observable'


const writer = new MemoryWriter()


class TestTradeBot extends BaseBot {
  // order: SimpleOrder

  constructor(code: string) {
    super(code)
  }

  @logger(writer)
  log(msg: any) {
    return msg
  }

  @subscribe.start
  async start(socket: UPbitSocket) {
    this.log('started')
    // this.order = this.newSimpleOrder('test', 10000)
  }

  @subscribe.finish
  async finish() {
    this.log('finished')
  }

  @subscribe.trade
  async trade(tr: I.TradeType) {
    // console.log(format(new Date(tr.trade_timestamp), 'isoDateTime'))
  }
}


async function waitChangedState(status: I.OrderType | I.OrderDetailType, ms: number = 1000): Promise<I.OrderDetailType> {
  let res: I.OrderDetailType
  do {
    await stop(ms)
    res = (await api.getOrderDetail({
      uuid: status.uuid,
    })).data
  } while(res.state === status.state)
  return res
}

let bot: TestTradeBot

test.before(async t => {
  // setTimeout(async () => {
  //   const socket = new UPbitSocket()
  //   bot = new TestTradeBot('KRW-BTC')
  //   socket.addBot(bot)
  //   await socket.open()
  // })
  const socket = new UPbitSocket()
  bot = new TestTradeBot('KRW-BTC')
  socket.addBot(bot)
  await socket.open()
})


/**
 * SimpleOrder 지정가 매매
 */
if(true) {
  let order: SimpleOrder
  let price: number
  let balanceOri: number
  let balanceDest: number

  test.serial('SimpleOrder: init maker --------------------', async t => {
    order = bot.newSimpleOrder('Test::Maker', 10000)
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    price = trade.trade_price
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, 10000)
    t.is(order.balanceDest, 0)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#makeBid(): bid maker', async t => {
    const res = await order.makeBid(price * 0.9)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
    t.is(res.ord_type, 'limit')
    t.true(res.locked > 10000 && res.locked < 10010)
    const msg = order.msg.order
    t.is(msg.name, 'bid')
    t.is(msg.description, res as I.OrderDetailType)
  })

  test.serial('SimpleOrder: balance: when be starting to bid', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri - order.msg.order.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#makeBid(): 미체결 매수가 있을 시 또 매수 주문을 할 수 없다.', async t => {
    const res = await order.makeBid(price * 0.9)
    t.true(res === null)
  })

  test.serial('SimpleOrder#cancel(): cancel the bid', async t => {
    const pre = order.msg.order
    const res = await order.cancel()
    t.is(res.uuid, pre.description.uuid)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
    const curr = order.msg.order
    t.is(curr.name, 'cancel_bid')
    t.is(curr.description.side, 'bid')
    t.is(curr.description.state, 'wait')
  })

  test.serial('SimpleOrder: balance: when be starting to cancel the bid', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri + order.msg.order.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#cancel(): wait cancel bid', async t => {
    await waitChangedState(order.msg.order.description)
    const msg = await order.updateOrderStatus()
    t.is(msg.name, 'cancel_bid')
    t.is(msg.description.side, 'bid')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('SimpleOrder: balance: when the bid is cancelled', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder: 미체결 매수가 있을 시 매도 주문하면 매수 주문을 취소하고 매도한다.', async t => {
    const res1 = await order.makeBid(price * 0.9)
    t.is(res1.side, 'bid')
    t.is(res1.state, 'wait')
    t.is(order.balanceOri, balanceOri - order.msg.order.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
    const res2 = await order.makeAsk(price * 1.1)
    t.true(res2 === null)
    const msg1 = order.msg.order
    t.is(msg1.name, 'cancel_bid')
    t.is(msg1.description.side, 'bid')
    t.is(msg1.description.state, 'wait')
    t.is(order.balanceOri, balanceOri + msg1.description.locked)
    t.is(order.balanceDest, balanceDest)
    await waitChangedState(msg1.description)
    const msg2 = await order.updateOrderStatus()
    t.is(msg2.name, 'cancel_bid')
    t.is(msg2.description.state, 'cancel')
    t.is(order.balanceOri, balanceOri + msg2.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#makeBid(): timeout bid maker', async t => {
    const res = await order.makeBid({price: price * 0.9, timeout: {ms: 1000}})
    await waitChangedState(res)
    const msg = await order.updateOrderStatus(res.uuid)
    t.is(msg.name, 'cancel_bid')
    t.is(msg.description.side, 'bid')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('SimpleOrder#makeBid(): timeout callback', t => {
    t.plan(4)
    const before = Date.now()
    return new Observable(observer => {
      order.makeBid({
        price: price * 0.9,
        timeout: {
          ms: 1000,
          cb: async msg => {
            const to = Date.now()
            t.true((to - before) > 1000 && (to - before) < 2000)
            t.is(msg.name, 'bid')
            t.is(msg.description.side, 'bid')
            t.is(msg.description.state, 'wait')
            await order.cancel(msg.description.uuid)
            console.log(`timeout...! in ${to - before}`)
            observer.complete()
          },
        },
      })
    })
  })

  test.serial('SimpleOrder#makeBidObs(): timeout observable', t => {
    t.plan(5)
    const before = Date.now()
    const observer = order.makeBidObs({price: price * 0.9, timeout: 1000})
    observer.subscribe({
      async next(msg) {
        const to = Date.now()
        t.true((to - before) > 1000 && (to - before) < 2000)
        t.is(msg.name, 'bid')
        t.is(msg.description.side, 'bid')
        t.is(msg.description.state, 'wait')
        const res = await order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${to - before}`)
        await waitChangedState(res)
        const updated = await order.updateOrderStatus(res.uuid)
        t.is(updated.name, 'cancel_bid')
        t.is(updated.description.state, 'cancel')
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      },
    })
    return observer
  })

  // test.serial('SimpleOrder#makeBidObs(): waiting cancel', async t => {
  //   await stop(1000)
  //   t.pass()
  // })

  test.serial('SimpleOrder: initialize balance 1', t => {
    balanceOri = 10000
    balanceDest = 0
    t.pass()
  })

  let bidPrice: number
  test.serial('bidPrice', async t => {
    bidPrice = (await api.getOrderbook({markets: ['KRW-BTC']})).data[0].orderbook_units[0].ask_price
    console.log(`bidPrice: ${bidPrice}`)
    t.pass()
  })

  test.serial('SimpleOrder#makeBid(): doing', async t => {
    const s = await order.makeBid({
      price: bidPrice * 1.00,
      timeout: {
        ms: 1000 * 60,
      },
    })
    const res = await waitChangedState(s)
    t.is(res.state, 'done')
  })

  test.serial('SimpleOrder#cancel(): 매매가 done 된걸 인식 못한 상태에서 cancel하면 error 대신 null을 반환한다.', async t => {
    const status = await order.cancel()
    t.is(status, null!)
    console.log(`status: ${status}`)
  })

  let executed_volume: number
  test.serial('SimpleOrder#makeBid(): done', async t => {
    const status = await order.updateOrderStatus()
    t.is(status.name, 'bid')
    t.is(status.description.side, 'bid')
    t.is(status.description.ord_type, 'limit')
    t.is(status.description.state, 'done')
    executed_volume = status.description.executed_volume
  })

  // test.serial('SimpleOrder#makeBidObs(): done', t => {
  //   const obs = order.makeBidObs({price: bidPrice, timeout: 10000})
  //   t.plan(4)
  //   obs.subscribe({
  //     next(msg) {
  //       t.is(msg.name, 'bid')
  //       t.is(msg.description.side, 'bid')
  //       t.is(msg.description.state, 'done')
  //       executed_volume = order.msg.order.description.executed_volume
  //     },
  //     complete() {
  //       t.pass()
  //     },
  //     error(err) {
  //       t.fail()
  //     }
  //   })
  //   return obs
  // })

  test.serial('SimpleOrder#balance: when the bid is done', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri - (sum(s.trades.map(t => t.funds)) + s.locked + s.paid_fee), 3))
    t.is(floor(order.balanceDest, 7), floor(balanceDest + s.executed_volume, 7))
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#cancel(): can not cancel the bid when already done', async t => {
    const res = await order.cancel()
    t.true(res === null)
  })

  test.serial('SimpleOrder#makeAsk(): high price', async t => {
    const res = await order.makeAsk(price * 1.1)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
    t.is(res.ord_type, 'limit')
    t.is(res.locked, executed_volume)
    const msg = order.msg.order
    t.is(msg.name, 'ask')
    t.is(msg.description, res as I.OrderDetailType)
  })

  test.serial('SimpleOrder: balance: when be starting to ask', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest - order.msg.order.description.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#makAsk(): 미체결 매도가 있을 시 또 매도 주문을 할 수 없다.', async t => {
    const res = await order.makeAsk(price * 1.1)
    console.log(res)
    t.true(res === null)
  })

  test.serial('SimpleOrder#cancel(): cancel ask', async t => {
    const pre = order.msg.order
    const res = await order.cancel()
    console.log(res)
    t.is(res.uuid, pre.description.uuid)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
    const curr = order.msg.order
    t.is(curr.name, 'cancel_ask')
    t.is(curr.description.side, 'ask')
    t.is(curr.description.state, 'wait')
  })

  test.serial('SimpleOrder: balance: when be starting to cancel the ask', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest + order.msg.order.description.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder: wait cancel ask', async t => {
    await waitChangedState(order.msg.order.description)
    const msg = await order.updateOrderStatus()
    t.is(msg.name, 'cancel_ask')
    t.is(msg.description.side, 'ask')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('SimpleOrder: balance: when the ask is cancelled', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder: 미체결 매도가 있을 시 매수 주문하면 매도 주문을 취소하고 매수를 준비한다.', async t => {
    const res1 = await order.makeAsk(price * 1.1)
    t.is(res1.side, 'ask')
    t.is(res1.state, 'wait')
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest - res1.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
    const res2 = await order.makeBid(price * 0.9)
    t.true(res2 === null)
    const msg1 = order.msg.order
    t.is(msg1.name, 'cancel_ask')
    t.is(msg1.description.side, 'ask')
    t.is(msg1.description.state, 'wait')
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest + msg1.description.locked)
    await waitChangedState(msg1.description)
    const msg2 = await order.updateOrderStatus()
    t.is(msg2.name, 'cancel_ask')
    t.is(msg2.description.state, 'cancel')
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest + msg2.description.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#makeAsk(): timeout', async t => {
    const res = await order.makeAsk({
      price: price * 1.1,
      timeout: {
        ms: 1000,
      },
    })
    await stop(2000)
    const msg1 = order.msg.order
    t.is(msg1.name, 'cancel_ask')
    t.is(msg1.description.side, 'ask')
    t.is(msg1.description.state, 'wait')
    await waitChangedState(msg1.description)
    const msg2 = await order.updateOrderStatus(res.uuid)
    t.is(msg2.name, 'cancel_ask')
    t.is(msg2.description.side, 'ask')
    t.is(msg2.description.state, 'cancel')
  })

  test.serial('SimpleOrder#makeAsk(): timeout callback ask', t => {
    const t1 = Date.now()
    return new Observable(observer => {
      order.makeAsk({
        price: price * 1.1,
        timeout: {
          ms: 1000,
          cb: async msg => {
            const t2 = Date.now()
            t.true((t2 - t1) >= 1000 && (t2 - t1) < 2000)
            t.is(msg.name, 'ask')
            t.is(msg.description.side, 'ask')
            t.is(msg.description.state, 'wait')
            await order.cancel(msg.description.uuid)
            console.log(`timeout...! in ${t1 - t2}`)
            observer.complete()
          },
        },
      })
    })
  })

  test.serial('SimpleOrder#makeAskObs(): timeout observable ask', t => {
    t.plan(5)
    const t1 = Date.now()
    const obs = order.makeAskObs({price: price * 1.1, timeout: 1000})
    obs.subscribe({
      next(msg) {
        const t2 = Date.now()
        t.true((t2 - t1) >= 1000 && (t2 - t1) < 2000)
        t.is(msg.name, 'ask')
        t.is(msg.description.side, 'ask')
        t.is(msg.description.state, 'wait')
        const canceling = order.cancel(msg.description.uuid)
        
        console.log(`timeout...! in ${t1 - t2}`)
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      },
    })
    return obs
  })

  // test.serial('SimpleOrder#makeAskObs(): waiting cancel', async t => {
  //   await stop(1000)
  //   t.pass()
  // })

  test.serial('SimpleOrder: waiting: for it is cancelled', async t => {
    await stop(1000)
    const msg = await order.updateOrderStatus()
    t.is(msg.name, 'cancel_ask')
    t.is(msg.description.side, 'ask')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('SimpleOrder: initialize balance 2', t => {
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
    console.log(`balanceOri: ${balanceOri}`)
    console.log(`balanceDest: ${balanceDest}`)
    t.pass()
  })

  let askPrice: number
  test.serial('ask price', async t => {
    askPrice = (await api.getOrderbook({markets: ['KRW-BTC']})).data[0].orderbook_units[0].bid_price
    t.pass()
  })

  test.serial('SimpleOrder#makeAsk(): doing', async t => {
    const s = await order.makeAsk({
      price: askPrice,
      timeout: {
        ms: 1000 * 60,
      },
    })
    const res = await waitChangedState(s)
    t.is(res.state, 'done')
  })

  test.serial('SimpleOrder#cancel(): 매매가 done 된걸 인식 못한 상태에서 cancel하면 error 대신 nell을 반환한다.', async t => {
    const status = await order.cancel()
    t.is(status, null!)
    console.log(`status: ${status}`)
  })

  test.serial('SimpleOrder#makeAsk(): done', async t => {
    const asked = await order.updateOrderStatus()
    t.is(asked.name, 'ask')
    t.is(asked.description.side, 'ask')
    t.is(asked.description.ord_type, 'limit')
    t.is(asked.description.state, 'done')
  })

  // test.serial('SimpleOrder#makeAskObs(): done', t => {
  //   t.plan(4)
  //   const obs = order.makeAskObs({price: askPrice, timeout: 10000})
  //   obs.subscribe({
  //     next(msg) {
  //       t.is(msg.name, 'ask')
  //       t.is(msg.description.side, 'ask')
  //       t.is(msg.description.state, 'done')
  //     },
  //     complete() {
  //       t.pass()
  //     },
  //     error(err) {
  //       t.fail()
  //     },
  //   })
  //   return obs
  // })

  test.serial('SimpleOrder#balance: when the ask is done', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri + sum(s.trades.map(t => t.funds)) - s.paid_fee, 3))
    t.is(floor(order.balanceDest, 7), 0)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#cancel(): can not cancel when the ask is done', async t => {
    const res = await order.cancel()
    t.true(res === null)
  })
}


/**
 * SimpleOrder 시장가 매매
 */
if(true) {
  let order: SimpleOrder
  let price: number
  let balanceOri: number
  let balanceDest: number

  test.serial('SimpleOrder: initialize taker ---------------------', async t => {
    order = bot.newSimpleOrder('Test::Taker', 10000)
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    price = trade.trade_price
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
    t.pass()
  })

  test.serial('SimpleOrder#takeBid(): 앞선 지정가 매수가 있을 시 매수를 취소하고 시장가로 매수 한다.', async t => {
    const makeBidId = (await order.makeBid(price * 0.9)).uuid
    const res = await order.takeBid()
    t.is(res.side, 'bid')
    t.is(res.ord_type, 'price')
    t.is(res.state, 'wait')
    const makeBidMsg = await order.updateOrderStatus(makeBidId)
    t.is(makeBidMsg.name, 'cancel_bid')
    t.is(makeBidMsg.description.uuid, makeBidId)
    await stop(2000)
    const takeBid = await order.updateOrderStatus(res.uuid)
    t.is(takeBid.name, 'bid')
    t.is(takeBid.description.ord_type, 'price')
    t.is(takeBid.description.state, 'cancel')
  })

  test.serial('SimpleOrder#takeBid(): balance when bided', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri - (sum(s.trades.map(t => t.funds)) + s.locked + s.paid_fee), 3))
    t.is(floor(order.balanceDest, 7), floor(balanceDest + s.executed_volume, 7))
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#takeBid(): 돈이 없으면 null', async t => {
    const res = await order.takeBid()
    t.true(res === null)
  })

  test.serial('SimpleOrder#takeBid(): 앞선 지정가 매도가 있을 시 매도를 취소한다.', async t => {
    const makeAskId = (await order.makeAsk(price * 1.1)).uuid
    const res = await order.takeBid()
    t.true(res === null)
    const makeAskMsg = await order.updateOrderStatus(makeAskId)
    t.is(makeAskMsg.name, 'cancel_ask')
    t.is(makeAskMsg.description.uuid, makeAskId)
  })

  test.serial('SimpleOrder#takeAsk(): 앞선 지정가 매도가 있을 시 매도를 취소하고 시장가로 매도한다.', async t => {
    const makeAskId = (await order.makeAsk(price * 1.1)).uuid
    const res = await order.takeAsk()
    t.is(res.side, 'ask')
    t.is(res.ord_type, 'market')
    t.is(res.state, 'wait')
    const makeAsk = await order.updateOrderStatus(makeAskId)
    t.is(makeAsk.name, 'cancel_ask')
    t.is(makeAsk.description.uuid, makeAskId)
    await stop(2000)
    const takeAsk = await order.updateOrderStatus(res.uuid)
    t.is(takeAsk.name, 'ask')
    t.is(takeAsk.description.ord_type, 'market')
    t.is(takeAsk.description.state, 'done')
  })

  test.serial('SimpleOrder#takeAsk(): balance when asked', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri + sum(s.trades.map(t => t.funds)) - s.paid_fee, 3))
    t.is(floor(order.balanceDest, 7), 0)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#takeAsk(): 돈없으면 null', async t => {
    const res = await order.takeAsk()
    t.true(res === null)
  })

  test.serial('SimpleOrder#takeAsk(): 앞선 지정가 매수가 있을 시 매수를 취소한다.', async t => {
    const makeBidId = (await order.makeBid(price * 0.9)).uuid
    const res = await order.takeAsk()
    t.true(res === null)
    const makeBidMsg = await order.updateOrderStatus(makeBidId)
    t.is(makeBidMsg.name, 'cancel_bid')
    t.is(makeBidMsg.description.uuid, makeBidId)
  })
}