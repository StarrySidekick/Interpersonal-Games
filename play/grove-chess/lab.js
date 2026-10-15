// The lab: make any level you like from a pile of settings, play it, and
// write down whether it was fun.
//
// A level is settings + a seed. The settings say what kind of level it is;
// the seed is the dice roll that places everything. Same settings and same
// seed give the same level on any phone, which is what makes a level
// shareable as a link. New layout = same settings, new seed.
//
// The standard board (2026-10-06, Timothy's framing): a kind of ground, a
// shape and a size, a hole, and pieces of theirs possessed by rabbits. The
// rabbit inside decides which way a piece goes; the piece decides how.
// Catch every possessed piece, which opens the hole, then sink the ball.
//
// Settings carry a version. Version 3 (possession) is the current one;
// anything saved earlier (links, the notebook) is read against the defaults
// of its own version, so it still builds exactly the level it was.

import { rng, shuffled } from '../../engine/seed.js';
import { PIECES, onBoard, initialState, autoApply, isOver, TRAITS, leaderMind, WEAPON_KINDS, canArm, foeMovesAny, routeSquares, movesFor } from './rules.js';
import { PATTERNS } from './day.js';
import { EXTRA_PATTERNS } from './rabbits.js';

/** Every named pattern: the daily's twelve, then the ones with pauses. */
const ALL_PATTERNS = [...PATTERNS, ...EXTRA_PATTERNS];
import { solveLevel, assess, unbalanced, openingCaptures } from './solve.js';
import { measure, BANDS } from './metrics.js';
import { cleanInvented, registerInvented } from './invented.js';
import { SUITS } from './run.js';
import { VARIANTS, VARIANT_ORDER, readFen } from './variants.js';

export const CLASSIC = Object.keys(PIECES).filter((k) => PIECES[k].kind === 'classic');
export const FAIRY = Object.keys(PIECES).filter((k) => PIECES[k].kind === 'fairy');
export const ALL = [...CLASSIC, ...FAIRY];

const opts = (...pairs) => pairs.map(([v, label]) => ({ v, label }));

// --- The eight parts of a mode (Timothy, 2026-10-13). ----------------------
// "a mode is a collection of settings": piece set, piece position, board,
// rounds, upgrades, win condition, turns, difficulty, the enemy side. Refined
// to eight parts, each a question every mode answers. Every setting belongs
// to one, and every settings panel is grouped by them. The enemy side is not
// a part of its own: Armies and Control are each set for both sides, and how
// they compare to you is whether the two sides' answers match. `subs` are the
// headings inside a part, in order.
export const PARTS = [
  { id: 'format', name: 'Format', ask: 'One match or a series, and what ends it?' },
  { id: 'board', name: 'Board', ask: 'What is it played on?', subs: [['neutral', 'Neutral pieces']] },
  { id: 'armies', name: 'Armies', ask: 'What does each side have, and where does it stand?', subs: [['yours', 'Yours'], ['theirs', 'Theirs'], ['ball', 'The ball']] },
  { id: 'control', name: 'Control', ask: 'Who moves each side, and when?', subs: [['yours', 'Yours'], ['theirs', 'Theirs'], ['rabbits', 'Rabbits'], ['live', 'Real time']] },
  { id: 'goal', name: 'Goal', ask: 'How do you win, how do you lose, and what ends a game that stalls?' },
  { id: 'growth', name: 'Growth', ask: 'What changes between the games of a series?' },
  { id: 'difficulty', name: 'Difficulty', ask: 'How hard is it, how does it climb, and what must every level pass?' },
  { id: 'information', name: 'Information', ask: 'What can each side see, and which hints show?' }
];
/** A schema group's heading for one of the parts. */
export const part = (id) => { const p = PARTS.find((q) => q.id === id); return { part: id, group: p.name, ask: p.ask, subs: p.subs || [] }; };

/** Every level setting: its part, label, kind and range. The page is built
    from this. `sub` is the heading it sits under within its part. */
