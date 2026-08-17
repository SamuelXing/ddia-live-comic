import type { Chapter } from '../types'
import { OneMoveDiagram } from '../diagrams'
import { SeasonShapes } from '../actDiagrams'
import { ArcTable, ThroughLines } from '../SeasonBlocks'

/* The close. A chapter with no paper — the only page in the book that reads
   the other pages instead of a primary source.

   The reason it exists as a page you click rather than a block at the foot of
   the contents: a retrospective printed under the map is scenery, and gets
   scrolled past by everybody including the people it was written for. As a row
   in the table of contents it is a thing you can decide to read, which is the
   only way a summary earns its length.

   Everything factual here is already somewhere else in the book. What is new
   is the arrangement — that the acts are one move repeated, and that a handful
   of ideas cross all of them without owning a chapter. */

export const season1: Chapter = {
  slug: 'season-1',
  act: 'The Close',
  paperNo: 'The close',
  title: 'The Season, in One Page',
  dek: 'Seventeen papers, and the same three moves under all of them. What the acts add up to, and the five or six ideas that cross every one of them without ever getting a chapter of their own.',
  minutes: 8,
  caption:
    'Read the season straight through and the chapters look like seventeen different problems. They are not. **Every act makes the same three moves** — it runs into a limit, gives up a guarantee to get past it, and then spends years buying that guarantee back in a form it can afford. What changes between acts is which guarantee, and what the buying-back costs. This page is that shape, and the handful of ideas that show up in act after act without ever being the subject of one.',
  steps: [
    {
      title: 'One move, seven times',
      accent: 'denim',
      body: [
        'Nobody in this book solved the problem they opened with. They **moved the bill to somewhere it could be paid** — and then the next act ran into the place they moved it to. That is the whole plot, and it is why the season has six acts instead of one long argument.',
        'Read the rows below the way the chapters were written: the wall is the world, and nobody chose it. The other three columns are decisions, and every one of them is arguable.',
      ],
      diagram: <OneMoveDiagram />,
    },
    {
      title: 'The acts, as the trade each one made',
      span: 2,
      body: [
        'Four cells per act. **What forced it, what got sold, what that bought, and what it cost** — and the cost column is worth reading on its own, top to bottom, because it is a list of the things engineers now spend their weeks on. Compaction. Merge functions. Round trips to a quorum. Pipelines. Staleness budgets. None of that is incidental; each one is the receipt for a decision somebody made deliberately, a decade or more ago, for a reason that was good at the time.',
      ],
      diagram: <ArcTable season={1} />,
    },
    {
      title: 'What kept coming back',
      accent: 'denim',
      span: 2,
      body: [
        'These are the ideas that never got a chapter, because they are not any one paper’s idea. They surface in act after act, usually without being named, and each one is worth more than the system it happened to appear in. *If you remember six things from the season, these are a defensible six.*',
      ],
      diagram: <ThroughLines season={1} />,
    },
    {
      title: 'The eight shapes, side by side',
      body: [
        'Each act opened with a picture, and they were never eight unrelated drawings — they are **the same world redrawn under whatever was breaking that decade.** One box. A pyramid with a master on top. A ring with nobody in charge. The floor underneath both of them. A storey added on top. The whole thing tipped on its side with the log at the centre. A fork. And the ring growing its organs back.',
        'Put them in a row and the argument stops needing words. *Nothing here was replaced; everything was added to, or turned over, or grown back.* The dashed line is the part worth sitting with — it runs from the last shape to the first, because the answer at the end of each act is what the next act ran into.',
      ],
      diagram: <SeasonShapes />,
    },
    {
      title: 'What the season left out, on purpose and otherwise',
      accent: 'terra',
      body: [
        '**The Prologue is not written.** Chapter 0 — the thirty years when one machine was enough, and the relational model, B-trees and transactions that every later chapter spends — is a row in the contents and nothing else yet. That is an odd hole to have at the front of a finished season, and it is the honest state of the book rather than a structural choice.',
        '**Whole families of systems are one sentence here.** CRDTs get a paragraph in Chapter 5 and deserve a chapter. Riak, Voldemort, MongoDB and VoltDB are descendants and sidebars. Spark is a hook at the end of Chapter 2 and nothing more, deliberately: it belongs to a season about computation rather than storage.',
        '**And the reading is one-sided by construction.** Nearly every paper here was written by the organisation that shipped the system, about the version that worked. There are no papers about the two designs they tried first, and very few numbers anybody outside could reproduce. *Treat every measurement in this book as a claim by an interested party* — which is not a reason to disbelieve it, and is a reason to notice how rarely the claim is one you could check.',
      ],
    },
  ],
  sources: [
    {
      year: '2015',
      title: 'Readings in Database Systems, 5th Edition — edited by Peter Bailis, Joseph M. Hellerstein and Michael Stonebraker',
      url: 'https://web.archive.org/web/20260806182941/http://www.redbook.io/',
      note: 'The Red Book, and the honest next step after this season. A curated reading list with an argumentative editorial in front of each section, written by people who disagree with each other in print. Read the introductions even if you read none of the papers — they are the closest thing the field has to an opinionated map, and they contradict several conclusions this book reaches. Linked through the archive because redbook.io still serves plain HTTP only.',
    },
    {
      year: '2015',
      title: 'Immutability Changes Everything — Pat Helland (ACM Queue)',
      url: 'https://queue.acm.org/detail.cfm?id=2884038',
      note: 'The through-line on this page that most deserved its own chapter, argued properly by somebody who was there for most of it. Append-only storage, versioned data, the log as truth and the table as a view — one essay that connects GFS, LSM trees, Percolator’s multi-version rows and Snowflake’s file sets. Short, and worth more than most of the papers it summarises.',
    },
    {
      year: '2017',
      title: 'Designing Data-Intensive Applications — Martin Kleppmann',
      url: 'https://dataintensive.net/',
      note: 'The book that teaches the mechanisms this season only watched being invented. Where these chapters ask why somebody built a thing in 2007, it asks what the thing does and when you should reach for it. The two are complementary in a specific way: read a chapter here for the pressure, then the matching chapter there for the machinery.',
    },
    {
      year: '2015',
      title: 'Turning the Database Inside Out — Martin Kleppmann',
      url: 'https://www.confluent.io/blog/turning-the-database-inside-out-with-apache-samza/',
      note: 'Where Season 2 starts, if you do not want to wait. It takes Chapter 13’s claim — the log is the record and everything else is a reader — and follows it until the database has been taken apart into its four constituent jobs. The talk it is transcribed from is the single best hour available on why stream processing looks the way it does.',
    },
  ],
  seenIn: [
    { label: 'The Retreat — Ch 17', to: '/papers/dynamodb', live: true },
    { label: 'The Cart That Must Not Close — Ch 5', to: '/papers/dynamo', live: true },
    { label: 'Write Once, Replay Everywhere — Ch 13', to: '/papers/kafka', live: true },
    { label: 'The whole table of contents', to: '/papers', live: true },
  ],
  finale: {
    title: 'The pressure outlives the answer',
    body: 'The papers in this book were right about their problems and are being steadily contradicted about their conclusions, which is what a healthy field looks like from the inside. Read them for the pressure that forced the design rather than for the design: the pressure comes back, and the answers are made of whatever hardware and economics happened to exist that year. A leaderless ring made sense when the alternative was a master and the hardware was yours. It made less sense once the machines were rented and the operator was a stranger. Nothing was refuted; the premises moved, and the conclusions went with them. That is the useful thing to carry into the next season, and into whatever you are building this week.',
  },
  next: { title: 'The Cost of Starting Over', slug: 'spark' },
}
