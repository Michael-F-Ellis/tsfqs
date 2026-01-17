## new Player(eventHandler, buffer)
**Source**: line 17
**Description**: Main player class. Contains methods to load files, start, stop.
**Parameters**:
- `eventHandler`: function - Callback to fire for each MIDI event. Can also be added with on('midiEvent', fn)
- `buffer`: array - Array buffer of MIDI file (optional).
**Returns**: void

## bytesProcessed()
**Source**: line 447
**Description**: Number of bytes processed in the loaded MIDI file.
**Parameters**:
**Returns**: number

## disableTrack(trackNumber)
**Source**: line 175
**Description**: Disallows a track for playing.
**Parameters**:
- `trackNumber`: number - Track number
**Returns**: Player

## dryRun()
**Source**: line 364
**Description**: Plays the loaded MIDI file without regard for timing and saves events in this.events. Essentially used as a parser.
**Parameters**:
**Returns**: Player

## emitEvent(event)
**Source**: line 488
**Description**: Sends MIDI event out to listener.
**Parameters**:
- `event`: object
**Returns**: Player

## enableTrack(trackNumber)
**Source**: line 165
**Description**: Enables a track for playing.
**Parameters**:
- `trackNumber`: number - Track number
**Returns**: Player

## endOfFile()
**Source**: line 466
**Description**: Determines if the player pointer has reached the end of the loaded MIDI file. Used in two ways: 1. If playing result is based on loaded JSON events. 2. If parsing (dryRun) it's based on the actual buffer length vs bytes processed.
**Parameters**:
**Returns**: boolean

## eventsPlayed()
**Source**: line 455
**Description**: Number of events played up to this point.
**Parameters**:
**Returns**: number

## fileLoaded()
**Source**: line 100
**Description**: Sets default tempo, parses file for necessary information, and does a dry run to calculate total length. Populates this.events & this.totalTicks.
**Parameters**:
**Returns**: Player

## getCurrentTick()
**Source**: line 478
**Description**: Gets the current tick number in playback.
**Parameters**:
**Returns**: number

## getDivision()
**Source**: line 184
**Description**: Gets quarter note division of loaded MIDI file.
**Parameters**:
**Returns**: Player

## getEvents()
**Source**: line 399
**Description**: Gets an array of events grouped by track.
**Parameters**:
**Returns**: array

## getFilesize()
**Source**: line 91
**Description**: Get filesize of loaded file in number of bytes.
**Parameters**:
**Returns**: number

## getFormat()
**Source**: line 118
**Description**: Gets MIDI file format for loaded file.
**Parameters**:
**Returns**: Player

## getSongPercentRemaining()
**Source**: line 439
**Description**: Gets remaining percent of playback.
**Parameters**:
**Returns**: number

## getSongTime()
**Source**: line 423
**Description**: Gets song duration in seconds.
**Parameters**:
**Returns**: number

## getSongTimeRemaining()
**Source**: line 431
**Description**: Gets remaining number of seconds in playback.
**Parameters**:
**Returns**: number

## getTotalEvents()
**Source**: line 415
**Description**: Gets total number of events in the loaded MIDI file.
**Parameters**:
**Returns**: number

## getTotalTicks()
**Source**: line 407
**Description**: Gets total number of ticks in the loaded MIDI file.
**Parameters**:
**Returns**: number

## getTracks()
**Source**: line 137
**Description**: Parses out tracks, places them in this.tracks and initializes this.pointers
**Parameters**:
**Returns**: Player

## isPlaying()
**Source**: line 356
**Description**: Checks if player is playing
**Parameters**:
**Returns**: boolean

## loadArrayBuffer(arrayBuffer)
**Source**: line 62
**Description**: Load an array buffer into the player.
**Parameters**:
- `arrayBuffer`: array - Array buffer of file to be loaded.
**Returns**: Player

## loadDataUri(dataUri)
**Source**: line 72
**Description**: Load a data URI into the player.
**Parameters**:
- `dataUri`: string - Data URI to be loaded.
**Returns**: Player

## loadFile(path)
**Source**: line 47
**Description**: Load a file into the player (Node.js only).
**Parameters**:
- `path`: string - Path of file.
**Returns**: Player

## on(playerEvent, fn)
**Source**: line 499
**Description**: Subscribes events to listeners
**Parameters**:
- `playerEvent`: string - Name of event to subscribe to.
- `fn`: function - Callback to fire when event is broadcast.
**Returns**: Player

## pause()
**Source**: line 292
**Description**: Pauses playback if playing.
**Parameters**:
**Returns**: Player

## play()
**Source**: line 264
**Description**: Start playing loaded MIDI file if not already playing.
**Parameters**:
**Returns**: Player

## playLoop(dryRun)
**Source**: line 194
**Description**: The main play loop.
**Parameters**:
- `dryRun`: boolean - Indicates whether or not this is being called simply for parsing purposes. Disregards timing if so.
**Returns**: undefined

## resetTracks()
**Source**: line 390
**Description**: Resets play pointers for all tracks.
**Parameters**:
**Returns**: Player

## setStartTime(startTime)
**Source**: line 255
**Description**: Setter for startTime.
**Parameters**:
- `startTime`: number - UTC timestamp
**Returns**: Player

## setTempo(tempo)
**Source**: line 245
**Description**: Setter for tempo.
**Parameters**:
- `tempo`: number - Tempo in bpm (defaults to 120)
**Returns**: void

## skipToPercent(percent)
**Source**: line 334
**Description**: Skips player pointer to specified percentage.
**Parameters**:
- `percent`: number - Percent value in integer format.
**Returns**: Player

## skipToSeconds(seconds)
**Source**: line 345
**Description**: Skips player pointer to specified seconds.
**Parameters**:
- `seconds`: number - Seconds to skip to.
**Returns**: Player

## skipToTick(tick)
**Source**: line 318
**Description**: Skips player pointer to specified tick.
**Parameters**:
- `tick`: number - Tick to skip to.
**Returns**: Player

## stop()
**Source**: line 304
**Description**: Stops playback if playing.
**Parameters**:
**Returns**: Player

## triggerPlayerEvent(playerEvent, data)
**Source**: line 511
**Description**: Broadcasts event to trigger subscribed callbacks.
**Parameters**:
- `playerEvent`: string - Name of event.
- `data`: object - Data to be passed to subscriber callback.
**Returns**: Player

## validate()
**Source**: line 109
**Description**: Validates file using simple means - first four bytes should == MThd.
**Parameters**:
**Returns**: boolean
