import test from 'ava'
import {
  Order,
  OrderMarket,
  OrderHistory,
  api,
  SimpleOrder,
  types as I,
} from '../src'
import {
  stop,
} from 'fourdollar'
import {
  sum,
  floor,
} from 'lodash'
import Observable from 'zen-observable'


/**
 * 지정가 매수매도
 * -- 실제로 거래됨 주의 --
 */
if(false) {
  const order = new Order('KRW-BTC')

  test.serial('order > #bid(): low price', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.bid(trade.trade_price * 0.9, 1000)
    console.log('order > #bid(): low price')
    console.log(res)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancel(): cancel bid', async t => {
    const status = order.status
    const res = await order.cancel()
    console.log('order > #cancel(): cancel bid')
    console.log(res)
    t.is(res.uuid, status.uuid)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
  })

  test.serial('order > wait cancel bid', async t => {
    t.timeout(6000)
    const status = await order.wait()
    console.log('order > wait cancel bid')
    console.log(status)
    t.is(status.side, 'bid')
    t.is(status.state, 'cancel')
  })

  test.serial('order > #bid(): low price again', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.bid(trade.trade_price * 0.9, 5000)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancelWaiting() bid', async t => {
    const status = await order.cancelWaiting()
    t.is(status.side, 'bid')
    t.is(status.state, 'cancel')
  })

  test.serial('order > #bid()', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.bid(trade.trade_price, 5000)
    console.log('order > #bid()')
    console.log(res)
    t.pass()
  })

  test.serial('order > wait done bid', async t => {
    t.timeout(120 * 1000)
    const status  = await order.wait({ms: 1000, timeout: 20})
    console.log('order > wait done bid')
    console.log(status)
    t.is(status.side, 'bid')
    t.is(status.state, 'done')
  })

  test.serial('order > can not cancel bid when done', async t => {
    const res = await order.cancel()
    t.true(res === null)
    console.log(order.error)
  })

  test.serial('order > #ask(): high price', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.ask(trade.trade_price * 1.1)
    console.log('order > #ask(): high price')
    console.log(res)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancel(): cancel ask', async t => {
    const status = order.status
    const res = await order.cancel()
    console.log('order > #cancel(): cancel ask')
    console.log(res)
    t.is(res.uuid, status.uuid)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
  })

  test.serial('order > wait cancel ask', async t => {
    t.timeout(6000)
    const status = await order.wait()
    console.log('order > wait cancel ask')
    console.log(status)
    t.is(status.side, 'ask')
    t.is(status.state, 'cancel')
  })

  test.serial('order > #ask(): high price again', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.ask(trade.trade_price * 1.1)
    console.log('order > #ask(): high price again')
    console.log(res)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancelWaiting() ask', async t => {
    const status = await order.cancelWaiting()
    t.is(status.side, 'ask')
    t.is(status.state, 'cancel')
  })

  test.serial('order > #ask()', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.ask(trade.trade_price)
    console.log('order > #ask()')
    console.log(res)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
  })

  test.serial('order > wait done ask', async t => {
    t.timeout(120 * 1000)
    const status  = await order.wait({ms: 1000, timeout: 20})
    console.log('order > wait done ask')
    console.log(status)
    t.is(status.side, 'ask')
    t.is(status.state, 'done')
  })

  test.serial('order > can not cancel ask when done', async t => {
    const res = await order.cancel()
    t.true(res === null)
    console.log(order.error)
  })

  test.serial('order > history', async t => {
    const h = order.history
    console.log(h)
    const bid = h.bid
    t.is(bid.length, 6)
    t.is(bid[0].side, 'bid')
    t.is(bid[0].state, 'wait')
    t.is(bid[1].side, 'bid')
    t.is(bid[1].state, 'cancel')
    t.is(bid[0].uuid, bid[1].uuid)
    t.is(bid[2].side, 'bid')
    t.is(bid[2].state, 'wait')
    t.is(bid[3].side, 'bid')
    t.is(bid[3].state, 'cancel')
    t.is(bid[2].uuid, bid[3].uuid)
    t.is(bid[4].side, 'bid')
    t.is(bid[4].state, 'wait')
    t.is(bid[5].side, 'bid')
    t.is(bid[5].state, 'done')
    t.is(bid[4].uuid, bid[5].uuid)
    const ask = h.ask
    t.is(ask.length, 6)
    t.is(ask[0].side, 'ask')
    t.is(ask[0].state, 'wait')
    t.is(ask[1].side, 'ask')
    t.is(ask[1].state, 'cancel')
    t.is(ask[0].uuid, ask[1].uuid)
    t.is(ask[2].side, 'ask')
    t.is(ask[2].state, 'wait')
    t.is(ask[3].side, 'ask')
    t.is(ask[3].state, 'cancel')
    t.is(ask[2].uuid, ask[3].uuid)
    t.is(ask[4].side, 'ask')
    t.is(ask[4].state, 'wait')
    t.is(ask[5].side, 'ask')
    t.is(ask[5].state, 'done')
    t.is(ask[4].uuid, ask[5].uuid)
    t.is(h.errorBid.length, 1)
    t.is(h.errorAsk.length, 1)
    console.log(h.errorBid[0])
    console.log(h.errorAsk[0])
  })

  test.serial('order > history file', async t => {
    const history = new OrderHistory<{name: string}>('./history/test.txt')
    const h = await history.append(order.history, {name: 'test'})
    const hh = (await history.read()).pop()
    if(hh !== undefined) {
      console.log(hh)
      t.deepEqual(h, hh)
      const bid = hh.bid
      t.is(bid.length, 6)
      t.is(bid[0].side, 'bid')
      t.is(bid[0].state, 'wait')
      t.is(bid[1].side, 'bid')
      t.is(bid[1].state, 'cancel')
      t.is(bid[0].uuid, bid[1].uuid)
      t.is(bid[2].side, 'bid')
      t.is(bid[2].state, 'wait')
      t.is(bid[3].side, 'bid')
      t.is(bid[3].state, 'cancel')
      t.is(bid[2].uuid, bid[3].uuid)
      t.is(bid[4].side, 'bid')
      t.is(bid[4].state, 'wait')
      t.is(bid[5].side, 'bid')
      t.is(bid[5].state, 'done')
      t.is(bid[4].uuid, bid[5].uuid)
      const ask = hh.ask
      t.is(ask.length, 6)
      t.is(ask[0].side, 'ask')
      t.is(ask[0].state, 'wait')
      t.is(ask[1].side, 'ask')
      t.is(ask[1].state, 'cancel')
      t.is(ask[0].uuid, ask[1].uuid)
      t.is(ask[2].side, 'ask')
      t.is(ask[2].state, 'wait')
      t.is(ask[3].side, 'ask')
      t.is(ask[3].state, 'cancel')
      t.is(ask[2].uuid, ask[3].uuid)
      t.is(ask[4].side, 'ask')
      t.is(ask[4].state, 'wait')
      t.is(ask[5].side, 'ask')
      t.is(ask[5].state, 'done')
      t.is(ask[4].uuid, ask[5].uuid)
      t.is(hh.errorBid.length, 1)
      t.is(hh.errorAsk.length, 1)
      console.log(hh.errorBid[0])
      console.log(hh.errorAsk[0])
      t.is(hh.brief.name, 'test')
    } else {
      t.fail()
    }
  })
}


