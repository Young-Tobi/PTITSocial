import { useCallback, useEffect, useRef, useState } from 'react';

const commonsCategory = 'https://commons.wikimedia.org/wiki/Category:Purrple_Cat';
const songs = [
  { id: 'bright-side', title: 'Look on the Bright Side', artist: 'Purrple Cat', duration: '2:43', src: '/study-media/look-on-the-bright-side.ogg', source: 'https://commons.wikimedia.org/wiki/File:Purrple_Cat_-_Look_on_the_Bright_Side.ogg' },
  { id: 'quiet-night', title: 'Quiet Night', artist: 'Purrple Cat', duration: '4:03', src: '/study-media/quiet-night.ogg', source: 'https://commons.wikimedia.org/wiki/File:Purrple_Cat_-_Quiet_Night.ogg' },
  { id: 'stale-cookies', title: 'Stale Cookies Still Taste Pretty Good', artist: 'Purrple Cat', duration: '3:07', src: '/study-media/stale-cookies.ogg', source: 'https://commons.wikimedia.org/wiki/File:Purrple_Cat_-_Stale_Cookies_Still_Taste_Pretty_Good.ogg' },
  { id: 'manifestations', title: 'Manifestations of the Heart', artist: 'Purrple Cat', duration: '2:52', src: '/study-media/manifestations-of-the-heart.ogg', source: 'https://commons.wikimedia.org/wiki/File:Purrple_Cat_-_Manifestations_of_the_Heart.ogg' },
  { id: 'learning-to-love-myself', title: 'Learning to Love Myself', artist: 'Purrple Cat', duration: '3:53', src: '/study-media/learning-to-love-myself.ogg', source: 'https://commons.wikimedia.org/wiki/File:Purrple_Cat_-_Learning_to_Love_Myself.ogg' },
  { id: 'now-or-never', title: 'Now or Never', artist: 'Purrple Cat', duration: '3:17', src: '/study-media/now-or-never.ogg', source: 'https://commons.wikimedia.org/wiki/File:Purrple_Cat_-_Now_or_Never.ogg' },
  { id: 'bookworm', title: 'Bookworm', artist: 'Purrple Cat', duration: '3:13', src: '/study-media/bookworm.ogg', source: 'https://commons.wikimedia.org/wiki/File:Bookworm.ogg' },
  { id: 'fake-mustache', title: 'Fake Mustache', artist: 'Purrple Cat', duration: '3:34', src: '/study-media/fake-mustache.ogg', source: 'https://commons.wikimedia.org/wiki/File:Fake_Mustache.ogg' },
  { id: 'foggy-window', title: 'Foggy Window', artist: 'Purrple Cat', duration: '3:13', src: '/study-media/foggy-window.ogg', source: 'https://commons.wikimedia.org/wiki/File:Purrple_Cat_-_Foggy_Window.ogg' },
  { id: 'just-relax', title: 'Just Relax', artist: 'Purrple Cat', duration: '3:33', src: '/study-media/just-relax.ogg', source: 'https://commons.wikimedia.org/wiki/File:Purrple_Cat_-_Just_Relax.ogg' },
  { id: 'remembering-good-times', title: 'Remembering All the Good Times', artist: 'Purrple Cat', duration: '3:14', src: '/study-media/remembering-good-times.ogg', source: 'https://commons.wikimedia.org/wiki/File:Purrple_Cat_-_Remembering_All_the_Good_Times.ogg' },
  { id: 'goodbye-meet-again', title: 'Goodbye, I Hope We Meet Again', artist: 'Purrple Cat', duration: '3:21', src: '/study-media/goodbye-meet-again.ogg', source: 'https://commons.wikimedia.org/wiki/File:Purrple_Cat_-_Goodbye,_I_Hope_We_Meet_Again.ogg' },
];

const mixes = [
  { id: 'deep-focus-mix', title: 'Deep Focus Mix', artist: 'Purrple Cat', duration: '40 phút', source: commonsCategory, playlist: songs.map((song) => song.id) },
  { id: 'rainy-night-mix', title: 'Rainy Night Mix', artist: 'Purrple Cat', duration: '27 phút', source: commonsCategory, playlist: ['quiet-night', 'foggy-window', 'manifestations', 'remembering-good-times', 'learning-to-love-myself', 'stale-cookies', 'goodbye-meet-again', 'just-relax'] },
  { id: 'cafe-reading-mix', title: 'Café Reading Mix', artist: 'Purrple Cat', duration: '23 phút', source: commonsCategory, playlist: ['bookworm', 'bright-side', 'fake-mustache', 'now-or-never', 'just-relax', 'stale-cookies', 'remembering-good-times'] },
];

export const LOFI_TRACKS = [...mixes, ...songs];
const songsById = Object.fromEntries(songs.map((song) => [song.id, song]));
const queueFor = (selection) =>
  selection.playlist ? selection.playlist.map((id) => songsById[id]).filter(Boolean) : [selection];

export default function useAmbientSound() {
  const audio = useRef(null);
  const createPlayerRef = useRef(null);
  const playingRef = useRef(false);
  const volumeRef = useRef(35);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(35);
  const [trackId, setTrackIdState] = useState(LOFI_TRACKS[0].id);
  const track = LOFI_TRACKS.find((item) => item.id === trackId) || LOFI_TRACKS[0];
  const [nowPlaying, setNowPlaying] = useState(queueFor(track)[0]);

  const createPlayer = useCallback((selection, index = 0, autoplay = false) => {
    const queue = queueFor(selection);
    const song = queue[index] || queue[0];
    const player = new Audio(song.src);
    player.preload = 'metadata';
    player.volume = volumeRef.current / 100;
    player.addEventListener('ended', () => {
      if (audio.current !== player || !playingRef.current) return;
      createPlayerRef.current?.(selection, (index + 1) % queue.length, true);
    });
    audio.current?.pause();
    audio.current = player;
    setNowPlaying(song);
    if (autoplay)
      player.play().catch(() => {
        playingRef.current = false;
        setPlaying(false);
      });
    return player;
  }, []);
  createPlayerRef.current = createPlayer;

  const ensureAudio = useCallback(() => audio.current || createPlayer(track), [createPlayer, track]);
  const play = useCallback(async () => {
    const player = ensureAudio();
    player.volume = volumeRef.current / 100;
    await player.play();
    playingRef.current = true;
    setPlaying(true);
  }, [ensureAudio]);
  const stop = useCallback(() => {
    playingRef.current = false;
    audio.current?.pause();
    audio.current = null;
    setNowPlaying(queueFor(track)[0]);
    setPlaying(false);
  }, [track]);
  const setVolume = useCallback((value) => {
    volumeRef.current = value;
    setVolumeState(value);
    if (audio.current) audio.current.volume = value / 100;
  }, []);
  const setTrackId = useCallback(
    async (nextId) => {
      const next = LOFI_TRACKS.find((item) => item.id === nextId) || LOFI_TRACKS[0];
      const shouldResume = playingRef.current;
      playingRef.current = false;
      audio.current?.pause();
      audio.current = null;
      setTrackIdState(next.id);
      setPlaying(false);
      const player = createPlayer(next);
      if (shouldResume) {
        await player.play();
        playingRef.current = true;
        setPlaying(true);
      }
    },
    [createPlayer]
  );

  useEffect(
    () => () => {
      playingRef.current = false;
      audio.current?.pause();
      audio.current = null;
    },
    []
  );

  return { playing, play, stop, volume, setVolume, track, trackId, setTrackId, tracks: LOFI_TRACKS, songCount: songs.length, mixCount: mixes.length, nowPlaying };
}
