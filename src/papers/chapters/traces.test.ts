import { test, expect } from 'vitest'
import { lintTraceSpec } from '../../components/traceLint'
import { bigtableWriteTrace } from './bigtable-trace'

test('bigtable trace passes lint', () => {
  const problems = lintTraceSpec(bigtableWriteTrace)
  expect(problems).toEqual([])
})