export const SCHEMA = [
  { ...part('format'), fields: [
    { key: 'variant', label: 'Play a chess variant', type: 'choice', def: 'none', options: opts(['none', 'No: a Grove Chess level'], ...VARIANT_ORDER.map((k) => [k, `${VARIANTS[k].name} (${VARIANTS[k].size})`])),
      help: 'A real chess variant from its starting position, against the thinking side (Timothy, 2026-10-11). The board, the pieces and the rules are the variant\u2019s; the settings that still matter are how they think and the move limit.' }
  ] },
  { ...part('board'), fields: [
    { key: 'w', label: 'Width', type: 'int', min: 3, max: 10, def: 6 },
    { key: 'h', label: 'Height', type: 'int', min: 3, max: 10, def: 6 },
    { key: 'shape', label: 'Shape', type: 'choice', def: 'rect', options: opts(
      ['rect', 'Rectangle'], ['diamond', 'Diamond'], ['round', 'Round'], ['cross', 'Cross'], ['ring', 'Ring'],
      ['hourglass', 'Hourglass'], ['L', 'L'], ['stairs', 'Stairs'], ['islands', 'Two islands'], ['cheese', 'Swiss cheese']) },
    { key: 'holes', label: 'Extra holes', type: 'int', min: 0, max: 15, def: 0 },
    { key: 'ground', label: 'Ground', type: 'choice', def: 'solid', options: opts(
      ['solid', 'Solid'], ['crumble', 'Crumbling'], ['shrink', 'Shrinking'], ['spiral', 'Shrinking in a spiral']),
      help: 'Crumbling: every square you move a piece off falls away. Shrinking: every few moves a square on the edge drops into the dark and the board closes in, at random or round in a spiral.' },
    { key: 'shrinkEvery', label: 'The edge falls every', type: 'int', min: 1, max: 5, def: 2, unit: 'moves', help: 'Only for shrinking ground.' },
    { key: 'magic', label: 'Magic edges', type: 'choice', def: 'none', options: opts(['none', 'None'], ['sides', 'The sides join'], ['all', 'All four join']),
      help: 'Like Pac-Man: off one edge is on at the other. Joined edges glow. A piece that slides all the way round comes back to where it started, so it stops there; a ball rolling round with nothing to stop it arrives back where it began, which is no move.' },
    { key: 'geared', label: 'Geared', type: 'bool', def: false,
      help: 'After every turn the board turns a quarter turn clockwise, with everything on it. Your pieces turn with it, so they move as ever; the rabbits\u2019 patterns do not, so a rabbit that hops up the screen goes a different way across the board each turn. Square boards only.' },
    { key: 'statues', sub: 'neutral', label: 'Statues', type: 'int', min: 0, max: 8, def: 2,
      help: 'Standing stones, each with a spiral cut in it, in the middle of the board. They never move and nothing can take them. Sliders stop at them, leapers jump them, and the grasshopper and the cannon can hop over them.' },
    { key: 'statueRow', sub: 'neutral', label: 'A row of statues that opens', type: 'bool', def: false,
      help: 'The middle row is all statues (in place of the count above), and after every turn one of them, at random, sinks away and opens its square (Timothy, 2026-10-12).' },
    { key: 'statuesTake', sub: 'neutral', label: 'Statues can be taken', type: 'bool', def: true,
      help: 'Statues are neutral pieces (Timothy, 2026-10-13): they never move or do anything, but either side can take one, and then it is gone. Sliders stop at them; leapers and hoppers go over them. Off: nothing can take them, the first way. Golf keeps them off.' },
    { key: 'ghosts', sub: 'neutral', label: 'A row of ghosts in front of each side', type: 'bool', def: false,
      help: 'Ghosts fill the row in front of each side, where pawns stand in chess (Timothy, 2026-10-13). A ghost never moves and never takes. Its own side moves through it as if it were not there, and once one of them passes through or onto it, it is gone for good. The other side cannot pass it or land on it, though a leaper can jump over. So at first neither side can reach the other: you open your own wall as you go.' },
    { key: 'gates', sub: 'neutral', label: 'Gates', type: 'int', min: 0, max: 6, def: 0,
      help: 'Gates between the two sides, up one turn and down the next (Timothy, 2026-10-13). Down, a gate is open ground; up, nothing passes it and nothing can stand there. A gate with a piece on it stays down until the piece leaves.' },
    { key: 'clouds', sub: 'neutral', label: 'Wandering clouds', type: 'int', min: 0, max: 4, def: 0,
      help: 'Clouds that drift a square a turn, any way, on their own (Timothy, 2026-10-13). A piece under a cloud is hidden from the other side, and so is its move into the cloud. A move that runs into a hidden piece stops there and takes it. You always see your own pieces, cloud or not.' },
    { key: 'sand', sub: 'neutral', label: 'Sand', type: 'int', min: 0, max: 6, def: 0,
      help: 'Sand squares, a golf hazard (2026-10-13): a ball hit into sand stops dead there. Pieces cross sand like any ground.' },
    { key: 'water', sub: 'neutral', label: 'Water', type: 'int', min: 0, max: 6, def: 0,
      help: 'Water squares, a golf hazard (2026-10-13): no piece can cross or stand in water, and a ball that rolls in goes back to the tee, where it started the hole (if something stands on the tee, the ball stops at the water\u2019s edge).' },
    { key: 'cloud', sub: 'neutral', label: 'A cloud on the second rows, first turn', type: 'bool', def: true,
      help: 'For the first turn, a cloud covers the row in front of each side. Each side moves through its own cloud freely; the other side\u2019s stops it (a piece can step in, not past), and nothing in a cloud can be taken by the other side. So nobody can take anything on the first move. It lifts once both sides have moved (Timothy, 2026-10-10 and 11: with no second row of pawns, this protects the Kings at the start).' },
    { key: 'cloudOwn', sub: 'neutral', label: 'Each cloud stops only the other side', type: 'bool', def: true,
      help: 'On: your pieces go through your own cloud as if it were not there, and only theirs stops you (and the same for them). Off: both clouds stop everyone, the first version.' }
  ] },
  { ...part('armies'), fields: [
    { key: 'fullRow', label: 'A full row each', type: 'bool', def: true,
      help: 'Each side starts with as many pieces as the board is wide: six on a six by six board, yours and theirs (Timothy, 2026-10-10). Off: the counts set below, under Yours and Theirs.' },
    { key: 'lineup', label: 'Line up like chess', type: 'bool', def: true,
      help: 'Your pieces start in a line along the bottom edge, theirs along the top. Off: scattered within the rows below.' },
    { key: 'inOrder', label: 'Stand in the order given', type: 'bool', def: false,
      help: 'For a run, whose sides are given rather than dealt (the descent): both lines stand in the order they were given, file by file, facing each other like chess, in the middle of the row. Off: where each piece stands is part of the dice roll.' },
    { key: 'mine', sub: 'yours', label: 'Pieces', type: 'int', min: 1, max: 8, def: 4 },
    { key: 'minePool', sub: 'yours', label: 'Dealt from', type: 'pieces', def: ['queen', 'knight', 'bishop', 'rook', 'grasshopper'] },
    { key: 'mineDupes', sub: 'yours', label: 'Repeats allowed', type: 'bool', def: false },
    { key: 'dealKing', sub: 'yours', label: 'Always dealt a King', type: 'bool', def: true, help: 'With a royal King: if the deal has none, your first piece becomes one.' },
    { key: 'promote', label: 'A pawn on the far row', type: 'choice', def: 'none', options: opts(['none', 'Stays a pawn'], ['copy', 'Becomes a copy of another of yours']),
      help: 'Copy (Timothy, 2026-10-13): it turns into any one kind of the other pieces its side has on the board (not a pawn or the King), chosen as it gets there. Theirs too.' },
    { key: 'pawnRules', label: 'Pawns', type: 'choice', def: 'chess', options: opts(['chess', 'Two squares first, and en passant'], ['step', 'One square at a time']),
      help: 'Two squares first (Timothy, 2026-10-14: "Pawns should have en passant and moving two squares as the first move in all modes by default"): a pawn that has not moved yet may step two squares if both are empty, and a pawn of the other side beside where it lands may take it as it passes, on the very next move, by moving to the square it passed over. One square: the first way. A chess variant keeps its own pawn rules.' },
    { key: 'bubbles', label: 'Every piece starts in a bubble', type: 'bool', def: false,
      help: 'Tile Chess (Timothy, 2026-10-14): at the start of every round each piece, yours and theirs, sits in a bubble, and nothing can take it until it moves for the first time. A piece in its bubble is a wall to the other side: their lines stop at it, and no weapon touches it.' },
    { key: 'bubbleTurns', label: 'Bubbles last at most', type: 'int', min: 0, max: 12, def: 4, unit: 'turns',
      help: 'Every bubble still left bursts after this many turns, so a King that never moves cannot hide in its bubble all game. 0: a bubble lasts until its piece moves, however long that is.' },
    { key: 'mineRows', sub: 'yours', label: 'Start within the bottom', type: 'int', min: 1, max: 5, def: 1, unit: 'rows', help: 'When not lined up.' },
    { key: 'arrange', sub: 'yours', label: 'Lay out your pieces first', type: 'bool', def: true,
      help: 'Before the first move, put your pieces where you like in your first two rows (Timothy, 2026-10-10). Nowhere that lets either side take a piece on its first move. Par is worked out again for your layout.' },
    { key: 'cycle', sub: 'yours', label: 'One piece on the board, taking turns', type: 'bool', def: false,
      help: 'Adventure (Timothy, 2026-10-15: "every turn you cycle through your piece set. so there is still always just one piece on the board"): only your first piece stands on the board, and after every turn it becomes the next piece of your set, in order, on the same square.' },
    { key: 'swordAims', sub: 'yours', label: 'A sword strikes the way it moves', type: 'bool', def: false,
      help: 'Adventure (Timothy, 2026-10-15: "the sword should be based on the direction you move, not just the space above"): a sword strikes the square beyond where it lands, in the direction it moved (and to either side of that, and between, at levels 2 and 3). Off: toward the other side, as in the descent.' },
    { key: 'foes', sub: 'theirs', label: 'Pieces', type: 'int', min: 0, max: 12, def: 3, help: 'Dark versions of chess and fairy pieces.' },
    { key: 'foePool', sub: 'theirs', label: 'Dealt from', type: 'pieces', rabbit: true, def: ['king', 'knight', 'bishop', 'rook'] },
    { key: 'foeDupes', sub: 'theirs', label: 'Repeats allowed', type: 'bool', def: true },
    { key: 'mirror', sub: 'theirs', label: 'Mirror your pieces instead', type: 'bool', def: false, help: 'They get a copy of your hand, facing you, like chess.' },
    { key: 'foeRows', sub: 'theirs', label: 'Start within the top', type: 'int', min: 1, max: 6, def: 1, unit: 'rows', help: 'Loose rabbits and the hole start up there too, lined up or not.' },
    { key: 'still', sub: 'theirs', label: 'Of them, statues', type: 'int', min: 0, max: 12, def: 0,
      help: 'Adventure (Timothy, 2026-10-15: "enemy pieces don\u2019t move, and they are gray like statues"): this many of their pieces are grey statues. A statue never moves and never takes; it is there to be taken. The rest move as set.' },
    { key: 'rabbits', sub: 'theirs', label: 'Free rabbits', type: 'int', min: 0, max: 4, def: 0,
      help: 'Rabbits loose on the board, on top of the ones inside their pieces.' },
    { key: 'foesCapture', sub: 'theirs', label: 'They can take your pieces', type: 'bool', def: true },
    { key: 'rabbitsEat', sub: 'theirs', label: 'Rabbits eat your pieces', type: 'bool', def: false,
      help: 'Off: a rabbit that would land on one of your pieces waits instead.' },
    { key: 'ballMove', sub: 'ball', label: 'The ball moves', type: 'choice', def: 'putt', options: [...opts(
      ['ice', 'On ice'], ['putt', 'Like a putt'], ['bounce', 'Like a billiard ball'], ['hit', 'Hit by the pieces'], ['ghost', 'A ghost']),
      // "There's no such thing as a sticky ball" (Timothy, 2026-10-13): read, not offered.
      { v: 'sticky', label: 'Sticky', hidden: true }],
      help: 'On ice: up, down, left or right, and it rolls until something stops it. Like a putt: up, down, left or right, as far as you like. Like a billiard ball: diagonally, as far as you like, bouncing off the edges (the reflecting bishop from Billiards Chess). It never takes anything. Hit by the pieces: it never moves by itself; any piece, yours or theirs, that moves into it sends it sliding along the line of that move, like on ice, until something stops it. A ghost: like ice, straight through pieces.' },
    { key: 'ballCaptures', sub: 'ball', label: 'The ball captures', type: 'bool', def: true,
      help: 'On: rolling or sliding into one of their pieces, the ball takes it and stops there. Off: it stops short, and never takes anything.' }
  ] },
  { ...part('control'), fields: [
    { key: 'first', label: 'First move', type: 'choice', def: 'you', options: opts(['you', 'You'], ['them', 'Them']) },
    { key: 'mode', sub: 'yours', label: 'Who moves your pieces', type: 'choice', def: 'hand', options: opts(['hand', 'You do'], ['auto', 'Rabbits (autochess)']),
      help: 'Autochess: before the game you put rabbits you have caught into your pieces, choose which way each faces and the order of your line. Then it plays itself: each rabbit picks the way, its piece picks how, the same as theirs.' },
    { key: 'autoPool', sub: 'yours', label: 'Your rabbits', type: 'choice', def: 'caught', options: opts(['caught', 'The ones you have caught'], ['all', 'Every named kind']),
      help: 'For autochess. Caught: one rabbit for every time you caught its kind, in the descent or the daily.' },
    { key: 'wait', sub: 'yours', label: 'Waiting allowed', type: 'bool', def: false,
      help: 'Off: you must move a piece every turn (Timothy, 2026-10-10). A side with no move at all still passes.' },
    { key: 'darkBrain', sub: 'theirs', label: 'Moved by', type: 'choice', def: 'possessed', options: opts(['possessed', 'A rabbit inside'], ['think', 'Thinking'], ['rabbit', 'One rabbit leads them']),
      help: 'A rabbit inside: each piece is possessed by a rabbit, whose pattern decides which way it goes each turn (left, up, a pause); the piece\u2019s own moves decide how. One rabbit leads them (2026-10-13): their pieces think, and a single Rabbit, starting on their King, sets how: its trait is their mood (aggressive and hunter hunt, shy flees) and its intelligence how far ahead they look. It hops every turn by its own mind.' },
    { key: 'skill', sub: 'theirs', label: 'Thinking skill', type: 'choice', def: '2', options: opts(
      ['0', 'Random'], ['1', 'Greedy'], ['2', 'Two ahead'], ['3', 'Three ahead']), help: 'For pieces of theirs that think, and thinking rabbits.' },
    { key: 'style', sub: 'theirs', label: 'Mood', type: 'choice', def: 'balanced', options: opts(['flee', 'Flee'], ['balanced', 'Balanced'], ['hunt', 'Hunt']) },
    { key: 'kinds', sub: 'theirs', label: 'Kinds of rabbit inside', type: 'int', min: 1, max: 4, def: 1,
      help: 'One kind: every piece moves to the same pattern (or has the same trait), so you can see it. More: each piece may have its own.' },
    { key: 'oneMove', sub: 'theirs', label: 'They move one piece a turn', type: 'bool', def: true,
      help: 'Like you. A piece that can take one of yours goes; otherwise their pieces take turns, in order. Off: every piece of theirs moves every turn. Loose rabbits always hop.' },
    { key: 'foesWait', sub: 'theirs', label: 'They may stay put', type: 'bool', def: false,
      help: 'Off: when they move one piece a turn, a piece of theirs always moves; if the one whose turn it is would rather stay, it moves anyway, and if it cannot, the next one goes. On: a rabbit may choose to stay where it is.' },
    { key: 'rabbitMind', sub: 'rabbits', label: 'Rabbits move by', type: 'choice', def: 'mind', options: opts(['mind', 'A mind of their own'], ['pattern', 'A fixed pattern']),
      help: 'A mind: every rabbit, loose or inside a piece, picks its own move each turn, by its trait and its intelligence. A fixed pattern: the old way, a hidden pattern that repeats.' },
    { key: 'iq', sub: 'rabbits', label: 'Intelligence', type: 'int', min: 1, max: 10, def: 5,
      help: 'For rabbits with minds. Low: fumbling, half blind to danger. High: sharp, sees what you could take, never boxes itself in.' },
    { key: 'traits', sub: 'rabbits', label: 'Traits', type: 'multi', def: Object.keys(TRAITS), options: Object.entries(TRAITS).map(([v, t]) => ({ v, label: t.name })),
      help: 'Which kinds of mind can turn up. Aggressive goes for you; Hunter for your strongest piece; Shy keeps away; Guard stays with its own side; Messy is all over the place; Habit keeps a learnable pattern but steps round trouble.' },
    { key: 'rabbitBrain', sub: 'rabbits', label: 'Rabbits move by', type: 'choice', def: 'pattern', options: opts(['pattern', 'Hidden pattern'], ['ai', 'Thinking']) },
    { key: 'patterns', sub: 'rabbits', label: 'Rabbit patterns', type: 'choice', def: 'all', options: opts(
      ['all', 'Every named kind'], ['daily', 'The daily set'], ['short', 'Random, 2 hops'], ['mid', 'Random, 3 to 4'], ['long', 'Random, 5 to 8'], ['wild', 'Random, big jumps'], ['routes', 'Short routes (Adventure)']),
      help: 'For free rabbits and the ones inside pieces. Every named kind has its own colour; "every named kind" adds three that pause. Short routes (Adventure, 2026-10-15): a rabbit inside a piece walks it along a short route made of that piece\u2019s own moves, there and back or round a square, that always comes home and can never get it stuck; a piece with no such route (a pawn) is a statue. Each route has its colour.' },
    { key: 'routeKinds', sub: 'rabbits', label: 'Routes', type: 'multi', def: ['Shuttle', 'Doze', 'Box step', 'Pace'],
      options: [{ v: 'Shuttle', label: 'Shuttle: there and back' }, { v: 'Doze', label: 'Doze: rest, there, rest, back' }, { v: 'Box step', label: 'Box step: round a square' }, { v: 'Pace', label: 'Pace: two there, rest, two back, rest' }],
      help: 'For short routes: which kinds can turn up.' },
    { key: 'hops', sub: 'rabbits', label: 'Rabbit hops per turn', type: 'int', min: 1, max: 3, def: 1 },
    { key: 'realtime', sub: 'live', label: 'Kung fu: no turns', type: 'bool', def: false,
      help: 'Real time, after Kung-Fu Chess (2002): move any piece of yours whenever it is ready, and so do they. A move takes time to travel, so a piece can dodge, and a piece that has moved rests before it moves again. Take their King.' },
    { key: 'kfStep', sub: 'live', label: 'Travel time a square', type: 'int', min: 60, max: 2000, def: 300, unit: 'ms', help: 'Kung-Fu Chess\u2019s lightning speed is 200; its standard speed is 1,000.' },
    { key: 'kfCool', sub: 'live', label: 'Your pieces rest for', type: 'int', min: 3, max: 100, def: 20, unit: 'tenths of a second', help: 'Lightning is 2 seconds (20); standard is 10 seconds (100).' },
    { key: 'kfFoeCool', sub: 'live', label: 'Theirs rest for', type: 'int', min: 3, max: 100, def: 50, unit: 'tenths of a second', help: 'In a descent, their first level\u2019s; they get quicker each level down.' },
    { key: 'kfFoeGap', sub: 'live', label: 'They start a move at most every', type: 'int', min: 2, max: 60, def: 18, unit: 'tenths of a second',
      help: 'Their side plays like one opponent: one move at a time, this often at most. In a descent, their first level\u2019s; it shortens each level down.' }
  ] },
  { ...part('goal'), fields: [
    { key: 'goal', label: 'How you win', type: 'choice', def: 'king', options: [...opts(
      ['king', 'Take their King'], ['capture', 'Capture'], ['carrier', 'Take the rabbit’s piece'], ['flag', 'Capture the rabbit, bring it home'],
      ['descent', 'Catch them, then the ball'], ['clear', 'Take them all, then jump in the hole'], ['rabbit', 'Catch the rabbit'], ['target', 'A marked one'], ['hole', 'Sink the ball'], ['mix', 'Mix it up']),
      // Capture them all and Catch any one are Capture with every one, or
      // one (2026-10-13); still read, so old links and boards play as they did.
      { v: 'all', label: 'Capture them all', hidden: true }, { v: 'any', label: 'Catch any one', hidden: true }],
      help: 'Capture: take as many of theirs as "How many" says. Take the rabbit’s piece: a rabbit rides their pieces and hops from one to another; take the one it is on. Capture the rabbit, bring it home: a rabbit waits in the middle; take it and it rides your piece, take that piece and it rides theirs; carry it back to your first row (Timothy, 2026-10-13). Catch them, then the ball: the hole stays shut until every possessed piece and loose rabbit is caught, then sink the ball in it. Take them all, then jump in the hole (Adventure, 2026-10-15): the hole stays shut until every piece of theirs is taken, then any piece of yours that lands on it jumps in and wins. King and rabbit make sure they have one. Sink the ball gives you a ball and a moving hole. Mix picks capture, King or rabbit per layout.' },
    { key: 'captureN', label: 'How many', type: 'int', min: 0, max: 8, def: 1, unit: 'of theirs',
      help: 'For Capture: take this many of their pieces to win, from one to every one (0).' },
    { key: 'rabbitMove', label: 'The rabbit is moved', type: 'choice', def: 'choose', options: opts(['choose', 'By its side, as a turn'], ['random', 'By itself, at random']),
      help: 'For Take the rabbit’s piece. By its side: moving the rabbit onto another of that side’s pieces is that side’s move for the turn, chosen like any other (Timothy, 2026-10-13: "moving the rabbit is now purposeful and costs a turn to do for the side that has one. It is no longer random"). By itself: it hops to another of their pieces at random, every so many turns, the first way.' },
    { key: 'rabbitHop', label: 'The rabbit hops every', type: 'int', min: 1, max: 5, def: 3, unit: 'turns',
      help: 'For a rabbit that hops by itself: from one of their pieces to another, at random, this often (Timothy, 2026-10-13: "anywhere from every turn to every five turns. By default, it’s three turns").' },
    { key: 'rabbitSides', label: 'Rabbits ride', type: 'choice', def: 'theirs', options: opts(['theirs', 'Their pieces'], ['both', 'Both sides’ pieces']),
      help: 'Both: you have one too, hopping round your pieces; if they take the piece yours is on, you lose.' },
    { key: 'royal', label: 'Your King is royal', type: 'bool', def: true, help: 'Lose the King, lose the game.' },
    { key: 'holeMoves', label: 'The hole moves by', type: 'choice', def: 'daily', options: opts(
      ['still', 'Staying put'], ['daily', 'The daily set'], ['short', 'Random, 2 hops'], ['mid', 'Random, 3 to 4'], ['long', 'Random, 5 to 8']),
      help: 'Only when there is a hole. A hidden pattern, like a rabbit\u2019s.' },
    { key: 'ballStops', label: 'Ball must stop on the hole', type: 'bool', def: false,
      help: 'Off: it drops in when it rolls over the hole. On: it has to come to rest there.' },
    { key: 'maxMoves', label: 'Move limit', type: 'int', min: 0, max: 60, def: 20, help: '0 means no limit.' },
    { key: 'showdown', label: 'Two left: the board closes in', type: 'bool', def: true,
      help: 'Once only one piece of yours and one of theirs are left, the edge falls away every move, round and inward, until they meet. A square with a piece on it never falls.' }
  ] },
  { ...part('difficulty'), fields: [
    { key: 'difficulty', label: 'Difficulty', type: 'choice', def: 'any', options: opts(['any', 'Any'], ['easy', 'Easy (1 to 3)'], ['normal', 'Normal (4 to 6)'], ['hard', 'Hard (7 to 8)'], ['brutal', 'Brutal (9 to 10)']),
      help: 'Measured by a novice bot playing the level two dozen times (metrics.js): how often it loses, and how long the shortest win is. Needs the solver.' },
    { key: 'aim', label: 'Aim for difficulty', type: 'int', min: 0, max: 10, def: 0, unit: 'of 10',
      help: 'A number in place of a band: the level must measure within one of it (1 aims at 1 to 2). 0 uses the band above. The descent sets this itself, level by level.' },
    { key: 'minEngage', label: 'Engaging, at least', type: 'int', min: 0, max: 90, def: 0, unit: 'of 100',
      help: 'A first guess at how engaging a level is: choices that matter, pieces used, tension, comebacks. 0 lets anything through.' },
    { key: 'minCeiling', label: 'Skill ceiling, at least', type: 'int', min: 0, max: 30, def: 0, unit: 'tenths',
      help: 'How much faster an expert wins than a novice: 10 means twice as fast. A high ceiling is easy to win in many moves and hard to win in few. 0 lets anything through.' },
    { key: 'solve', label: 'Only deal winnable levels', type: 'bool', def: true,
      help: 'The solver plays each layout first and throws out any it cannot win in time. It also sets par.' },
    { key: 'parMax', label: 'Winnable within', type: 'int', min: 2, max: 30, def: 10, unit: 'moves' },
    { key: 'parMin', label: 'But not in fewer than', type: 'int', min: 1, max: 12, def: 3, unit: 'moves' },
    { key: 'balance', label: 'Balance rules', type: 'choice', def: 'on', options: opts(['off', 'Off'], ['on', 'On'], ['strict', 'Strict']),
      help: 'On: no piece on either side can capture on its first move, every piece of yours can move at the start, and every strange piece (fairy pieces, and the grasshopper-like ones that need the right circumstances) has a job: it makes a catch in the winning line, or the level is worse without it. Strict: every piece has a job. Needs the solver.' }
  ] },
  { ...part('information'), fields: [
    { key: 'showReach', label: 'Show where theirs can go', type: 'bool', def: true,
      help: 'A purple ring on every square their pieces\u2019 moves cover, updating as pieces move: the squares that are dangerous to stand on (Timothy, 2026-10-10 and 11). It includes squares under their own pieces that another of theirs guards, and a pawn\u2019s diagonals even when empty (2026-10-12).' },
    { key: 'showMyReach', label: 'Show where yours can go', type: 'bool', def: false,
      help: 'A gold ring on every square one of your pieces could move to. Off by default (2026-10-11: "less useful and muddies the board"); tapping a piece still lights its own squares.' },
    { key: 'showGuards', label: 'Shields on guarded pieces', type: 'bool', def: true,
      help: 'A piece of yours that another of yours would avenge (if it were taken there, yours could take back on that square) wears a shield, which falls into place with a clink when it becomes guarded: silver for one guard, gold for two or more.' },
    { key: 'showSafe', label: 'Shields on squares you guard', type: 'bool', def: true,
      help: 'A flat shield on an empty square their pieces reach (a purple ring) where one of yours can move and another would take back: move that piece there and it is guarded. Silver when two of your pieces come together there (one to move, one to guard), gold for three or more. A square only guarded, with nothing of yours able to move onto it, has none. With a piece picked up, its own moves are tried for real: it cannot guard itself (Timothy, 2026-10-13).' },
    { key: 'showBeacons', label: 'Beacons on what can be taken', type: 'bool', def: true,
      help: 'A beam of light rises from what could be taken next: purple from a piece of yours they could take on their next move if it stays (on your King, that is check), green from a piece of theirs you can take now (Timothy, 2026-10-11).' },
    { key: 'showPins', label: 'Needles through pinned pieces', type: 'bool', def: true,
      help: 'A piece pinned to its King (it stands between its King and a piece of the other side, so moving it would leave the King to be taken) has a sewing needle driven down through it, which drops in from above when the pin starts (Timothy, 2026-10-13). Yours and theirs, wherever losing the King loses. The rules still let it move: moving it loses.' },
    { key: 'tracks', label: 'Show rabbit tracks', type: 'bool', def: true }
  ] }

];