/**
 * 사장가 매수매도
 * -- 실제로 거래됨 주의 --
 */
if(false) {
  const order = new OrderMarket('KRW-BTC')
  let statusBid: I.OrderDetailType
  let statusAsk: I.OrderDetailType
  
  test.serial('order market > #bid()', async t => {
    const res = await order.bid(10000)
    order.wait(null, status => statusBid = status)
    console.log('order market > #bid()')
    console.log(res)
    t.is(res.state, 'wait')
  })

  // 시장가 거래는 cancel 안됨 주의.
  test.serial('order market > #cancel(): can not cancel bid', async t => {
    const res = await order.cancel()
    console.log('order market > #cancel(): can not cancel bid')
    console.log(res)
    t.is(res.state, 'wait')
  })

  // test.serial.cb('order market > wait done bid', t => {
  //   t.timeout(60 * 1000)
  //   const id = setInterval(async () => {
  //     const status = await order.updateStatus()
  //     if(status.state === 'cancel' && statusBid) {
  //       console.log('order market > wait done bid')
  //       console.log(status)
  //       t.is(status.side, 'bid')
  //       t.deepEqual(status, statusBid)
  //       t.end()
  //       clearInterval(id)
  //     }
  //   }, 3000)
  // })

  test.serial('order market > #ask()', async t => {
    const res = await order.ask()
    order.wait(null, status => statusAsk = status)
    console.log('order market > #ask()')
    console.log(res)
    t.is(res.state, 'wait')
  })

  // 시장가 거래는 cancel 안됨 주의.
  test.serial('order market > #cancel(): can not cancel ask', async t => {
    const res = await order.cancelWaiting()
    t.true(res === null)
  })

  // test.serial.cb('order market > wait done ask', t => {
  //   t.timeout(60 * 1000)
  //   const id = setInterval(async () => {
  //     const status = await order.updateStatus()
  //     if(status.state === 'done' && statusAsk) {
  //       console.log('order market > wait done ask')
  //       console.log(status)
  //       t.is(status.side, 'ask')
  //       t.deepEqual(status, statusAsk)
  //       t.end()
  //       clearInterval(id)
  //     }
  //   }, 3000)
  // })

  test.serial('order market > history', async t => {
    const history = new OrderHistory<{name: string}>('./history/test.txt')
    const h = await history.append(order.history, {name: 'test'})
    console.log(h)
    const hh = await history.read()
    console.log(hh[hh.length - 1])
    console.log(hh[hh.length - 1].bid)
    console.log(hh[hh.length - 1].ask)
    t.deepEqual(h, hh[hh.length - 1])
  })
}


/**
 * SimpleOrder 지정가 매매
 */
