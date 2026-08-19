import { describe, expect, it } from 'vitest'
import { TOC, SEASONS, seasonOfAct, seasonProgress, progressLabel } from './book'
import { ACT_FIGURES } from './actDiagrams'
import { CHAPTERS, CHAPTER_BY_SLUG } from './chapters'

/* The act openers are split across two files — prose in book.ts (plain data,
   no JSX) and pictures in actDiagrams.tsx — joined by a string key. That join
   is exactly the kind of thing that rots silently: an act renders with a hole
   where its figure should be and nothing complains. These tests are the
   complaint. */

describe('the season table of contents', () => {
  it('gives every act that reads papers a figure, a summary and a hinge', () => {
    /* The Close is an act with no opener on purpose — it sets up no pressure,
       it reads the acts that did. Every act that carries a paper still has to
       introduce itself, which is what this was written to enforce. */
    const storyActs = TOC.filter((a) =>
      a.entries.some((e) => e.slug && CHAPTER_BY_SLUG[e.slug]?.paper),
    )
    expect(storyActs.length).toBeGreaterThan(5)
    for (const act of storyActs) {
      expect(act.figure, `${act.act} has no figure key`).toBeTruthy()
      expect(act.summary?.length ?? 0, `${act.act} summary looks empty`).toBeGreaterThan(80)
      expect(act.next?.length ?? 0, `${act.act} has no hinge line`).toBeGreaterThan(20)
    }
  })

  it('never half-writes an opener', () => {
    /* A figure with no words next to it, or words with an empty frame beside
       them, both render as something broken rather than as something absent. */
    const half = TOC.filter((a) => !!a.figure !== !!a.summary).map((a) => a.act)
    expect(half).toEqual([])
  })

  it('resolves every figure key, and leaves no figure unused', () => {
    const used = TOC.map((a) => a.figure).filter((f): f is string => !!f).sort()
    for (const key of used) expect(ACT_FIGURES[key], `no figure named "${key}"`).toBeTypeOf('function')
    expect(Object.keys(ACT_FIGURES).sort()).toEqual(used)
  })

  it('only links TOC rows to chapters that actually exist', () => {
    for (const act of TOC)
      for (const e of act.entries)
        if (e.slug) expect(CHAPTER_BY_SLUG[e.slug], `${e.no} points at a missing chapter`).toBeTruthy()
  })

  it('agrees with each chapter about whether it is an interlude', () => {
    /* Two files have to hold the same opinion: the TOC row carries the
       `interlude` marker, the chapter carries it by *not* having a paper. If
       they drift, a page renders with no citation card under a row that
       promises one, or the reverse. */
    const wrong: string[] = []
    for (const act of TOC)
      for (const e of act.entries) {
        const ch = e.slug ? CHAPTER_BY_SLUG[e.slug] : undefined
        if (!ch) continue
        if (e.interlude && ch.paper) wrong.push(`${e.title}: TOC says interlude, chapter cites a paper`)
        if (!e.interlude && !ch.paper) wrong.push(`${e.title}: chapter has no paper but the TOC calls it a chapter`)
      }
    expect(wrong).toEqual([])
  })

  it('lists every chapter that exists — the other direction', () => {
    /* The half nobody thinks to check: a chapter can be written, registered and
       routed while its TOC row still has no slug, so the season map shows it as
       unwritten and nothing links to it. The page would look finished from the
       chapter and unfinished from the index. */
    const linked = new Set(TOC.flatMap((a) => a.entries).map((e) => e.slug).filter(Boolean))
    const orphaned = Object.keys(CHAPTER_BY_SLUG).filter((s) => !linked.has(s))
    expect(orphaned).toEqual([])
  })
})

