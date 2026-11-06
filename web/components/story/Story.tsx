"use client";
import { useMemo } from "react";
import { useStoryArea } from "@/lib/story/live";
import type { Scene } from "@/lib/story/scenes";
import type { Address } from "@/lib/types";
import type { VerifierCell } from "@/lib/verifier";
import { Chapter } from "./Chapter";
import { CheatPanel } from "./CheatPanel";
import { CheckItYourself } from "./CheckItYourself";
import { Ending, StoryFooter } from "./Ending";
import { EvidenceWall } from "./EvidenceWall";
import { GoGlobal } from "./GoGlobal";
import { Hero, StoryNav } from "./Hero";
import { SceneStage } from "./SceneStage";
import { SlashSequence } from "./SlashSequence";
import { TamperDemo } from "./TamperDemo";
import { Tricks } from "./Tricks";
import { WhoPays } from "./WhoPays";

export function Story({ arkivWriter, initialCell }: { arkivWriter: Address | null; initialCell: VerifierCell | null }) {
  const live = useStoryArea(initialCell);
  // Scene per scene-chapter, in scroll order. Index 0 (the hero) is today's live category.
  const order = useMemo<Scene[]>(() => [live.scene, "very-poor", "satisfactory", "moderate", "poor", "severe", "good"], [live.scene]);
  return (
    <SceneStage order={order}>
      <StoryNav />
      <Hero live={live} />
      <Chapter id="before" idx={1} n={1} title="It's happened before" wide>
        <EvidenceWall />
      </Chapter>
      <Chapter id="why" idx={2} n={2} title="Why tampering works">
        <Tricks />
      </Chapter>
      <Chapter id="signed" idx={3} n={3} title="Signed at the source">
        <TamperDemo />
      </Chapter>
      <Chapter id="democracy" idx={4} n={4} title="A democracy of honest nodes" wide>
        <p>
          Anyone can run a node: a home, a school, a housing society. <b>One human, one voice:</b> World ID proves you&apos;re a
          unique person without revealing who, and each person can run at most 3 nodes, so nobody can fake a crowd. Neighbours
          and the official station check each other. <b>Try to cheat:</b>
        </p>
        <CheatPanel live={live} />
      </Chapter>
      <SlashSequence idx={5} />
      <Chapter id="check" n={6} title="Check it yourself" paper>
        <CheckItYourself writer={arkivWriter} />
      </Chapter>
      <Chapter id="pays" n={7} title="Who pays for honest air" paper>
        <WhoPays />
      </Chapter>
      <Chapter id="global" n={8} title="Start local, go global" paper>
        <GoGlobal live={live} />
      </Chapter>
      <Ending idx={6} />
      <StoryFooter />
    </SceneStage>
  );
}

