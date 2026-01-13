# miniFQS Web Application Specification

## 1. Overview
The miniFQS Web App provides a complete environment for editing, listening, and visualizing music scores. It combines the Parser, Layout Engine, and Audio Generator into a single interface.

## 2. Layout & UI (Mobile/Tablet Friendly)
**Block-Based Editor Pattern**:
-   The UI renders the score as a vertical list of interactive **Music Blocks**.
-   **View Mode**: Shows the rendered SVG for the block.
-   **Edit Mode**: Clicking a block expands an editor *inline* (beneath or replacing the view) containing the source text for that specific block.
-   **Creation**: Tapping in the empty space between blocks (or explicit "+" buttons) adds a new empty block.
-   **Deletion**: Clearing the text of a block removes it from the document.

### 2.1 Interaction Flow
1.  **Initial Load**: Parse full source -> Split into Blocks -> Render List.
2.  **Tap Block**:
    -   Switch specific block to Edit Mode.
    -   Show `<textarea>` populated with block source.
    -   Focus editor.
3.  **Edit & Save**:
    -   On `blur` or "Done" button: Parse block text.
    -   If empty: Remove block.
    -   Else: Update Block State -> Re-render SVG -> Switch to View Mode.
4.  **Playback**:
    -   **Fixed Bottom Bar**: Play/Stop/Pause controls stuck to the bottom of the viewport (z-index high).
    -   Progress Bar / Scrubber included in the bar.
    -   Highlighting current block during playback (scroll into view).

## 3. Libraries

### 3.1 Layout & Logic
-   **State Management**:
    -   App holds `Block[]` state.
    -   `LayoutEngine` needs to support rendering a *single* `MusicBlock` AST node (it already does, but we need to structure the App to map 1 Block -> 1 SVG).
    -   *Title Block*: Handled as the first block (Special type? Or just text?). miniFQS parser distinguishes Title Block from Music Blocks. We might need a generic "Header Block" editor.
-   **Bundled Core**: Native ES Modules.

### 3.2 Audio Playback
-   **Synthesizer**: `soundfont-player` (e.g., from `https://github.com/danigb/soundfont-player`).
-   **MIDI Player**: `midi-player-js` (e.g., `https://github.com/grimmdude/MidiPlayerJS`).
    -   *Flow*:
        1.  `AudioGenerator` -> `Uint8Array` (MIDI File).
        2.  `MidiPlayer` loads the array.
        3.  `MidiPlayer` triggers events.
        4.  `SoundFontPlayer` PLAYS notes based on events.

## 4. Implementation Steps

1.  **Dependencies**:
    -   Add `soundfont-player` and `midi-player-js` to `package.json` (or use CDN links for prototype).
    -   *Plan*: Use CDN (unpkg/esm.sh) for `index.html` to keep it zero-config runnable if possible, OR `npm install` and use a light bundler like `vite` or `esbuild`.
    -   *Decision*: Let's use `npm install` and a simple build script. The repo already has a `package.json`.

2.  **`src/index.ts` (Entry Point)**:
    -   Exports `renderScore(fqsString, elementId)`
    -   Exports `playScore(fqsString)`
    -   Exports `downloadMidi(fqsString)`

3.  **`index.html`**:
    -   UI Skeleton.
    -   Glue code.

## 5. Challenges
-   **SoundFonts**: Browsers block AudioContext until user interaction. Trigger initialization on "Play" button.
-   **Synchronization**: Highlighting notes while playing.
    -   *v1*: Just playback.
    -   *v2*: `midi-player-js` emits events with ticks. We can map Ticks -> Beat -> Layout Element?
    -   *Mapping*: The Layout Engine needs to expose a "Tick Map" (Element ID -> Start Tick).
    -   *Scope*: Out of scope for v1, but good to keep in mind.

## 6. Verification
-   Load `Layout Verify` example.
-   Press Play -> Hear Audio.
-   Edit Text -> See Layout Update.
-   Press Download -> Get `.mid`.
