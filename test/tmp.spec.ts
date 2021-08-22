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
import {
  format,
} from 'fecha'
import {
  getCandlesMinutes,
} from '../src/database'



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

if(false) {
  test('Promise.all()', async t => {
    const times = [2000, 500, 3000, 1000]
    await Promise.all(times.map(async t => {
      await stop(t)
      console.log(t)
    }))
    t.pass()
  })
}


if(false) {
  test('candle', async t => {
    const api = new UPbit(getConfig('./config.json').upbit_keys)
    const res = await api.getCandlesMinutes(1, {
      market: 'KRW-BTC',
      count: 5,
    })
    const d = res.data[res.data.length - 1].candle_date_time_utc
    const to = format(new Date(d), 'isoDateTime')
    console.log(`to: ${to}`)
    const res2 = await api.getCandlesMinutes(1, {
      market: 'KRW-BTC',
      count: 5,
      to: d + '+00:00',
    })
    console.log(res.data)
    console.log(res2.data)
    t.pass()
  })
}


let count = 0
function asyncFunc() {
  return new Promise((resolve, reject) => {
    if(count % 10 === 0) {
      count++
      reject(new Error('error!!'))
      return
    }
    resolve(++count)
  })
}

async function bad() {
  try {
    // await 하지 않고 바로 리턴하면 에러를 캣치하지 못한다.
    return asyncFunc()
  } catch(e) {
    console.log(e.message)
    return asyncFunc()
  }
}

async function right() {
  try {
    const res = await asyncFunc()
    return res
  } catch(e) {
    console.log(e.message)
    return asyncFunc()
  }
}

if(true) {
test('test async reject', async t => {
  for(let i = 0; i < 100; i++) {
    const res = await right()
    console.log(res)
  }
  t.pass()
})
}