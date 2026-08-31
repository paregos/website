const winterInJapan = ({ month }) => month === 12 || month <= 2;
const fridayDinner = ({ weekday, hour }) =>
  weekday === 'Fri' && hour >= 16 && hour <= 23;
const lateNight = ({ hour }) => hour >= 22 || hour < 4;
const sleepHours = ({ hour }) => hour >= 23 || hour < 8;

const dinnerWeight = ({ hour }) => (hour >= 17 && hour <= 21 ? 3 : 1);
const cosyWeatherWeight = ({ weather }) =>
  ['rain', 'storm', 'overcast', 'fog', 'snow'].includes(weather?.kind) ||
  weather?.temperature < 18
    ? 3
    : 1;
const hotWeatherWeight = ({ weather }) => weather?.temperature >= 28 ? 3 : 1;
const weekendWeight = ({ weekday }) => weekday === 'Sat' || weekday === 'Sun' ? 2 : 1;

export const ACTIVITIES = [
  { text: 'Bouldering', weight: weekendWeight },
  { text: 'Recovering from bouldering' },
  { text: 'Skiing in Japan', when: winterInJapan },
  { text: 'Looking at flights to Japan' },
  { text: 'Eating ramen', weight: cosyWeatherWeight },
  { text: 'Trying not to order ramen', weight: dinnerWeight },
  { text: 'Watching Dune', weight: cosyWeatherWeight },
  { text: 'Listening to Spotify' },
  { text: 'Vibecoding' },
  { text: 'Thinking about which MapleStory class to main' },
  { text: 'Trying to remember kanji' },
  { text: 'Watering my passionfruit plant' },
  { text: 'Checking on my passionfruit plant' },
  { text: 'Doomscrolling', weight: ({ hour }) => lateNight({ hour }) ? 3 : 1 },
  { text: 'Eating Muscle Chef', weight: dinnerWeight },
  { text: 'Wondering if Muscle Chef counts as cooking', weight: dinnerWeight },
  { text: 'Playing badminton', weight: weekendWeight },
  { text: 'Daydreaming I’m a successful game dev' },
  { text: 'Planning a game I may never finish' },
  { text: 'Making $$$$' },
  { text: 'Sleeping', when: sleepHours },
  { text: 'Staying up later than intended', when: lateNight },
  { text: 'Running to catch the T8' },
  { text: 'Waiting for the T8' },
  { text: 'Eating dinner at Canva', when: fridayDinner, weight: dinnerWeight },
  { text: 'Playing board games with friends', weight: cosyWeatherWeight },
  { text: 'Buying another board game' },
  { text: 'Drinking an expensive mocha' },
  { text: 'Eating Taco Bell', weight: dinnerWeight },
  { text: 'Drinking Sprite Zero', weight: hotWeatherWeight },
  { text: 'Overthinking a side project' },
  { text: 'Pretending this tab is productive' },
  { text: 'Debugging something that worked yesterday' },
  { text: 'Making something nobody asked for' },
  { text: 'Watching a video that explains the double-slit experiment' },
  { text: 'Watching someone explain why time might not be real' },
  { text: 'Watching a 47-minute video about black holes' },
  { text: 'Trying to understand the double-slit experiment again' },
];

export function getEligibleActivities(context) {
  return ACTIVITIES.filter((activity) => !activity.when || activity.when(context));
}

export function pickActivity(context, recent = [], random = Math.random) {
  const eligible = getEligibleActivities(context);
  const fresh = eligible.filter((activity) => !recent.includes(activity.text));
  const choices = fresh.length ? fresh : eligible;
  const weighted = choices.map((activity) => ({
    activity,
    weight: Math.max(0, activity.weight?.(context) ?? 1),
  }));
  const totalWeight = weighted.reduce((total, choice) => total + choice.weight, 0);

  let target = random() * totalWeight;
  for (const choice of weighted) {
    target -= choice.weight;
    if (target <= 0) return choice.activity.text;
  }

  return choices.at(-1)?.text || '';
}