if(false) {
  // test.only('api cancel', async t => {
  //   const pp = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0].trade_price
  //   const price = floorOrderbook(pp * 0.9)
  //   const res1 = await api.order({
  //     market: 'KRW-BTC',
  //     side: 'bid',
  //     ord_type: 'limit',
  //     price,
  //     volume: ceil(5000 / price, 8),
  //   })
  //   console.log(res1.data)
  //   const res2 = await api.cancel({uuid: res1.data.uuid})
  //   console.log(res2.data)
  //   const res3 = await api.getOrderDetail({uuid: res1.data.uuid})
  //   console.log(res3.data)
  //   t.pass()
  // })

  // test.only('api chance', async t => {
  //   const chance = (await api.getOrdersChance({market: 'KRW-BTC'})).data
  //   console.log(chance)
  //   t.pass()
  // })

  const order = new SimpleOrder('test', 'KRW-BTC', 10000)
  let price: number
  let balanceOri: number
  let balanceDest: number

  test.before(async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    price = trade.trade_price
  })

  test.serial('SimpleOrder: balance: before stating', t => {
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
    await stop(1000)
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
    await stop(1000)
    const msg2 = await order.updateOrderStatus()
    t.is(msg2.name, 'cancel_bid')
    t.is(msg2.description.state, 'cancel')
    t.is(order.balanceOri, balanceOri + msg2.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#makeBid(): timeout bid maker', async t => {
    t.timeout(4000)
    const res = await order.makeBid(price * 0.9, {ms: 1000})
    await stop(3000)
    const msg = await order.updateOrderStatus(res.uuid)
    t.is(msg.name, 'cancel_bid')
    t.is(msg.description.side, 'bid')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('SimpleOrder#makeBid(): timeout callback', t => {
    t.plan(4)
    const before = Date.now()
    return new Observable(observer => {
      order.makeBid(price * 0.9, {ms: 1000, cb: async msg => {
        const to = Date.now()
        t.true((to - before) > 1000 && (to - before) < 2000)
        t.is(msg.name, 'bid')
        t.is(msg.description.side, 'bid')
        t.is(msg.description.state, 'wait')
        await order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${to - before}`)
        observer.complete()
      }})
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
        await order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${to - before}`)
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

  test.serial('SimpleOrder#makeBidObs(): waiting cancel', async t => {
    await stop(1000)
    t.pass()
  })

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

  let executed_volume: number
  test.serial('SimpleOrder#makeBidObs(): done', t => {
    const obs = order.makeBidObs({price: bidPrice, timeout: 10000})
    t.plan(4)
    obs.subscribe({
      next(msg) {
        t.is(msg.name, 'bid')
        t.is(msg.description.side, 'bid')
        t.is(msg.description.state, 'done')
        executed_volume = order.msg.order.description.executed_volume
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      }
    })
    return obs
  })

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
    await stop(1000)
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

  test.serial('SimpleOrder: 미체결 매도가 있을 시 매수 주문하면 매도 주문을 취소하고 매수한다.', async t => {
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
    await stop(1000)
    const msg2 = await order.updateOrderStatus()
    t.is(msg2.name, 'cancel_ask')
    t.is(msg2.description.state, 'cancel')
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest + msg2.description.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('SimpleOrder#makeAsk(): timeout', async t => {
    t.timeout(4000)
    const res = await order.makeAsk(price * 1.1, {ms: 1000})
    await stop(3000)
    const msg1 = order.msg.order
    t.is(msg1.name, 'cancel_ask')
    t.is(msg1.description.side, 'ask')
    t.is(msg1.description.state, 'wait')
    const msg2 = await order.updateOrderStatus(res.uuid)
    t.is(msg2.name, 'cancel_ask')
    t.is(msg2.description.side, 'ask')
    t.is(msg2.description.state, 'cancel')
  })

  test.serial('SimpleOrder#makeAsk(): timeout callback ask', t => {
    const t1 = Date.now()
    return new Observable(observer => {
      order.makeAsk(price * 1.1, {ms: 1000, cb: async msg => {
        const t2 = Date.now()
        t.true((t2 - t1) >= 1000 && (t2 - t1) < 2000)
        t.is(msg.name, 'ask')
        t.is(msg.description.side, 'ask')
        t.is(msg.description.state, 'wait')
        await order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${t1 - t2}`)
        observer.complete()
      }})
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
        order.cancel(msg.description.uuid)
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

  test.serial('SimpleOrder#makeAskObs(): waiting cancel', async t => {
    await stop(1000)
    t.pass()
  })

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

  test.serial('SimpleOrder#makeAskObs(): done', t => {
    t.plan(4)
    const obs = order.makeAskObs({price: askPrice, timeout: 10000})
    obs.subscribe({
      next(msg) {
        t.is(msg.name, 'ask')
        t.is(msg.description.side, 'ask')
        t.is(msg.description.state, 'done')
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
if(false) {
  const order = new SimpleOrder('SimpleOrder::Taker::Test', 'KRW-BTC', 10000)
  let price: number
  let balanceOri = order.balanceOri
  let balanceDest = order.balanceDest

  test.before(async () => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    price = trade.trade_price
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