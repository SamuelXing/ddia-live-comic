import { test, expect } from 'vitest'
import { lintTraceSpec } from '../../components/traceLint'
import { bigtableWriteTrace } from './bigtable-trace'
import { gfsAppendTrace } from './gfs-trace'
import { chubbySessionTrace } from './chubby-trace'

test('bigtable trace passes lint', () => {
  const problems = lintTraceSpec(bigtableWriteTrace)
  expect(problems).toEqual([])
})

test('gfs trace passes lint', () => {
  const problems = lintTraceSpec(gfsAppendTrace)
  expect(problems).toEqual([])
})

test('chubby trace passes lint', () => {
  const problems = lintTraceSpec(chubbySessionTrace)
  expect(problems).toEqual([])
})