const FIELDS = SCHEMA.flatMap((g) => g.fields);
export const SETTINGS_VERSION = 21;
export const defaults = () => ({ ...Object.fromEntries(FIELDS.map((f) => [f.key, Array.isArray(f.def) ? [...f.def] : f.def])), v: SETTINGS_VERSION });

/** How each earlier version's defaults differ from today's. Settings saved
    then (links and notebook entries) only stored what differed from their
    own defaults, so they are read against them. */
// Version 9 (2026-10-09): pieces start on the first row, theirs and yours,
// when they are not lined up (Timothy: "pieces should start on the first
// row by default").
// Version 11 (2026-10-10): nobody waits. You must move a piece every turn,
// and so must they (Timothy: "by default, nobody, including enemies, should
// be able to wait instead of moving").
// Version 12 (2026-10-10): a full row each, a cloud on the second rows for
// the first turn, and every piece's reach shown.
// Version 13 (2026-10-11): each cloud stops only the other side (`cloudOwn`).
// Version 14 (2026-10-11): your own reach rings off, shields on guarded
// pieces.
// Version 15 (2026-10-11): beacons on what can be taken.
// Version 16 (2026-10-13): needles through pinned pieces.
// Version 17 (2026-10-13): statues can be taken.
// Version 18 (2026-10-13): shields on squares you guard.
// Version 19 (2026-10-13): the suits renamed (Swords is Vines, Spirals is
// Gears) and two gone (Diamonds, Spirits); weapons. No default changed:
// pieceMod reads an older link's suits by their old names.
// Version 20 (2026-10-13): the riding rabbit is moved by its side, as a
// turn (`rabbitMove: 'choose'`); before, it hopped by itself at random.
// Version 21 (2026-10-14): pawns step two squares on their first move,
// and en passant (`pawnRules: 'chess'`); before, one square at a time.
const V21 = { pawnRules: 'step' };
const V20 = { rabbitMove: 'random', ...V21 };
const V19 = { ...V20 };
const V18 = { showSafe: false, ...V19 };
const V17 = { statuesTake: false, ...V18 };
const V16 = { showPins: false, ...V17 };
const V15 = { showBeacons: false, ...V16 };
const V14 = { showMyReach: true, showGuards: false, ...V15 };
const V13 = { cloudOwn: false, ...V14 };
const V12 = { fullRow: false, cloud: false, showReach: false, ...V13 };
const V11 = { wait: true, foesWait: true, arrange: false, ...V12 };
const V10 = { oneMove: false, ...V11 };
const V9 = { mineRows: 2, foeRows: 3, ...V10 };
// Version 8 (2026-10-09): each side has a King. Take theirs, keep yours
// (goal 'king', royal), and two left brings on the showdown.
const V8 = { goal: 'descent', royal: false, showdown: false, dealKing: false, ...V9 };
const BEFORE = {
  20: { ...V21 },
  19: { ...V20 },
  18: { ...V19 },
  17: { ...V18 },
  16: { ...V17 },
  15: { ...V16 },
  14: { ...V15 },
  13: { ...V14 },
  12: { ...V13 },
  11: { ...V12 },
  10: { ...V11 },
  9: { ...V10 },
  8: { ...V9 },
  7: { ...V8 },
  6: { ...V8, rabbitMind: 'pattern' },
  5: { ...V8, rabbitMind: 'pattern', ballCaptures: false, statues: 0 },
  4: { ...V8, rabbitMind: 'pattern', lineup: false, ballCaptures: false, statues: 0 },
  3: { ...V8, rabbitMind: 'pattern', ballMove: 'ice', lineup: false, ballCaptures: false, statues: 0 },
  2: { ...V8, rabbitMind: 'pattern', lineup: false, ballCaptures: false, statues: 0, rabbits: 1, foes: 2, patterns: 'daily', darkBrain: 'think', kinds: 1, foePool: ['king', 'knight', 'bishop', 'pawn'], ballMove: 'ice' },
  1: { ...V8, rabbitMind: 'pattern', lineup: false, ballCaptures: false, statues: 0, rabbits: 0, foes: 3, patterns: 'daily', darkBrain: 'think', kinds: 1, foePool: ['king', 'knight', 'bishop', 'pawn'],
    ground: 'solid', goal: 'king', balance: 'off', ballMove: 'ice' }
};
/** A settings version this code can read: 2 up to today's. (Two copies
    of a list of versions went out of step at version 11, and links from 11
    on read as version 1: 2026-10-10.) */
const knownVersion = (v) => Number.isInteger(v) && v >= 2 && v <= SETTINGS_VERSION;
const defaultsFor = (v) => ({ ...defaults(), ...JSON.parse(JSON.stringify(BEFORE[v] || {})) });

/** Keep settings inside their ranges, whatever a link or a bug hands us.
    Anything without `v: 2` was made before version 2 and keeps its old
    meaning: crumbling was a switch, there was no separate rabbit count, and
    rabbits ate whenever their side could take your pieces. */
/** What has been done to one piece (a hand's, a square's): its hearts
    (lives), its suit and its weapon, kept in range. Settings older than
    version 19 named the suits as they were then (Swords is Vines now,
    Spirals is Gears, and Diamonds and Spirits are gone). */
const OLD_SUITS = { swords: 'vines', spirals: 'gears', diamonds: null, spirits: null };
export function pieceMod(m, v = SETTINGS_VERSION) {
  const suit = v < 19 && m?.suit in OLD_SUITS ? OLD_SUITS[m.suit] : m?.suit;
  return { ...(m?.lives > 1 ? { lives: Math.min(9, m.lives | 0) } : {}), ...(SUITS[suit] ? { suit } : {}),
    ...(WEAPON_KINDS.includes(m?.weapon) ? { weapon: m.weapon, wl: Math.max(1, Math.min(3, m.wl | 0 || 1)) } : {}), ...(m?.row === 1 ? { row: 1 } : {}) };
}

