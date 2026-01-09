# miniFQS Language Definition

## Overview
miniFQS is a concise format for representing vocal music scores, consisting of lyrics aligned with pitches. It is designed to be human-readable and easily editable.

## File Structure
A miniFQS file consists of a **Title Block** followed by one or more **Music Blocks**. Blocks are separated by one or more empty lines.

### Title Block
The first block in the file is the Title Block. It can contain one or more lines of text (e.g., Title, Composer, Arranger).

### Music Blocks
Each Music Block represents a line of music and consists of:
1.  **Lyric Line**: The text and rhythm data.
2.  **Pitch Line**: The musical notes and key signature.
3.  **Counter Line** (Deprecated/Removed): Replaced by `[N...]` directive.

Example 1:
```
Happy Birthday
 
[N3] Hap.py | birth day to | you - ; |
K&1 cc | d c f | e |
```

Example 2:
```
Happy Birthday Without Lyrics.
 
[N3] ** | * * * | * - ; |
K&1 cc | d c f | e |
```

---

## Syntax Details

### 1. Lyric Line
The lyric line defines the text syllables and their rhythmic distribution.

-   **Syllables**: Text segments to be sung (e.g., `Hap`, `py`).
-   **Barlines**: `|` delimits measures. **Must** be present at the end of the line.
-   **Beat Separators**: whitespace separates beats.
-   **Subdivisions**: `.` separates syllables within a single beat (e.g., `Hap.py` puts "Hap" and "py" in the same beat).
-   **Special Characters**:
    -   `-`: Hyphen (continuation of a note or rest subdivision).
    -   `*`: Asterisk (melisma) continues a syllable with change of pitch.  Does not require a `.` to separate from the previous subdivision.
    -   `_`: Underscore (Silent Subdivision). Counts as a beat subdivision but represents truncation of the beat.
    -   `;`: Semicolon (denotes a musical rest).
    -   `=`: Shorthand for `--`.

#### Subdivision Duration Formula
The duration ($D$) of each subdivision in a beat is calculated as:
$$ D = \frac{M}{S} $$
Where:
-   $M$ is the Multi-beat count (defaults to 1 if no prefix).
-   $S$ is the total count of subdivisions in the beat (syllables, `*`, `-`, `_`).

**Example**: `[B4.] **_`
-   $M=1$
-   $S=3$ (`*`, `*`, `_`)
-   $D = 1/3$ beat.
-   Result: Two notes each lasting 1/3 beat, followed by 1/3 beat of silence. (Effective for 5/8 feel within 6/8 time).

**Example**: `2**-__`
-   $M=2$ (spans 2 beats)
-   $S=5$ (`*`, `*`, `-`, `_`, `_`)
-   $D = 2/5$ beat.
-   Result:
    -   First `*`: $2/5$ beat.
    -   Second `*` + `-`: $4/5$ beat.
    -   `_` + `_`: $4/5$ beat silence.

-   **Directives**: Square brackets `[...]` contain optional directives, allowing multiple directives separated by spaces (e.g., `[N3 B4. T80]`).
    -   `N<number>`: **Pickup Measure Start Count**. Indicates the count on which the music begins for a partial measure (anacrusis).
        -   Example: `[N3]` in 4/4 time means the measure starts on count 3 (contains beats 3 and 4).
    -   `B<duration>`: **Beat Duration**. Sets the note value that represents one beat. The following durations are supported:
	    -   `B1`: Whole note.
		-   `B1.`: Dotted whole note.
		-   `B2`: Half note.
		-   `B2.`: Dotted half note.
		-   `B4`: Quarter note (default).
		-   `B4.`: Dotted quarter note.
		-   `B8`: Eighth note.
		-   `B8.`: Dotted eighth note.
		-   `B16`: Sixteenth note.
		-   `B16.`: Dotted sixteenth note.
    -   `T<number>`: **Tempo**. Beats per minute.
        -   Example: `[T60]`. 
		-   The default is 120 BPM.
-   **Multi-beat Tuples**: An integer prefix indicates a syllable spans multiple beats.
    -   `2these.three.words` spans 2 beats with each word getting 2/3 of a beat.

### 2. Pitch Line
The pitch line defines the melody and harmonization.

-   **Structure**: Starts with a Key Signature, followed by pitches and barlines.
-   **Key Signature**: `K` followed by accidental count.
    -   `K0`: C Major (no sharps/flats).
    -   `K#2`, `K2#`: D Major (2 sharps).
    -   `K&3`, `K3&`: Eb Major (3 flats).
-   **Pitches**:
    -   **Note Names**: `a` through `g`.
    -   **Octave Shifts**:
        -   `^`: Shift up one octave (e.g., `^c`).
        -   `/`: Shift down one octave (e.g., `/c`).
    -   **Accidentals**:
        -   `#`: Sharp.
        -   `##`: Double Sharp.
        -   `&`: Flat.
        -   `&&`: Double Flat.
        -   `%`: Natural.
-   **Barlines**: `|` aligns with the lyric line barlines. **Must** be present at the end.

### 3. Counter Line (Removed)
The legacy `counter:` line is replaced by the `[N<number>]` directive (e.g., `[N3]`) placed at the start of the line (lyric or pitch) to indicate the starting beat of a pickup measure.
## Alignment
The parser and layout engine align the Lyric Line and Pitch Line beat-by-beat. Barlines in both lines are expected to match.
