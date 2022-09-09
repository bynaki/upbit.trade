import test, {
} from 'ava'
import WebSocket from 'ws'
import Observable from 'zen-observable'



test.serial('websocket > trade', t => {
  t.plan(2)
  return new Observable(obs => {
    const ws = new WebSocket('wss://api.upbit.com/websocket/v1')
    ws.onopen = e => {
      console.log('opened...')
      ws.send(JSON.stringify([
        {ticket: 'test'},
        {type: 'trade', codes: [
          'KRW-BTC',
          'KRW-ETH',
          'KRW-NEO',
          'KRW-MTL',
          'KRW-LTC',
          'KRW-XRP',
          'KRW-ETC',
          'KRW-OMG',
          'KRW-SNT',
          'KRW-WAVES',
        ], isOnlyRealtime: true},
      ]))
      t.pass()
    }
    ws.onmessage = e => {
      console.log('trade ----------------------------------------------------------')
      console.log(`message: ${e.data}`)
      console.log(JSON.parse(e.data.toString('utf-8')))
      ws.close()
    }
    ws.onerror = e => {
      console.log(`error: ${e}`)
      t.fail()
    }
    ws.onclose = e => {
      console.log('closed...')
      t.pass()
      obs.complete()
    }
  })
})

test.serial('websocket > orderbook', t => {
  t.plan(2)
  return new Observable(obs => {
    const ws = new WebSocket('wss://api.upbit.com/websocket/v1')
    ws.onopen = e => {
      console.log('opened...')
      ws.send(JSON.stringify([
        {ticket: 'test'},
        {type: 'orderbook', codes: [
          'KRW-BTC',
          'KRW-ETH',
          'KRW-NEO',
          'KRW-MTL',
          'KRW-LTC',
          'KRW-XRP',
          'KRW-ETC',
          'KRW-OMG',
          'KRW-SNT',
          'KRW-WAVES',
        ], isOnlyRealtime: true},
      ]))
      t.pass()
    }
    ws.onmessage = e => {
      console.log('orderbook ------------------------------------------------------')
      console.log(`message: ${e.data}`)
      console.log(JSON.parse(e.data.toString('utf-8')))
      ws.close()
    }
    ws.onerror = e => {
      console.log(`error: ${e}`)
      t.fail()
    }
    ws.onclose = e => {
      console.log('closed...')
      t.pass()
      obs.complete()
    }
  })
})

test.serial('websocket > ticker', t => {
  t.plan(2)
  return new Observable(obs => {
    const ws = new WebSocket('wss://api.upbit.com/websocket/v1')
    ws.onopen = e => {
      console.log('opened...')
      ws.send(JSON.stringify([
        {ticket: 'test'},
        {type: 'ticker', codes: [
          'KRW-BTC',
          'KRW-ETH',
          'KRW-NEO',
          'KRW-MTL',
          'KRW-LTC',
          'KRW-XRP',
          'KRW-ETC',
          'KRW-OMG',
          'KRW-SNT',
          'KRW-WAVES',
        ], isOnlyRealtime: true},
      ]))
      t.pass()
    }
    ws.onmessage = e => {
      console.log('ticker ---------------------------------------------------------')
      console.log(`message: ${e.data}`)
      console.log('')
      console.log(JSON.parse(e.data.toString('utf-8')))
      ws.close()
    }
    ws.onerror = e => {
      console.log(`error: ${e}`)
      t.fail()
    }
    ws.onclose = e => {
      console.log('closed...')
      t.pass()
      obs.complete()
    }
  })
})
