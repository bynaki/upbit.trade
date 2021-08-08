import test from 'ava'
import {
  UPbit,
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  getConfig,
} from '../src/utils'
import {
  stop,
} from 'fourdollar'



if(false) {
  const api = new UPbit(getConfig('./config.json').upbit_keys)
  test('hello', async t => {
    const res = await api.getTradesTicks({
      market: 'KRW-BTC',
      daysAgo: 0,
      to: '00:02:00', // 포함안됨
      count: 1000,
    })
    console.log(res.data)
    console.log(res.data.length)
    const res2 = await api.getTradesTicks({
      market: 'KRW-BTC',
      daysAgo: 0,
      count: 200,
      cursor: res.data[res.data.length - 1].sequential_id,
    })
    console.log(res2.data)
    console.log(res2.data.length)
    t.pass()
  })
}

if(true) {
  test('Promise.all()', async t => {
    const times = [2000, 500, 3000, 1000]
    await Promise.all(times.map(async t => {
      await stop(t)
      console.log(t)
    }))
    t.pass()
  })
}