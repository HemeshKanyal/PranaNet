// Chapter 1 evidence wall (docs/STORY.md). Our own one-line summaries + links, never copies of
// the articles. Keep the wording exactly this careful: allegations stay allegations.
export interface WallCard { place: string; when: string; summary: string; source: string; url: string; kind: "conviction" | "allegation" | "inquiry" | "survey" }

const STAR = "https://www.thestar.com.my/aseanplus/aseanplus-news/2025/12/02/indias-capital-accused-of-tampering-with-air-quality-readings-to-make-pollution-look-less-dire";

export const WALL: WallCard[] = [
  {
    place: "Xi'an, China", when: "2016", kind: "conviction",
    summary: "Officials stuffed cotton into air monitors 28 times; seven were jailed in 2017.",
    source: "Caixin, 29 Jan 2018",
    url: "https://www.caixinglobal.com/2018-01-29/court-papers-reveal-how-officials-faked-xian-air-pollution-readings-101204613.html",
  },
  {
    place: "Hunan, China", when: "2018", kind: "allegation",
    summary: "Workers sprayed mist cannons near monitoring stations during smog, per a provincial notice.",
    source: "Caixin, 2 Feb 2018",
    url: "https://www.caixinglobal.com/2018-02-02/what-bad-air-hunan-officials-use-mist-cannons-to-fool-pollution-meters-101206784.html",
  },
  {
    place: "Delhi", when: "Oct 2025", kind: "allegation",
    summary: "After a water-sprinkler video at the Anand Vihar monitor, reporters found the ground still wet and the air still toxic.",
    source: "Newslaundry, 27 Oct 2025",
    url: "https://www.newslaundry.com/2025/10/27/ground-still-wet-air-stays-toxic-a-reality-check-at-anand-vihar-air-monitor-after-water-sprinkler-video",
  },
  {
    place: "Delhi", when: "Diwali 2025", kind: "allegation",
    summary: "163 hours of peak-period AQI data were lost, against 34 hours the year before.",
    source: "The Straits Times via The Star, 2 Dec 2025",
    url: STAR,
  },
  {
    place: "Delhi", when: "Nov 2025", kind: "allegation",
    summary: "A reporter watched a sprinkler truck repeatedly spray around the Jahangirpuri station; officials called the charges politically motivated and said sprinkling is citywide.",
    source: "The Straits Times via The Star, 2 Dec 2025",
    url: STAR,
  },
  {
    place: "Supreme Court of India", when: "17 Nov 2025", kind: "inquiry",
    summary: "Asked the Delhi government to explain its AQI equipment and how accurate it is.",
    source: "The Leaflet",
    url: "https://theleaflet.in/amp/story/leaflet-reports/supreme-court-asks-delhi-government-to-detail-aqi-monitoring-equipment-and-its-accuracy",
  },
  {
    place: "Survey, Delhi region", when: "Oct 2025", kind: "survey",
    summary: "87% of residents in and around Delhi had little or no trust in official air data.",
    source: "The Straits Times via The Star, 2 Dec 2025",
    url: STAR,
  },
];
