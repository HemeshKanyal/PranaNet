"use client";
import { useStoryArea } from "@/lib/story/live";
import { moodLabel } from "@/lib/story/poses";
import type { Address } from "@/lib/types";
import type { VerifierCell } from "@/lib/verifier";
import { Chapter, Ledger } from "./Chapter";
import { SideIndex } from "./ChapterIndex";
import { CheatPanel } from "./CheatPanel";
import { CheckItYourself } from "./CheckItYourself";
import { EndingText, StoryFooter } from "./Ending";
import { Clippings, DelhiStory } from "./EvidenceWall";
import { GoGlobal } from "./GoGlobal";
import { Hero } from "./Hero";
import { SlashSequence } from "./SlashSequence";
import { Stage } from "./Stage";
import { TamperDemo } from "./TamperDemo";
import { TrickTiles, TricksText } from "./Tricks";
import { WhoPays } from "./WhoPays";

export function Story({ arkivWriter, initialCell }: { arkivWriter: Address | null; initialCell: VerifierCell | null }) {
  const live = useStoryArea(initialCell);
  return (
    <>
      <SideIndex />
      <Hero live={live} />

      <Chapter id="before" side="right" stage={<Stage pose="pointing" mood="Very Poor" label={moodLabel("Very Poor")} prop="peacock" />} below={<Clippings />}>
        <DelhiStory />
      </Chapter>

      <Chapter id="why" side="left" stage={<Stage pose="shrug" mood="Satisfactory" label={moodLabel("Satisfactory")} prop="pot" />} below={<TrickTiles />}>
        <TricksText />
      </Chapter>

      <Chapter
        id="signed"
        side="right"
        stage={<Stage pose="seated" mood="Moderate" label={moodLabel("Moderate")} />}
        below={<Ledger className="mx-auto max-w-3xl"><TamperDemo /></Ledger>}
      >
        <p className="mt-5">
          Each node holds its own key and <b className="text-cream">signs every reading on the sensor itself</b>. Your browser can check that
          signature without asking anyone, and if a single digit changes, the check fails.
        </p>
        <p className="mt-3 text-sand">Not even the server that carries the data can change it.</p>
      </Chapter>

      <Chapter
        id="democracy"
        side="left"
        stage={<Stage pose="standing" mood="Poor" label={moodLabel("Poor")} />}
        below={<Ledger className="mx-auto max-w-3xl"><p className="font-[family-name:var(--font-rozha)] text-2xl text-maroon">Try to cheat</p><CheatPanel live={live} /></Ledger>}
      >
        <p className="mt-5">
          Anyone can run a node: a home, a school, a housing society. <b className="text-cream">One human, one voice:</b> World ID proves
          you&apos;re a unique person without revealing who, and each person can run at most 3 nodes, so nobody can fake a crowd.
        </p>
        <p className="mt-3 text-sand">Neighbours and the official station check each other. Below are the real nodes around us, live.</p>
      </Chapter>

      <SlashSequence />

      <Chapter id="check" below={<Ledger><CheckItYourself writer={arkivWriter} /></Ledger>}>
        <p className="mt-5">The latest readings, read straight from Arkiv by your browser. Verify any of them yourself.</p>
      </Chapter>

      <Chapter id="pays" below={<Ledger><WhoPays /></Ledger>}>
        <p className="mt-5">Honest work gets paid from revenue, not from a token.</p>
      </Chapter>

      <Chapter id="global" below={<GoGlobal live={live} />}>
        <p className="mt-5">One venue today. Every city with a dispute about its air tomorrow.</p>
      </Chapter>

      <Chapter id="ending" side="left" stage={<Stage pose="with-builder" mood="Good" label={moodLabel("Good")} prop="peacock-right" walk />}>
        <EndingText />
      </Chapter>

      <StoryFooter />
    </>
  );
}