describe('the season’s progress counter', () => {
  /* "1 of 18" was typed by hand in three places and all three were stale the
     moment Chapter 1 shipped. The count is derived now; these pin it. */
  it('counts the chapters that are live, not the rows that exist', () => {
    const chapters = Object.values(CHAPTER_BY_SLUG).filter((c) => c.paper)
    expect(seasonProgress().live).toBe(chapters.length)
  })

  it('does not let an interlude inflate the count', () => {
    /* An interlude is a live page with a slug and is deliberately not a
       chapter — counting it would make the fraction disagree with a table of
       contents that plainly numbers eighteen. */
    const interludes = Object.values(CHAPTER_BY_SLUG).filter((c) => !c.paper)
    expect(interludes.length).toBeGreaterThan(0)
    expect(seasonProgress().live + interludes.length).toBe(Object.keys(CHAPTER_BY_SLUG).length)
  })

  it('counts chapters, not interludes, in the total', () => {
    const rows = TOC.flatMap((a) => a.entries)
    expect(seasonProgress().total).toBe(rows.length - rows.filter((e) => e.interlude).length)
    expect(rows.some((e) => e.interlude)).toBe(true) // or the line above proves nothing
  })

  it('states what there is to read, without a fraction', () => {
    /* The fraction read as an off-by-one, because the chapters start at Ch 0 —
       a reader counts to Ch 17 and is told there are 18. */
    const { live } = seasonProgress()
    expect(progressLabel()).toBe(`${live} chapters live`)
    expect(live).toBeGreaterThan(0)
    expect(progressLabel()).not.toMatch(/ of /)
  })

})

describe('the chain of “next” teasers at the foot of every chapter', () => {
  /* Nothing checked these until Chapter 17 shipped, and shipping it needed two
     edits in two files: the new chapter, and the previous chapter's `next`
     changing from unwritten to a slug. A typo in that slug renders a link to
     /papers/whatever, which is a page the router does not have — and the only
     way anyone finds out is by clicking the last link on a finished chapter,
     which is the link a reader is most likely to click and an author least
     likely to re-test.

     The reading order lives in CHAPTERS. These pin the teasers to it, so the
     chain cannot quietly disagree with the order the book is registered in. */
  const order = CHAPTERS.map((c) => c.slug)

  it('points every teaser at a chapter that exists', () => {
    const broken = CHAPTERS.filter((c) => c.next?.slug && !CHAPTER_BY_SLUG[c.next.slug]).map(
      (c) => `${c.slug} → ${c.next?.slug}`,
    )
    expect(broken).toEqual([])
  })

  it('follows the reading order, one chapter at a time', () => {
    /* Not merely "forwards": the next teaser is the very next chapter, because
       a teaser that skips one is how a chapter becomes unreachable by reading. */
    const wrong = CHAPTERS.flatMap((c, i) => {
      const expected = order[i + 1]
      const actual = c.next?.slug
      if (!expected) return actual ? [`${c.slug} is last but teases ${actual}`] : []
      return actual === expected ? [] : [`${c.slug} → ${actual ?? 'nothing'}, expected ${expected}`]
    })
    expect(wrong).toEqual([])
  })

  it('gives the teaser the title of the chapter it points at', () => {
    /* The title is typed by hand in the previous chapter, so it drifts the
       moment a chapter is renamed — and it drifts silently, because the link
       still works and only the words are stale. */
    const stale = CHAPTERS.filter((c) => c.next?.slug && CHAPTER_BY_SLUG[c.next.slug]?.title !== c.next.title).map(
      (c) => `${c.slug} calls it “${c.next?.title}”`,
    )
    expect(stale).toEqual([])
  })

  it('leaves the last live chapter teasing something unwritten', () => {
    /* There is no next chapter to name and the foot of the last page is still
       the most-clicked link on it, so it has to say the book is unfinished
       rather than dead-end in silence. */
    const last = CHAPTERS[CHAPTERS.length - 1]
    expect(last.next?.unwritten).toBe(true)
    expect(last.next?.slug).toBeUndefined()
  })
})

describe('the chapter numbers written into cross-links', () => {
  /* Chapter numbers are typed by hand into `seenIn` labels — "The Cart That
     Must Not Close — Ch 6" — and the number lives in exactly one other place,
     the TOC row. Writing the epilogue I got Dynamo's number wrong in a label
     and in ten sentences of prose, because I had it as Ch 6 in my head and
     nothing in the repo disagreed with me.

     Prose is not checkable. A label next to the link it labels is: the `to`
     says which chapter is meant, so the number in the text has to match the
     number the TOC gives that chapter. That is the half of the mistake a test
     can hold, and it is the half a reader clicks. */
  const numberBySlug: Record<string, string> = {}
  for (const act of TOC)
    for (const e of act.entries) if (e.slug && /^Ch \d+$/.test(e.no)) numberBySlug[e.slug] = e.no

  it('has chapter numbers to check', () => {
    expect(Object.keys(numberBySlug).length).toBeGreaterThan(10)
  })

  it('gives every labelled cross-link the number the TOC gives that chapter', () => {
    const wrong: string[] = []
    for (const c of CHAPTERS)
      for (const s of c.seenIn) {
        const m = /^\/papers\/([\w-]+)$/.exec(s.to ?? '')
        const label = /\bCh (\d+)\b/.exec(s.label)
        if (!m || !label) continue
        const expected = numberBySlug[m[1]]
        if (expected && expected !== `Ch ${label[1]}`)
          wrong.push(`${c.slug}: “${s.label}” points at ${m[1]}, which is ${expected}`)
      }
    expect(wrong).toEqual([])
  })
})

