// Chapter ids, Roman numerals and titles: shared by the chapters, the contents list and the side index.
export const CHAPTERS = [
  { id: "before", roman: "I", title: "It's happened before" },
  { id: "why", roman: "II", title: "Why tampering works" },
  { id: "signed", roman: "III", title: "Signed at the source" },
  { id: "democracy", roman: "IV", title: "A democracy of honest nodes" },
  { id: "honest-work", roman: "V", title: "Proof of honest work" },
  { id: "check", roman: "VI", title: "Check it yourself" },
  { id: "pays", roman: "VII", title: "Who pays for honest air" },
  { id: "global", roman: "VIII", title: "Start local, go global" },
  { id: "ending", roman: "IX", title: "Nobody owns the truth" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];
export const chapter = (id: ChapterId) => CHAPTERS.find((c) => c.id === id)!;
