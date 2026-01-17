# Audio Generation Specification (MIDI)

## 1. Overview
The Audio module transforms the `miniFQS` AST into a Standard MIDI File (SMF) Type 2. The MIDI data can then be played back using a browser-based MIDI player with SoundFont support or downloaded by the user.

## 2. Requirements
-   **Output Format**: Standard MIDI File (SMF) Type 2.
-   **Instrumentation**: General MIDI (GM) instruments mapped from `I` directives.
-   **Velocity**: Mapped from `V` directives (0-100 range -> 0-127 MIDI).
-   **Timing**:
    -   Tempo calculation for MIDI Quarter Note (QN) definition.
    -   Precise rhythmic conversion of AST divisions to MIDI Ticks.

## 3. Data Flow
`AST` -> `MidiSequence` (Internal) -> `SMF Binary` -> `AudioPlayer` (External Lib)

## 4. MIDI Mapping Logic

### 4.1 Track Structure
The entire score will be flattened into a **single MIDI Track**.
-   **Sequential**: All Music Blocks are concatenated sequentially.
-   **Benefits**:
    -   Simplifies continuity (e.g., handling state/ties across block boundaries).
    -   Standard linear playback.
-   **Playback Control**: Advanced features like looping or seeking specific blocks will be handled by the logical Player implementation, not by splitting the MIDI file itself.

### 4.2 Event Generation
The generation process iterates through the AST (similar to Layout) to align Lyrics and Pitches.

#### NOTE ON
-   **Trigger**: Start of any "Attack" subdivision (Syllable, Melisma `*`, or Chord).
-   **Pitch**: Calculated from the aligned Pitch Element.
    -   `Note`: MIDI Note Number (Middle C4 = 60).
    -   `Chord`: Multiple NOTE ON events (one per pitch).
-   **Velocity**: Current `V` value * 1.27.
-   **Channel**: Fixed (e.g., Channel 0) or derived from Instrument? (GM usually implies Channel 1-9, 11-16. Channel 10 is drums). We will use Channel 0 by default.

#### NOTE OFF
-   **Trigger**:
    -   Start of a *subsequent* Attack (Cut off previous note).
    -   Start of a Rest (`;`).
    -   Start of `_` (Partial/Silence).
    -   End of Music Block.
-   **Behavior**: Sends NOTE OFF for *all* currently sounding notes on the channel. This prevents "stuck" notes and handles the monophonic-with-chords nature (where a new chord replaces the old one entirely).

### 4.3 Timing & Tempo
MIDI Tokens are measured in Ticks.
-   **PPQ (Pulses Per Quarter)**: 480 (Standard resolution).

#### Tempo Conversion
MIDI Tempo is defined in Microseconds per Quarter Note (MPqn).
The `T` directive in miniFQS specifies Beats Per Minute (BPM) where the "Beat" is defined by `B`.

$$ \text{MIDI\_BPM} = T \times \text{Multiplier} $$

**Multipliers**:
-   `B1`:   4.00 (Whole note = 4 QN)
-   `B2`:   2.00 (Half note = 2 QN)
-   `B4`:   1.00 (Quarter note = 1 QN)
-   `B4.`:  1.50 (Dotted Quarter = 1.5 QN)
-   `B8`:   0.50 (Eighth = 0.5 QN)
-   `B8.`:  0.75
-   `B16`:  0.25

**Formula**:
$$ \text{MPqn} = \frac{60,000,000}{\text{MIDI\_BPM}} $$

#### Duration Calculation
$$ \text{SubdivisionTicks} = \text{BeatFraction} \times \text{BeatMultiplier} \times \text{PPQ} $$
Example: `B4.` (Multiplier 1.5) with a subdivision duration of 1/3 beat:
$$ \text{Ticks} = (1/3) \times 1.5 \times 480 = 240 \text{ Ticks} $$

## 5. Implementation Strategy

### 5.1 `MidiGenerator` Class
-   **Input**: `AST.Score`
-   **Output**: `Uint8Array` (MIDI File bytes)

**Process**:
1.  Initialize MIDI Header (Format 2, PPQ 480).
2.  For each Music Block:
    -   Start new Track.
    -   Initialize State: `Time=0`, `Tempo=120`, `Key=C`, `Instrument=1` (Piano).
    -   Iterate Lyric/Pitch measures (Lockstep):
        -   Handle Directives (`T`, `B`, `I`, `V`, `K`, `O`): Emit MIDI Meta Events or Controller messages.
        -   Handle Subdivisions:
            -   Calculate Delta Time since last event.
            -   If Attack:
                -   NOTE OFF (Previous) -> Delta 0 (or actual delta).
                -   NOTE ON (Current) -> Delta 0.
            -   If Rest/Space:
                -   NOTE OFF (Previous).
            -   Advance Time accumulator based on duration.
    -   End Track.

### 5.2 Libraries
-   **MIDI Writer**: Custom strictly-typed writer (No external write dependencies).
-   **Player**: `midi-player-js` (Event scheduler) + `soundfont-player` (Audio generation).
    -   See [`MIDIPLAYER.md`](./MIDIPLAYER.md) for a succinct local reference of the `midi-player-js` API.

## 6. Verification
### 6.1 Simple Rhythm & Pitch Test
Input:
```
[T120 B4] * ; * ; |  * - - -  |
[K0 O4] c  d  |  c  |
```
Expected Output:
1.  **Note ON** 60 (C4), Duration 0.5s (1 Beat / 2) -> 240 Ticks
2.  **Silence** 0.5s (Rest)
3.  **Note ON** 62 (D4), Duration 0.5s
4.  **Silence** 0.5s
5.  **Note ON** 60 (C4), Duration 2.0s (Full measure) -> 960 Ticks