export function clean(raw) {
  const v = knownVersion(raw?.v) ? raw.v : 1, legacy = v === 1;
  // Pieces invented in the catalog travel with the settings (so a link, or
  // the solver's background thread, knows them), and are made real first.
  const invented = cleanInvented(raw?.invented);
  if (invented.length) registerInvented(invented);
  const s = defaultsFor(v);
  for (const f of FIELDS) {
    const v = raw?.[f.key];
    if (v === undefined) continue;
    if (f.type === 'int' && Number.isFinite(+v)) s[f.key] = Math.max(f.min, Math.min(f.max, Math.round(+v)));
    if (f.type === 'bool') s[f.key] = !!v;
    if (f.type === 'choice' && f.options.some((o) => o.v === String(v))) s[f.key] = String(v);
    if (f.type === 'multi' && Array.isArray(v)) {
      const ok = v.filter((k) => f.options.some((o) => o.v === k));
      if (ok.length) s[f.key] = [...new Set(ok)];
    }
    if (f.type === 'pieces' && Array.isArray(v)) {
      const ok = v.filter((k) => PIECES[k] && PIECES[k].kind !== 'neutral' && (k !== 'rabbit' || f.rabbit));
      if (ok.length) s[f.key] = [...new Set(ok)];
    }
  }
  if (legacy) {
    if (raw?.crumble && raw.ground === undefined) s.ground = 'crumble';
    if (raw?.rabbitsEat === undefined) s.rabbitsEat = s.foesCapture;
  }
  if (invented.length) s.invented = invented;
  // The catalog's vetoes: pieces kept out of every deal (not out of a hand
  // given outright).
  if (Array.isArray(raw?.veto)) { const veto = raw.veto.filter((k) => PIECES[k]); if (veto.length) s.veto = [...new Set(veto)]; }
  if (s.parMin > s.parMax) s.parMin = s.parMax;
  if (s.geared) s.h = s.w; // a board that turns has to be square
  const ballGoal = s.goal === 'hole' || s.goal === 'descent';
  if (s.foes + s.rabbits < 1 && !ballGoal) s.foes = 1; // nothing to catch otherwise
  if (s.goal === 'king' && s.foes < 1) s.foes = 1;    // something has to be the King
  if (ballGoal && !legacy && s.mine < 2) s.mine = 2;  // the ball, and something to stop it
  // A full row each (version 12): as many pieces a side as the board is
  // wide (at most eight). A hand given outright (below) keeps its own count.
  if (s.fullRow) { s.mine = Math.min(8, s.w); if (!ballGoal) s.foes = Math.min(8, s.w); }
  if (s.kinds > Math.max(1, s.foes)) s.kinds = Math.max(1, s.foes);
  // A hand given outright (the descent: the pieces you carry down), not
  // dealt. Not a setting on the page.
  if (Array.isArray(raw?.hand) && raw.hand.length) {
    const keep = raw.hand.map((k) => !!PIECES[k]);
    s.hand = raw.hand.filter((k, i) => keep[i]);
    s.mine = s.hand.length;
    // What the descent has done to each piece in the hand: hearts (lives)
    // and its suit (a rule it carries, and its colour).
    if (Array.isArray(raw.handMods)) s.handMods = raw.handMods.filter((m, i) => keep[i]).map((m) => pieceMod(m, v));
  }
  // Both sides square by square (the piece trials, 2026-10-13): `cells` is
  // yours, your back row first, left to right, then the row in front;
  // `foeCells` theirs, their back row first, in the same files as yours
  // (so a mirrored line has the same order). A null is an empty square;
  // `cellMods` and `foeCellMods` are each piece's suit and hearts. Not on
  // the page.
  if (Array.isArray(raw?.cells) && Array.isArray(raw?.foeCells)) {
    const ok = (a) => a.slice(0, 2 * s.w).map((t) => (typeof t === 'string' && PIECES[t] && t !== 'rabbit' && t !== 'ball' ? t : null));
    const mod = (m) => pieceMod(m, v);
    s.cells = ok(raw.cells); s.foeCells = ok(raw.foeCells);
    s.cellMods = s.cells.map((_, i) => mod(raw.cellMods?.[i])); s.foeCellMods = s.foeCells.map((_, i) => mod(raw.foeCellMods?.[i]));
    s.mine = s.cells.filter(Boolean).length; s.foes = s.foeCells.filter(Boolean).length;
  }
  // Their side given outright (the descent from 2026-10-12: they carry a
  // lineup down too, with its own upgrades), not dealt. Not on the page.
  if (Array.isArray(raw?.foeHand) && raw.foeHand.length) {
    const keep = raw.foeHand.map((k) => !!PIECES[k]);
    s.foeHand = raw.foeHand.filter((k, i) => keep[i]);
    s.foes = s.foeHand.filter((k) => k !== 'bunny').length;
    if (Array.isArray(raw.foeMods)) s.foeMods = raw.foeMods.filter((m, i) => keep[i]).map((m) => pieceMod(m, v));
  }
  // A starting position given outright (the piece trials, 2026-10-13): an
  // extended FEN (variants.js readFen). Not on the page.
  if (typeof raw?.position === 'string' && /^[0-9a-zA-Z/[\]-]{3,400}$/.test(raw.position)) s.position = raw.position;
  // A board of tiles (Tile Chess, 2026-10-14): `tiles` is { w, h, open
  // (squares y * w + x that are board), home: [your row, their row], cx
  // (the file the lines centre on) }. Every other square is a gap. Not on
  // the page; a run carries it.
  const T = raw?.tiles;
  if (T && Number.isInteger(T.w) && Number.isInteger(T.h) && T.w >= 3 && T.h >= 3 && T.w <= 16 && T.h <= 16 && Array.isArray(T.open) && Array.isArray(T.home)) {
    const open = [...new Set(T.open.filter((q) => Number.isInteger(q) && q >= 0 && q < T.w * T.h))];
    const row = (y) => Math.max(0, Math.min(T.h - 1, y | 0));
    if (open.length >= 12) { s.tiles = { w: T.w, h: T.h, open, home: [row(T.home[0]), row(T.home[1])], cx: Math.max(0, Math.min(T.w - 1, T.cx | 0)) }; s.w = T.w; s.h = T.h; }
  }
  // Run rules carried by a level (the descent's jokers).
  if (raw?.movesPerTurn === 2) s.movesPerTurn = 2;
  if (raw?.lazyFoes) s.lazyFoes = true;
  s.v = SETTINGS_VERSION;
  return s;
}

// --- Going crazy. ----------------------------------------------------------

/** Random settings. Not uniformly random: weighted toward things that are
    likely to be playable, with a long tail of strange. `allowed` is which
    fairy pieces (and whether the rabbit) it may use; classic pieces always. */
export function crazy(rand = Math.random, allowed = [...FAIRY, 'rabbit']) {
  const fairy = FAIRY.filter((k) => allowed.includes(k)), rabbitOk = allowed.includes('rabbit');
  const ALL = [...CLASSIC, ...fairy];
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const some = (pool, a, b) => shuffled(pool, rand).slice(0, int(a, b));
  const w = int(4, 9), h = int(4, 9);
  const mine = int(2, 5);
  const brain = rand() < 0.5 ? 'pattern' : 'ai';
  const out = clean({
    v: SETTINGS_VERSION, w, h,
    shape: rand() < 0.35 ? 'rect' : pick(['diamond', 'round', 'cross', 'ring', 'hourglass', 'L', 'stairs', 'islands', 'cheese']),
    holes: rand() < 0.6 ? 0 : int(1, 6), statues: rand() < 0.3 ? 0 : int(1, 4),
    magic: pick(['none', 'none', 'none', 'sides', 'all']), geared: rand() < 0.15,
    ground: pick(['solid', 'solid', 'solid', 'crumble', 'shrink', 'spiral']), shrinkEvery: int(1, 3),
    rabbits: rabbitOk ? int(0, 2) : 0, rabbitsEat: rand() < 0.2,
    darkBrain: rand() < 0.65 ? 'possessed' : 'think', kinds: int(1, 3),
    rabbitMind: rand() < 0.8 ? 'mind' : 'pattern', iq: int(2, 9), traits: some(Object.keys(TRAITS), 1, 4),
    mine, minePool: some(ALL, 2, 6), mineDupes: rand() < 0.3, mineRows: int(1, 2), lineup: rand() < 0.8,
    mode: rand() < 0.15 ? 'auto' : 'hand', autoPool: 'all',
    royal: rand() < 0.2, wait: (rand(), false), // still drawn, so the rolls after it are the same
    foes: int(1, 4),
    foePool: rabbitOk && rand() < 0.4 ? ['rabbit'] : some(rabbitOk ? ['rabbit', ...ALL] : ALL, 1, 4),
    foeDupes: rand() < 0.6, mirror: rand() < 0.12, foeRows: int(1, 3),
    rabbitBrain: brain, patterns: pick(['all', 'all', 'daily', 'short', 'mid', 'long', 'wild']),
    hops: rand() < 0.8 ? 1 : int(2, 3), tracks: rand() < 0.85,
    skill: pick(['0', '1', '2', '2', '3']), style: pick(['flee', 'balanced', 'hunt']),
    foesCapture: rand() < 0.85,
    goal: pick(['all', 'king', 'king', 'any', 'mix', 'hole', 'hole', ...(rabbitOk ? ['rabbit', 'rabbit', 'descent', 'descent', 'descent'] : [])]),
    maxMoves: pick([0, 15, 20, 25, 30]), first: rand() < 0.8 ? 'you' : 'them',
    holeMoves: pick(['still', 'daily', 'daily', 'short', 'mid']), ballStops: rand() < 0.3, ballMove: pick(['putt', 'putt', 'ice', 'bounce', 'hit', 'hit']),
    solve: true, parMax: int(6, 12), parMin: int(2, 3)
  });
  // Ball levels are often best with few or no pieces against you.
  if (out.goal === 'hole') out.foes = int(0, 2);
  if (out.goal === 'descent') { out.foes = int(1, 4); if (out.darkBrain !== 'possessed') out.rabbits = Math.max(1, out.rabbits); }
  return out;
}

// --- Board shapes. ---------------------------------------------------------

/** Which squares a shape leaves out. */
function shapeHoles(shape, W, H, rand) {
  const holes = new Set(), cx = (W - 1) / 2, cy = (H - 1) / 2;
  const drop = (x, y) => holes.add(y * W + x);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const nx = (x - cx) / (W / 2), ny = (y - cy) / (H / 2);
      const out = {
        diamond: () => Math.abs(nx) + Math.abs(ny) > 1.05,
        round: () => nx * nx + ny * ny > 1.1,
        cross: () => Math.abs(x - cx) > Math.max(0.5, W / 6) && Math.abs(y - cy) > Math.max(0.5, H / 6),
        ring: () => W >= 5 && H >= 5 && Math.abs(x - cx) < W / 4 && Math.abs(y - cy) < H / 4,
        hourglass: () => Math.abs(nx) > Math.abs(ny) + 0.3,
        L: () => x >= Math.ceil(W / 2) && y >= Math.ceil(H / 2),
        stairs: () => Math.abs((x / (W - 1)) - (y / (H - 1))) > 0.55,
        cheese: () => rand() < 0.2
      }[shape];
      if (out && out()) drop(x, y);
    }
  if (shape === 'islands' && H >= 5) {
    const mid = Math.floor(H / 2), bridge = Math.floor(rand() * W);
    for (let x = 0; x < W; x++) if (x !== bridge) drop(x, mid);
  }
  return holes;
}

/** Keep only the biggest connected piece of board, so nothing is stranded. */
function keepLargest(W, H, holes) {
  const seen = new Set();
  let best = [];
  for (let sq = 0; sq < W * H; sq++) {
    if (holes.has(sq) || seen.has(sq)) continue;
    const part = [], stack = [sq];
    seen.add(sq);
    while (stack.length) {
      const q = stack.pop(), x = q % W, y = Math.floor(q / W);
      part.push(q);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || holes.has(k) || seen.has(k)) continue;
        seen.add(k); stack.push(k);
      }
    }
    if (part.length > best.length) best = part;
  }
  const keep = new Set(best), out = new Set();
  for (let sq = 0; sq < W * H; sq++) if (!keep.has(sq)) out.add(sq);
  return out;
}

// --- Rabbit patterns. ------------------------------------------------------

function randomPattern(kind, rand) {
  const small = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const big = [[2, 0], [0, 2], [-2, 0], [0, -2], [2, 1], [1, 2], [-1, 2], [-2, 1], [2, 2], [-2, 2], [3, 0], [0, 3]];
  const len = { short: 2, mid: 3 + Math.floor(rand() * 2), long: 5 + Math.floor(rand() * 4), wild: 2 + Math.floor(rand() * 3) }[kind];
  const pool = kind === 'wild' ? big : small;
  for (;;) {
    const steps = Array.from({ length: len }, () => pool[Math.floor(rand() * pool.length)]);
    const dx = steps.reduce((n, s) => n + s[0], 0), dy = steps.reduce((n, s) => n + s[1], 0);
    if (dx || dy) return { name: 'Random', steps }; // a pattern that goes nowhere is no fun to find
  }
}

// --- Making a level. -------------------------------------------------------

