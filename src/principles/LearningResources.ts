/**
 * LearningResources - Curated book/chapter recommendations keyed to DesignPrincipleLinter's
 * own diagnostic ids (SRP-FAT-CLASS, DEMETER-VIOLATION, KISS-METAPROGRAMMING,
 * YAGNI-UNUSED-PRIVATE). Deliberately not a new smell-detection engine — DesignPrincipleLinter
 * already finds these; this only adds "here's further reading" to a smell it already flagged,
 * surfaced as an extra Code Action alongside the existing Quick Fix / AI-fix actions.
 */

export interface LearningResource {
  book: string
  chapter: string
  note: string
}

const RESOURCES: Record<string, LearningResource> = {
  'SRP-FAT-CLASS': {
    book: 'Practical Object-Oriented Design (POODR), by Sandi Metz',
    chapter: 'Ch. 2 — Designing Classes with a Single Responsibility',
    note: 'A class that knows or does too much is POODR\'s opening example (a bicycle\'s Gear class) — this chapter walks through recognizing the smell and extracting responsibility one method at a time.',
  },
  'DEMETER-VIOLATION': {
    book: 'Practical Object-Oriented Design (POODR), by Sandi Metz',
    chapter: 'Ch. 4 — Creating Flexible Interfaces ("train wrecks")',
    note: 'POODR calls a chain like this a "train wreck": each extra `.` couples your code to another object\'s internal structure. The chapter covers when to delegate vs. when a chain is actually fine.',
  },
  'KISS-METAPROGRAMMING': {
    book: 'Metaprogramming Ruby 2, by Paolo Perrotta',
    chapter: 'Ch. 3 — Methods (define_method, method_missing, class_eval)',
    note: 'Walks through exactly what define_method/class_eval/instance_eval do to the method lookup path, so you can judge whether the dynamism here is earning its complexity.',
  },
  'YAGNI-UNUSED-PRIVATE': {
    book: 'Practical Object-Oriented Design (POODR), by Sandi Metz',
    chapter: 'Ch. 9 — Designing Cost-Effective Tests',
    note: '"You aren\'t gonna need it" — unused code (and the tests it would need) is a maintenance cost with no offsetting benefit. POODR\'s testing chapter frames why that trade never pays off.',
  },
}

export function getLearningResource(diagnosticId: string): LearningResource | null {
  return RESOURCES[diagnosticId] ?? null
}
