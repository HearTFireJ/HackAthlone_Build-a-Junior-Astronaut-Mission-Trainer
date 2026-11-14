// Event cards: small surprises that turn up some mornings. Each one asks the
// commander to choose between two answers, and neither answer is free.
//
// These events are made up for the game. Only the solar flares and storms are real records.

import { CREW, MISSIONS, crewInfo } from './content.ts'
import type { GameState } from './outpost.ts'

export const EVENT_IDS = [
  'rock',
  'dust',
  'school',
  'birthday',
  'shadow',
  'pod',
  'pump',
  'newcrew',
  'homesick',
  'stuck',
  'find',
] as const
export type EventId = (typeof EVENT_IDS)[number]

export interface EventOption {
  label: string
  /** What it costs or gives, in a few words, shown under the button. */
  detail: string
  apply: (state: GameState, who: string | null) => void
  result: (state: GameState, who: string | null) => string
}

export interface EventCard {
  title: string
  icon: string
  text: (state: GameState, who: string | null) => string
  /** True when the card is about one astronaut, picked by the dice. */
  aboutSomeone: boolean
  /** True when the card is about the astronaut who is away on a rover trip. */
  aboutTraveller?: boolean
  /** Whether the card can turn up in this state. */
  when: (state: GameState) => boolean
  options: [EventOption, EventOption]
}

const nameOf = (who: string | null) => (who ? crewInfo(who).name : 'Someone')

function moodFor(state: GameState, change: (id: string) => number): void {
  for (const astronaut of state.crew) astronaut.mood += change(astronaut.id)
}

const someoneAway = (state: GameState) => state.crew.some((astronaut) => astronaut.away)
const traveller = (state: GameState, who: string | null) => state.crew.find((astronaut) => astronaut.id === who && astronaut.away)

