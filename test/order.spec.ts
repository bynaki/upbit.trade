import test from 'ava'
import {
  Order,
  getConfig,
  UPbit,
} from '../src'
import {
  stop,
} from 'fourdollar'


{
  const config = getConfig('./config.json')
  const api = new UPbit(config.upbit_keys)
  const order = new Order(api)
  
  test.serial.skip('order > Order#bidMarket()', async t => {
    const res = await order.bidMarket({
      market: 'KRW-BTC',
      price: 5000,
    })
    console.log(res)
    t.pass()
  })

  // 시장가 거래는 cancel 안됨 주의.
  test.serial.skip('order > Order#cancel(): not cancel', async t => {
    const res = await order.cancel()
    console.log(res)
    t.pass()
  })

  test.serial.skip('order > Order#askMarket()', async t => {
    t.timeout(10000)
    await stop(5000)
    const res = await order.askMarket()
    console.log(res)
    t.pass()
  })
}