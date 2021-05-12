import test from 'ava'
import {
  allMarketCode,
} from '../src'


test.skip('allMarketCode()', async t => {
  const markets = await allMarketCode()
  while(markets.length !== 0) {
    console.log(JSON.stringify(markets.splice(0, 25), null, 2))
  }
  t.pass()
})