/** Settings + seed -> a level the rules engine can play. */
export function makeLevel(settings, seed) {
  const S = clean(settings);
  if (S.variant !== 'none' && VARIANTS[S.variant]) return variantLevel(S, seed);
  if (S.position) { const L = positionLevel(S, seed); if (L) return L; }
  const rand = rng(`lab:${seed}`);
  const T = S.tiles, W = T ? T.w : S.w, H = T ? T.h : S.h;
  const need = S.mine + (S.mirror ? S.mine : S.foes) + S.rabbits + 2 + S.statues;

  let holes;
  if (T) {
    // A board of tiles: the squares turned over so far, every other one a gap.
    const open = new Set(T.open);
    holes = new Set();
    for (let q = 0; q < W * H; q++) if (!open.has(q)) holes.add(q);
  } else {
    holes = shapeHoles(S.shape, W, H, rand);
    for (let i = 0; i < S.holes; i++) holes.add(Math.floor(rand() * W * H));
    holes = keepLargest(W, H, holes);
    if (W * H - holes.size < need) holes = new Set(); // too little board left: fall back to the rectangle
  }

  // Stumps and bramble are out for now; the rules engine still expects the
  // fields (the first two daily boards use them), so they stay, empty.
  const day = { W, H, holes, stumps: new Set(), bramble: [], brambleAt: new Map(), every: 2 };
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (onBoard(day, x, y)) cells.push([x, y]);
  const rows = [...new Set(cells.map((c) => c[1]))].sort((a, b) => a - b);
  const taken = new Set();
  const free = ([x, y]) => !taken.has(y * W + x);
  /** A random free square in the given rows, or anywhere free if those are full. */
  const place = (rowList) => {
    let pool = cells.filter((c) => rowList.includes(c[1]) && free(c));
    if (!pool.length) pool = cells.filter(free);
    if (!pool.length) return {};
    const c = pool[Math.floor(rand() * pool.length)];
    taken.add(c[1] * W + c[0]);
    return { x: c[0], y: c[1] };
  };
  /** n piece types from a pool: drawn without repeats until the pool runs
      out (or with repeats from the start, if allowed). */
  const deal = (pool0, n, dupes) => {
    // Vetoed pieces are left out, unless that would leave nothing.
    const kept = S.veto ? pool0.filter((k) => !S.veto.includes(k)) : pool0;
    const pool = kept.length ? kept : pool0;
    const out = [];
    let bag = [];
    for (let i = 0; i < n; i++) {
      if (dupes) { out.push(pool[Math.floor(rand() * pool.length)]); continue; }
      if (!bag.length) bag = shuffled(pool, rand);
      out.push(bag.shift());
    }
    return out;
  };

  /** Lined up like chess (version 5): n squares side by side along the
      first of `rowList` (its edge row first), a run of them at a random
      place along it, spilling onto the next row if the shape is too narrow. */
  const lineUp = (rowList, n) => {
    const out = [];
    for (const y of rowList) {
      if (out.length >= n) break;
      const row = cells.filter((c) => c[1] === y && free(c)).sort((p, q) => p[0] - q[0]);
      const k = Math.min(n - out.length, row.length), at = Math.floor(rand() * (row.length - k + 1));
      for (const [x] of row.slice(at, at + k)) { taken.add(y * W + x); out.push({ x, y }); }
    }
    while (out.length < n) out.push(place(rowList));
    return shuffled(out, rand); // which piece stands where is part of the dice roll
  };

  const bottom = rows.slice(0, S.mineRows), top = rows.slice(-S.foeRows);
  const myTypes = S.hand ? S.hand.slice() : deal(S.minePool, S.mine, S.mineDupes);
  // A royal King has to be there to protect. (A run's hand brings its own:
  // the descent deals one and keeps it.)
  if (S.royal && S.dealKing && !S.hand && myTypes.length && !myTypes.includes('king') && S.goal !== 'hole') myTypes[0] = 'king';
  /** In the order given (inOrder): n squares along row y, from the file
      that centres them, left to right. */
  const inRow = (y, n) => {
    const row = cells.filter((c) => c[1] === y).sort((p, q) => p[0] - q[0]), at = Math.max(0, Math.floor((row.length - n) / 2));
    return Array.from({ length: n }, (_, i) => { const c = row[at + i]; if (!c || !free(c)) return place([y]); taken.add(c[1] * W + c[0]); return { x: c[0], y: c[1] }; });
  };
  const ordered = S.inOrder && S.hand && S.foeHand;
  /** A board of tiles: n squares along home row y0, centred on file cx,
      left to right. A square that is a gap or taken moves to the nearest
      free one on that row, then on the rows in front (dir: +1 for you, -1
      for them), so a line longer than the row spills forward. */
  const tileLine = (y0, n, dir) => Array.from({ length: n }, (_, i) => {
    const x0 = T.cx - Math.floor((n - 1) / 2) + i;
    for (let y = y0; y >= 0 && y < H; y += dir) {
      const row = cells.filter((c) => c[1] === y && free(c)).sort((a, b) => Math.abs(a[0] - x0) - Math.abs(b[0] - x0) || a[0] - b[0]);
      if (row.length) { const [x] = row[0]; taken.add(y * W + x); return { x, y }; }
    }
    return place([y0]);
  });
  // Square by square (cells, the piece trials): no dice at all.
  const exact = S.cells && S.foeCells;
  const fromCells = (list, mods, side) => list.map((type, i) => {
    if (!type) return null;
    const x = i % W, r = Math.floor(i / W), y = side === 'you' ? rows[r] : rows[rows.length - 1 - r];
    if (y === undefined || !onBoard(day, x, y)) return null;
    taken.add(y * W + x);
    return { type, x, y, ...(mods?.[i] || {}) };
  }).filter(Boolean);
  /** A line in two rows: the pieces marked row 1 (a row of pawns, the
      descent and Tile Chess from 2026-10-14) stand in front of the rest.
      `at(r, n)` gives n squares on row r of the line. */
  const twoRows = (rowOf, n, at) => {
    const back = [], front = [];
    for (let i = 0; i < n; i++) (rowOf(i) ? front : back).push(i);
    const b = at(0, back.length), f = at(1, front.length), out = [];
    back.forEach((i, k) => { out[i] = b[k]; }); front.forEach((i, k) => { out[i] = f[k]; });
    return out;
  };
  const myRow = (i) => S.handMods?.[i]?.row === 1;
  const mySpots = exact ? null : T && ordered ? twoRows(myRow, myTypes.length, (r, n) => tileLine(T.home[0] + r, n, 1))
    : ordered ? twoRows(myRow, myTypes.length, (r, n) => inRow(rows[r] ?? rows[0], n)) : S.lineup ? lineUp(rows, myTypes.length) : null;
  let pieces = exact ? fromCells(S.cells, S.cellMods, 'you') : myTypes.map((type, i) => ({ type, ...(mySpots ? mySpots[i] : place(bottom)), ...(S.handMods?.[i] || {}) }));
  // One piece on the board, taking turns (cycle, Adventure): the first of
  // the set stands there; the rest wait in order, and their squares are free.
  if (S.cycle && pieces.length > 1 && !exact) {
    day.cycle = pieces.map(({ x, y, ...own }) => own);
    for (const p of pieces.slice(1)) if (p.x !== undefined) taken.delete(p.y * W + p.x);
    pieces = pieces.slice(0, 1);
  }

  let foes;
  if (exact) foes = fromCells(S.foeCells, S.foeCellMods, 'foe');
  else if (S.mirror) {
    foes = pieces.map((p) => {
      const my = H - 1 - p.y, sq = my * W + p.x;
      const spot = onBoard(day, p.x, my) && !taken.has(sq) ? (taken.add(sq), { x: p.x, y: my }) : place(top);
      return { type: p.type, ...spot };
    });
  } else if (S.foeHand) {
    // Their lineup, given: lined up on the far row, and any Rabbit among it
    // on the row in front of them (2026-10-12).
    const far = rows.slice().reverse(), mods = S.foeMods || [];
    const line = S.foeHand.map((type, i) => ({ type, ...(mods[i] || {}) })).filter((f) => f.type !== 'bunny');
    const theirRow = (i) => line[i].row === 1;
    const spots = T && ordered ? twoRows(theirRow, line.length, (r, n) => tileLine(T.home[1] - r, n, -1))
      : ordered ? twoRows(theirRow, line.length, (r, n) => inRow(far[r] ?? far[0], n)) : lineUp(far, line.length);
    foes = line.map((f, i) => ({ ...f, ...spots[i] }));
    for (const t of S.foeHand) if (t === 'bunny') foes.push({ type: 'bunny', ...place(far.slice(1, 2)) });
  } else if (S.lineup) {
    // With all four edges joined the top row touches the bottom one, so the
    // farthest their line can be from yours is halfway up the board.
    const far = S.magic === 'all' ? [...rows.slice(Math.floor(rows.length / 2)), ...rows.slice(1, Math.floor(rows.length / 2)).reverse()] : rows.slice().reverse();
    const types = deal(S.foePool, S.foes, S.foeDupes), spots = lineUp(far, types.length);
    foes = types.map((type, i) => ({ type, ...spots[i] }));
  } else foes = deal(S.foePool, S.foes, S.foeDupes).map((type) => ({ type, ...place(top) }));
  // Rabbits of their own, on top of the dark pieces. (Only drawn when there
  // are some, so levels from before version 2 come out exactly as they did.)
  for (let i = 0; i < S.rabbits; i++) foes.push({ type: 'rabbit', ...place(top) });

  // The goal. King and rabbit goals make sure the thing to catch exists, and
  // mark it; the rules engine only knows "catch every marked one".
  const goal = S.goal === 'mix' ? ['all', 'king', 'rabbit'][Math.floor(rand() * 3)] : S.goal;
  if (goal === 'king' && foes.length) {
    const kings = foes.filter((f) => f.type === 'king');
    if (!kings.length) foes[0].type = 'king';
    else kings.slice(1).forEach((f) => { f.type = 'pawn'; });
    foes.find((f) => f.type === 'king').target = true;
  }
  if (goal === 'rabbit' && foes.length) {
    if (!foes.some((f) => f.type === 'rabbit')) foes[0].type = 'rabbit';
    foes.forEach((f) => { if (f.type === 'rabbit') f.target = true; });
  }
  if (goal === 'target' && foes.length) (foes.find((f) => f.type === 'rabbit') || foes[0]).target = true;
  // Rabbits, then the ball: every rabbit is marked, and the hole stays shut
  // until they are all caught.
  if (goal === 'descent') foes.forEach((f) => { if (f.type === 'rabbit' || S.darkBrain === 'possessed') f.target = true; });
  // Take them all, then the hole: every one of theirs is marked.
  if (goal === 'clear') foes.forEach((f) => { if (f.type !== 'rabbit') f.target = true; });

  // Capture the rabbit (2026-10-13, Timothy: "rabbit in the center of a 7x7
  // board"): it waits on the middle square, which nothing else is dealt onto.
  if (goal === 'flag') {
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
    const spot = [[cx, cy], ...cells.slice().sort((a, b) => Math.max(Math.abs(a[0] - cx), Math.abs(a[1] - cy)) - Math.max(Math.abs(b[0] - cx), Math.abs(b[1] - cy)))]
      .find(([x, y]) => onBoard(day, x, y) && free([x, y]) && ![...pieces, ...foes].some((p) => p.x === x && p.y === y));
    if (spot) { day.flag = { x: spot[0], y: spot[1] }; taken.add(spot[1] * W + spot[0]); }
  }

  // Sink the ball: your first piece becomes the ball, and the hole starts on
  // their side of the board. (This draws its random numbers only on ball
  // levels, so every other level stays exactly as it was.)
  let hole = null;
  // The way out of a cleared level: a hole on any free square, shut until
  // every piece of theirs is taken. It does not move, and nothing becomes
  // a ball.
  if (goal === 'clear') {
    const spot = place(rows);
    if (spot.x !== undefined) hole = { x: spot.x, y: spot.y, mx: 1, my: 1 };
  }
  if (goal === 'hole' || goal === 'descent') {
    if (pieces.length) pieces[0].type = 'ball';
    const spot = place(top);
    if (spot.x !== undefined) {
      hole = { x: spot.x, y: spot.y, mx: rand() < 0.5 ? 1 : -1, my: rand() < 0.5 ? 1 : -1 };
      if (S.holeMoves !== 'still') {
        const p = S.holeMoves === 'daily' ? PATTERNS[Math.floor(rand() * PATTERNS.length)] : randomPattern(S.holeMoves, rand);
        hole.pattern = p.steps; hole.patternName = p.name;
      }
    }
  }

  // Brains and patterns. A possessed piece gets one of `kinds` patterns,
  // chosen first, in turn, so with one kind every piece moves alike.
  // (Possession draws its numbers only when there is some, so levels from
  // before version 3 come out exactly as they did.)
  const pickPattern = () => (S.patterns === 'daily' ? PATTERNS[Math.floor(rand() * PATTERNS.length)]
    : S.patterns === 'all' ? ALL_PATTERNS[Math.floor(rand() * ALL_PATTERNS.length)] : randomPattern(S.patterns, rand));
  const routes = S.darkBrain === 'possessed' && S.patterns === 'routes';
  const possessed = S.darkBrain === 'possessed' && !routes ? foes.filter((f) => f.type !== 'rabbit') : [];
  const kindPats = possessed.length ? Array.from({ length: Math.min(S.kinds, possessed.length) }, pickPattern) : [];
  foes.forEach((f) => {
    if (possessed.includes(f)) {
      const p = kindPats[possessed.indexOf(f) % kindPats.length];
      f.brain = 'possessed'; f.pattern = p.steps; f.patternName = p.name;
      f.mx = rand() < 0.5 ? 1 : -1; f.my = rand() < 0.5 ? 1 : -1;
      return;
    }
    f.brain = f.type === 'rabbit' && S.rabbitBrain === 'pattern' ? 'pattern' : 'ai';
    if (f.brain === 'pattern') {
      const p = pickPattern();
      f.pattern = p.steps; f.patternName = p.name;
      f.mx = rand() < 0.5 ? 1 : -1; f.my = rand() < 0.5 ? 1 : -1; f.hops = S.hops;
    }
  });
  // Statues of theirs (Adventure, 2026-10-15): the first `still` of their
  // pieces never move and never take; they are there to be taken. Drawn in
  // grey. (No random numbers, so levels without them deal as before.)
  if (S.still > 0 && !routes) foes.filter((f) => f.type !== 'rabbit').slice(0, S.still).forEach((f) => { f.brain = 'still'; delete f.pattern; delete f.patternName; });
  // One rabbit leads them (darkBrain 'rabbit', 2026-10-13): a Rabbit on
  // their King's head (one given in their lineup, or a new one), with a
  // trait and an intelligence. Their pieces think as it says (leaderMind).
  let lead = null;
  if (S.darkBrain === 'rabbit' && foes.length && goal !== 'carrier') {
    const king = foes.find((f) => f.type === 'king' && f.x !== undefined) || foes.find((f) => f.type !== 'bunny' && f.x !== undefined);
    let r = foes.find((f) => f.type === 'bunny');
    if (!r) { r = { type: 'bunny' }; foes.push(r); }
    const trait = S.traits[Math.floor(rand() * S.traits.length)] || 'aggressive';
    if (king) Object.assign(r, { x: king.x, y: king.y, rides: foes.indexOf(king) });
    Object.assign(r, { brain: 'leader', mind: { iq: S.iq, trait }, patternName: TRAITS[trait].name, mx: 1, my: 1, i: 0 });
    lead = leaderMind(trait, S.iq);
  }

  // Ghosts (2026-10-13): the row in front of each side's line, where pawns
  // would stand, every square of it that nothing else stands on. No random
  // numbers, so a level without them is dealt as it always was.
  if (S.ghosts && !S.realtime && rows.length >= 4) {
    day.ghosts = new Map();
    const at = new Set([...pieces, ...foes].filter((p) => p.x !== undefined).map((p) => p.y * W + p.x));
    for (const [y, side] of [[rows[1], 'you'], [rows[rows.length - 2], 'foe']])
      for (const [x, cy] of cells) if (cy === y && !at.has(y * W + x)) { day.ghosts.set(y * W + x, side); taken.add(y * W + x); }
  }

  // Statues (2026-10-07): in the middle of the board, between the two
  // sides' rows, never where anything starts. Placed last, so a level
  // without them comes out exactly as it did before they existed.
  if (S.statueRow) {
    // A row of statues (2026-10-12): the middle row, all of it, opening one
    // a turn in an order drawn here.
    const y = rows[Math.floor(rows.length / 2)], row = cells.filter((c) => c[1] === y && free(c));
    day.statueKinds = new Map();
    const kinds = ['pawn', 'rook', 'knight', 'bishop', 'king', 'queen'];
    for (const [x] of row) { day.stumps.add(y * W + x); day.statueKinds.set(y * W + x, kinds[Math.floor(rand() * kinds.length)]); }
    day.statueOrder = shuffled(row.map(([x]) => y * W + x), rand);
  } else if (S.statues) {
    // On a board of tiles, between the two lines, not in front of either.
    const between = T ? rows.filter((y) => y > T.home[0] + 1 && y < T.home[1] - 1) : null;
    const mid = T ? (between.length ? between : rows.filter((y) => y > T.home[0] && y < T.home[1])) : rows.slice(S.lineup ? 1 : S.mineRows, S.lineup ? -1 : -S.foeRows);
    const pool = cells.filter((c) => (mid.length ? mid.includes(c[1]) : true) && free(c));
    const kinds = ['pawn', 'rook', 'knight', 'bishop', 'king', 'queen'];
    day.statueKinds = new Map();
    for (let i = 0; i < S.statues && pool.length; i++) {
      const [x, y] = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      day.stumps.add(y * W + x);
      day.statueKinds.set(y * W + x, kinds[Math.floor(rand() * kinds.length)]);
    }
  }

  // The cloud (version 12), for the first turn: the row just in front of
  // each side's pieces (their second row, when a full row lines up on the
  // first). No random numbers, so nothing else about the level changes.
  if (S.cloud && rows.length >= 4) {
    const mineY = pieces.filter((p) => p.y !== undefined).map((p) => p.y), theirY = foes.filter((f) => f.y !== undefined && f.type !== 'rabbit' && f.type !== 'bunny').map((f) => f.y);
    const ahead = mineY.length ? rows.find((r) => r > Math.max(...mineY)) : undefined;
    const behind = theirY.length ? [...rows].reverse().find((r) => r < Math.min(...theirY)) : undefined;
    const cloudRows = [ahead, behind].filter((r) => r !== undefined);
    const rowSet = (r) => new Set(cells.filter((c) => c[1] === r).map(([x, y]) => y * W + x));
    if (cloudRows.length) {
      day.cloud = new Set(cells.filter((c) => cloudRows.includes(c[1])).map(([x, y]) => y * W + x));
      // Which is whose (version 13): yours stops theirs, theirs stops yours.
      day.cloudYou = rowSet(ahead); day.cloudFoe = rowSet(behind);
    }
  }

  // Minds (version 7): every rabbit, loose or inside a piece, gets an
  // intelligence and a trait; `kinds` says how many different traits.
  // Drawn last, so a level without minds is dealt as it always was.
  if (S.rabbitMind === 'mind') {
    const minded = foes.filter((f) => f.brain === 'possessed' || f.brain === 'pattern');
    const traits = shuffled(S.traits, rand).slice(0, Math.max(1, Math.min(S.kinds, minded.length)));
    minded.forEach((f, i) => {
      const trait = traits[i % traits.length];
      f.mind = { iq: S.iq, trait };
      // It wears its trait's colour; a habit keeps its pattern's name.
      if (trait !== 'pattern') f.patternName = TRAITS[trait].name;
    });
  }

  // Gates and wandering clouds (2026-10-13), drawn last so a level without
  // them is dealt as it always was: on free squares between the two sides
  // (inside the ghosts, if there are any).
  if ((S.gates || S.clouds || S.sand || S.water) && !S.realtime) {
    const lo = S.ghosts ? 2 : 1, mid = rows.slice(lo, Math.max(lo, rows.length - lo));
    const pool = cells.filter((c) => (mid.length ? mid.includes(c[1]) : true) && free(c) && !day.ghosts?.has(c[1] * W + c[0]) && !day.stumps.has(c[1] * W + c[0]));
    const pick = () => { const [x, y] = pool.splice(Math.floor(rand() * pool.length), 1)[0]; taken.add(y * W + x); return { x, y }; };
    if (S.gates) { day.gates = new Map(); for (let i = 0; i < S.gates && pool.length; i++) { const { x, y } = pick(); day.gates.set(y * W + x, i % 2); } }
    if (S.clouds) { day.clouds = []; for (let i = 0; i < S.clouds && pool.length; i++) day.clouds.push(pick()); }
    // Golf's hazards (2026-10-13), after the rest so nothing else moves.
    if (S.sand) { day.sand = new Set(); for (let i = 0; i < S.sand && pool.length; i++) { const { x, y } = pick(); day.sand.add(y * W + x); } }
    if (S.water) { day.water = new Set(); for (let i = 0; i < S.water && pool.length; i++) { const { x, y } = pick(); day.water.add(y * W + x); } }
  }

  // Take the rabbit's piece (2026-10-13): a Rabbit rides one of their
  // pieces, picked at random (one given in their lineup, or a new one); with
  // rabbitSides 'both', one rides yours too. Drawn last, so other levels are
  // dealt as they always were.
  pieces = pieces.filter((p) => p.x !== undefined); foes = foes.filter((f) => f.x !== undefined);
  // A weapon a piece cannot carry (a lance on one that does not slide) goes.
  for (const p of [...pieces, ...foes]) if (p.weapon && !canArm(p.type, p.weapon)) { delete p.weapon; delete p.wl; }
  if (goal === 'carrier') {
    const ride = (list, own) => {
      const on = list.map((q, j) => j).filter((j) => list[j].x !== undefined && !['bunny', 'ball', 'rabbit'].includes(list[j].type));
      if (!on.length) return;
      let r = own ? list.find((q) => q.type === 'bunny') : null;
      if (!r) { r = { type: 'bunny' }; list.push(r); }
      const j = on[Math.floor(rand() * on.length)];
      Object.assign(r, { brain: 'carrier', x: list[j].x, y: list[j].y, rides: j });
    };
    ride(foes, true);
    if (S.rabbitSides === 'both') ride(pieces, false);
  }

  Object.assign(day, {
    seed, settings: S, shrinkKey: seed, pieces, foes,
    goalKind: goal, hole,
    rules: { goal: ['king', 'rabbit', 'target'].includes(goal) ? 'target' : goal, maxMoves: S.maxMoves, wait: S.wait,
      foesCapture: S.foesCapture, rabbitsEat: S.rabbitsEat, royal: S.royal, ...(S.showdown ? { showdown: true } : {}), ...(S.oneMove ? { oneMove: true } : {}), ...(S.oneMove && !S.foesWait ? { foesMust: true } : {}), ...(day.cloud ? { cloud: true, ...(S.cloudOwn ? { cloudOwn: true } : {}) } : {}), ...(S.realtime ? { realtime: kungfuRules(S) } : {}), first: S.first, ballStops: S.ballStops, ballMove: S.ballMove,
      ...(S.ballCaptures ? { ballCaptures: true } : {}), ...(S.swordAims ? { swordAims: true } : {}),
      ...(S.magic !== 'none' ? { wrap: S.magic } : {}),
      ...(S.geared ? { geared: true } : {}),
      ...(S.movesPerTurn === 2 ? { movesPerTurn: 2 } : {}), ...(S.lazyFoes ? { lazyFoes: true } : {}),
      ...(day.statueOrder ? { statuesOpen: true } : {}),
      ...(S.statuesTake && !S.realtime ? { statuesTake: true } : {}), ...(S.bubbles && !S.realtime ? { bubbles: true, bubbleTurns: S.bubbleTurns } : {}), ...(S.pawnRules === 'chess' ? { pawnTwo: true, ...(S.realtime ? {} : { enPassant: true }) } : {}),
      ...(goal === 'capture' ? { captureN: S.captureN } : {}), ...(goal === 'carrier' ? { rabbitHop: S.rabbitHop, rabbitSides: S.rabbitSides, rabbitMove: S.rabbitMove } : {}),
      ...(S.promote === 'copy' ? { promote: 'copy' } : {}),
      crumble: S.ground === 'crumble', shrink: S.ground === 'shrink' ? 'random' : S.ground === 'spiral' ? 'spiral' : null,
      shrinkEvery: S.shrinkEvery },
    ai: lead || { skill: +S.skill, style: S.style },
    tracks: S.tracks
  });
  if (routes) dealRoutes(day, S, rand);
  return day;
}

