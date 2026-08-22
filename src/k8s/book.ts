/**
 * Book C — Kubernetes. One constant to rename when the title settles;
 * everything (nav brand, masthead, document titles) reads it from here, which
 * is the lesson book B paid for.
 *
 * WHY THIS BOOK IS SHAPED DIFFERENTLY FROM BOOK B, stated here because a
 * reader will notice and because I nearly got it wrong.
 *
 * Book B ran on one move: read a paper, design it yourself, compare. That
 * works when the paper is the reason the system exists. Kubernetes is unusual
 * in having its reasons published at all — Borg, Omega, and above all "Borg,
 * Omega, and Kubernetes" (ACM Queue 2016), where the team explains what they
 * got wrong twice before getting here. That is the same shape as book B and it
 * is Act I.
 *
 * It is also about a third of what an expert needs. Reading the three papers
 * for this plan: the reconciliation loop is in them, in the authors' own words,
 * and so is choreography-against-orchestration, and labels-against-job-names,
 * and an entire section titled THINGS TO AVOID. The scheduler/kubelet split is
 * not — the word "kubelet" does not appear. Neither does "extensib". Those are
 * real chapters with no answer key, and pretending otherwise would repeat the
 * exact error the adversarial review caught in book B, where six sentences
 * claimed a chapter covered a paper it never mentions.
 *
 * So: two modes, declared rather than hidden. Act I reads papers. Acts II and
 * III read the API and the source, the way book F is planned to read xv6. The
 * contents page says which is which, because a reader who thinks every chapter
 * has a paper behind it will go looking for one that does not exist.
 */
export const BOOK = {
  title: 'Nobody Is In Charge',
  short: 'Kubernetes',
  /* The thesis, and the paper's own phrase: "control through choreography —
     achieving a desired emergent behavior by combining the effects of
     separate, autonomous entities that collaborate", named there as a
     conscious choice against a centralised orchestrator. Most explanations of
     Kubernetes start with containers. This one starts with the fact that
     nothing in it is in charge of anything. */
  dek: 'Kubernetes, read as a set of decisions with published reasons — including the ones its authors regret.',
}

export interface TocEntry {
  no: string
  title: string
  /**
   * A half-chapter with no paper and no component behind it — it sits between
   * two acts and compares them to something outside the book. Book B used the
   * same device for the RUM triangle and CAP. Interludes are not numbered,
   * because numbering them would make "Chapter 7" mean two things depending on
   * whether the reader counts them.
   */
  interlude?: boolean
  /** what the chapter reads: a paper, an API object, a component's source */
  reads: string
  /** present once the chapter is live */
  slug?: string
}

export interface TocAct {
  act: string
  /** Which mode this act runs in — printed, because the book changes gear. */
  mode: 'papers' | 'api' | 'source' | 'tool'
  summary: string
  entries: TocEntry[]
}

/**
 * The map. Nothing is written yet and that is the point: book B put its season
 * map up on day one, holes and all, and it made the shape arguable before the
 * shape was expensive to change.
 */
export const TOC: TocAct[] = [
  {
    act: 'Act I · The Answer Keys',
    mode: 'papers',
    summary:
      'Three papers in which the people who built this explain what they were thinking, twice failed, and once succeeded. This act is the only one with a paper behind every chapter, and it is where the load-bearing ideas are.',
    entries: [
      { no: 'Ch 1', title: 'A Loop, Not a Plan', reads: 'Borg, Omega, and Kubernetes · ACM Queue 2016' },
      { no: 'Ch 2', title: 'Choreography, Not Orchestration', reads: 'Borg, Omega, and Kubernetes · ACM Queue 2016' },
      { no: 'Ch 3', title: 'Names Are Not a Data Model', reads: 'Borg · EuroSys 2015' },
      { no: 'Ch 4', title: 'Two Schedulers, One Cluster', reads: 'Omega · EuroSys 2013' },
      { no: 'Ch 5', title: 'The Things They Say To Avoid', reads: 'Borg, Omega, and Kubernetes · §Things to avoid' },
    ],
  },
  {
    act: 'Interlude',
    /* Not 'api'. It renders the label on screen, and this act reads neither a
       paper nor Kubernetes — it reads a different tool entirely. Mislabelling
       it "reads the API" is the exact thing this field was added to stop, and
       it was mislabelled for one commit until the render was looked at. */
    mode: 'tool',
    summary:
      'Act I argues that a loop beats a plan, and inside a book that only reads Kubernetes that argument cannot lose. So here is the same idea built the other way round, by people who were not wrong.',
    entries: [
      {
        no: '—',
        title: 'Interlude: The Other Reconciler',
        reads: 'Terraform · plan and apply',
        interlude: true,
      },
    ],
  },
  {
    act: 'Act II · The Object',
    mode: 'api',
    summary:
      'No paper from here on, and the book says so. What replaces it is the API itself — which is a database with admission control in front, and every argument in this act is about what that database refuses to promise.',
    entries: [
      { no: 'Ch 6', title: 'Everything Is a Row', reads: 'The API server' },
      { no: 'Ch 7', title: 'No Transaction Across Two Objects', reads: 'The API server' },
      { no: 'Ch 8', title: 'Who Owns This', reads: 'ownerReferences · garbage collection' },
      { no: 'Ch 9', title: 'List, Then Watch', reads: 'resourceVersion · informers' },
    ],
  },
  {
    act: 'Act III · The Machinery',
    mode: 'source',
    summary:
      'The components, read as what they are: controllers that happen to have names. Each one is the Act I loop again, pointed at something physical — a node, a network, a disk.',
    entries: [
      { no: 'Ch 10', title: 'The Scheduler Does Not Talk to the Kubelet', reads: 'kube-scheduler' },
      { no: 'Ch 11', title: 'The Kubelet Is a Controller Too', reads: 'kubelet · CRI' },
      { no: 'Ch 12', title: 'The Network Nobody Configured', reads: 'Service · Endpoints · CNI' },
      { no: 'Ch 13', title: 'Every Extension Is the Same Shape', reads: 'CRDs · controller-runtime' },
    ],
  },
  {
    act: 'The Close',
    mode: 'api',
    summary: 'What operating one actually consists of, and which of the arguments above you will meet at 3am.',
    entries: [{ no: 'Ch 14', title: 'The Book, in One Page', reads: 'all of it' }],
  },
]

/** Counted, never typed. Six hand-written tallies in this repo have gone stale. */
export const progress = () => {
  /* Interludes are pages and are deliberately not chapters — the same rule as
     book B, where counting them made "4 of 18" drift away from a contents page
     that plainly numbers eighteen. */
  const chapters = TOC.flatMap((a) => a.entries).filter((e) => !e.interlude)
  return { live: chapters.filter((e) => e.slug).length, total: chapters.length }
}

export const progressLabel = () => {
  const { live, total } = progress()
  return live === 0 ? `the map is up, ${total} chapters to write` : `${live} of ${total} chapters live`
}

export const MODE_LABEL: Record<TocAct['mode'], string> = {
  papers: 'reads a paper',
  api: 'reads the API',
  source: 'reads the source',
  tool: 'reads another tool',
}
