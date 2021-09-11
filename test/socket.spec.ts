import test, {
} from 'ava'
import WebSocket from 'ws'



test.cb('websocket > trade', t => {
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
  }
  ws.onmessage = e => {
    //console.log(`message: ${e.data}`)
    //console.log(JSON.stringify(e.data, null, 2))
    console.log('')
    console.log('------------------------------------------------------------')
    console.log(JSON.parse(e.data.toString('utf-8')))
    ws.close()
  }
  ws.onerror = e => {
    console.log(`error: ${e}`)
  }
  ws.onclose = e => {
    console.log('closed...')
    t.end()
  }
})

test.cb('websocket > orderbook', t => {
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
  }
  ws.onmessage = e => {
    //console.log(`message: ${e.data}`)
    //console.log(JSON.stringify(e.data, null, 2))
    console.log('')
    console.log('------------------------------------------------------------')
    console.log(JSON.parse(e.data.toString('utf-8')))
    ws.close()
  }
  ws.onerror = e => {
    console.log(`error: ${e}`)
  }
  ws.onclose = e => {
    console.log('closed...')
    t.end()
  }
})

test.cb('websocket > ticker', t => {
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
  }
  ws.onmessage = e => {
    //console.log(`message: ${e.data}`)
    //console.log(JSON.stringify(e.data, null, 2))
    console.log('')
    console.log('------------------------------------------------------------')
    console.log(JSON.parse(e.data.toString('utf-8')))
    ws.close()
  }
  ws.onerror = e => {
    console.log(`error: ${e}`)
  }
  ws.onclose = e => {
    console.log('closed...')
    t.end()
  }
})
