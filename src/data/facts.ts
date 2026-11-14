// Real-life facts shown in the game, each with the page it comes from.
// Every line here was checked against its source on 14 November 2026.
// The wording stays inside what the source says: change one only after re-reading the source.

export interface Fact {
  text: string
  source: string
  url: string
}

export const FACTS = {
  ice: {
    text: "NASA spacecraft found signs of water ice inside craters near the Moon's poles that never see the Sun. Astronauts will need water for drinking, for oxygen to breathe and for making rocket fuel.",
    source: 'NASA Science: Moon Water and Ices',
    url: 'https://science.nasa.gov/moon/moon-water-and-ices/',
  },
  shield: {
    text: 'On the Moon, astronauts could pile Moon soil over their shelters to help block radiation.',
    source: 'NASA Science: How NASA Will Protect Astronauts From Space Radiation at the Moon',
    url: 'https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/',
  },
  dish: {
    text: 'The far side of the Moon is thought to be one of the best places for a radio telescope. NASA and its partners are preparing a small one, called LuSEE-Night, to land there.',
    source: 'NASA Science: CS-3 Science Payloads',
    url: 'https://science.nasa.gov/lunar-science/clps-deliveries/cs-3/',
  },
  sun: {
    text: 'Scientists increasingly think that huge clouds blasted off the Sun, called coronal mass ejections, drive its most dangerous particle storms.',
    source: 'NASA Science: How NASA Will Protect Astronauts From Space Radiation at the Moon',
    url: 'https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/',
  },
  flash: {
    text: 'The flash from a solar flare travels at the speed of light. It reaches us about 8 minutes after the flare happens.',
    source: 'NASA Science: Solar Storms and Flares',
    url: 'https://science.nasa.gov/sun/solar-storms-and-flares/',
  },
  particles: {
    text: 'The fastest particles from a solar storm can arrive in only 15 to 30 minutes. Slower ones keep arriving for hours or days.',
    source: 'NASA Solar Dynamics Observatory: SDO & Space Weather',
    url: 'https://sdo.gsfc.nasa.gov/mission/spaceweather.php',
  },
  fraction: {
    text: 'NASA scientists say that only a small fraction of flares and clouds from the Sun send out the particles that are dangerous to astronauts. Nobody can yet tell which ones will.',
    source: 'NASA Science: How NASA Will Protect Astronauts From Space Radiation at the Moon',
    url: 'https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/',
  },
  shelter: {
    text: "In NASA's Orion spacecraft, the crew stacks storage bags around themselves to make a shelter during a radiation storm. They have up to one hour to build it.",
    source: 'NASA: Orion Crew Systems',
    url: 'https://www.nasa.gov/reference/crew-systems/',
  },
  panels: {
    text: "High-speed particles from the Sun can wear down a spacecraft's solar panels.",
    source: 'NASA Science: Solar Storms and Flares',
    url: 'https://science.nasa.gov/sun/solar-storms-and-flares/',
  },
  dust: {
    text: 'Moon dust is sharp like tiny bits of glass. On the Apollo missions it stuck to spacesuits and clogged machines.',
    source: 'NASA: Dust, An Out-of-This World Problem',
    url: 'https://www.nasa.gov/humans-in-space/dust-an-out-of-this-world-problem/',
  },
  family: {
    text: 'Crews on the space station video-chat with family and friends to feel less far from the people they love.',
    source: 'NASA: Isolation, What Can We Learn From the Experiences of NASA Astronauts?',
    url: 'https://www.nasa.gov/humans-in-space/isolation-what-can-we-learn-from-the-experiences-of-nasa-astronauts/',
  },
  light: {
    text: "At the Moon's poles the Sun always sits near the horizon, so shadows are very long and sweep across the ground.",
    source: "NASA Science: Shadows near the Moon's South Pole",
    url: 'https://science.nasa.gov/resource/shadows-near-the-moons-south-pole/',
  },
  cargo: {
    text: 'NASA plans cargo landers that will carry big equipment, like a rover, to the Moon.',
    source: 'NASA: Missions for Two Future Artemis Cargo Landers',
    url: 'https://www.nasa.gov/news-release/nasa-plans-to-assign-missions-for-two-future-artemis-cargo-landers/',
  },
  rover: {
    text: 'Japan is building a Moon rover with a cabin, where two astronauts can live and work for up to 30 days at a time.',
    source: 'NASA: NASA and Japan Sign Agreement for Lunar Rover',
    url: 'https://www.nasa.gov/news-release/nasa-japan-advance-space-cooperation-sign-agreement-for-lunar-rover/',
  },
  hazards: {
    text: 'NASA names five big dangers of living in space. Being isolated and shut in with the same few people is one of them, next to radiation.',
    source: 'NASA: 5 Hazards of Human Spaceflight',
    url: 'https://www.nasa.gov/hrp/hazards/',
  },
  plants: {
    text: "Astronauts grow plants on the space station. NASA says gardens are good for the crew's well-being, as well as for fresh food.",
    source: 'NASA: Growing Plants in Space',
    url: 'https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/',
  },
} satisfies Record<string, Fact>

export type FactId = keyof typeof FACTS

/** The fact that goes with each mission, shown when it is finished. */
export const MISSION_FACTS = { ice: 'ice', shield: 'shield', dish: 'dish', sun: 'sun' } as const satisfies Record<string, FactId>

/** The fact that goes with some of the morning event cards. */
export const EVENT_FACTS: Partial<Record<string, FactId>> = {
  dust: 'dust',
  homesick: 'family',
  shadow: 'light',
  pod: 'cargo',
  stuck: 'rover',
}