// --- Routes (Adventure, 2026-10-15). -------------------------------------------
// Timothy: "enemy pieces possessed by rabbits still move each turn, each one
// of them. rabbits have colors like before representing what set pattern
// that move in. the pattern should generally be short, super predictable,
// and not land the piece in a stuck position."
//
// A route is made of the piece's own moves: `v` is one of its moves, the
// shortest of its kind (a rook's one square, a knight's L), and `w` another.
// Each kind of route has a name and a colour of fur, the Grove's own where
// one already walks that shape. Every route comes home, so it repeats
// forever; it is dealt only where every square of it is free, no two routes
// share a square, and it never bounces off an edge (routeSquares, rules.js).
// Nothing but your piece can stand in its way: a piece that finds you on
// its next square takes you, or, if it cannot, waits and tries again.

const neg = ([x, y]) => [-x, -y];
export const ROUTES = {
  Shuttle: { len: 2, steps: (v) => [v, neg(v)] },
  Doze: { len: 4, steps: (v) => [[0, 0], v, [0, 0], neg(v)] },
  'Box step': { len: 4, steps: (v, w) => [v, w, neg(v), neg(w)], two: true },
  Pace: { len: 6, steps: (v) => [v, v, [0, 0], neg(v), neg(v), [0, 0]] }
};

/** The routes a level allows, by its routeKinds setting: a list of names. */
const routeKinds = (S) => (S.routeKinds?.length ? S.routeKinds : Object.keys(ROUTES)).filter((k) => ROUTES[k]);

/** Give each piece of theirs a route, or make it a statue: as many as the
    level wants moving (all but `still`), tried in a random order, each with
    a random kind of route that fits. Mutates the level. */
