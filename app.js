/* Sup FUCKER. */
(() => {
  "use strict";

  // Sup FUCKER. Check the playlist.
  const TRACKS = [
    {
      title: "She's My Witch",
      artist: "Kip Tyler",
      file: "My witch.mp3",
      coverNames: ["My witch", "She's My Witch"],
      colors: ["#32151d", "#6e2431"]
    },
    {
      title: "Cowboys and Angels",
      artist: "George Michael",
      file: "cowboys and angels.mp3",
      coverNames: ["Cowboys_and_Angels", "Cowboys and Angels"],
      colors: ["#151820", "#4a3941"]
    },
    {
      title: "Closer",
      artist: "Nine Inch Nails",
      file: "Nine Inch Nails - Closer.mp3",
      coverNames: ["Nine Inch Nails - Closer", "Closer"],
      colors: ["#100e12", "#4e2630"]
    },
    {
      title: "He Asked Me to Quit Smoking",
      artist: "Adadido · cover",
      file: "Adadido - He Asked Me to Quit Smoking.mp3",
      coverNames: ["Adadido - He Asked Me to Quit Smoking", "He Asked Me to Quit Smoking"],
      colors: ["#231418", "#713243"]
    }
  ];

  const COVER_EXTENSIONS = ["webp", "jpg", "jpeg", "png", "avif"];
  const SVG_FILE = "./brand-hello-kitty-svgrepo-com.svg";

  const audio = document.getElementById("audio");
  const player = document.querySelector(".music-player");
  const rainLayer = document.getElementById("rain-layer");
  const artwork = document.getElementById("album-artwork");
  const coverImage = document.getElementById("album-cover");
  const songTitle = document.getElementById("song-title");
  const artistName = document.getElementById("artist-name");
  const playButton = document.getElementById("play-button");
  const previousButton = document.getElementById("previous-button");
  const nextButton = document.getElementById("next-button");
  const volumeUpButton = document.getElementById("volume-up");
  const volumeDownButton = document.getElementById("volume-down");
  const controlOverlay = document.getElementById("btn-overlay");
  const statusNode = document.getElementById("player-status");

  let currentIndex = 0;
  let lyricsByTrack = {};
  let currentCues = [];
  let firedCues = new Set();
  let lastAudioTime = 0;
  let activeCueIndex = -1;
  let particles = [];
  let nextParticleId = 1;
  let lastFrame = 0;
  let lastSvgSpawn = 0;
  let svgSpawnInterval = 1050;
  let pointer = { x: -1000, y: -1000, active: false, touch: false, until: 0 };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fitPlayerOnMobile() {
    if (!player) return;

    if (window.matchMedia("(max-width: 620px)").matches) {
      const availableWidth = Math.max(1, window.innerWidth - 32);
      const scale = Math.min(0.72, availableWidth / 697);
      player.style.setProperty("--mobile-player-scale", String(scale));
    } else {
      player.style.removeProperty("--mobile-player-scale");
    }
  }

  fitPlayerOnMobile();
  window.addEventListener("resize", fitPlayerOnMobile, { passive: true });

  audio.volume = 0.5;

  function encodeLocalFile(filename) {
    return "./" + filename.split("/").map(encodeURIComponent).join("/");
  }

  function setStatus(message) {
    statusNode.textContent = message;
  }

  // Sup FUCKER.
  function updateCover(track) {
    coverImage.hidden = true;
    coverImage.removeAttribute("src");
    artwork.classList.remove("has-cover");

    const baseName = track.file.replace(/\.[^.]+$/, "");
    const coverNames = track.coverNames || [baseName];
    let nameIndex = 0;
    let extensionIndex = 0;

    function tryNextCover() {
      if (nameIndex >= coverNames.length) return;

      const candidate = "./covers/" + encodeURIComponent(coverNames[nameIndex]) + "." + COVER_EXTENSIONS[extensionIndex];
      extensionIndex += 1;
      if (extensionIndex >= COVER_EXTENSIONS.length) {
        extensionIndex = 0;
        nameIndex += 1;
      }

      const probe = new Image();
      probe.onload = () => {
        coverImage.src = candidate;
        coverImage.hidden = false;
        artwork.classList.add("has-cover");
      };
      probe.onerror = tryNextCover;
      probe.src = candidate;
    }

    tryNextCover();
  }

  function updateTrackDetails() {
    const track = TRACKS[currentIndex];
    songTitle.textContent = track.title;
    artistName.textContent = track.artist;
    artwork.style.setProperty("--cover-a", track.colors[0]);
    artwork.style.setProperty("--cover-b", track.colors[1]);
    updateCover(track);
  }

  function setPlayingState(isPlaying) {
    player.classList.toggle("is-playing", isPlaying);
    playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    playButton.title = isPlaying ? "Pause" : "Play";
  }

  async function togglePlayback() {
    if (audio.paused) {
      try {
        await audio.play();
        setPlayingState(true);
        setStatus("Now playing: " + TRACKS[currentIndex].title);
      } catch (error) {
        setPlayingState(false);
        setStatus("Could not play this MP3. Check the filename and make sure the audio file is uploaded.");
      }
    } else {
      audio.pause();
      setPlayingState(false);
      setStatus("Paused: " + TRACKS[currentIndex].title);
    }
  }

  function loadTrack(index, autoplay) {
    if (index < 0 || index >= TRACKS.length) return;

    audio.pause();
    currentIndex = index;
    currentCues = normalizeCues(lyricsByTrack[TRACKS[index].file] || []);
    firedCues = new Set();
    lastAudioTime = 0;
    activeCueIndex = -1;
    clearLyricParticles();

    audio.src = encodeLocalFile(TRACKS[index].file);
    audio.load();
    updateTrackDetails();
    setPlayingState(false);

    setStatus(currentCues.length
      ? "Loaded " + currentCues.length + " timed lyric lines for " + TRACKS[index].title
      : "No local timed lyrics found for " + TRACKS[index].title);

    if (autoplay) {
      audio.play().then(() => {
        setPlayingState(true);
        setStatus("Now playing: " + TRACKS[index].title);
      }).catch(() => {
        setPlayingState(false);
        setStatus("Could not play this MP3. Check the filename and make sure the audio file is uploaded.");
      });
    }
  }

  function normalizeCues(input) {
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
      const response = await fetch("./lyrics.json", { cache: "no-store" });
      if (!response.ok) throw new Error("lyrics.json could not be loaded");
      lyricsByTrack = await response.json();
      currentCues = normalizeCues(lyricsByTrack[TRACKS[currentIndex].file] || []);
      setStatus("Local timed lyrics ready. Press play.");
    } catch (error) {
      lyricsByTrack = {};
      currentCues = [];
      setStatus("Could not load lyrics.json. Run this page through a local web server.");
    }
  }

  function normalizeVolume() {
    audio.volume = Math.max(0, Math.min(1, Math.round(audio.volume * 10) / 10));
  }

  function changeVolume(amount) {
    audio.volume = Math.max(0, Math.min(1, Math.round((audio.volume + amount) * 10) / 10));
    setStatus("Volume: " + Math.round(audio.volume * 100) + "%");
  }

  function addPressEffect(button, direction) {
    const add = () => {
      if (direction === "play") button.classList.add("pressed");
      else controlOverlay.classList.add(direction);
    };
    const remove = () => {
      if (direction === "play") button.classList.remove("pressed");
      else controlOverlay.classList.remove(direction);
    };

    button.addEventListener("pointerdown", add);
    ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((eventName) => {
      button.addEventListener(eventName, remove);
    });
  }

  function enableKeyboardControl(control) {
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        control.click();
      }
    });
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return String(minutes).padStart(2, "0") + ":" + String(remainingSeconds).padStart(2, "0");
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
      id: nextParticleId++,
      type: "lyric",
      element,
      isCurrent: cueIndex === activeCueIndex,
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
      id: nextParticleId++,
      type: "svg",
      element: image,
      isCurrent: false,
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

  function handleSeek() {
    const time = audio.currentTime || 0;
    firedCues = new Set();
    for (let index = 0; index < currentCues.length; index += 1) {
      if (currentCues[index].time <= time) firedCues.add(index);
    }
    clearLyricParticles();
    activeCueIndex = findActiveCueIndex(time);
    if (activeCueIndex >= 0) spawnLyric(currentCues[activeCueIndex], activeCueIndex);
    lastAudioTime = time;
  }

  function syncLyrics() {
    if (audio.paused || !currentCues.length) return;
    const now = audio.currentTime || 0;

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
      particle.isCurrent = isCurrent;
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

  // Sup FUCKER.
  function getParticleMass(particle) {
    if (particle.type === "lyric" && particle.isCurrent) return 5.0;
    if (particle.type === "lyric") return 2.0;
    return 0.65;
  }

  function getCollisionSize(particle) {
    const radians = particle.rotation * Math.PI / 180;
    const cosine = Math.abs(Math.cos(radians));
    const sine = Math.abs(Math.sin(radians));
    return {
      width: particle.width * cosine + particle.height * sine,
      height: particle.width * sine + particle.height * cosine
    };
  }

  // Sup FUCKER.
  function resolveCollisions(delta) {
    const stiffness = 18;       // lower = softer, slower push
    const damping = 8;          // removes rebound and stops jitter
    const maxForce = 900;       // prevents sudden impulses on deep overlap
    const minOverlap = 0.5;     // ignore sub-pixel contact noise

    const collisionBounds = particles.map((particle) => {
      const size = getCollisionSize(particle);
      return {
        centerX: particle.x + particle.width / 2,
        centerY: particle.y + particle.height / 2,
        halfWidth: size.width / 2,
        halfHeight: size.height / 2
      };
    });

    for (let first = 0; first < particles.length; first += 1) {
      const a = particles[first];
      const boundsA = collisionBounds[first];
      const inverseMassA = 1 / getParticleMass(a);

      for (let second = first + 1; second < particles.length; second += 1) {
        const b = particles[second];
        const boundsB = collisionBounds[second];
        const overlapX = boundsA.halfWidth + boundsB.halfWidth - Math.abs(boundsA.centerX - boundsB.centerX);
        const overlapY = boundsA.halfHeight + boundsB.halfHeight - Math.abs(boundsA.centerY - boundsB.centerY);

        if (overlapX <= minOverlap || overlapY <= minOverlap) continue;

        let directionX = Math.sign(boundsB.centerX - boundsA.centerX);
        if (directionX === 0) directionX = a.id < b.id ? 1 : -1;

        const inverseMassB = 1 / getParticleMass(b);
        const relativeVelocityX = (b.vx - a.vx) * directionX;

        const force = Math.max(0, Math.min(maxForce,
          stiffness * overlapX - damping * relativeVelocityX
        ));
        if (force <= 0) continue;

        a.vx -= directionX * force * inverseMassA * delta;
        b.vx += directionX * force * inverseMassB * delta;

        a.vx = Math.max(-95, Math.min(95, a.vx));
        b.vx = Math.max(-95, Math.min(95, b.vx));
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
      particle.vx *= Math.pow(.992, delta * 60);
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.rotation += particle.spin * delta;

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
          particle.vy -= force * .08 * delta;
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

    resolveCollisions(delta);
    particles.forEach(drawParticle);
    requestAnimationFrame(animate);
  }

  playButton.addEventListener("click", togglePlayback);
  previousButton.addEventListener("click", () => {
    loadTrack((currentIndex - 1 + TRACKS.length) % TRACKS.length, true);
  });
  nextButton.addEventListener("click", () => {
    loadTrack((currentIndex + 1) % TRACKS.length, true);
  });
  volumeUpButton.addEventListener("click", () => changeVolume(.1));
  volumeDownButton.addEventListener("click", () => changeVolume(-.1));

  addPressEffect(playButton, "play");
  addPressEffect(previousButton, "left");
  addPressEffect(nextButton, "right");
  addPressEffect(volumeUpButton, "up");
  addPressEffect(volumeDownButton, "down");

  [playButton, previousButton, nextButton, volumeUpButton, volumeDownButton].forEach(enableKeyboardControl);

  audio.addEventListener("play", () => setPlayingState(true));
  audio.addEventListener("pause", () => setPlayingState(false));
  audio.addEventListener("seeking", handleSeek);
  audio.addEventListener("seeked", handleSeek);
  audio.addEventListener("timeupdate", syncLyrics);
  audio.addEventListener("ended", () => {
    loadTrack((currentIndex + 1) % TRACKS.length, true);
  });
  audio.addEventListener("error", () => {
    setPlayingState(false);
    setStatus("Audio file missing or unreadable. Check the MP3 filename in the project root.");
  });

  async function initialize() {
    updateTrackDetails();
    audio.src = encodeLocalFile(TRACKS[0].file);
    audio.load();
    await loadLyrics();
    currentCues = normalizeCues(lyricsByTrack[TRACKS[currentIndex].file] || []);
    setPlayingState(false);
    requestAnimationFrame(animate);
  }

  initialize();

  // Sup FUCKER. That is all.
})();
