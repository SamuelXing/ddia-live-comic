import type { TraceSpec } from '../../components/TracePlayer'
import { VIZ } from '../../styles/viz'

/* One transaction against one machine, which is what the next thirty chapters
   spend their time taking apart. The trace exists because the ordering is the
   entire correctness argument and no still picture carries an ordering: the
   log record has to be on the disk before the page it describes, and the
   commit is the log write rather than the data write. Read it once here and
   Chapter 1's refusal to edit a byte, Chapter 3's memtable, and Chapter 14's
   "the log is the database" all land as variations rather than as news.

   Colours: blue on the transaction, which is the client. Amber on the lock
   table, the only coordinator in the picture. Green on the pages and the
   buffer pool, since they are the store. Violet on the log, because it is a
   replication log for a single machine's own future self. Red on the crash.

   Geometry: three bands, and every particle crosses one — nothing travels
   along a row. The log lives on the right in both memory and disk so that the
   forcing step is a short vertical hop rather than a diagonal across the
   pages it is protecting. */
const C = {
  txn: VIZ.blue,
  lock: VIZ.amber,
  page: VIZ.green,
  log: VIZ.violet,
  crash: VIZ.red,
}

export const prologueTrace: TraceSpec = {
  title: 'One transaction, one machine, and the order the writes have to happen in',
  aspect: 0.56,
  zones: [
    { label: 'The transaction', x: 2, y: 3, w: 96, h: 14 },
    { label: 'Memory', x: 2, y: 19, w: 96, h: 14 },
    /* short, because a zone label is drawn at a fixed y and a long one runs
       straight across the node beside it — which this one did, in ink, on the
       first render. The point it used to make now lives in step 1's prose. */
    { label: 'The disk', x: 2, y: 35, w: 96, h: 17 },
  ],
  nodes: [
    { id: 'txn', x: 6, y: 6, w: 38, h: 8, label: 'DEBIT_CREDIT', sub: 'move £40, both sides', color: C.txn },
    { id: 'lock', x: 56, y: 6, w: 38, h: 8, label: 'The lock table', sub: 'who is waiting for whom', color: C.lock },
    { id: 'buf', x: 6, y: 22, w: 38, h: 8, label: 'Buffer pool', sub: 'pages, in core', color: C.page },
    { id: 'logbuf', x: 56, y: 22, w: 38, h: 8, label: 'Log buffer', sub: 'written, not yet durable', color: C.log },
    { id: 'btree', x: 6, y: 38, w: 38, h: 11, label: 'The B-tree', sub: 'root · internal · leaf', color: C.page },
    { id: 'log', x: 56, y: 38, w: 38, h: 11, label: 'The log', sub: 'its own spindle', color: C.log },
  ],
  steps: [
    {
      title: 'Everything you can see is about to be a lie',
      prose:
        'One process, one disk, one clock. The only thing in this picture that survives the power going off is the bottom band, and reaching it costs about <b>50 milliseconds</b> — long enough that a design is judged by how few times it goes there. Everything above the line is fast and imaginary. <em>The whole of this chapter is about the gap between those two sentences.</em>',
      focus: ['btree', 'log'],
      particles: [],
    },
    {
      title: 'Finding the account is four seeks at worst',
      prose:
        'The transaction wants one account out of ten million. It walks the index from the root down, and each level is one page fetched from disk — but a page holds <b>120 entries</b>, so four levels cover two hundred million keys. In practice the top levels are already in the buffer pool because every transaction touches them, so this costs one seek or none. <em>The tree is wide because a seek buys the transfer of about five hundred entries, and being wide is how you spend the transfer instead of the seek.</em>',
      focus: ['txn', 'buf', 'btree'],
      particles: [
        { from: 'txn', to: 'buf', color: C.txn },
        { from: 'btree', to: 'buf', color: C.page, count: 2 },
      ],
    },
    {
      title: 'And nobody else may touch it now',
      prose:
        'Before changing anything the transaction takes a lock on the account, and holds it until the very end. That is the rule doing the work: <b>do not read anybody’s uncommitted data, and do not release your own until you are finished.</b> Follow it and any interleaving of transactions comes out equivalent to some order in which they ran one after another — so a programmer may write as though nothing else is running, which is the entire point.',
      focus: ['txn', 'lock'],
      particles: [{ from: 'txn', to: 'lock', color: C.lock }],
    },
    {
      title: 'The change happens in memory, where it does not count',
      prose:
        'The balance is updated in the buffer pool. The teller’s drawer and the branch total change too — <em>three pages, one intention</em> — and the disk underneath still holds every one of the old values. Stop the machine here and nothing has happened, which is exactly the property being engineered: <b>a half-finished transaction has to be indistinguishable from one that never started.</b>',
      focus: ['buf', 'txn'],
      particles: [{ from: 'txn', to: 'buf', color: C.page, count: 3 }],
    },
    {
      title: 'The log record goes to the disk first — always first',
      prose:
        'Before any modified page may be written down, the record describing how to undo and redo it has to be on the disk already. Write the page first and crash, and there is no longer anything that knows what the old value was. <b>This is the write-ahead rule, and it is the one invariant everything else rests on.</b> Note where it came from: log buffers used to live in core memory, which survived a power cut, so the rule only became necessary once memory stopped being magnetic.',
      focus: ['logbuf', 'log'],
      particles: [{ from: 'logbuf', to: 'log', color: C.log, count: 2 }],
    },
    {
      title: 'Commit is the log write, not the data write',
      prose:
        'The transaction commits by forcing its log to disk and nothing else. <em>The pages it changed may still be sitting in memory, unwritten, for minutes.</em> That is the trick worth carrying: durability is bought with one sequential write to one file, rather than with several scattered writes to wherever the data happens to live — and sequential is the only thing a disc is good at.',
      focus: ['txn', 'log'],
      particles: [{ from: 'txn', to: 'logbuf', color: C.log }, { from: 'logbuf', to: 'log', color: C.log }],
    },
    {
      title: 'Now pull the plug',
      prose:
        'Memory is gone: the buffer pool, the lock table, the log buffer, all of it. On the disk there is a B-tree in an unknown state — some pages carrying committed changes, some carrying half-finished ones, most stale — and a log. <b>Nobody knows anything yet, and that is fine.</b>',
      focus: ['buf', 'logbuf', 'lock'],
      particles: [
        { from: 'buf', to: 'txn', color: C.crash },
        { from: 'logbuf', to: 'lock', color: C.crash },
      ],
    },
    {
      title: 'The log says what happened, and it is the only thing that does',
      prose:
        'Restart reads the log forward and <b>redoes</b> everything that committed, then backward and <b>undoes</b> everything that did not. Both operations have to be safe to apply twice, because a crash during recovery starts recovery again. The whole apparatus — the tree, the pages, the buffer pool — is reconstructible from a file somebody appended to. <em>Which is a sentence this book will write about twenty more times, and this is where it is true first.</em>',
      focus: ['log', 'buf', 'btree'],
      particles: [
        { from: 'log', to: 'buf', color: C.log, count: 2 },
        { from: 'buf', to: 'btree', color: C.page },
      ],
    },
  ],
}