function dealRoutes(day, S, rand) {
  const s = initialState(day), W = day.W, used = new Set(), reach = setReach(day);
  // Your square, and the hole, are off every route.
  for (const p of day.pieces) used.add(p.y * W + p.x);
  if (day.hole) used.add(day.hole.y * W + day.hole.x);
  const army = day.foes.map((f, k) => k).filter((k) => day.foes[k].type !== 'rabbit' && day.foes[k].type !== 'bunny');
  // Every other piece's own square is off this one's route.
  for (const k of army) used.add(day.foes[k].y * W + day.foes[k].x);
  let want = Math.max(0, army.length - S.still);
  for (const k of shuffled(army, rand)) {
    const f = day.foes[k];
    const route = want > 0 ? findRoute(s, k, used, routeKinds(S), rand, reach) : null;
    if (route) {
      Object.assign(f, { brain: 'possessed', pattern: route.steps, patternName: route.name, route: true, mx: 1, my: 1 });
      for (const q of route.squares) used.add(q);
      want--;
    } else { f.brain = 'still'; delete f.pattern; delete f.patternName; delete f.route; }
    s.foes[k] = { ...f, i: 0, taken: false };
  }
  // Pawns cannot walk a route (they never step back), so a level dealt all
  // pawns would have nobody walking: a pawn becomes another of the pool.
  const walkers = S.foePool.filter((t) => t !== 'pawn' && PIECES[t]);
  for (const k of shuffled(army.filter((j) => day.foes[j].type === 'pawn'), rand)) {
    if (want <= 0 || !walkers.length) break;
    const f = day.foes[k];
    f.type = walkers[Math.floor(rand() * walkers.length)];
    s.foes[k] = { ...f, i: 0, taken: false };
    const route = findRoute(s, k, used, routeKinds(S), rand, reach);
    if (route) {
      Object.assign(f, { brain: 'possessed', pattern: route.steps, patternName: route.name, route: true, mx: 1, my: 1 });
      for (const q of route.squares) used.add(q);
      s.foes[k] = { ...f, i: 0, taken: false };
      want--;
    } else { f.type = 'pawn'; s.foes[k] = { ...f, i: 0, taken: false }; }
  }
  // Somewhere your set can get to (a lone bishop keeps to its colour): every
  // statue, and the hole, moved there if it is not. (Routes already touch it.)
  const free = shuffled([...reach].filter((q) => !used.has(q)), rand);
  const move = (o) => { const q = free.pop(); if (q === undefined) return; used.delete(o.y * W + o.x); o.x = q % W; o.y = Math.floor(q / W); used.add(q); };
  for (const f of day.foes) if (f.brain === 'still' && !reach.has(f.y * W + f.x)) move(f);
  if (day.hole && !reach.has(day.hole.y * W + day.hole.x)) move(day.hole);
}

/** Every square your set can get to from where you start, on the board
    with nothing else on it, whichever of your pieces is on the board: the
    squares where theirs can be taken. */
function setReach(day) {
  const s = initialState(day), W = day.W, me = s.pieces[0];
  if (!me) return new Set();
  const types = [...new Set((day.cycle || day.pieces).map((p) => p.type))];
  s.foes = []; s.hole = null; delete s.set; delete s.clouds;
  const seen = new Set([me.y * W + me.x]), todo = [me.y * W + me.x];
  while (todo.length) {
    const q = todo.pop();
    for (const type of types) {
      s.pieces = [{ type, x: q % W, y: Math.floor(q / W), taken: false }];
      for (const m of movesFor(s, 0)) { const k = m.y * W + m.x; if (!seen.has(k)) { seen.add(k); todo.push(k); } }
    }
  }
  return seen;
}

/** A route for piece k of theirs, that walks only on squares not `used`
    (its own aside): { name, steps, squares }, or null. */
function findRoute(s, k, used, kinds, rand, reach = null) {
  const f = s.foes[k], W = s.day.W, home = f.y * W + f.x;
  // Its own shortest moves: nothing between where it is and where it lands.
  const g = (a, b) => (b ? g(b, a % b) : a);
  const vs = foeMovesAny(s, k).filter((m) => !m.cap && g(Math.abs(m.x - f.x), Math.abs(m.y - f.y)) === 1).map((m) => [m.x - f.x, m.y - f.y]);
  if (!vs.length) return null;
  for (const name of shuffled(kinds, rand)) {
    const R = ROUTES[name];
    for (const v of shuffled(vs, rand)) {
      const ws = R.two ? shuffled(vs.filter((w) => w[0] * v[0] + w[1] * v[1] === 0 && (w[0] || w[1])), rand) : [null];
      for (const w of ws) {
        const steps = R.steps(v, w), squares = routeSquares(s, k, steps);
        if (squares && squares.every((q) => q === home || !used.has(q)) && (!reach || squares.some((q) => reach.has(q)))) return { name, steps, squares };
      }
    }
  }
  return null;
}

/** Kung fu's timings, in the rules: ms a square, and each side's rest. */
const kungfuRules = (S) => ({ step: S.kfStep, cool: S.kfCool * 100, foeCool: S.kfFoeCool * 100, gap: S.kfFoeGap * 100 });

/** A chess variant's level: its own board and starting position, their
    side thinking, take their King (or the variant's own way to win). No
    random numbers: the same every time. */
function variantLevel(S, seed) {
  const V = VARIANTS[S.variant], { W, H, pieces, foes } = readFen(V.fen);
  for (const f of foes) { f.brain = 'ai'; if (f.type === 'king') f.target = true; }
  const r = V.rules;
  return {
    W, H, holes: new Set(), stumps: new Set(), bramble: [], brambleAt: new Map(), every: 2,
    seed, settings: S, shrinkKey: seed, pieces, foes, goalKind: 'king', hole: null, variant: S.variant,
    rules: { goal: 'target', maxMoves: S.maxMoves, wait: false, foesCapture: true, rabbitsEat: false, royal: true, oneMove: true,
      first: 'you', ballStops: false, ballMove: 'putt', crumble: false, shrink: null, shrinkEvery: 2,
      ...(r.promote ? { promote: true } : {}), ...(r.pawnDouble ? { pawnDouble: true } : {}), ...(r.hill ? { hill: true } : {}),
      ...(r.race ? { race: true } : {}), ...(r.noCheck ? { noCheck: true } : {}), ...(r.movesPerTurn ? { movesPerTurn: r.movesPerTurn } : {}),
      ...(r.realtime || S.realtime ? { realtime: kungfuRules(S) } : {}) },
    ai: { skill: +S.skill, style: S.style },
    tracks: false
  };
}

/** A position given outright (the piece trials): both sides as written,
    their side thinking, take their King, keep yours. A row of statues, if
    asked for, fills the middle row's empty squares and opens one a turn in
    an order drawn from the seed. With goal 'flag' (Capture the rabbit,
    2026-10-14) the game is the rabbit instead: it sits on the middle
    square, and a King is royal only if the settings say so. Null if the
    position does not read. */
function positionLevel(S, seed) {
  let read = null;
  try { read = readFen(S.position); } catch { return null; }
  const { W, H, pieces, foes } = read;
  if (!pieces.length || !foes.length || [...pieces, ...foes].some((p) => !PIECES[p.type])) return null;
  const flag = S.goal === 'flag';
  for (const f of foes) { f.brain = 'ai'; if (f.type === 'king' && !flag) f.target = true; }
  const day = { W, H, holes: new Set(), stumps: new Set(), bramble: [], brambleAt: new Map(), every: 2 };
  if (flag) {
    const x = Math.floor(W / 2), y = Math.floor(H / 2);
    if (![...pieces, ...foes].some((p) => p.x === x && p.y === y)) day.flag = { x, y };
  }
  if (S.statueRow && H % 2 === 1) {
    const rand = rng(`lab:${seed}`), y = (H - 1) / 2, kinds = ['pawn', 'rook', 'knight', 'bishop', 'king', 'queen'];
    const row = Array.from({ length: W }, (_, x) => y * W + x).filter((sq) => ![...pieces, ...foes].some((p) => p.y * W + p.x === sq));
    day.statueKinds = new Map();
    for (const sq of row) { day.stumps.add(sq); day.statueKinds.set(sq, kinds[Math.floor(rand() * kinds.length)]); }
    day.statueOrder = shuffled(row, rand);
  }
  return Object.assign(day, {
    seed, settings: S, shrinkKey: seed, pieces, foes, goalKind: flag ? 'flag' : 'king', hole: null, position: S.position,
    rules: { goal: flag ? 'flag' : 'target', maxMoves: S.maxMoves, wait: false, foesCapture: true, rabbitsEat: false, royal: flag ? !!S.royal : true, oneMove: true,
      first: 'you', ballStops: false, ballMove: 'putt', crumble: false, shrink: null, shrinkEvery: 2,
      ...(pieces.some((p) => p.type === 'pawn') || foes.some((f) => f.type === 'pawn') ? { promote: true, ...(S.pawnRules === 'chess' ? { pawnTwo: true, enPassant: true } : {}) } : {}),
      ...(day.statueOrder ? { statuesOpen: true } : {}) },
    ai: { skill: +S.skill, style: S.style },
    tracks: false
  });
}

export const GOAL_TEXT = {
  capture: 'capturing', carrier: 'taking the piece their rabbit rides', flag: 'capturing the rabbit and bringing it home',
  descent: 'catching every possessed piece and loose rabbit, then sinking the ball', all: 'capturing them all', king: 'taking their King', rabbit: 'catching the rabbit',
  any: 'catching any one', target: 'catching the marked one', mix: 'a goal that changes with each layout',
  hole: 'sinking the ball in the hole'
};
export const GOAL_PILL = {
  capture: 'Capture', carrier: 'Take the rabbit’s piece', flag: 'Bring the rabbit home',
  descent: 'Catch them, then the ball', all: 'Capture them all', king: 'Take their King', rabbit: 'Catch the rabbit', any: 'Catch any one', target: 'Catch the marked one',
  hole: 'Sink the ball', clear: 'Take them all, then the hole'
};

/** One line saying what a level is. */
export function summary(S) {
  const name = (k) => PIECES[k].name;
  const pool = (a) => (a.length > 4 ? `${a.slice(0, 4).map(name).join(', ')} and ${a.length - 4} more` : a.map(name).join(', '));
  const shape = S.shape === 'L' ? 'L-shaped board' : FIELDS.find((f) => f.key === 'shape').options.find((o) => o.v === S.shape).label.toLowerCase();
  const hand = S.mirror ? S.minePool : S.foePool;
  const made = S.goal === 'king' && !hand.includes('king') ? ', one of them made a King'
    : S.goal === 'rabbit' && !hand.includes('rabbit') ? ', one of them made a rabbit' : '';
  const statues = (S.statueRow ? ', a row of statues that opens' : S.statues ? `, ${S.statues} statue${S.statues > 1 ? 's' : ''}` : '') +
    (S.ghosts ? ', a row of ghosts in front of each side' : '') + (S.gates ? `, ${S.gates} gate${S.gates > 1 ? 's' : ''}` : '') + (S.sand ? `, ${S.sand} sand` : '') + (S.water ? `, ${S.water} water` : '') +
    (S.clouds ? `, ${S.clouds} wandering cloud${S.clouds > 1 ? 's' : ''}` : '') +
    (S.magic === 'sides' ? ', magic sides' : S.magic === 'all' ? ', magic on all four sides' : '') + (S.geared ? ', geared' : '');
  const ground = { solid: '', crumble: ', crumbling', shrink: `, shrinking every ${S.shrinkEvery}`, spiral: `, shrinking in a spiral every ${S.shrinkEvery}` }[S.ground];
  const rabbitsHere = S.rabbits > 0 || (S.foePool.includes('rabbit') && !S.mirror);
  const minds = S.rabbitMind === 'mind' ? ` with minds (intelligence ${S.iq}, ${S.traits.map((t) => TRAITS[t].name.toLowerCase()).join('/')})` : '';
  const dark = S.darkBrain === 'possessed' ? `possessed by ${S.kinds} kind${S.kinds > 1 ? 's' : ''} of rabbit${minds}` : S.darkBrain === 'rabbit' ? `led by one rabbit (intelligence ${S.iq})` : 'thinking';
  const auto = S.mode === 'auto' ? `Autochess, with ${S.autoPool === 'all' ? 'every named kind of rabbit' : 'the rabbits you have caught'}. ` : '';
  // Both sides square by square (the piece trials and Custom's armies).
  if (S.cells) {
    const line = (c, mods) => c.map((t, i) => (t ? `${name(t)}${mods?.[i]?.suit ? ` of ${mods[i].suit[0].toUpperCase()}${mods[i].suit.slice(1)}` : ''}${mods?.[i]?.weapon ? ` with a ${mods[i].weapon} (${mods[i].wl || 1})` : ''}` : null)).filter(Boolean).join(', ');
    const turned = S.cells.map((_, i) => S.cells[Math.floor(i / S.w) * S.w + (S.w - 1 - (i % S.w))]);
    const theirs = S.foeCells.join() === S.cells.join() ? 'the same, mirrored' : S.foeCells.join() === turned.join() ? 'the same, turned' : line(S.foeCells, S.foeCellMods);
    return `${S.w} × ${S.h} ${shape}${ground}${statues}. You: ${line(S.cells, S.cellMods)}. Them: ${theirs}, ${dark}. Win by ${GOAL_TEXT[S.goal]}${S.maxMoves ? ` in ${S.maxMoves} moves` : ''}.`;
  }
  return `${auto}${S.w} × ${S.h} ${shape}${ground}${statues}${S.lineup ? ', lined up' : ''}. You: ${S.hand ? S.hand.map(name).join(', ') : `${S.mine} from ${pool(S.minePool)}`}. ` +
    `Them: ${S.rabbits ? `${S.rabbits} rabbit${S.rabbits > 1 ? 's' : ''}, ` : ''}` +
    `${S.mirror ? 'a mirror of you' : S.foes ? `${S.foes} from ${pool(S.foePool)}, ${dark}` : 'no pieces'}${made}` +
    `${rabbitsHere ? `, rabbits ${S.rabbitBrain === 'pattern' ? 'on patterns' : 'thinking'}${S.rabbitsEat ? ' that eat' : ''}` : ''}. ` +
    `Win by ${GOAL_TEXT[S.goal]}` +
    `${S.maxMoves ? ` in ${S.maxMoves} moves` : ''}.` +
    `${!S.solve ? '' : S.mode === 'auto' ? ` Checked: some setup wins in ${S.maxMoves || 40} turns.` : ` Checked winnable in ${S.parMin} to ${S.parMax}.`}`;
}

