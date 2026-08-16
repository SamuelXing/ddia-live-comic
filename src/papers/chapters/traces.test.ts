import { test, expect } from 'vitest'
import { lintTraceSpec } from '../../components/traceLint'
import { bigtableWriteTrace } from './bigtable-trace'
import { gfsAppendTrace } from './gfs-trace'

test('bigtable trace passes lint', () => {
  const problems = lintTraceSpec(bigtableWriteTrace)
  expect(problems).toEqual([])
})

test('gfs trace passes lint', () => {
  const problems = lintTraceSpec(gfsAppendTrace)
  expect(problems).toEqual([])
})