export const EVENTS: Record<EventId, EventCard> = {
  rock: {
    title: 'A hole in the Greenhouse',
    icon: '☄️',
    text: () => 'A space rock the size of a pea hit the Greenhouse roof. Air is hissing out.',
    aboutSomeone: false,
    when: (state) => !state.broken.includes('farm'),
    options: [
      {
        label: 'Send the repair robot now',
        detail: 'Uses 2 power today',
        apply: (state) => {
          state.powerPenalty += 2
        },
        result: () => 'The robot patched the hole. You have 2 less power today.',
      },
      {
        label: 'Seal the door and fix it later',
        detail: 'Greenhouse is off until someone repairs it',
        apply: (state) => {
          state.broken.push('farm')
        },
        result: () => 'The Greenhouse is closed. Give someone the Repair job to open it again.',
      },
    ],
  },
  dust: {
    title: 'Dusty panels',
    icon: '🌫️',
    text: () => 'Moon dust has settled on the solar panels. They are making less power.',
    aboutSomeone: false,
    when: () => true,
    options: [
      {
        label: 'Shake the dust off with the motors',
        detail: 'Uses 2 power today',
        apply: (state) => {
          state.powerPenalty += 2
        },
        result: () => 'The panels are clean again. You have 2 less power today.',
      },
      {
        label: 'Leave the dust',
        detail: '1 less power every day until someone repairs the panels',
        apply: (state) => {
          state.solarLoss += 1
        },
        result: () => 'The panels stay dusty. Give someone the Repair job to clean them.',
      },
    ],
  },
  school: {
    title: 'A call from a school',
    icon: '🏫',
    text: () => 'A class in Athlone wants to talk to the crew by video. They have a lot of questions.',
    aboutSomeone: false,
    when: () => true,
    options: [
      {
        label: 'Take the call',
        detail: 'Uses 1 power today. Everyone cheers up',
        apply: (state) => {
          state.powerPenalty += 1
          moodFor(state, () => 1)
        },
        result: () => 'The children asked how you go to the toilet in space. The crew is still laughing.',
      },
      {
        label: 'Too busy today',
        detail: 'Nothing changes',
        apply: () => {},
        result: () => 'You sent the class a photo instead.',
      },
    ],
  },
  birthday: {
    title: 'A birthday',
    icon: '🎂',
    text: (_state, who) => `It is ${nameOf(who)}'s birthday today.`,
    aboutSomeone: true,
    when: (state) => state.food >= 4,
    options: [
      {
        label: 'Have a party',
        detail: 'Uses 2 food. Everyone cheers up',
        apply: (state, who) => {
          state.food -= 2
          moodFor(state, (id) => (id === who ? 2 : 1))
        },
        result: (_state, who) => `There was cake, more or less. ${nameOf(who)} is very happy.`,
      },
      {
        label: 'Work as usual',
        detail: 'The birthday astronaut is sad',
        apply: (state, who) => {
          moodFor(state, (id) => (id === who ? -1 : 0))
        },
        result: (_state, who) => `${nameOf(who)} says it is fine. It is not really fine.`,
      },
    ],
  },
  shadow: {
    title: 'A long shadow',
    icon: '🌑',
    text: () => 'The shadow of a crater rim is lying across some of the solar panels today.',
    aboutSomeone: false,
    when: () => true,
    options: [
      {
        label: 'Dim the lights in the crew rooms',
        detail: 'Everyone is a bit gloomy',
        apply: (state) => {
          moodFor(state, () => -1)
        },
        result: () => 'The crew spent the morning in the half dark.',
      },
      {
        label: 'Keep the lights on',
        detail: '2 less power today',
        apply: (state) => {
          state.powerPenalty += 2
        },
        result: () => 'The rooms stay bright. You have 2 less power today.',
      },
    ],
  },
  pod: {
    title: 'A supply pod has landed',
    icon: '📦',
    text: () => 'A cargo pod from Earth came down a long drive from the base. It is full of food and air.',
    aboutSomeone: false,
    when: (state) => !state.pod,
    options: [
      {
        label: 'Mark it on the map',
        detail: 'A new 2-day rover trip: Fetch the supply pod',
        apply: (state) => {
          state.pod = true
        },
        result: () => 'The pod is on the map. Send someone with the rover when you can.',
      },
      {
        label: 'Leave it',
        detail: 'Nothing changes',
        apply: () => {},
        result: () => 'The pod sits in the dust. Maybe the next crew will want it.',
      },
    ],
  },
  pump: {
    title: 'A funny noise',
    icon: '🔧',
    text: () => 'The pump in Life Support is making a noise like a cat in a tin.',
    aboutSomeone: false,
    when: () => true,
    options: [
      {
        label: 'Stop it and fix it',
        detail: 'Life Support cannot run today',
        apply: (state) => {
          state.offToday.push('life')
        },
        result: () => 'The pump is fixed. Life Support cannot run until tomorrow.',
      },
      {
        label: 'Keep it running',
        detail: 'Life Support makes less air for 3 days',
        apply: (state) => {
          state.weakLifeDays = 3
        },
        result: () => 'The pump keeps going, slowly. Life Support makes 2 less air for 3 days.',
      },
    ],
  },
  newcrew: {
    title: 'One more astronaut?',
    icon: '🚀',
    text: () => 'Mission Control can send one more astronaut on a cargo flight. More hands, and one more mouth.',
    aboutSomeone: false,
    when: (state) => state.crew.length < CREW.length && !state.arriving && state.day <= 6,
    options: [
      {
        label: 'Yes, send them',
        detail: 'A new astronaut lands tomorrow. They need air and food too',
        apply: (state) => {
          const onCrew = state.crew.map((astronaut) => astronaut.id)
          state.arriving = CREW.find((member) => !onCrew.includes(member.id))?.id ?? null
        },
        result: (state) => `${nameOf(state.arriving)} lands tomorrow morning.`,
      },
      {
        label: 'No, thank you',
        detail: 'Nothing changes',
        apply: () => {},
        result: () => 'The seat goes to a different base.',
      },
    ],
  },
  homesick: {
    title: 'Missing home',
    icon: '🌍',
    text: (_state, who) => `${nameOf(who)} keeps looking at Earth through the window. They miss home.`,
    aboutSomeone: true,
    when: () => true,
    options: [
      {
        label: 'Let them call home tonight',
        detail: 'Uses 1 power today. They cheer up',
        apply: (state, who) => {
          state.powerPenalty += 1
          moodFor(state, (id) => (id === who ? 2 : 0))
        },
        result: (_state, who) => `${nameOf(who)} talked to family for an hour and feels better.`,
      },
      {
        label: 'Ask them to keep going',
        detail: 'Their mood drops',
        apply: (state, who) => {
          moodFor(state, (id) => (id === who ? -2 : 0))
        },
        result: (_state, who) => `${nameOf(who)} nods and goes quiet.`,
      },
    ],
  },
  stuck: {
    title: 'The rover is stuck',
    icon: '🚙',
    text: (_state, who) => `${nameOf(who)} calls from the rover: the wheels are sinking into soft dust.`,
    aboutSomeone: false,
    aboutTraveller: true,
    when: someoneAway,
    options: [
      {
        label: 'Dig it out by hand',
        detail: 'Hard work in a spacesuit: they lose 1 health',
        apply: (state, who) => {
          const driver = traveller(state, who)
          if (driver) driver.health -= 1
        },
        result: (_state, who) => `${nameOf(who)} dug for two hours. The rover is rolling again, and ${nameOf(who)} is worn out.`,
      },
      {
        label: 'Back out slowly and go the long way',
        detail: 'The trip takes 1 more day',
        apply: (state, who) => {
          const driver = traveller(state, who)
          if (driver?.away) driver.away.daysLeft += 1
        },
        result: (_state, who) => `${nameOf(who)} takes the long way round. The trip will take one more day.`,
      },
    ],
  },
  find: {
    title: 'Something shiny',
    icon: '✨',
    text: (_state, who) => `${nameOf(who)} calls from the rover: something is glinting in a little crater beside the track.`,
    aboutSomeone: false,
    aboutTraveller: true,
    when: someoneAway,
    options: [
      {
        label: 'Stop and take a look',
        detail: 'The trip takes 1 more day. They bring something home',
        apply: (state, who) => {
          const driver = traveller(state, who)
          if (driver?.away) driver.away.daysLeft += 1
          if (state.missions.shield < MISSIONS.shield.goal) state.missions.shield = Math.min(MISSIONS.shield.goal - 1, state.missions.shield + 2)
          else moodFor(state, () => 1)
        },
        result: (state, who) =>
          state.missions.shield < MISSIONS.shield.goal
            ? `${nameOf(who)} found a glassy kind of Moon soil. It is just what the Lab needed: the shield research jumps ahead.`
            : `${nameOf(who)} found a glassy rock, and the whole crew wants to see it.`,
      },
      {
        label: 'Keep driving',
        detail: 'Nothing changes',
        apply: () => {},
        result: (_state, who) => `${nameOf(who)} drives on. Whatever it was, it is still out there.`,
      },
    ],
  },
}
