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

      <Chapter id="before" side="right" stage={<Stage pose="pointing" mood="Very Poor" label={moodLabel("Very Poor")} props={["peacock-left"]} />} below={<Clippings />}>
        <DelhiStory />
      </Chapter>

      <Chapter id="why" side="left" stage={<Stage pose="shrug" mood="Satisfactory" label={moodLabel("Satisfactory")} props={["table"]} />} below={<TrickTiles />}>
        <TricksText />
      </Chapter>

      <Chapter
        id="signed"
        side="right"
        stage={<Stage pose="seated" mood="Moderate" label={moodLabel("Moderate")} />}
        below={<Ledger className="mx-auto max-w-4xl"><TamperDemo /></Ledger>}
      >
        <p className="mt-5">
          The ESP32 on each node <b className="text-cream">signs every reading with its own key</b> before it leaves the board. Below is the
          latest one from our sensor at BKC. Change a single digit and your browser rejects it.
        </p>
        <p className="mt-3 text-sand">Not even the server that carries the data can change it.</p>
      </Chapter>

      <Chapter
        id="democracy"
        side="left"
        stage={<Stage pose="standing" mood="Poor" label={moodLabel("Poor")} props={["sensor", "incense"]} />}
        below={<Ledger className="mx-auto max-w-4xl"><p className="font-[family-name:var(--font-rozha)] text-2xl text-maroon">Try to cheat</p><CheatPanel live={live} /></Ledger>}
      >
        <p className="mt-5">
          Anyone can run a node: a home, a school, a housing society. <b className="text-cream">One human, one voice:</b> World ID proves
          you&apos;re a unique person without revealing who, and each person can run at most 3 nodes, so nobody can fake a crowd.
        </p>
        <p className="mt-3 text-sand">Below are the nodes at BKC right now. Put yours in the middle and try to fool them.</p>
      </Chapter>

      <SlashSequence />

      <Chapter id="check" below={<Ledger><CheckItYourself writer={arkivWriter} /></Ledger>}>
        <p className="mt-5">Every reading is stored on Arkiv. The table below comes straight from Arkiv into your browser, without passing through our server. Press verify on any row.</p>
      </Chapter>

      <Chapter id="pays" side="right" stage={<Stage pose="builder" fill="#2B4A55" label="The customer: pays for proof" />} below={<Ledger><WhoPays /></Ledger>}>
        <p className="mt-5">Construction sites in Mumbai already have to monitor their dust, which makes them the first people who would pay for readings that come with proof, along with regulators and apps. That money goes to the people running the nodes. There is no token.</p>
      </Chapter>

      <Chapter id="global" below={<GoGlobal live={live} />}>
        <p className="mt-5">Today it&apos;s a handful of nodes at one venue in BKC. Mumbai&apos;s construction sites come next, then Delhi, where this started.</p>
      </Chapter>

      <Chapter id="ending" side="left" stage={<Stage pose="with-builder" mood="Good" label={moodLabel("Good")} props={["peacock-right"]} walk />}>
        <EndingText />
      </Chapter>

      <StoryFooter />
    </>
  );
}
