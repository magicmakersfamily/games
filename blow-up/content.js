/* Blow Up — content. Everything the game knows about cards, places, days, science and words lives
   here as plain data, so new content never needs engine changes. sim.js reads this; index.html
   draws it. Times are sim-minutes after 7:00 (0 = 7:00, 780 = 20:00). */
(function (root) {
  'use strict';

  const hm = (h, m) => (h - 7) * 60 + (m || 0);

  // The six kinds of drops in the bucket. Every drop also carries its glyph, so colour is never the
  // only signal.
  const LOADS = {
    body:      { color: '#F28A30', glyph: '🍽', name: 'Body',      kid: 'tummy, sleepy, wiggly' },
    control:   { color: '#8F6BD9', glyph: '⏰', name: 'Control',   kid: 'bossed and rushed' },
    social:    { color: '#EC6FA8', glyph: '🧸', name: 'Social',    kid: 'friends and sharing' },
    sensory:   { color: '#E9B926', glyph: '🔊', name: 'Sensory',   kid: 'loud and bright' },
    thinking:  { color: '#3F93E0', glyph: '🧩', name: 'Thinking',  kid: 'hard and too much' },
    emotional: { color: '#DB3F35', glyph: '💔', name: 'Emotional', kid: 'unfair and sad' },
  };
  const LOAD_ORDER = ['body', 'control', 'social', 'sensory', 'thinking', 'emotional'];

  // The three jars (self-determination theory).
  const JARS = {
    choice:   { name: 'My Choice',   zh: '我選', py: ['wǒ', 'xuǎn'], glyph: '✋', color: '#F2A93B' },
    can:      { name: 'I Can Do It', zh: '我行', py: ['wǒ', 'xíng'], glyph: '💪', color: '#5DB36A' },
    together: { name: 'Together',    zh: '一起', py: ['yì', 'qǐ'],   glyph: '🤝', color: '#E7708E' },
  };

  /* Uh-Oh cards (irritants). amount = drops added. Optional:
     zone: multiplier per zone; phaseAmt: override in recovery phases; talking: counts as talking;
     set: body state to switch on; jar: marbles gained/lost; lastStraw: tiny spike, classic last straw;
     sock: the hidden itchy sock; anim: special kid reaction. */
  const UHOH = [
    { id: 'hungry',  icon: '🍽️', name: 'Hungry',            type: 'body',      amount: 6,  set: 'hungry', thought: 'My tummy is empty!',       feel: 'hungry' },
    { id: 'tired',   icon: '🥱', name: 'Tired',             type: 'body',      amount: 5,  set: 'tired',  thought: 'My eyes are so heavy…',     feel: 'tired' },
    { id: 'sock',    icon: '🧦', name: 'Itchy sock',        type: 'body',      amount: 4,  sock: true,    thought: 'Something feels wrong…',    feel: 'itchy' },
    { id: 'stop',    icon: '⏹️', name: 'Stop playing NOW',  type: 'control',   amount: 10, jar: { choice: -1 }, transition: true, thought: 'I wasn’t done!', feel: 'notdone' },
    { id: 'toy',     icon: '🧸', name: 'Toy taken',         type: 'social',    amount: 10, thought: 'That’s MINE!',                    feel: 'unfair' },
    { id: 'bluecup', icon: '🥤', name: 'The blue cup',      type: 'emotional', amount: 7,  thought: 'I wanted the BLUE cup!',          feel: 'unfair' },
    { id: 'tower',   icon: '🧱', name: 'Tower falls',       type: 'thinking',  amount: 8,  thought: 'It fell DOWN!',                   feel: 'frustrated' },
    { id: 'cookie',  icon: '🍪', name: 'Broken cookie',     type: 'emotional', amount: 3,  lastStraw: true, thought: 'My cookie is BROKEN!', feel: 'disappointed' },
    { id: 'lost',    icon: '🎲', name: 'Lost a game',       type: 'social',    amount: 9,  thought: 'I never win!',                    feel: 'disappointed' },
    { id: 'loud',    icon: '📢', name: 'Too loud',          type: 'sensory',   amount: 9,  thought: 'My ears hurt!',                   feel: 'noisy' },
    { id: 'calmdown',icon: '🙅', name: '“Calm down!”',      type: 'control',   amount: 8,  extra: { emotional: 6 }, talking: true, anim: 'balloon', thought: 'Don’t tell me how to feel!', feel: 'unheard' },
    { id: 'lecture', icon: '🗣️', name: 'Long lecture',      type: 'thinking',  amount: 5,  zone: { green: 1, yellow: 1.6, red: 3 }, phaseAmt: 16, talking: true, anim: 'pingpong', thought: 'Blah blah blah…', feel: 'unheard' },
  ];

  /* Helper cards. amount = drops drained. zone and phase multipliers; a negative multiplier is a
     backfire that adds `backfire` drops instead. pref: a kid preference that can flip the sign.
     skill: practising it builds a self-regulation skill. */
  const ALL_PHASES = { eruption: 1, cooling: 1, reconnect: 1, repair: 1, learn: 1 };
  const HELPERS = [
    { id: 'snack',   icon: '🍎', name: 'Snack',               amount: 10, target: 'body', clears: 'hungry', meal: true, drain: 'body',
      phase: { eruption: 0.2, cooling: 1, reconnect: 1, repair: 1, learn: 1 }, say: 'Crunch!' },
    { id: 'water',   icon: '💧', name: 'Water',               amount: 5,  target: 'body', drain: 'body',
      phase: { eruption: 0.5, cooling: 1.2, reconnect: 1, repair: 1, learn: 1 }, say: 'Gulp gulp' },
    { id: 'hug',     icon: '🤗', name: 'Hug',                 amount: 14, pref: 'hugs', drain: 'connection', jar: { together: 1 }, marble: 'A big hug',
      backfire: { social: 8 }, phase: { eruption: 0.3, cooling: 1.3, reconnect: 1.2, repair: 1, learn: 1 }, say: 'Squeeeze' },
    { id: 'name',    icon: '🏷️', name: 'Name the feeling',    amount: 8, drain: 'connection', names: true, jar: { together: 1 }, marble: 'You knew how I felt',
      zone: { green: 0.6, yellow: 1, red: 1.3 }, phase: { eruption: 0.4, cooling: 1.5, reconnect: 1.6, repair: 1.3, learn: 1 }, say: 'You feel mad because…' },
    { id: 'wish',    icon: '✨', name: 'Wish it with them',   amount: 9, drain: 'connection', jar: { together: 1 }, marble: 'We wished together',
      zone: { green: 0.7, yellow: 1, red: 1.2 }, phase: { eruption: 0.3, cooling: 1.2, reconnect: 1.5, repair: 1, learn: 1 }, say: 'I wish we could stay ALL day!' },
    { id: 'warn',    icon: '⏳', name: '5-minute warning',    amount: 2, drain: 'autonomy', warn: 30, jar: { choice: 1 }, marble: 'I got a heads-up',
      phase: { eruption: 0, cooling: 0.3, reconnect: 0.5, repair: 1, learn: 1 }, say: 'Five more minutes!' },
    { id: 'choice',  icon: '✌️', name: 'Choice of two',       amount: 5, drain: 'autonomy', jar: { choice: 1 }, marble: 'I got to pick',
      zone: { green: 1, yellow: 1, red: 0.7 }, phase: { eruption: 0, cooling: 0.5, reconnect: 0.8, repair: 1, learn: 1 }, say: 'This one or that one?' },
    { id: 'stomp',   icon: '🦖', name: 'Dinosaur stomp',      amount: 12, drain: 'movement', skill: 'stomp', move: true,
      phase: { eruption: 0.5, cooling: 1.3, reconnect: 1, repair: 1, learn: 1 }, say: 'STOMP STOMP ROAR' },
    { id: 'breathe', icon: '🌸', name: 'Flower and candle',   amount: 12, drain: 'quiet', skill: 'breathe', breathing: true,
      zone: { green: 0.8, yellow: 1.2, red: 0.8 }, phase: { eruption: 0.2, cooling: 1.4, reconnect: 1, repair: 1, learn: 1 }, say: 'Sniff sniff… whoooo' },
    { id: 'corner',  icon: '🛋️', name: 'Calm corner',         amount: 10, target: 'sensory', drain: 'quiet',
      phase: { eruption: 0.6, cooling: 1.2, reconnect: 1, repair: 1, learn: 1 }, say: 'Cosy and quiet' },
    { id: 'count',   icon: '🔢', name: 'Count to 10',         amount: 8, drain: 'quiet',
      zone: { green: 0.5, yellow: 1.2, red: 0.6 }, phase: { eruption: 0.1, cooling: 1, reconnect: 0.8, repair: 1, learn: 1 }, say: 'One… two… three…' },
    { id: 'silly',   icon: '🤪', name: 'Silly voice',         amount: 7, drain: 'connection', backfire: { emotional: 10 }, backThought: 'You’re laughing at me!',
      zone: { green: 1, yellow: 1.1, red: -1 }, phase: { eruption: -1.2, cooling: -0.6, reconnect: 0.3, repair: 0.8, learn: 1 }, say: 'Hello, I am a talking potato' },
    { id: 'tickle',  icon: '🪶', name: 'Tickles',             amount: 6, drain: 'connection', backfire: { social: 14 }, backThought: 'STOP! I said STOP!', anim: 'porcupine',
      zone: { green: 1, yellow: 0.3, red: -1.6 }, phase: { eruption: -1.8, cooling: -1, reconnect: -0.5, repair: 0.3, learn: 0.8 }, say: 'Tickle tickle' },
  ];

  /* Recovery tools appear only after a blow-up, in their own tray. */
  const TOOLS = [
    { id: 'close',   icon: '🫂', name: 'Stay close',          amount: 6, drain: 'connection', adult: -8,
      phase: { eruption: 1, cooling: 0.8, reconnect: 0.6, repair: 0.3, learn: 0.2 }, say: 'I’m right here.' },
    { id: 'quiet',   icon: '🤫', name: 'Few words, calm body', amount: 5, drain: 'quiet', adult: -15,
      phase: { eruption: 1, cooling: 0.8, reconnect: 0.4, repair: 0.2, learn: 0.2 }, say: '(slow breath)' },
    { id: 'squeeze', icon: '🤲', name: 'Squeeze my hands',     amount: 8, drain: 'movement',
      phase: { eruption: 0.4, cooling: 1.2, reconnect: 0.8, repair: 0.3, learn: 0.2 }, say: 'Squeeze… and let go.' },
    { id: 'here',    icon: '💙', name: '“I’m here”',           amount: 8, drain: 'connection', jar: { together: 1 }, marble: 'You stayed with me',
      phase: { eruption: 0.5, cooling: 1, reconnect: 1.4, repair: 0.8, learn: 0.5 }, say: 'I’m here. You’re safe.' },
    { id: 'sorry',   icon: '🙏', name: 'Say sorry',            amount: 6, drain: 'repair', talking: true, repair: true, jar: { together: 1 }, marble: 'We said sorry',
      phase: { eruption: 0, cooling: 0, reconnect: 0.3, repair: 1.2, learn: 0.6 }, say: 'Sorry I rushed you. Sorry I yelled.' },
    { id: 'fix',     icon: '🔧', name: 'Fix it together',      amount: 6, drain: 'repair', talking: true, repair: true, jar: { can: 1 }, marble: 'We fixed it together',
      phase: { eruption: 0, cooling: 0, reconnect: 0.3, repair: 1.2, learn: 0.6 }, say: 'Let’s pick up the pillows together.' },
    { id: 'plan',    icon: '🗺️', name: 'Plan for next time',   amount: 5, drain: 'repair', talking: true, repair: true, jar: { can: 1 }, marble: 'I have a plan',
      phase: { eruption: 0, cooling: 0, reconnect: 0.2, repair: 1.1, learn: 1 }, say: 'Next time you can stomp like a dinosaur.' },
    { id: 'consequence', icon: '⚖️', name: 'Consequence',      amount: 0, drain: 'repair', talking: true, backfire: { control: 8 }, backThought: 'That’s not FAIR!',
      phase: { eruption: -1, cooling: -1, reconnect: -1, repair: 0, learn: 0 }, say: 'No screens tomorrow!' },
    { id: 'praise',  icon: '⭐', name: 'Specific praise',      amount: 4, drain: 'competence', praise: 'specific', jar: { can: 2 }, marble: 'I stomped instead of hitting',
      phase: { eruption: 0, cooling: 0, reconnect: 0, repair: 0, learn: 1 }, say: 'You stomped instead of hitting. That was hard!' },
    { id: 'goodjob', icon: '👍', name: '“Good job!”',          amount: 1, drain: 'competence', praise: 'generic',
      phase: { eruption: 0, cooling: 0, reconnect: 0, repair: 0, learn: 0.3 }, say: 'Good job!' },
    { id: 'practice',icon: '🎯', name: 'Practise a tool',      amount: 3, drain: 'competence', practice: true, jar: { can: 1 }, marble: 'I practised',
      phase: { eruption: 0, cooling: 0, reconnect: 0, repair: 0.3, learn: 1 }, say: 'Let’s practise the flower breath.' },
  ];

  /* "Say It Differently". Both options have the same outcome ("done"); only the jars and load differ. */
  const SAYS = {
    shoes: { done: 'Shoes on', icon: '👟',
      control: { text: '“Put your shoes on NOW.”', load: 8, jar: { choice: -1 } },
      support: { text: '“Shoes before or after you grab your water?”', load: 1, jar: { choice: 1 }, marble: 'I chose when' } },
    leave: { done: 'Time to go', icon: '🛝',
      control: { text: '“Stop playing, we’re leaving.”', load: 9, jar: { choice: -1 } },
      support: { text: '“Five more minutes. Want to pick the last slide?”', load: 2, jar: { choice: 1 }, marble: 'I picked the last slide' } },
    veg: { done: 'Veggies eaten', icon: '🥦',
      control: { text: '“Eat your vegetables.”', load: 7, jar: { choice: -1 } },
      support: { text: '“Which vegetable goes first?”', load: 1, jar: { choice: 1 }, marble: 'I picked the first veggie' } },
    coat: { done: 'Coat zipped', icon: '🧥',
      control: { text: '“Let me do it, you’re too slow.”', load: 7, jar: { choice: -1, can: -1 } },
      support: { text: '“Take your time, I’ll wait.”', load: 1, jar: { can: 1 }, marble: 'I zipped it myself' } },
    bed: { done: 'In bed', icon: '🛏️',
      control: { text: '“Bed. Now.”', load: 8, jar: { choice: -1 } },
      support: { text: '“Two books or three songs tonight?”', load: 1, jar: { choice: 1 }, marble: 'I picked three songs' } },
    project: { done: 'Project chosen', icon: '🏰',
      control: { text: '“Today you’re doing a worksheet.”', load: 6, jar: { choice: -1 } },
      support: { text: '“What do you want to build today?”', load: 0, jar: { choice: 1 }, marble: 'I picked my project' } },
  };

  /* Places. drift = drops per sim-minute by load type; rest = extra natural recovery per minute;
     masking = the kid holds it together here (restraint collapse later). */
  const LOCATIONS = {
    home:       { name: 'Home',       sky: '#F7E3C8', drift: {}, rest: 0.02 },
    classroom:  { name: 'Classroom',  sky: '#EFE6D4', drift: { body: 0.045, thinking: 0.05, sensory: 0.025, control: 0.02 }, rest: 0, masking: true, adultBase: 40,
                  science: 'masking' },
    playground: { name: 'Playground', sky: '#BFE3F5', drift: { social: 0.02 }, rest: 0.1, move: true },
    field:      { name: 'Field',      sky: '#CDEBF7', drift: { sensory: 0.004 }, rest: 0.12, move: true, nature: true, science: 'nature' },
    bus:        { name: 'Bus',        sky: '#DDE8F0', drift: { sensory: 0.06, body: 0.02 }, rest: 0 },
    car:        { name: 'Car',        sky: '#DDE8F0', drift: { body: 0.04, thinking: 0.01 }, rest: 0 },
    walk:       { name: 'Walk',       sky: '#CDEBF7', drift: {}, rest: 0.08, move: true, nature: true },
  };

  // Random happenings. They fire from the seeded dice, only where they make sense.
  const CHAOS = [
    { id: 'seagull', icon: '🐦', name: 'A seagull stole the sandwich!', type: 'emotional', amount: 8, where: ['playground', 'field', 'walk'], set: 'hungry', thought: 'MY SANDWICH!' },
    { id: 'dog',     icon: '🐕', name: 'The dog ate the drawing!',      type: 'emotional', amount: 9, where: ['home'], thought: 'I worked SO hard on that!' },
    { id: 'icecream',icon: '🍦', name: 'Ice cream fell off the cone!',  type: 'emotional', amount: 7, where: ['playground', 'field', 'walk', 'home'], after: hm(13), thought: 'Noooo!' },
    { id: 'drill',   icon: '🚨', name: 'Surprise fire drill!',          type: 'sensory',   amount: 12, where: ['classroom'], thought: 'Too LOUD!' },
    { id: 'sneeze',  icon: '🤧', name: 'Sneeze attack!',                type: 'body',      amount: 4, where: null, thought: 'Ah… ah… AH-CHOO!' },
  ];

  /* Day styles. Scenes run back to back. events: at = minutes into the scene; card = a card id, or
     an inline effect. say = a Say It Differently moment with this style's default phrasing, used
     when nobody chooses (headless runs). */
  const DAY_STYLES = {
    rushed: {
      name: 'Rushed school day', icon: '⏰', mvp: true,
      blurb: 'Alarm clock, a gulped breakfast, a noisy bus, a long school day and a packed evening.',
      wake: 'alarm', sleepDebt: 1, adultStart: 50, meals: 'rushed',
      scenes: [
        { id: 'wake',      loc: 'home', room: 'bedroom', at: hm(7), dur: 10, label: 'Alarm clock wake-up', adult: 0.3,
          events: [{ at: 0, fx: { type: 'body', amount: 8, label: 'Alarm clock wake-up', thought: 'Five more minutes…' } }] },
        { id: 'dress',     loc: 'home', room: 'bedroom', at: hm(7, 10), dur: 15, label: 'Get dressed (hurry!)', rushed: true, adult: 0.4,
          say: [{ at: 8, id: 'shoes', def: 'control' }] },
        { id: 'breakfast', loc: 'home', room: 'kitchen', at: hm(7, 25), dur: 15, label: 'Rushed breakfast', rushed: true, meal: 0.6, adult: 0.3,
          events: [{ at: 5, fx: { type: 'control', amount: 7, label: 'Rushed breakfast', thought: 'I’m still eating!' } }] },
        { id: 'bus',       loc: 'bus', at: hm(7, 40), dur: 20, label: 'Noisy bus' },
        { id: 'class1',    loc: 'classroom', at: hm(8), dur: 120, label: 'Sitting still at school',
          events: [{ at: 30, fx: { type: 'thinking', amount: 7, label: 'Hard worksheet', thought: 'This is too hard!' } },
                   { at: 75, fx: { type: 'control', amount: 8, jar: { choice: -1 }, label: '“Because I said so”', thought: 'But WHY?' } }] },
        { id: 'recess',    loc: 'playground', at: hm(10), dur: 20, label: 'Short recess', recess: true,
          events: [{ at: 4, fx: { type: 'body', amount: -8, jar: { choice: 1 }, marble: 'I picked the recess game', label: 'Picked the recess game', thought: 'Let’s play tag!' } }],
          say: [{ at: 18, id: 'leave', def: 'control' }] },
        { id: 'class2',    loc: 'classroom', at: hm(10, 20), dur: 100, label: 'More sitting still',
          events: [{ at: 50, card: 'lost' }] },
        { id: 'lunch',     loc: 'classroom', room: 'lunch', at: hm(12), dur: 25, label: 'Noisy lunchroom', meal: 1, drift: { sensory: 0.12 } },
        { id: 'class3',    loc: 'classroom', at: hm(12, 25), dur: 155, label: 'Long afternoon',
          events: [{ at: 60, fx: { type: 'thinking', amount: 6, label: 'Too many instructions', thought: 'Wait, what do I do?' } },
                   { at: 110, fx: { type: 'body', amount: -5, jar: { choice: 1 }, marble: 'I chose a library book', label: 'Chose a library book', thought: 'The dinosaur one!' } }] },
        { id: 'activity',  loc: 'playground', at: hm(15), dur: 75, label: 'Soccer practice', adult: 0.1, drift: { control: 0.03 },
          events: [{ at: 20, fx: { type: 'control', amount: 6, label: 'Told how to play', thought: 'I want to be goalie!' } }] },
        { id: 'car',       loc: 'car', at: hm(16, 15), dur: 30, label: 'Traffic home', adult: 0.3 },
        { id: 'dinner',    loc: 'home', room: 'kitchen', at: hm(16, 45), dur: 45, label: 'Dinner', meal: 1, adult: 0.2,
          say: [{ at: 20, id: 'veg', def: 'control' }] },
        { id: 'homework',  loc: 'home', room: 'living', at: hm(17, 30), dur: 70, label: 'Homework and chores', drift: { thinking: 0.05 }, adult: 0.15,
          events: [{ at: 40, card: 'stop' }] },
        { id: 'bath',      loc: 'home', room: 'bath', at: hm(18, 40), dur: 40, label: 'Bath', adult: 0.2, bath: true },
        { id: 'bed',       loc: 'home', room: 'bedroom', at: hm(19, 20), dur: 40, label: 'Bedtime', bedtime: true,
          say: [{ at: 10, id: 'bed', def: 'control' }] },
      ],
    },
    supported: {
      name: 'Supported school day', icon: '🌤️', mvp: false,
      blurb: 'Calm morning, longer recess, a snack at pickup and one activity, not three.',
      wake: 'natural', sleepDebt: 0, adultStart: 25, scenes: null,
    },
    overscheduled: { name: 'Overscheduled achievement day', icon: '📅', mvp: false,
      blurb: 'School plus three activities.', wake: 'alarm', sleepDebt: 1, adultStart: 55, scenes: null },
    homeGood: { name: 'Flexible home day', icon: '🏡', mvp: false,
      blurb: 'Homeschool done well: rhythm, outdoor time, friends in the afternoon.', wake: 'natural', sleepDebt: 0, adultStart: 30, scenes: null },
    homeBad: { name: 'Home day gone wrong', icon: '📱', mvp: false,
      blurb: 'Hovering parent, no rhythm, a screen spiral, a lonely kid and a stressed parent.', wake: 'natural', sleepDebt: 0, adultStart: 55, scenes: null },
    adventure: {
      name: 'Child-led adventure day', icon: '🌳', mvp: true,
      blurb: 'Waking up naturally, a walk to the field, a self-chosen project, and a real limit or two.',
      wake: 'natural', sleepDebt: 0, adultStart: 32, meals: 'relaxed',
      scenes: [
        { id: 'wake',      loc: 'home', room: 'bedroom', at: hm(7), dur: 20, label: 'Slow wake-up' },
        { id: 'breakfast', loc: 'home', room: 'kitchen', at: hm(7, 20), dur: 30, label: 'Slow breakfast', meal: 1,
          events: [{ at: 12, card: 'bluecup' }] },
        { id: 'dress',     loc: 'home', room: 'bedroom', at: hm(7, 50), dur: 20, label: 'Get dressed (in your own time)',
          say: [{ at: 10, id: 'coat', def: 'support' }] },
        { id: 'walk',      loc: 'walk', at: hm(8, 10), dur: 30, label: 'Walk to the field' },
        { id: 'project',   loc: 'field', at: hm(8, 40), dur: 110, label: 'Building a stick fort',
          say: [{ at: 2, id: 'project', def: 'support' }],
          events: [{ at: 50, card: 'tower' },
                   { at: 80, fx: { type: 'thinking', amount: -6, jar: { can: 1 }, marble: 'I rebuilt the fort myself', label: 'Rebuilt the fort (productive struggle)', src: 'skill', thought: 'I DID it!' } }] },
        { id: 'outdoor',   loc: 'field', at: hm(10, 30), dur: 60, label: 'Mud and bugs', drift: { sensory: 0.03, body: 0.02 },
          events: [{ at: 20, fx: { type: 'sensory', amount: 6, label: 'A bug on my arm', thought: 'Get it OFF!' } }] },
        { id: 'lunch',     loc: 'field', at: hm(11, 30), dur: 40, label: 'Late picnic lunch', meal: 1,
          events: [{ at: 0, card: 'hungry' }] },
        { id: 'afternoon', loc: 'home', room: 'living', at: hm(12, 10), dur: 150, label: 'Grown-up working, kid on their own', adult: 0.12,
          drift: { social: 0.035, emotional: 0.02 },
          events: [{ at: 60, fx: { type: 'emotional', amount: 6, label: '“Not now, I’m working”', thought: 'Nobody wants to play with me.' } }] },
        { id: 'friends',   loc: 'playground', pick: ['playground', 'field'], at: hm(14, 40), dur: 90, label: 'Friends at the park',
          events: [{ at: 25, card: 'toy' }, { at: 60, card: 'lost' }],
          say: [{ at: 85, id: 'leave', def: 'control' }] },
        { id: 'walkhome',  loc: 'walk', at: hm(16, 10), dur: 25, label: 'Walk home (legs are tired)', drift: { body: 0.04 } },
        { id: 'dinner',    loc: 'home', room: 'kitchen', at: hm(16, 35), dur: 50, label: 'Dinner', meal: 1, adult: 0.1,
          say: [{ at: 20, id: 'veg', def: 'support' }] },
        { id: 'play',      loc: 'home', room: 'living', at: hm(17, 25), dur: 75, label: 'Free play',
          events: [{ at: 55, card: 'stop' }] },
        { id: 'bath',      loc: 'home', room: 'bath', at: hm(18, 40), dur: 40, label: 'Bath', bath: true },
        { id: 'bed',       loc: 'home', room: 'bedroom', at: hm(19, 20), dur: 40, label: 'Bedtime', bedtime: true,
          say: [{ at: 10, id: 'bed', def: 'support' }] },
      ],
    },
    custom: { name: 'Build your own day', icon: '🧰', mvp: false, blurb: 'Coming later.', scenes: null },
  };

  /* Kid profiles: hidden preferences the player discovers by trying things. */
  const KIDS = {
    pip: { name: 'Pip', hugs: 'loves', movement: 1.3, noise: 1.3, hair: '#5A3A22', skin: '#E9B98F', shirt: '#3F93E0' },
    rio: { name: 'Rio', hugs: 'space', movement: 1.0, noise: 1.0, hair: '#1E1A1A', skin: '#B97A52', shirt: '#5DB36A' },
  };

  // The feelings under the anger (the iceberg), with Traditional Chinese and pinyin per character.
  const FEELINGS = {
    angry:        { en: 'mad',            zh: '生氣',   py: ['shēng', 'qì'] },
    hungry:       { en: 'hungry',         zh: '餓',     py: ['è'] },
    tired:        { en: 'tired',          zh: '累',     py: ['lèi'] },
    itchy:        { en: 'itchy',          zh: '癢',     py: ['yǎng'] },
    unfair:       { en: 'it’s unfair',    zh: '不公平', py: ['bù', 'gōng', 'píng'] },
    notdone:      { en: 'I wasn’t done',  zh: '還沒玩完', py: ['hái', 'méi', 'wán', 'wán'] },
    frustrated:   { en: 'stuck',          zh: '挫折',   py: ['cuò', 'zhé'] },
    disappointed: { en: 'disappointed',   zh: '失望',   py: ['shī', 'wàng'] },
    noisy:        { en: 'too noisy',      zh: '太吵',   py: ['tài', 'chǎo'] },
    unheard:      { en: 'not listened to', zh: '沒人聽', py: ['méi', 'rén', 'tīng'] },
    bossed:       { en: 'bossed around',  zh: '被命令', py: ['bèi', 'mìng', 'lìng'] },
    lonely:       { en: 'lonely',         zh: '孤單',   py: ['gū', 'dān'] },
    embarrassed:  { en: 'embarrassed',    zh: '難為情', py: ['nán', 'wéi', 'qíng'] },
    calm:         { en: 'calm',           zh: '平靜',   py: ['píng', 'jìng'] },
  };
  // Which feeling a load type usually hides.
  const LOAD_FEELING = { body: 'hungry', control: 'bossed', social: 'lonely', sensory: 'noisy', thinking: 'frustrated', emotional: 'unfair' };

  const ZONES = {
    green:  { name: 'Green',  zh: '綠', py: ['lǜ'],    kid: 'Calm and ready' },
    yellow: { name: 'Yellow', zh: '黃', py: ['huáng'], kid: 'Wobbly' },
    red:    { name: 'Red',    zh: '紅', py: ['hóng'],  kid: 'Almost boiling' },
  };

  const BLOWUPS = {
    hangry:  { name: 'The Hangry Monster',    kid: 'GRRR, FOOD!' },
    noodle:  { name: 'Floppy Noodle meltdown', kid: 'I can’t even…' },
    gavel:   { name: 'Tiny Courtroom Tantrum', kid: 'NOT FAIR! Order in the court!' },
    tornado: { name: 'Spinning Tornado',      kid: 'Too much too much!' },
    volcano: { name: 'Glitter Volcano',       kid: 'KABOOM!' },
    whistle: { name: 'Steam-Whistle Stomp',   kid: 'YOU’RE NOT THE BOSS OF ME!' },
  };

  const PHASES = {
    eruption:  { name: 'Eruption',  kid: 'Storm',        tip: 'Stay close. Keep safe. Very few words.' },
    cooling:   { name: 'Cooling',   kid: 'Cooling down', tip: 'Breathe together, water, stomp, squeeze. No talking it over yet.' },
    reconnect: { name: 'Reconnect', kid: 'Coming back',  tip: 'Name the feeling. “I’m here.” Wish it with them.' },
    repair:    { name: 'Repair',    kid: 'Fix it',       tip: 'Sorry, fix it together, plan for next time.' },
    learn:     { name: 'Learn',     kid: 'Grow',         tip: 'Praise the exact skill they used. Practise a tool.' },
  };

  /* Science cards: a kid line, a grown-up paragraph and a source. Claims are kept general where the
     evidence is mixed. */
  const SCIENCE = {
    bucket: { title: 'The stress bucket', kid: 'Little things add up, like drops in a bucket.',
      adult: 'Stress from many small sources adds up. When the total goes past what a person can hold, a small thing can tip them over. The stress-vulnerability “bucket” is a teaching picture used in mental-health education, not a precise measurement.',
      source: 'Brabban & Turkington (2002), stress-vulnerability model' },
    window: { title: 'The window of tolerance', kid: 'When you are rested and fed, your bucket is bigger.',
      adult: 'Each of us has a range of arousal in which we can think, listen and cope. Sleep, food, connection and a sense of control widen it; stress narrows it. The green band on the bucket shows this range.',
      source: 'Daniel Siegel (1999), The Developing Mind' },
    lid: { title: 'Flipping your lid', kid: 'When the alarm dog barks too loud, the wise owl falls off its chair.',
      adult: 'Siegel’s hand model of the brain: under strong stress, the alarm systems take over and the thinking parts go “offline” for a while. That is why reasoning with a child mid-meltdown rarely works. It is a simplified picture of real brain systems, meant for families.',
      source: 'Daniel Siegel, the hand model of the brain' },
    name: { title: 'Name it to tame it', kid: 'Saying “I feel mad” helps the mad feeling get smaller.',
      adult: 'Putting feelings into words (affect labelling) was linked with lower amygdala activity in brain-imaging studies. For young children, a grown-up naming the feeling out loud does this job at first.',
      source: 'Lieberman et al. (2007), Psychological Science' },
    breath: { title: 'The long breath out', kid: 'Two sniffs in, one long blow out, like a birthday candle.',
      adult: 'A small randomised study found that five minutes a day of “cyclic sighing” (two inhales, then a long exhale) improved mood more than mindfulness meditation. Slow breathing with a long exhale is a simple, low-risk tool; the study was in adults.',
      source: 'Balban et al. (2023), Cell Reports Medicine' },
    coreg: { title: 'Calm is contagious', kid: 'When the grown-up is calm, you can borrow their calm.',
      adult: 'Young children learn to regulate first with a caregiver: a calm voice, a calm body and staying close help a child’s body settle. A stressed adult tends to pass stress on. Self-regulation grows out of many rounds of this co-regulation.',
      source: 'Developmental research on caregiver–child co-regulation' },
    restraint: { title: 'Restraint collapse', kid: 'Holding it together all day is hard work. It can spill out at home.',
      adult: 'Many children hold it together at school and then fall apart at pickup or home, where they feel safe. Parents often see the worst of the day. The term was popularised by counsellor Andrea Loewen Nair; it describes a common experience rather than a formal diagnosis.',
      source: 'Andrea Loewen Nair (term popularised)' },
    masking: { title: 'Calm outside, full inside', kid: 'At school your face looks calm, but your bucket can still be filling.',
      adult: 'Children often mask stress in structured settings. A quiet child is not always a calm child. Look for the body signals (tight shoulders, fidgeting, a hot face) and plan a soft landing after school: a snack, quiet and no questions straight away.',
      source: 'Clinical observation; related to restraint collapse' },
    sugar: { title: 'It wasn’t the cake', kid: 'Sugar doesn’t make you wild. Noise, crowds and tiredness do.',
      adult: 'A meta-analysis of controlled trials found no effect of sugar on children’s behaviour or thinking. At parties, overstimulation, excitement, late nights and hunger are more likely culprits.',
      source: 'Wolraich, Wilson & White (1995), JAMA' },
    nature: { title: 'Nature restores attention', kid: 'Trees and sky help your busy brain rest.',
      adult: 'Attention restoration theory proposes that natural settings let tired, effortful attention recover. Evidence for benefits of green time for children is encouraging, though study quality varies.',
      source: 'Kaplan & Kaplan (1989), attention restoration theory' },
    sdt: { title: 'Three jars: choice, can-do, together', kid: 'Everyone needs to choose, to do things themselves, and to be close to people.',
      adult: 'Self-determination theory describes three basic psychological needs: autonomy, competence and relatedness. When they are met, motivation and wellbeing tend to be better. The jars in the game make these needs visible.',
      source: 'Deci & Ryan, self-determination theory' },
    execfn: { title: 'Choices build thinking skills', kid: 'When grown-ups let you try, your brain gets stronger.',
      adult: 'In one longitudinal study, mothers’ autonomy support with toddlers (following the child’s lead, offering hints instead of taking over) predicted better executive function later. It is one study, but it fits a wider body of work.',
      source: 'Bernier, Carlson & Whipple (2010), Child Development' },
    reactance: { title: 'Pushback', kid: 'When nobody lets you choose anything, you push back even more.',
      adult: 'Psychological reactance: when people feel a freedom is being taken away, they are motivated to restore it, often by resisting. Offering real choices within limits tends to reduce the fight.',
      source: 'Brehm (1966), A Theory of Psychological Reactance' },
    freeplay: { title: 'Free play matters', kid: 'Playing your own way is good for you.',
      adult: 'Peter Gray argues that the decline of children’s free, self-directed play has contributed to rising anxiety and lower wellbeing. The link is debated and hard to prove causally, but the case for more unstructured play is widely supported.',
      source: 'Gray (2011); Gray, Lancy & Bjorklund (2023)' },
    greene: { title: 'Kids do well if they can', kid: 'You are not bad. Sometimes a thing is just too hard right now.',
      adult: 'Ross Greene’s approach assumes that challenging behaviour comes from lagging skills and unsolved problems, not a lack of wanting to behave. Solve problems together, ahead of time, when everyone is calm.',
      source: 'Ross Greene, Collaborative & Proactive Solutions' },
    turtle: { title: 'The Turtle Technique', kid: 'Stop, go into your shell, take a breath, then think.',
      adult: 'Children learn to pause like a turtle, calm down, then come out and solve the problem. It began as a classroom method and is used in preschool social-emotional programmes.',
      source: 'Schneider & Robin (1974)' },
    fantasy: { title: 'Wish it with them', kid: '“I wish we could stay ALL day!” feels better than “No.”',
      adult: 'Giving a child in fantasy what you can’t give in reality (“I wish I could make the park open all night!”) shows you understand, while the limit stays.',
      source: 'Faber & Mazlish, How to Talk So Kids Will Listen' },
    coaching: { title: 'Emotion coaching', kid: 'All feelings are OK. Not all actions are OK.',
      adult: 'Gottman’s emotion-coaching parents notice feelings, see them as a chance to connect, help the child name them, and then set limits and solve problems. Children of emotion-coaching parents did better on several measures in his studies.',
      source: 'John Gottman (1997), Raising an Emotionally Intelligent Child' },
    repair: { title: 'Rupture and repair', kid: 'After a big fight, we can make up. Making up is a skill.',
      adult: 'Research on parent–infant interaction found frequent small mismatches that were repaired, and repair seemed to matter more than never getting it wrong. Saying sorry and reconnecting after a blow-up teaches that relationships survive hard moments.',
      source: 'Ed Tronick, still-face and repair research' },
    zones: { title: 'Zones of colour', kid: 'Green is calm, yellow is wobbly, red is almost boiling.',
      adult: 'The Zones of Regulation curriculum uses colours to help children notice and name their state and pick a tool that fits. The game’s zones borrow the idea loosely.',
      source: 'Leah Kuypers (2011), The Zones of Regulation' },
    recovery: { title: 'Recovery takes time', kid: 'After a storm, your body needs a while to feel calm again.',
      adult: 'After intense stress, the body’s arousal can stay up for a while even when the child looks calm, so a second upset comes easily. Rushing back to talking, lessons or consequences can restart it. Wait for real calm first.',
      source: 'General stress physiology; kept deliberately general' },
    struggle: { title: 'Productive struggle', kid: 'Hard things you chose make you stronger.',
      adult: 'A hard task with support and ownership builds competence and confidence. The same difficulty, forced and unsupported, mostly adds stress.',
      source: 'Education research on productive struggle' },
    suppress: { title: 'Quiet is not the same as calm', kid: 'Being still and sad is not the same as being happy.',
      adult: 'A child who stops protesting may simply have given up. The goal is not zero blow-ups; it is a child who has the skills and support to handle big feelings, and a relationship that survives them.',
      source: 'A theme across emotion-coaching and self-determination research' },
  };

  // When Professor Pickle pops up, and with which card.
  const PICKLE = {
    firstRed: 'zones', blowup: 'lid', secondEruption: 'recovery', masking: 'masking', collapse: 'restraint',
    nature: 'nature', say: 'reactance', breath: 'breath', name: 'name', waves: 'coreg', cookie: 'bucket',
    flat: 'suppress', wish: 'fantasy', repair: 'repair', skill: 'turtle', choice: 'execfn', start: 'bucket',
    freeplay: 'freeplay', struggle: 'struggle', window: 'window', coaching: 'coaching', greene: 'greene', sugar: 'sugar', sdt: 'sdt',
  };

  const STR = {
    title: 'Blow Up', titleZh: '大爆發', titlePy: ['dà', 'bào', 'fā'],
    tagline: 'Blowing up isn’t losing. Learning why is winning.',
    uhoh: 'Uh-oh', helpers: 'Helpers', tools: 'After the storm',
    noWonder: 'No wonder!', makesSense: 'It makes sense to feel mad when…', notOk: 'It’s not OK to hurt. What can we do instead?',
    cookieNote: 'It wasn’t really about the cookie.',
    sockReveal: 'The real problem was the itchy sock all along!',
    flat: 'Quiet isn’t the same as calm. This jar is empty.',
    disclaimer: 'Blow Up is a learning tool, not treatment. If outbursts are frequent, intense or dangerous, a professional evaluation is worth considering.',
    equation: 'Blow-up risk = load − recovery − skills − support',
  };

  /* The storyteller. Everything the narrator says, in short sentences a 4-year-old can follow.
     {name} and similar are filled in by index.html. */
  const NARR_SCENES = {
    rushed: {
      wake: 'Beep beep beep! The alarm clock wakes Pip up. Pip didn’t get enough sleep.',
      dress: 'Time to get dressed. Hurry, hurry! The grown-up is in a big rush.',
      breakfast: 'Breakfast time. But there’s not much time to eat.',
      bus: 'Pip rides the school bus. It’s very noisy!',
      class1: 'School starts. Pip has to sit still for a long, long time.',
      recess: 'Recess! Pip gets to run and play. Running helps empty the bucket.',
      class2: 'Back to the classroom. More sitting still.',
      lunch: 'Lunch in the lunchroom. Food helps! But it’s so loud in here.',
      class3: 'A long afternoon at school. Pip is holding it all in.',
      activity: 'After school, soccer practice. Pip’s tummy is getting empty.',
      car: 'Driving home. Stuck in traffic. Beep beep!',
      dinner: 'Dinner time at home.',
      homework: 'Homework and chores. Pip is getting tired.',
      bath: 'Bath time! Splash, splash.',
      bed: 'It’s almost bedtime.',
    },
    adventure: {
      wake: 'Good morning! Pip wakes up slowly, all by themself. Pip slept really well.',
      breakfast: 'A slow, cozy breakfast.',
      dress: 'Getting dressed. Pip can take their time.',
      walk: 'Pip walks to the big field. Fresh air!',
      project: 'Pip gets to build a stick fort. Pip chose it!',
      outdoor: 'Mud and bugs! Pip explores outside.',
      lunch: 'Picnic lunch. Pip is super hungry, because lunch is late.',
      afternoon: 'Back home. The grown-up has to work, so Pip plays alone. Pip feels a bit lonely.',
      friends: 'Pip meets friends at the park!',
      walkhome: 'Walking home. Pip’s legs are tired.',
      dinner: 'Dinner time.',
      play: 'Free play! Pip gets to play their own way.',
      bath: 'Bath time! Splash, splash.',
      bed: 'It’s almost bedtime.',
    },
  };
  // first: said the first time a card is used today. back: said when it backfires.
  const CARD_NARR = {
    hungry: { first: 'Pip is hungry. Hungry makes little things feel really big.' },
    tired: { first: 'Pip is tired. When you’re tired, helpers don’t work as well.' },
    sock: { first: 'An itchy sock! Pip feels wrong, but doesn’t know why.' },
    stop: { first: 'Stop playing right now, with no warning. Pip wasn’t done!' },
    toy: { first: 'Someone took Pip’s toy.' },
    bluecup: { first: 'Someone else got the blue cup. It feels so unfair.' },
    tower: { first: 'The tower fell down. So frustrating!' },
    cookie: { first: 'The cookie broke. It’s a tiny thing. But tiny things add up.' },
    lost: { first: 'Pip lost the game.' },
    loud: { first: 'It’s too loud! Loud noises really bother Pip.' },
    calmdown: { first: 'The grown-up said, calm down! That never helps. Pip feels like nobody is listening.' },
    lecture: { first: 'A long, long talk. Blah blah blah.' },
    snack: { first: 'A snack! A full tummy helps the bucket calm down.' },
    water: { first: 'A drink of water helps Pip’s body feel better.' },
    hug: { first: 'A hug! Hugs help Pip feel safe.', back: 'Pip needs some space right now. Not a hug.' },
    name: { first: 'Naming the feeling. You feel mad! When someone understands, the mad gets smaller, and the guard dog stops barking.' },
    wish: { first: 'Wishing together. I wish we could stay all day! Pip feels understood.' },
    warn: { first: 'A five minute warning. Now Pip knows what’s coming. Changes feel easier.' },
    choice: { first: 'A choice of two! Pip gets to pick. That puts a marble in the My Choice jar.' },
    stomp: { first: 'Dinosaur stomp! Moving your body lets the mad out safely.' },
    breathe: { first: 'Flower and candle breaths. Breathe along with Pip!' },
    corner: { first: 'The calm corner. A quiet, cozy place to rest.' },
    count: { first: 'Counting to ten, nice and slow. It helps most when Pip is wobbly.' },
    silly: { first: 'A silly voice! Silly is fun when Pip is calm.', back: 'Oops! When Pip is really upset, a silly voice feels like laughing at them.' },
    tickle: { first: 'Tickles! Fun when Pip is calm.', back: 'Oops! Tickles feel bad when Pip is upset. Pip turned into a spiky porcupine!' },
    close: { first: 'Staying close. Pip isn’t alone in the storm.' },
    quiet: { first: 'Few words and a calm body. The grown-up takes a slow breath. Calm is catching!' },
    squeeze: { first: 'Squeeze my hands, then let go. It helps Pip’s body calm down.' },
    here: { first: 'I’m here. You’re safe.' },
    sorry: { first: 'Saying sorry. Grown-ups can say sorry too.' },
    fix: { first: 'Fixing it together.' },
    plan: { first: 'Making a plan for next time.' },
    consequence: { first: 'A punishment.', back: 'A punishment right now just makes it worse. Fix it together when Pip is calm.' },
    praise: { first: 'You stomped instead of hitting! Saying exactly what Pip did well helps Pip learn.' },
    goodjob: { first: 'Good job is nice. But it doesn’t tell Pip what they did well.' },
    practice: { first: 'Practising a calm-down tool while calm makes it stronger.' },
  };
  const NARR_PIP = {
    better: 'I feel better now.', night: 'Goodnight…', selfBreathe: 'I can smell the flower all by myself!', selfStomp: 'STOMP! I did it myself!',
    sockNamed: 'My SOCK is itchy! That’s what it was!', sockBath: 'Bye-bye itchy sock!',
    space: 'I need SPACE!', nope: 'Nope!', lala: 'LA LA LA, I can’t hear you!',
  };
  const NARR = {
    welcome: 'Hi! This is Pip. Pip has a bucket inside. Little things fill it up, drop by drop. When it gets too full… KABOOM! The red cards bring trouble to Pip’s day. The blue cards help Pip feel better. Pick a day, then tap the big orange button.',
    splash: 'Tap the big button to start.',
    tour: [
      ['#sceneWrap', 'This is Pip, and Pip’s grown-up.'],
      ['.bucket-card', 'This is Pip’s bucket. Every little thing drops in. Green means calm. Yellow means wobbly. Red means almost boiling.'],
      ['#trayUhoh', 'The red cards bring trouble to Pip’s day. Drag one onto Pip, or just tap it.'],
      ['#trayHelp', 'The blue cards help Pip feel better.'],
      ['#jars', 'These jars fill with marbles when Pip gets to choose, does things by themself, and feels close to people. Full jars make the bucket bigger.'],
      ['#controlRoom', 'This is inside Pip’s head. A guard dog barks when Pip gets upset. A wise owl helps Pip think.'],
      ['#sceneWrap', 'Tap Pip any time, and I’ll tell you how Pip feels. Let’s go!'],
    ],
    uhohWord: 'Uh-oh!', yayWord: 'Yay!',
    times: { 2: 'Two times!', 3: 'Three times!', 4: 'Four times!', 5: 'Five times!' },
    again: { helper: 'Pip already had that. Try something different!', uhoh: 'Again? Pip is getting used to that one.' },
    worse: 'More drops in the bucket.', better: 'Pip feels calmer.',
    bounce: 'Too soon to talk! Pip’s body is still upset, so the words bounce off like ping-pong balls.',
    weak: 'That doesn’t work right now. Try one of the glowing cards.',
    zone: { yellow: 'Pip is getting wobbly. The bucket is filling up.', red: 'Pip is almost boiling! The bucket is nearly full. Can you help Pip?', green: 'Pip feels calm again. Nice!' },
    hungry: 'Pip’s tummy is rumbling. Pip is hungry!', tired: 'Pip is getting sleepy.',
    blowup: 'KABOOM! Pip’s bucket overflowed!',
    blowType: {
      hangry: 'Pip turned into the Hangry Monster!', noodle: 'Pip melted into a floppy noodle!', gavel: 'Pip is having a tiny courtroom tantrum! Not fair!',
      tornado: 'Pip is spinning like a tornado! Too much!', volcano: 'Pip is erupting like a glitter volcano!', whistle: 'Steam is shooting out of Pip’s ears! You’re not the boss of me!',
    },
    cookie: 'And it was just a broken cookie! But the bucket was already full.',
    collapse: 'Pip held it all in at school. Now, at home, it all spills out.',
    second: 'Oh no, a second storm! Talking came too soon.',
    phase: {
      eruption: 'Pip is in a storm. The wise owl fell off its chair, so Pip can’t think right now. Stay close. Keep Pip safe. Use very few words.',
      cooling: 'The storm is getting smaller. Help Pip’s body calm down. Try breathing, water, stomping, or squeezing hands.',
      reconnect: 'Pip is coming back. Tell Pip how they feel, or say, I’m here.',
      repair: 'Now let’s fix it. Say sorry, or fix it together.',
      learn: 'Tell Pip exactly what they did well.',
      day: 'Pip feels better now. Blowing up isn’t losing. Learning why is winning.',
    },
    validate: {
      start: 'No wonder Pip got so mad! Look at everything that happened.', under: 'Under the mad, there were other feelings.',
      end: 'Feelings are OK. Hurting is not OK. Next time, Pip can stomp like a dinosaur, take big breaths, or say: I’m SO mad!',
      ready: 'When you’re ready, tap the orange button to fix it together.', littleThings: 'Lots of little things.',
      hungry: 'An empty tummy.', tired: 'A tired body.',
    },
    strings: 'Look, strings! Pip feels like a puppet, because Pip never gets to choose. Give Pip a choice to snip the strings.',
    snip: 'Snip! One string is gone.',
    flat: 'Pip went quiet and grey. Quiet isn’t the same as happy. Pip’s choice jar is empty.',
    masking: 'At school, Pip looks calm on the outside. But inside, the bucket keeps filling up.',
    wavesBlue: 'The grown-up is calm. Calm is catching, like blue waves.',
    wavesRed: 'The grown-up is stressed. Stress is catching too, like red waves.',
    selfUse: { breathe: 'Wow! Pip did the flower breath all by themself!', stomp: 'Wow! Pip did the dinosaur stomp all by themself!' },
    levelUp: { breathe: 'Pip is getting better at the flower breath!', stomp: 'Pip is getting better at the dinosaur stomp!' },
    sayIntro: { shoes: 'Pip needs to put shoes on.', leave: 'It’s time to leave.', veg: 'Time to eat the vegetables.', coat: 'Pip is zipping the coat. Slowly.', bed: 'It’s bedtime.', project: 'What will Pip do today?' },
    sayAsk: 'How should the grown-up say it? The bossy way, or the choosing way? Tap the face you pick.',
    saySupport: '{done}! Pip got to choose, so a marble goes in the My Choice jar.',
    sayControl: '{done}. But Pip didn’t get to choose. A marble fell out of the My Choice jar.',
    pick: 'Where should Pip go? The playground, or the field? Tap one.',
    predict: 'Will Pip get calmer, or madder? Tap the calm face or the mad face.',
    bedtime: 'The day is over. Pip snuggles into bed. Goodnight, Pip.',
    bedtimeHigh: 'Sleep helps Pip’s body rest. Some big feelings might still be there tomorrow, and that’s okay. Pip will have help.',
    receipt: {
      start: 'Here is the cost of Pip’s day.',
      blowups: ['Pip had no blow-ups at all.', 'Pip had one big blow-up.', 'Pip had two big blow-ups.', 'Pip had three big blow-ups.', 'Pip had four big blow-ups.', 'Pip had five big blow-ups.', 'Pip had lots of big blow-ups.'],
      fillers: 'The biggest bucket fillers were:', helpers: 'The best helpers were:',
      marbles: 'Pip earned {m} marbles.', marble1: 'Pip earned one marble.',
      end: 'When you’re ready, you can play another day. Or say goodnight too.',
    },
    feel: { green: 'Pip feels calm and happy.', yellow: 'Pip feels wobbly.', red: 'Pip is almost boiling!', storm: 'Pip is in a storm right now.', flat: 'Pip feels flat and quiet.', masked: 'Pip looks calm on the outside, but the bucket is filling up inside.' },
    because: { body: 'Pip’s body needs something, like food, sleep or moving.', control: 'Pip is being bossed and rushed.', social: 'Things with other kids went wrong.', sensory: 'Things are too loud.', thinking: 'Things are too hard.', emotional: 'Things feel unfair.' },
    mostDrops: 'The most drops are {x} drops.',
    bucketLevel: ['The bucket is almost empty.', 'The bucket is a little bit full.', 'The bucket is half full.', 'The bucket is nearly full!', 'The bucket is overflowing!'],
    head: { calm: 'Inside Pip’s head, the guard dog is quiet and the wise owl is thinking.', bark: 'Inside Pip’s head, the guard dog is barking, and the wise owl is slipping off its chair!', storm: 'Inside Pip’s head, the guard dog is barking loud, and the wise owl fell off its chair.' },
    adult: { calm: 'This is Pip’s grown-up. The grown-up is calm.', mid: 'This is Pip’s grown-up.', stressed: 'This is Pip’s grown-up. The grown-up is stressed and in a hurry.' },
    jar: { choice: 'The My Choice jar has {n} marbles. It fills when Pip gets to choose.', can: 'The I Can Do It jar has {n} marbles. It fills when Pip does things by themself.', together: 'The Together jar has {n} marbles. It fills when Pip feels close to people.' },
    clock: 'It’s about {h} o’clock {part}.',
    hours: ['seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'],
    misc: {
      back: 'I’m back! I’ll tell you what’s happening.', tapStart: 'Tap the big orange button to start.',
      continueDay: 'Tap to continue Pip’s day.',
      bossyWay: 'The bossy way:', choosingWay: 'Or the choosing way:', guessRight: 'You guessed it!', guessWrong: 'Surprise! Not what you guessed.',
      hungry: 'Pip is hungry.', tired: 'Pip is tired.', sock: 'Something is bugging Pip’s foot…', asleep: 'Pip is fast asleep. Shhh.',
      worse: 'Oops! That made Pip feel worse.', wait: 'One at a time! Watch what happens.',
    },
    sticker: 'New sticker!',
    breath: ['Smell the flower. Sniff!', 'Sniff again!', 'Blow out the candle. Whoooooo.', 'Nice and slow.'],
  };

  // Shared by the page and the voice build script, so recorded lines match exactly.
  const plain = t => String(t).replace(/[“”"]/g, '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k] != null ? o[k] : '');
  function voiceKey(who, text) {           // FNV-1a over "who|text"
    let h = 0x811c9dc5; const str = who + '|' + text;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }

  const api = { hm, LOADS, LOAD_ORDER, JARS, UHOH, HELPERS, TOOLS, SAYS, LOCATIONS, CHAOS, DAY_STYLES, KIDS, FEELINGS, LOAD_FEELING, ZONES, BLOWUPS, PHASES, SCIENCE, PICKLE, STR, ALL_PHASES, NARR, NARR_SCENES, CARD_NARR, NARR_PIP, plain, fill, voiceKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BUContent = api;
})(this);
