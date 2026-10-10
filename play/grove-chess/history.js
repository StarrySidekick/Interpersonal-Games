// Where each piece comes from, for the pieces catalog (pieces/). A few
// sentences each, kept to what is well attested; where a history is thin or
// argued over, it says so rather than inventing one.

export const HISTORY = {
  king: 'The raja of chaturanga, the Indian game of about the sixth century that chess grew from, then the shah of Persian and Arabic shatranj. "Checkmate" is the Persian shah mat, usually read as "the king is helpless". Its move has hardly changed in fifteen hundred years; castling was added in late medieval Europe.',
  queen: 'For most of its life a weak piece: the counsellor (mantri in India, farzin or fers in Persia and the Arab world) who stepped one square diagonally. Around 1475 to 1500, in Spain and Italy, it became the queen and gained its huge move, the change that made modern chess. Players at the time called the new game "mad queen" chess.',
  rook: 'The chariot: ratha in chaturanga, rukh in Persian, and from that the English word. Its move, straight lines as far as it likes, has stayed the same since the beginning. Its castle shape came later, in Europe.',
  bishop: 'It began as the elephant (al-fil in shatranj), which jumped exactly two squares diagonally: the alfil, also in this game. With the queen, around 1475 to 1500, it became the long-range bishop. Other languages see it differently: in French it is the fool (fou), in German the runner (Läufer).',
  knight: 'The horse of chaturanga. Its L-shaped jump is the one move in chess that has never changed: the same in India fifteen hundred years ago, in shatranj, in medieval Europe and today.',
  pawn: 'The foot soldier (padati in Sanskrit, baidaq in Arabic). The two-square first step, and capturing en passant, were added in Europe in the late Middle Ages to speed the game up.',

  grasshopper: 'Invented in 1912 by Thomas Rayner Dawson, the English problemist who did more than anyone to make fairy chess a field of its own. It is one of the oldest and best-loved fairy pieces: it can only move by hopping over something.',
  nightrider: 'Also T. R. Dawson, 1925: a knight that keeps going, repeating its jump in a straight line. A favourite of chess problem composers ever since.',
  camel: 'A long knight, three and one. It appears in Tamerlane chess, the great medieval game associated with Timur\'s court in the fourteenth century, and in other large historical variants; fairy chess kept the name for the move.',
  zebra: 'A three-and-two leaper. A modern fairy piece, named in the habit of naming leapers after animals; it has no great history of its own beyond the problem books.',
  alfil: 'The elephant of shatranj, which jumped exactly two squares diagonally. Around 1475 to 1500 Europe replaced it with the long-range bishop, but the old elephant lives on in fairy chess under its Arabic name.',
  ferz: 'The counsellor of shatranj (fers, from the Persian farzin): one step diagonally. It sat beside the shah, and it is the piece that became the queen. Fairy chess keeps the old name for the old move.',
  wazir: 'Wazir is the Arabic for vizier. Tamerlane chess had a vizier that stepped one square straight; fairy chess uses the name for that move.',
  cannon: 'The cannon of xiangqi, Chinese chess, which took its modern form around the Song dynasty (960 to 1279). It moves like a chariot but captures by jumping exactly one piece. Its character was first written with the stone radical, a catapult, and later with the fire radical, a gun.',
  mao: 'The horse of xiangqi. It moves like a knight but in two steps, one straight and one diagonal, so a piece on the first square blocks it. "Mao" is the fairy chess name, from the Chinese ma, horse.',
  squirrel: 'A modern fairy piece that can reach every square exactly two away: the dabbaba, the alfil and the knight in one. Named, like many leapers, after an animal.',
  rose: 'A modern fairy piece: a knight that keeps going, but turning a little each jump, so its path curves round a circle. It is named for the shape that path draws.',
  archbishop: 'Bishop and knight together. Pietro Carrera called it the centaur in his large chess of 1617; Henry Bird used it in 1874; José Raúl Capablanca, world champion, put it in his ten-file chess in the 1920s, and Capablanca\'s name, the archbishop, is the one that stuck.',
  chancellor: 'Rook and knight together. Carrera\'s champion of 1617, Bird\'s guard of 1874, and Capablanca\'s chancellor of the 1920s. Computer studies put it, and the archbishop, at nearly the worth of a queen.',
  amazon: 'Queen and knight together, the strongest piece in common use. Some regional Russian chess of the 1700s let the queen move this way, and it is the lone maharaja of the old Indian game "The Maharajah and the Sepoys".',
  dabbaba: 'The war engine of Tamerlane chess, the dabbaba: a covered siege machine that crept up to walls. As a piece it jumps exactly two squares straight.',
  silver: 'A silver general of shogi, Japanese chess. Shogi pieces are flat wedges that point at the enemy, the same colour for both sides, and a captured piece can be dropped back in on the other side. The silver steps diagonally or straight forward.',
  lance: 'The kyōsha, "incense chariot", of shogi: it slides any distance straight forward, and can never come back.',

  gold: 'The gold general of shogi: it guards the king, stepping anywhere but diagonally back. In shogi most pieces that cross into the far camp promote to move like a gold.',
  copper: 'The copper general of chu shogi, the larger shogi played in Japan from about the fourteenth century: a weaker cousin of the silver.',
  leopard: 'The ferocious leopard of chu shogi: one step in any direction but sideways.',
  tiger: 'The blind tiger of chu shogi: one step in any direction but straight ahead, which, being blind, it cannot see.',
  kirin: 'The kirin of chu shogi, named for the kirin (qilin), a hoofed, horned beast of East Asian legend. In chu shogi it promotes to the lion, the game\'s great piece.',
  phoenix: 'The phoenix of chu shogi, the kirin\'s partner: where the kirin steps diagonally and leaps straight, the phoenix steps straight and leaps diagonally. It promotes to the queen.',
  elephant: 'The old elephant (the alfil) with the counsellor\'s step added. Several modern variants call this piece the elephant, a guess at what the shatranj elephant might have been if it could also take one step.',
  woody: 'A short-range rook: one step or a two-square leap, straight. It belongs to Ralph Betza\'s Chess with Different Armies (1990s), where each side can field a different army of equal strength.',
  alibaba: 'Every square exactly two away in a straight line or a diagonal. A name from the fairy chess catalogues, where compounds of simple leapers are given names of their own.',
  threeleaper: 'The (3,0) leaper, one of the simple jumps fairy chess lists by size: wazir (1,0), dabbaba (2,0), threeleaper (3,0).',
  tripper: 'The (3,3) leaper: ferz (1,1), alfil (2,2), tripper (3,3). It can reach only one square in eight of the board.',
  frog: 'The ferz and the threeleaper in one. A name from the fairy chess catalogues.',
  vao: 'The cannon\'s diagonal twin: it slides like a bishop, and captures only by jumping exactly one piece. It turns up in modern variants of xiangqi and in fairy chess.',

  ball: 'Not a chess piece: Grove Chess\'s own, for the golf-like levels. It rolls, putts or bounces like a billiard ball, depending on the level.',
  rabbit: 'Grove Chess\'s own. Rabbits get into pieces and move them; caught, they join your collection.'
};