describe('the book in seasons', () => {
  /* Two seasons now, and both of these were free while there was one. An act
     name is the join between a chapter and its season (`seasonOfAct`), and a
     chapter number is the join between prose and the contents — "Chapter 13"
     appears in sentences no tool can check, so the least the contents can do
     is guarantee the number means exactly one thing. */

  it('gives every season a label, a question and some acts', () => {
    for (const s of SEASONS) {
      expect(s.label, `season ${s.n} has no label`).toMatch(/^Season \d+ · /)
      expect(s.dek.length, `season ${s.n} has no dek`).toBeGreaterThan(80)
      expect(s.acts.length, `season ${s.n} has no acts`).toBeGreaterThan(0)
    }
  })

  it('never gives two acts the same name', () => {
    /* seasonOfAct() finds an act by name across every season. Two acts sharing
       one — a second "Epilogue", say — would silently put a chapter in the
       wrong season's masthead. */
    const names = TOC.map((a) => a.act)
    expect(names.length).toBe(new Set(names).size)
  })

  it('resolves every act back to the season it is in', () => {
    const orphaned = TOC.filter((a) => !seasonOfAct(a.act)).map((a) => a.act)
    expect(orphaned).toEqual([])
  })

  it('numbers chapters straight through the book, with no gaps or repeats', () => {
    /* Seasons are later acts of the same book, so Season 2 opens at Ch 18.
       Restarting would make "Chapter 5" mean two things, and this book
       cross-references bare chapter numbers in prose constantly. */
    const nums = TOC.flatMap((a) => a.entries)
      .map((e) => /^Ch (\d+)$/.exec(e.no)?.[1])
      .filter((n): n is string => !!n)
      .map(Number)
    expect(nums.length).toBeGreaterThan(20)
    expect(nums).toEqual([...nums].sort((a, b) => a - b))
    expect(nums.length).toBe(new Set(nums).size)
    expect(nums).toEqual(nums.map((_, i) => nums[0] + i))
  })
})

describe('the season deks do not carry a hand-typed tally', () => {
  /* Season 1's dek opened "Seventeen papers on where the bytes sit" and stayed
     that way when Chapter 0 went in at the head of the season — a chapter that
     reads three more papers. So the first sentence on /papers undercounted the
     season, and the sentence after it said the season starts with a company
     that cannot fit its data on one machine, while the Prologue sat visibly
     underneath it opening in 1970.

     That is the sixth hand-typed count in this repo to go stale: three in the
     progress labels, one in the read index, one in the roadmap, this one. The
     counts that survive are the ones derived from the data — progressLabel()
     and remainingLabel() — and the lesson has been learned expensively enough
     to be worth a test rather than a resolution.

     A number that is genuinely about the SUBJECT is fine and this does not
     touch it: Season 2's dek can say a system waits 200 milliseconds. What is
     banned is counting the book's own contents in prose, because the contents
     change and the prose does not. */
  const COUNT_OF_CONTENTS =
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|\d+)[\s-]+(papers?|chapters?|acts?)\b/i

  it('has deks to check', () => {
    expect(SEASONS.length).toBeGreaterThan(1)
    for (const s of SEASONS) expect(s.dek.length).toBeGreaterThan(80)
  })

  it('never counts its own chapters or papers in a season dek', () => {
    const counting = SEASONS.filter((s) => COUNT_OF_CONTENTS.test(s.dek)).map(
      (s) => `${s.label}: “${COUNT_OF_CONTENTS.exec(s.dek)![0]}”`,
    )
    expect(counting).toEqual([])
  })
})
