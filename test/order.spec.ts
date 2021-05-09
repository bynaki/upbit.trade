import test from 'ava'
import {
  Order,
  OrderMock,
  getConfig,
  UPbit,
} from '../src'
import {
  stop,
} from 'fourdollar'

/**
 * 지정가 매수매도
 * -- 실제로 거래됨 주의 --
 */
if(false) {
  const config = getConfig('./config.json')
  const api = new UPbit(config.upbit_keys)
  const order = new Order(api)

  test.serial('order > #bid(): low price', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.bid({
      market: 'KRW-BTC',
      price: trade.trade_price * 0.9,
      volume: 5000,
    })
    console.log(res)
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancel(): cancel bid', async t => {
    const status = order.status
    const res = await order.cancel()
    console.log(res)
    t.is(res.uuid, status.uuid)
    t.is(res.state, 'wait')
  })

  test.serial.cb('order > wait cancel bid', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = order.status
      const update = await order.updateStatus()
      if(update.state === 'cancel') {
        console.log(update)
        t.is(update.uuid, status.uuid)
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })

  test.serial('order > #bid()', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.bid({
      market: 'KRW-BTC',
      price: trade.trade_price,
      volume: 5000,
    })
    console.log(res)
    t.pass()
  })

  test.serial.cb('order > wait done bid', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = await order.updateStatus()
      if(status.state === 'done') {
        console.log(status)
        t.is(status.side, 'bid')
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })

  test.serial('order > #ask(): high price', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.ask(trade.trade_price * 1.1)
    console.log(res)
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancel(): cancel ask', async t => {
    const status = order.status
    const res = await order.cancel()
    console.log(res)
    t.is(res.uuid, status.uuid)
    t.is(res.state, 'wait')
  })

  test.serial.cb('order > wait cancel ask', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = order.status
      const update = await order.updateStatus()
      if(update.state === 'cancel') {
        console.log(update)
        t.is(update.uuid, status.uuid)
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })

  test.serial('order > #ask()', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.ask(trade.trade_price)
    console.log(res)
    t.is(res.state, 'wait')
  })

  test.serial.cb('order > wait done ask', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = await order.updateStatus()
      if(status.state === 'done') {
        console.log(status)
        t.is(status.side, 'ask')
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })
}


/**
 * 사장가 매수매도
 */
if(false) {
  const config = getConfig('./config.json')
  const api = new UPbit(config.upbit_keys)
  const order = new Order(api)
  
  test.serial('order > #bidMarket()', async t => {
    const res = await order.bidMarket({
      market: 'KRW-BTC',
      price: 5000,
    })
    console.log(res)
    t.is(res.state, 'wait')
  })

  // 시장가 거래는 cancel 안됨 주의.
  test.serial('order > #cancel(): can not cancel bidMarket', async t => {
    const res = await order.cancel()
    console.log(res)
    t.is(res.state, 'wait')
  })

  test.serial.cb('order > wait done bidMarket', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = await order.updateStatus()
      if(status.state === 'cancel') {
        console.log(status)
        t.is(status.side, 'bid')
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })

  test.serial('order > #askMarket()', async t => {
    const res = await order.askMarket()
    console.log(res)
    t.is(res.state, 'wait')
  })

  // 시장가 거래는 cancel 안됨 주의.
  test.serial('order > #cancel(): can not cancel askMarket', async t => {
    const res = await order.cancel()
    console.log(res)
    t.is(res.state, 'wait')
  })

  test.serial.cb('order > wait done askMarket', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = await order.updateStatus()
      if(status.state === 'done') {
        console.log(status)
        t.is(status.side, 'ask')
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })
}

// test('test', async t => {
//   const config = getConfig('./config.json')
//   const api = new UPbit(config.upbit_keys)
//   const res = (await api.getOrderDetail({
//     uuid: '784d5fca-c761-42fc-bfaa-df6c1fc4b302'
//   })).data
//   console.log(res)
//   t.pass()
// })

/**
 * 가상 매매
 */
if(true) {
  const config = getConfig('./config.json')
  const api = new UPbit(config.upbit_keys)
  const order = new OrderMock(api)

  test.serial('ordermock > #bidMarket()', async t => {
    const res = await order.bidMarket({
      market: 'KRW-BTC',
      price: 5000,
    })
    console.log(res)
    console.log(await order.updateStatus())
    t.pass()
  })

  test.serial('ordermock > #cancel(): can not cancel', async t => {
    const res = await order.cancel()
    console.log(res)
    console.log(await order.updateStatus())
    t.pass()
  })

  test.serial('ordermock > #askMarket()', async t => {
    const res = await order.askMarket()
    console.log(res)
    console.log(await order.updateStatus())
    t.pass()
  })
}