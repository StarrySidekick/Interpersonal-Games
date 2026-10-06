# How Grove Chess should look, sound and feel

Recorded 2026-10-06 from Timothy's notes. **Direction, with a plan; the big
step (a 3D board) is not built yet** and waits on his go-ahead.

> "You're interpreting the look and feel of this game as if it's like a
> 16-bit or 32-bit game. What I'm more aiming for is like a Nintendo 64
> game."
>
> "An air of mystery to it, and mystique, as if you found some strange
> chessboard in the middle of the forest."
>
> "Spirals are a motif I want to explore."

## Nintendo 64, not 16-bit

### What makes each look

| | 16-bit (SNES, Mega Drive) | Nintendo 64 |
|---|---|---|
| Things on screen | flat sprites, hand-placed pixels | polygons, lit and shaded in 3D |
| Edges | crisp, every pixel visible | soft: textures are smoothed (*bilinear filtering*), and the whole frame is slightly blurred |
| Space | flat tiles, seen from above or the side | a real space with depth and a camera that moves |
| Distance | everything equally sharp | fog: far things fade into a colour, which hid how little the console could draw and became a mood of its own |
| Colour | strict palettes | smooth gradients across faces (*Gouraud shading*: colours worked out at the corners of each polygon and blended across it) |
| Text | pixel fonts | big, rounded, bold lettering |

*Bilinear filtering*: when a small texture is stretched, each screen pixel
is a blend of the four nearest texels instead of a copy of one, so it comes
out soft instead of blocky. It is most of why N64 games look smooth and a
little blurry where 16-bit games look sharp and pixelly.

### Where Grove Chess is now

- **Already N64:** the turning board on the title, the Descent's title and
  the lab preview, and the pieces menu. Those are real 3D scenes, shaded,
  drawn by `engine/lowpoly.js`.
- **Still 16-bit:** the board you actually play on. It is a flat, top-down
  canvas drawn pixel by pixel, the pieces are tiny pictures taken of the 3D
  models once (30 by 36 pixels), the numbers are a 3 by 5 pixel font, and
  the whole thing is scaled up with crisp, nearest-neighbour pixels. That is
  the part that reads as 16-bit, and it is most of what you look at.

### The plan, in order

1. **Play on the 3D board.** The board you play on becomes the same kind of
   scene as the title: tilted toward you, the pieces as real models, lit.
   Taps are turned into squares by projecting each square's corners to the
   screen and finding which one the tap is inside. Highlights, tracks and
   the next-to-fall shadow become flat shapes laid on the board. This is the
   big one, and everything below builds on it.
2. **Soft, not crisp.** Draw at a low resolution and let the browser smooth
   it up, instead of keeping every pixel square. Slightly fewer, softer
   pixels than now.
3. **Fog.** The board sits in a small circle of light; past its rim the
   forest fades into fog. This is also the mystery (below).
4. **A camera that breathes.** A slow sway while you think; a short swing
   when something happens.
5. **Lettering.** Round, bold numerals on the tracks instead of the pixel
   font.

Cost: (1) is a few days of careful work and needs real-device testing for
speed, since every frame is drawn in software. (2) to (5) are small once (1)
exists.

## Mystery

The fiction in one line: **you found a strange chessboard in the middle of
the forest, and nobody remembers setting it.** The design philosophy's
narrative section names the two elemental genres this is: **mystery** (a
hidden truth you want to work out) and **wonder** (awe at something that
should not be possible). In each register:

- **Written: say less.** Rules stay clear, but the world is not explained.
  The Descent's title already does this ("a board nobody remembers
  setting"). No lore dumps; a line here and there.
- **Visual: darkness at the edges.** Fog, a pool of light on the board, the
  dark where squares have fallen (built: crumbled and fallen squares are now
  nothing but darkness), the shut hole's twig cover.
- **Audial: the forest around you.** A quiet bed of wind and night insects,
  and a long echo on the notes, so the board sounds like it is somewhere
  large.

Mystery also answers the open question in the design philosophy about
*discovery*: things the game never explains, for the player to notice
(why each rabbit has its colour, what is at the bottom of the Descent).

## Spirals

Where they are already:

- **The Spiral rabbit**, one of the twelve patterns, in violet.
- **Shrinking in a spiral** (built 2026-10-06): the board's edge falls away
  clockwise and inward.
- **The rose**, the fairy piece whose knight jumps curve round a circle.

Where they could go:

- **The Descent as a spiral stair**: the fall between depths drawn as a
  turn downward, each depth a step.
- **The hole opening as a swirl.**
- **The long game's map** spiralling in toward the middle of the wood,
  where the light is.
- **Carvings** on the board's rim.
- **A sound for the Descent**: a *Shepard tone* is layered notes an octave
  apart, each fading in at the top and out at the bottom, so the whole
  seems to fall forever without getting any lower. It is the sound version
  of the endless staircase drawn by Penrose and Escher, and the sound of the
  Descent.

## Questions for Timothy

- Go ahead with the 3D board (step 1)? It changes how every screen feels.
- How dark: a dark forest around a lit board in both light and dark modes,
  or only in dark mode?
