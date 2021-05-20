import test from 'ava'
import {
  UPbit,
} from 'cryptocurrency.api'
import { getConfig } from '../src'


if(false) {
  const cf = getConfig()
  const api = new UPbit(cf.upbit_keys)
  let uuid
  
  test.serial('cancel', async t => {
    const ask = await api.order({
      market: 'KRW-BTC',
      ord_type: 'market',
      side: 'ask',
      volume: 0.00018995,
    })
    console.log('ask:')
    console.log(ask.data)
    uuid = ask.data.uuid
    const cancel = await api.cancel({uuid: ask.data.uuid})
    console.log('cancel:')
    console.log(cancel.data)
    t.pass()
  })
  
  test.serial.cb('confirm', t => {
    t.timeout(10000)
    const id = setInterval(async () => {
      const res = await api.getOrderDetail({uuid})
      if(res.data.state === 'done' || res.data.state === 'cancel') {
        console.log('res:')
        console.log(res.data)
        t.pass()
        clearInterval(id)
      }
    }, 1000)
  })
}