// --- Links. ----------------------------------------------------------------
// Only what differs from the defaults goes in, to keep links short.

export function encodeLevel(settings, seed) {
  const S = clean(settings), d = defaults(), diff = {};
  for (const k of Object.keys(S)) if (JSON.stringify(S[k]) !== JSON.stringify(d[k])) diff[k] = S[k];
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `lab=${b64}&v=${SETTINGS_VERSION}&seed=${seed}`;
}

/** A level link with its par attached, so opening it needs no solving. */
export function encodeLevelWithPar(settings, seed, par) {
  return encodeLevel(settings, seed) + (par ? `&par=${par}` : '');
}

export function decodeLevel(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (!p.has('lab')) return null;
  try {
    const json = decodeURIComponent(escape(atob(p.get('lab').replace(/-/g, '+').replace(/_/g, '/'))));
    const par = parseInt(p.get('par'), 10);
    const diff = JSON.parse(json || '{}');
    // A link is read against the defaults of the version it was made in
    // (no v at all: before version 2).
    const v = +p.get('v');
    if (knownVersion(v)) diff.v = v; else delete diff.v;
    return { settings: clean(diff), seed: Math.abs(parseInt(p.get('seed'), 10)) || 1, par: par > 0 ? par : null };
  } catch { return null; }
}

// --- The notebook: what you played and whether it was fun. ----------------

const NOTE_KEY = 'ig.grove.lab.v1';

export function loadLab() {
  try {
    const s = JSON.parse(localStorage.getItem(NOTE_KEY));
    if (s && s.version === 1) return s;
  } catch { /* storage blocked: start fresh */ }
  return { version: 1, current: null, notes: [] };
}

export function saveLab(lab) {
  try { localStorage.setItem(NOTE_KEY, JSON.stringify(lab)); } catch { /* never lose a game over storage */ }
}

// --- Autochess. ------------------------------------------------------------
// Rabbits you have caught possess your pieces, and the game plays itself
// (rules.js, autoMove). A level is the same board as ever; what you bring
// to it is a setup: for each place in your line, which piece stands there,
// which rabbit is inside it (or none: it stands still), and which way the
// rabbit faces.

/** A pattern by its name, or null. */
export const patternNamed = (name) => ALL_PATTERNS.find((p) => p.name === name) || null;

/** The rabbits you can use, { name: how many }. 'caught': one for every
    time you caught that kind (`caught` is rabbits.js caughtRabbits()).
    'all': every named kind, enough of each for every piece. */
export function rabbitPool(S, caught = {}, pieces = 8) {
  const out = {};
  for (const name of [...ALL_PATTERNS.map((p) => p.name), ...Object.values(TRAITS).filter((t) => t.name !== 'Habit').map((t) => t.name)]) {
    const n = S.autoPool === 'all' ? pieces : caught[name] || 0;
    if (n > 0) out[name] = n;
  }
  return out;
}

/** The trait a rabbit's name stands for (a rabbit with a mind), or null. */
export const traitNamed = (name) => Object.keys(TRAITS).find((k) => TRAITS[k].name === name && k !== 'pattern') || null;

/** A fresh setup for a level: every piece where it was dealt, no rabbits. */
export const emptySetup = (level) => level.pieces.map((p) => ({ type: p.type, rabbit: null, mx: 1 }));

/** Does a setup use no more of each rabbit than the pool has? */
export function setupFits(setup, pool) {
  const used = {};
  for (const u of setup) if (u.rabbit) used[u.rabbit] = (used[u.rabbit] || 0) + 1;
  return Object.entries(used).every(([k, n]) => (pool[k] || 0) >= n);
}

/** The level with a setup applied: the pieces in their places, possessed. */
export function withSetup(level, setup) {
  return Object.assign(Object.create(Object.getPrototypeOf(level)), level, {
    pieces: level.pieces.map((p, i) => {
      const u = setup[i], pat = u?.rabbit && patternNamed(u.rabbit), trait = u?.rabbit && traitNamed(u.rabbit);
      const out = { x: p.x, y: p.y, type: u?.type || p.type };
      if (pat) Object.assign(out, { brain: 'possessed', pattern: pat.steps, patternName: pat.name, mx: u.mx || 1, my: 1, i: 0 });
      // A rabbit with a mind plays for you as it would against you.
      if (trait) Object.assign(out, { brain: 'possessed', mind: { iq: level.settings?.iq ?? 6, trait }, patternName: u.rabbit, mx: 1, my: 1, i: 0 });
      return out;
    })
  });
}

/** Play a set-up level to the end. Returns the last state. */
export function runAuto(day) {
  const cap = day.rules.maxMoves || 40;
  let s = initialState(day);
  while (!isOver(s) && s.t < cap) s = autoApply(s);
  return s;
}

/**
 * Try setups at random (and every one, when there are few) and keep the
 * fastest win. Autochess has no moves to search, only setups, and a setup
 * plays out the same way every time, so this is enough to say whether a
 * level can be won and roughly how fast. Returns { par, setup, tried, wins }.
 */
export function searchAuto(level, pool, { deadline = Date.now() + 1500, maxTries = 4000 } = {}) {
  const rand = rng(`auto:${level.seed}`), names = Object.keys(pool);
  const types = level.pieces.map((p) => p.type);
  let best = null, tried = 0, wins = 0;
  if (!names.length) return { par: null, setup: null, tried, wins };
  for (; tried < maxTries && Date.now() < deadline; tried++) {
    const left = { ...pool }, order = tried === 0 ? types : shuffled(types, rand);
    const setup = order.map((type) => {
      const have = names.filter((k) => left[k] > 0);
      const rabbit = have.length && rand() < 0.92 ? have[Math.floor(rand() * have.length)] : null;
      if (rabbit) left[rabbit]--;
      return { type, rabbit, mx: rand() < 0.5 ? 1 : -1 };
    });
    const end = runAuto(withSetup(level, setup));
    if (!end.won) continue;
    wins++;
    if (!best || end.t < best.par) best = { par: end.t, setup };
  }
  return { par: best?.par ?? null, setup: best?.setup ?? null, tried, wins };
}

// --- Testing layouts. ------------------------------------------------------

/**
 * Try seed, seed + 1, seed + 2... until the solver wins one with par inside
 * [parMin, parMax], reporting through `post` as it goes. With `fixed` it
 * solves exactly the seed given. Used by lab-worker.js on a background
 * thread, and directly by the page when workers are not available.
 */
/** The difficulty a level must measure: an aim, or a band. */
export function bandOf(S) {
  if (S.aim > 0) return [Math.max(1, S.aim - 1), Math.min(10, S.aim + 1)];
  return BANDS[S.difficulty] || BANDS.any;
}

export function searchLayouts({ settings, seed, parMin, parMax, maxTries = 400, maxMs = 15000, fixed = false, pool, quick = false }, post) {
  // A chess variant has one starting position and nothing to search for.
  if (clean(settings).variant !== 'none' || clean(settings).position) return post({ type: 'done', seed, par: null, tried: 1, thrown: {}, measure: null });
  if (clean(settings).mode === 'auto') return searchAutoLayouts({ settings, seed, parMin, maxMs, fixed, pool }, post);
  const t0 = Date.now(), rules = clean(settings).balance;
  let best = null, tried = 0;
  const thrown = {}; // why layouts were thrown out by the balance rules, with counts
  // Layouts where something could capture on the first move are thrown out
  // before solving, since checking that is cheap and solving is not; so
  // many more of them can be skipped than solved.
  const opening = rules !== 'off' && !fixed;
  let skipped = 0;
  for (let i = 0; i < (fixed ? 1 : maxTries + skipped); i++) {
    const sd = seed + i, level = makeLevel(settings, sd);
    if (opening && skipped < 4000) {
      const o = openingCaptures(level);
      if (o.yours || o.theirs) { skipped++; thrown['a piece could capture on the first move'] = (thrown['a piece could capture on the first move'] || 0) + 1; continue; }
    }
    // Quick (Adventure) skips the balance report, so it can afford a wider
    // search for a truer par.
    const r = solveLevel(level, { maxDepth: parMax, deadline: quick ? Math.min(t0 + maxMs, Date.now() + 2500) : t0 + maxMs, ...(quick ? { exactCap: 20000, width: 240, branch: 16, budget: 400000 } : {}) });
    tried = i + 1;
    // Quick (Adventure, 2026-10-15): winnable at the right length is all
    // that is asked; no balance report and no novice games, which are most
    // of the time a search takes.
    if (quick && r.par && r.par >= parMin) return post({ type: 'done', seed: sd, par: r.par, exact: r.exact, line: r.line, tried: i + 1, balance: null, why: [], thrown, measure: null });
    if (r.par && (fixed || r.par >= parMin)) {
      // Winnable at the right length. Now: is it balanced?
      const balance = assess(level, r, { deadline: t0 + maxMs });
      const why = unbalanced(balance, rules, { oneCapture: true });
      // Then: is it as hard, and as engaging, as asked?
      const S = clean(settings), m = measure(level, r), band = bandOf(S);
      if (!fixed && !why.length && (m.difficulty < band[0] || m.difficulty > band[1])) why.push(m.difficulty < band[0] ? 'it was too easy' : 'it was too hard');
      if (!fixed && !why.length && m.engagement < S.minEngage) why.push('it was not engaging enough');
      if (!fixed && !why.length && S.minCeiling && (m.ceiling ?? 0) * 10 < S.minCeiling) why.push('its skill ceiling was too low');
      if (fixed || !why.length) return post({ type: 'done', seed: sd, par: r.par, exact: r.exact, line: r.line, tried, balance, why, thrown, measure: m });
      for (const w of why) thrown[w] = (thrown[w] || 0) + 1;
      // Nothing may pass, so keep the nearest miss: balanced before
      // unbalanced, then the closest to the difficulty asked for.
      const off = (m.difficulty < band[0] ? band[0] - m.difficulty : m.difficulty > band[1] ? m.difficulty - band[1] : 0)
        + (unbalanced(balance, rules, { oneCapture: true }).length ? 20 : 0);
      if (!best || best.off == null || off < best.off) best = { seed: sd, par: r.par, exact: r.exact, line: r.line, balance, why, unbalanced: true, off, measure: m };
    } else if (r.par && (!best || (!best.unbalanced && r.par > best.par))) {
      // Winnable but too easy: keep the hardest of those, in case nothing passes.
      best = { seed: sd, par: r.par, exact: r.exact, line: r.line };
    }
    post({ type: 'progress', tried });
    if (Date.now() - t0 > maxMs) break;
  }
  if (best && !best.balance && !quick) best.balance = assess(makeLevel(settings, best.seed), best, { deadline: Date.now() + 3000 });
  post({ type: 'failed', tried, best, thrown });
}

/** searchLayouts for autochess: try seed after seed until some setup, from
    the rabbits in `pool`, wins within the move limit and in no fewer than
    parMin turns. Par is the fastest win found. */
function searchAutoLayouts({ settings, seed, parMin, maxMs = 15000, fixed = false, pool = {} }, post) {
  const t0 = Date.now();
  let best = null, tried = 0;
  if (!Object.keys(pool).length) return post({ type: 'failed', tried: 0, best: null, noRabbits: true });
  const rules = clean(settings).balance;
  for (let i = 0; i < (fixed ? 1 : 60); i++) {
    const sd = seed + i, level = makeLevel(settings, sd);
    // The same opening rule as by hand: nothing can capture on the first move.
    const open = openingCaptures(level);
    if (!fixed && rules !== 'off' && (open.yours || open.theirs)) { tried = i + 1; post({ type: 'progress', tried }); continue; }
    const r = searchAuto(level, pool, { deadline: Math.min(t0 + maxMs, Date.now() + 1200) });
    tried = i + 1;
    const found = { seed: sd, par: r.par, setup: r.setup, setups: r.tried, wins: r.wins, auto: true };
    if (r.par && (fixed || r.par >= parMin)) return post({ type: 'done', ...found, tried });
    if (r.par && (!best || r.par > best.par)) best = found;
    post({ type: 'progress', tried });
    if (Date.now() - t0 > maxMs) break;
  }
  post({ type: 'failed', tried, best });
}
