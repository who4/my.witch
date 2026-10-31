(() => {
  "use strict";

  // These filenames are expected to sit in the same folder as index.html.
  const TRACKS = [
    {
      title: "She's My Witch",
      artist: "Kip Tyler",
      file: "My witch.mp3",
      letter: "W",
      colors: ["#352039", "#bb6f9c"]
    },
    {
      title: "Cowboys and Angels",
      artist: "George Michael",
      file: "Cowboys_and_Angels.mp3",
      letter: "C",
      colors: ["#263345", "#a78c9d"]
    },
    {
      title: "Closer",
      artist: "Nine Inch Nails",
      file: "Nine Inch Nails - Closer.mp3",
      letter: "N",
      colors: ["#17171e", "#806b78"]
    },
    {
      title: "He Asked Me to Quit Smoking",
      artist: "Adadido · cover",
      file: "Adadido - He Asked Me to Quit Smoking.mp3",
      letter: "A",
      colors: ["#30212e", "#d58ba9"]
    }
  ];

  const SVG_FILE = "./brand-hello-kitty-svgrepo-com.svg";
  const audio = document.getElementById("audio");
  const player = document.querySelector(".music-player");
  const rainLayer = document.getElementById("rain-layer");
  const playlist = document.getElementById("playlist");
  const titleNode = document.getElementById("track-title");
  const artistNode = document.getElementById("track-artist");
  const art = document.getElementById("album-art");
  const artLetter = document.getElementById("art-letter");
  const playButton = document.getElementById("play-button");
  const artPlay = document.getElementById("art-play");
  const previousButton = document.getElementById("previous-button");
  const nextButton = document.getElementById("next-button");
  const seekbar = document.getElementById("seekbar");
  const seekFill = document.getElementById("seek-fill");
  const currentTimeNode = document.getElementById("current-time");
  const totalTimeNode = document.getElementById("total-time");
  const messageNode = document.getElementById("player-message");

  let currentIndex = 0;
  let lyricsByTrack = {};
  let currentCues = [];
  let firedCues = new Set();
  let lastAudioTime = 0;
  let activeCueIndex = -1;
  let particles = [];
  let lastFrame = 0;
  let lastSvgSpawn = 0;
  let svgSpawnInterval = 1050;
  let pointer = { x: -1000, y: -1000, active: false, touch: false, until: 0 };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function encodeLocalFile(filename) {
    // encodeURI preserves slashes and safely handles spaces in local filenames.
    return "./" + encodeURIComponent(filename).replace(/%2F/g, "/");
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return String(minutes).padStart(2, "0") + ":" + String(remainingSeconds).padStart(2, "0");
  }

  function setMessage(message) {
    messageNode.textContent = message;
  }

  function buildPlaylist() {
    playlist.innerHTML = "";
    TRACKS.forEach((track, index) => {
      const item = document.createElement("li");
      item.className = "track-row";
      item.dataset.index = String(index);
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-label", "Play " + track.title);

      const thumb = document.createElement("span");
      thumb.className = "track-thumb";
      thumb.textContent = track.letter;
      thumb.style.background = `linear-gradient(135deg, ${track.colors[0]}, ${track.colors[1]})`;

      const copy = document.createElement("span");
      copy.className = "track-row-copy";

      const rowTitle = document.createElement("span");
      rowTitle.className = "track-row-title";
      rowTitle.textContent = track.title;

      const rowArtist = document.createElement("span");
      rowArtist.className = "track-row-artist";
      rowArtist.textContent = track.artist || "Artist detected from audio";
      copy.append(rowTitle, rowArtist);

      const duration = document.createElement("span");
      duration.className = "track-duration";
      duration.textContent = "--:--";

      item.append(thumb, copy, duration);
      item.addEventListener("click", () => loadTrack(index, true));
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          loadTrack(index, true);
        }
      });
      playlist.appendChild(item);

      // Read only metadata so the playlist can show song lengths without
      // downloading the whole track into memory.
      const probe = new Audio();
      probe.preload = "metadata";
      probe.src = encodeLocalFile(track.file);
      probe.addEventListener("loadedmetadata", () => {
        duration.textContent = formatTime(probe.duration);
      }, { once: true });
      probe.addEventListener("error", () => {
        duration.textContent = "--:--";
      }, { once: true });
    });
  }

  function updatePlayerDetails() {
    const track = TRACKS[currentIndex];
    titleNode.textContent = track.title;
    artistNode.textContent = track.artist;
    artLetter.textContent = track.letter;
    art.style.setProperty("--cover-a", track.colors[0]);
    art.style.setProperty("--cover-b", track.colors[1]);
    document.querySelectorAll(".track-row").forEach((row, index) => {
      const selected = index === currentIndex;
      row.classList.toggle("is-active", selected);
      row.setAttribute("aria-current", selected ? "true" : "false");
      const rowArtist = row.querySelector(".track-row-artist");
      if (rowArtist) rowArtist.textContent = TRACKS[index].artist || "Artist detected from audio";
    });
  }

  function setPlayingState(isPlaying) {
    player.classList.toggle("is-playing", isPlaying);
    playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    artPlay.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  }

  async function togglePlayback() {
    if (audio.paused) {
      try {
        await audio.play();
        setPlayingState(true);
        setMessage("Now playing · timed lyrics follow the recording");
      } catch (error) {
        setPlayingState(false);
        setMessage("Could not play this file. Check its filename and browser support.");
      }
    } else {
      audio.pause();
      setPlayingState(false);
      setMessage("Paused");
    }
  }

  function loadTrack(index, autoplay) {
    if (index < 0 || index >= TRACKS.length) return;

    const wasPlaying = !audio.paused;
    audio.pause();
    currentIndex = index;
    currentCues = Array.isArray(lyricsByTrack[TRACKS[index].file])
      ? normalizeCues(lyricsByTrack[TRACKS[index].file])
      : [];
    firedCues = new Set();
    lastAudioTime = 0;
    activeCueIndex = -1;
    clearLyricParticles();

    audio.src = encodeLocalFile(TRACKS[index].file);
    audio.load();
    updatePlayerDetails();
    seekFill.style.width = "0%";
    currentTimeNode.textContent = "00:00";
    totalTimeNode.textContent = "--:--";
    setPlayingState(false);
    setMessage(currentCues.length
      ? "Local timed lyrics loaded · press play"
      : "No local timed lyrics are available for this track.");

    if (autoplay || wasPlaying) {
      audio.play().then(() => {
        setPlayingState(true);
        setMessage("Now playing · timed lyrics follow the recording");
      }).catch(() => {
        setPlayingState(false);
        setMessage("Could not play this file. Check its filename and browser support.");
      });
    }
  }

  function normalizeCues(input) {
    // Keep valid cues only and sort them by their start time.
    return input
      .filter((cue) => cue && Number.isFinite(Number(cue.time)) && typeof cue.text === "string")
      .map((cue) => ({
        time: Number(cue.time),
        end: cue.end !== undefined && cue.end !== null && Number.isFinite(Number(cue.end)) ? Number(cue.end) : null,
        text: cue.text,
        words: Array.isArray(cue.words) ? cue.words : null
      }))
      .sort((a, b) => a.time - b.time);
  }

  async function loadLyrics() {
    try {
      // All lyrics are stored locally in lyrics.json; no API or network lookup is used.
      const response = await fetch("./lyrics.json", { cache: "no-store" });
      if (!response.ok) throw new Error("lyrics.json could not be loaded");
      lyricsByTrack = await response.json();
      currentCues = normalizeCues(lyricsByTrack[TRACKS[currentIndex].file] || []);
      if (currentCues.length) {
        setMessage("Local timed lyrics loaded · press play");
      } else {
        setMessage("No local timed lyrics found for this track.");
      }
    } catch (error) {
      lyricsByTrack = {};
      currentCues = [];
      setMessage("Could not load lyrics.json · run this page through a local web server.");
    }
  }

  function updateTimeUI() {
    const duration = audio.duration;
    const current = audio.currentTime || 0;
    currentTimeNode.textContent = formatTime(current);
    totalTimeNode.textContent = formatTime(duration);
    const percentage = Number.isFinite(duration) && duration > 0 ? (current / duration) * 100 : 0;
    seekFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    seekbar.setAttribute("aria-valuenow", String(Math.round(percentage)));
  }

  function seekToPointer(event) {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const bounds = seekbar.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    audio.currentTime = fraction * audio.duration;
    handleSeek();
    updateTimeUI();
  }

  function handleSeek() {
    const time = audio.currentTime || 0;
    // On a seek, don't spray every skipped lyric at once. Mark the past cues as
    // already handled and show only the line that belongs at the new position.
    firedCues = new Set();
    for (let index = 0; index < currentCues.length; index += 1) {
      if (currentCues[index].time <= time) firedCues.add(index);
    }
    clearLyricParticles();
    activeCueIndex = findActiveCueIndex(time);
    if (activeCueIndex >= 0) {
      spawnLyric(currentCues[activeCueIndex], activeCueIndex);
    }
    lastAudioTime = time;
  }

  function findActiveCueIndex(time) {
    let candidate = -1;
    for (let index = 0; index < currentCues.length; index += 1) {
      const cue = currentCues[index];
      if (cue.time > time) break;
      if (cue.end === null || time < cue.end) candidate = index;
      else candidate = -1;
    }
    return candidate;
  }

  function spawnLyric(cue, cueIndex) {
    const element = document.createElement("div");
    element.className = "rain-item rain-lyric";
    element.dataset.cueIndex = String(cueIndex);

    if (cue.words && cue.words.length) {
      cue.words.forEach((word, index) => {
        const span = document.createElement("span");
        span.className = "rain-word";
        span.textContent = word.text || "";
        span.dataset.wordIndex = String(index);
        element.appendChild(span);
        if (index < cue.words.length - 1) element.appendChild(document.createTextNode(" "));
      });
    } else {
      element.textContent = cue.text;
    }

    const size = 16 + Math.random() * 9;
    element.style.setProperty("--font-size", `${size}px`);
    rainLayer.appendChild(element);
    const bounds = element.getBoundingClientRect();
    const width = Math.max(30, bounds.width);
    const height = Math.max(20, bounds.height);
    const maxX = Math.max(4, window.innerWidth - width - 4);
    const particle = {
      type: "lyric",
      element,
      x: 4 + Math.random() * Math.max(0, maxX - 4),
      y: -height - 12,
      width,
      height,
      vx: (Math.random() - 0.5) * 18,
      vy: 38 + Math.random() * 26,
      rotation: (Math.random() - 0.5) * 5,
      spin: (Math.random() - 0.5) * 2.5,
      cueIndex
    };
    particles.push(particle);
    drawParticle(particle);
  }

  function spawnSvg() {
    const image = document.createElement("img");
    image.className = "rain-item rain-svg";
    image.src = SVG_FILE;
    image.alt = "";
    const size = 24 + Math.random() * 23;
    image.style.width = `${size}px`;
    image.style.height = `${size}px`;
    rainLayer.appendChild(image);
    const maxX = Math.max(0, window.innerWidth - size);
    const particle = {
      type: "svg",
      element: image,
      x: Math.random() * maxX,
      y: -size - 8,
      width: size,
      height: size,
      vx: (Math.random() - 0.5) * 15,
      vy: 28 + Math.random() * 31,
      rotation: (Math.random() - 0.5) * 32,
      spin: (Math.random() - 0.5) * 12,
      cueIndex: -1
    };
    particles.push(particle);
    drawParticle(particle);
  }

  function drawParticle(particle) {
    particle.element.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0) rotate(${particle.rotation}deg)`;
  }

  function clearLyricParticles() {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      if (particles[index].type === "lyric") {
        particles[index].element.remove();
        particles.splice(index, 1);
      }
    }
  }

  function syncLyrics() {
    if (audio.paused || !currentCues.length) return;
    const now = audio.currentTime || 0;

    // A backwards seek is handled by the seeked event; this also catches
    // browser/player time jumps that don't emit it reliably.
    if (now < lastAudioTime - 0.45) handleSeek();

    for (let index = 0; index < currentCues.length; index += 1) {
      const cue = currentCues[index];
      if (cue.time <= now + 0.025 && !firedCues.has(index)) {
        firedCues.add(index);
        spawnLyric(cue, index);
      }
    }

    activeCueIndex = findActiveCueIndex(now);
    particles.forEach((particle) => {
      if (particle.type !== "lyric") return;
      const cue = currentCues[particle.cueIndex];
      const isCurrent = particle.cueIndex === activeCueIndex;
      particle.element.classList.toggle("is-current", isCurrent);

      const wordSpans = particle.element.querySelectorAll(".rain-word");
      if (wordSpans.length && cue && cue.words) {
        let activeWord = -1;
        for (let wordIndex = 0; wordIndex < cue.words.length; wordIndex += 1) {
          const word = cue.words[wordIndex];
          const wordStart = Number(word.time);
          const nextWord = cue.words[wordIndex + 1];
          const wordEnd = Number.isFinite(Number(word.end))
            ? Number(word.end)
            : (nextWord ? Number(nextWord.time) : Infinity);
          if (now >= wordStart && now < wordEnd) activeWord = wordIndex;
        }
        wordSpans.forEach((span, wordIndex) => {
          span.classList.toggle("is-sung", isCurrent && wordIndex === activeWord);
        });
      }
    });

    lastAudioTime = now;
  }

  function updatePointer(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.touch = event.pointerType === "touch";
    pointer.active = true;
    pointer.until = performance.now() + (pointer.touch ? 950 : 120);
  }

  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("pointerdown", updatePointer, { passive: true });
  window.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch") pointer.until = performance.now() + 650;
  }, { passive: true });
  window.addEventListener("pointercancel", () => { pointer.active = false; }, { passive: true });
  window.addEventListener("pointerleave", () => { pointer.active = false; }, { passive: true });

  function resolveCollisions() {
    // Simple 2D separation: objects are pushed sideways when their bounding
    // boxes overlap, so lyrics and falling SVGs do not sit on top of each other.
    for (let first = 0; first < particles.length; first += 1) {
      const a = particles[first];
      for (let second = first + 1; second < particles.length; second += 1) {
        const b = particles[second];
        const centerAX = a.x + a.width / 2;
        const centerAY = a.y + a.height / 2;
        const centerBX = b.x + b.width / 2;
        const centerBY = b.y + b.height / 2;
        const overlapX = (a.width + b.width) / 2 - Math.abs(centerAX - centerBX);
        const overlapY = (a.height + b.height) / 2 - Math.abs(centerAY - centerBY);

        if (overlapX <= 0 || overlapY <= 0) continue;

        const direction = centerAX === centerBX ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(centerAX - centerBX);
        const push = overlapX / 2 + 1.5;
        const oldAX = a.x;
        const oldBX = b.x;
        a.x += direction * push;
        b.x -= direction * push;

        const maxAX = Math.max(0, window.innerWidth - a.width);
        const maxBX = Math.max(0, window.innerWidth - b.width);
        a.x = Math.max(0, Math.min(maxAX, a.x));
        b.x = Math.max(0, Math.min(maxBX, b.x));
        a.vx += direction * 12;
        b.vx -= direction * 12;

        // If the viewport edge prevents enough horizontal separation, stagger
        // their vertical positions slightly as a fallback.
        const stillOverlapX = (a.width + b.width) / 2 - Math.abs((a.x + a.width / 2) - (b.x + b.width / 2));
        if (stillOverlapX > 0) {
          if (a.y <= b.y) a.y -= overlapY + 2;
          else b.y -= overlapY + 2;
        }
        if (a.x === oldAX && b.x === oldBX && overlapY > 0) {
          if (a.y <= b.y) a.y -= overlapY + 2;
          else b.y -= overlapY + 2;
        }
      }
    }
  }

  function animate(now) {
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.04) : 0.016;
    lastFrame = now;

    if (!reducedMotion && now - lastSvgSpawn > svgSpawnInterval) {
      spawnSvg();
      lastSvgSpawn = now;
      svgSpawnInterval = 850 + Math.random() * 900;
    }

    if (pointer.active && now > pointer.until) pointer.active = false;

    if (!audio.paused) syncLyrics();

    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.vx *= Math.pow(0.992, delta * 60);
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.rotation += particle.spin * delta;

      // A pointer/touch gently repels the falling objects.
      if (pointer.active) {
        const centerX = particle.x + particle.width / 2;
        const centerY = particle.y + particle.height / 2;
        const dx = centerX - pointer.x;
        const dy = centerY - pointer.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const radius = pointer.touch ? 125 : 105;
        if (distance < radius) {
          const force = (1 - distance / radius) * (pointer.touch ? 175 : 115);
          particle.vx += (dx / distance) * force * delta;
          particle.vy -= force * 0.08 * delta;
        }
      }

      if (particle.x < 0) { particle.x = 0; particle.vx = Math.abs(particle.vx) * .55; }
      if (particle.x + particle.width > window.innerWidth) {
        particle.x = Math.max(0, window.innerWidth - particle.width);
        particle.vx = -Math.abs(particle.vx) * .55;
      }

      if (particle.y > window.innerHeight + particle.height + 30) {
        particle.element.remove();
        particles.splice(index, 1);
      }
    }

    resolveCollisions();
    particles.forEach(drawParticle);
    requestAnimationFrame(animate);
  }

  playButton.addEventListener("click", togglePlayback);
  artPlay.addEventListener("click", togglePlayback);
  previousButton.addEventListener("click", () => {
    loadTrack(Math.max(0, currentIndex - 1), true);
  });
  nextButton.addEventListener("click", () => {
    loadTrack(Math.min(TRACKS.length - 1, currentIndex + 1), true);
  });
  seekbar.addEventListener("pointerdown", (event) => {
    seekToPointer(event);
  });
  seekbar.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, audio.currentTime - 5);
    if (event.key === "ArrowRight" && Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
  });

  audio.addEventListener("loadedmetadata", () => {
    updateTimeUI();
    if (currentCues.length) setMessage("Local timed lyrics loaded · press play");
  });
  audio.addEventListener("timeupdate", () => {
    updateTimeUI();
    syncLyrics();
  });
  audio.addEventListener("seeked", () => {
    handleSeek();
    updateTimeUI();
  });
  audio.addEventListener("play", () => setPlayingState(true));
  audio.addEventListener("pause", () => setPlayingState(false));
  audio.addEventListener("ended", () => {
    if (currentIndex < TRACKS.length - 1) loadTrack(currentIndex + 1, true);
    else {
      setPlayingState(false);
      setMessage("Playlist finished");
    }
  });
  audio.addEventListener("error", () => {
    setPlayingState(false);
    setMessage("Audio file not found · put the MP3 beside index.html");
  });

  buildPlaylist();
  updatePlayerDetails();
  loadLyrics().then(() => {
    // Start with the first song only after the JSON configuration is ready.
    loadTrack(0, false);
  });
  requestAnimationFrame(animate);
})();
