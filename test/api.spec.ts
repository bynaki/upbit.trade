import test from 'ava'
import {
  allMarketCode,
  api
} from '../src'


let codes: string[] = []

test.before('codes', async t => {
  codes = await allMarketCode()
})

test.serial('codes', async t => {
  console.log('allMarketCode() ---------------------------------')
  console.log(await allMarketCode())
  t.pass()
})

test.serial('#getOrderChance()', async t => {
  console.log('#getOrderChance() ---------------------------------')
  for(let code of codes) {
    console.log((await api.getOrdersChance({market: code})).data)
  }
  t.pass()
})