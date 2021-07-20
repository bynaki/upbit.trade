import test from 'ava'
import {
  UPbit,
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  getConfig,
} from '../src/utils'



if(true) {
  const api = new UPbit(getConfig('./config.json').upbit_keys)
  test('hello', async t => {
    const res = await api.getTradesTicks({
      market: 'KRW-BTC',
      daysAgo: 6,
      to: '00:02:00', // 포함안됨
      count: 1000,
    })
    console.log(res.data)
    console.log(res.data.length)
    const res2 = await api.getTradesTicks({
      market: 'KRW-BTC',
      daysAgo: 6,
      count: 10,
      cursor: res.data[res.data.length - 1].sequential_id,
    })
    console.log(res2.data)
    console.log(res2.data.length)
    t.pass()
  })
}