(() => {
  const photos = Array.isArray(window.GALLERY_PHOTOS) ? window.GALLERY_PHOTOS : [];
  const container = document.querySelector(".container");
  const canvas = document.getElementById("canvas");
  const overlay = document.getElementById("overlay");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const settings = { baseWidth: 400, smallHeight: 330, largeHeight: 500, itemGap: 65, hoverScale: 1.05, expandedScale: .4, dragEase: .075, momentumFactor: 200, bufferZone: 3, overlayOpacity: .9, overlayEaseDuration: .8, zoomDuration: .6 };
  const columns = 4;
  let itemSizes, cellWidth, cellHeight;
  const visibleItems = new Set();
  let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
  let startX = 0, startY = 0, lastDragTime = 0, velocityX = 0, velocityY = 0;
  let isDragging = false, mouseHasMoved = false, canDrag = true;
  let isExpanded = false, activeItemId = null, expandedItem = null, originalPosition = null;
  let lastX = 0, lastY = 0, lastUpdate = 0;

  function setLayout() {
    const baseWidth = innerWidth < 700 ? Math.max(180, Math.min(330, innerWidth * .72)) : settings.baseWidth;
    const gap = innerWidth < 700 ? Math.max(24, Math.round(baseWidth * .16)) : settings.itemGap;
    itemSizes = [
      { width: baseWidth, height: Math.round(baseWidth * .825) },
      { width: baseWidth, height: Math.round(baseWidth * 1.25) }
    ];
    cellWidth = baseWidth + gap;
    cellHeight = itemSizes[1].height + gap;
  }

  function rebuildGrid() {
    visibleItems.forEach((id) => document.getElementById(id)?.remove());
    visibleItems.clear();
    setLayout();
    updateVisibleItems();
  }

  const getItemId = (column, row) => `${column},${row}`;
  const getItemSize = (row, column) => itemSizes[Math.abs((row * columns + column) % itemSizes.length)];
  const imageIndex = (row, column) => Math.abs((row * columns + column) % photos.length);

  function updateVisibleItems() {
    if (!photos.length) return;
    const viewWidth = innerWidth * (1 + settings.bufferZone);
    const viewHeight = innerHeight * (1 + settings.bufferZone);
    const startColumn = Math.floor((-currentX - viewWidth / 2) / cellWidth);
    const endColumn = Math.ceil((-currentX + viewWidth * 1.5) / cellWidth);
    const startRow = Math.floor((-currentY - viewHeight / 2) / cellHeight);
    const endRow = Math.ceil((-currentY + viewHeight * 1.5) / cellHeight);
    const required = new Set();
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        const id = getItemId(column, row);
        required.add(id);
        if (visibleItems.has(id) || (id === activeItemId && isExpanded)) continue;
        const size = getItemSize(row, column);
        const item = document.createElement("button");
        const imageContainer = document.createElement("div");
        const image = document.createElement("img");
        item.type = "button"; item.className = "item"; item.id = id;
        item.setAttribute("aria-label", "Open photo");
        item.style.width = `${size.width}px`; item.style.height = `${size.height}px`;
        item.style.left = `${column * cellWidth}px`; item.style.top = `${row * cellHeight}px`;
        item.dataset.width = String(size.width); item.dataset.height = String(size.height);
        imageContainer.className = "item-image-container";
        image.src = photos[imageIndex(row, column)]; image.alt = ""; image.draggable = false;
        imageContainer.appendChild(image); item.appendChild(imageContainer);
        item.addEventListener("click", () => { if (!mouseHasMoved && !isDragging) expandItem(item); });
        canvas.appendChild(item); visibleItems.add(id);
      }
    }
    visibleItems.forEach((id) => {
      if (!required.has(id) || (id === activeItemId && isExpanded)) { document.getElementById(id)?.remove(); visibleItems.delete(id); }
    });
  }

  function expandItem(item) {
    if (isExpanded) return;
    isExpanded = true; canDrag = false; activeItemId = item.id; container.style.cursor = "auto";
    const rect = item.getBoundingClientRect();
    const width = Number(item.dataset.width), height = Number(item.dataset.height), source = item.querySelector("img").src;
    originalPosition = { rect, width, height };
    overlay.classList.add("active");
    expandedItem = document.createElement("div"); expandedItem.className = "expanded-item";
    expandedItem.style.width = `${width}px`; expandedItem.style.height = `${height}px`;
    const image = document.createElement("img"); image.src = source; image.alt = ""; expandedItem.appendChild(image);
    expandedItem.addEventListener("click", closeExpandedItem); document.body.appendChild(expandedItem);
    document.querySelectorAll(".item").forEach((element) => { if (element !== item) gsap.to(element, { opacity: 0, duration: settings.overlayEaseDuration, ease: "power2.inOut" }); });
    const targetWidth = innerWidth * settings.expandedScale, targetHeight = targetWidth * height / width, duration = reducedMotion ? 0 : settings.zoomDuration;
    gsap.to(overlay, { opacity: settings.overlayOpacity, duration, ease: "power2.inOut" });
    gsap.fromTo(expandedItem, { x: rect.left + width / 2 - innerWidth / 2, y: rect.top + height / 2 - innerHeight / 2 }, { width: targetWidth, height: targetHeight, x: 0, y: 0, duration, ease: "power3.inOut" });
  }

  function closeExpandedItem() {
    if (!expandedItem || !originalPosition) return;
    const { rect, width, height } = originalPosition, duration = reducedMotion ? 0 : settings.zoomDuration;
    gsap.to(overlay, { opacity: 0, duration, ease: "power2.inOut" });
    document.querySelectorAll(".item").forEach((element) => gsap.to(element, { opacity: 1, duration: settings.overlayEaseDuration, ease: "power2.inOut" }));
    gsap.to(expandedItem, { width, height, x: rect.left + width / 2 - innerWidth / 2, y: rect.top + height / 2 - innerHeight / 2, duration, ease: "power3.inOut", onComplete: () => { expandedItem?.remove(); expandedItem = null; overlay.classList.remove("active"); isExpanded = false; activeItemId = null; originalPosition = null; canDrag = true; container.style.cursor = "grab"; updateVisibleItems(); } });
  }

  function animate() {
    if (canDrag) {
      const ease = reducedMotion ? 1 : settings.dragEase;
      currentX += (targetX - currentX) * ease; currentY += (targetY - currentY) * ease;
      canvas.style.transform = `translate(${currentX}px, ${currentY}px)`;
      const now = Date.now();
      if (Math.hypot(currentX - lastX, currentY - lastY) > 100 || now - lastUpdate > 120) { updateVisibleItems(); lastX = currentX; lastY = currentY; lastUpdate = now; }
    }
    requestAnimationFrame(animate);
  }

  container.addEventListener("pointerdown", (event) => { if (!canDrag) return; isDragging = true; mouseHasMoved = false; startX = event.clientX; startY = event.clientY; container.style.cursor = "grabbing"; container.setPointerCapture(event.pointerId); });
  container.addEventListener("pointermove", (event) => { if (!isDragging || !canDrag) return; const dx = event.clientX - startX, dy = event.clientY - startY; if (Math.abs(dx) > 5 || Math.abs(dy) > 5) mouseHasMoved = true; const now = Date.now(), elapsed = Math.max(10, now - lastDragTime); lastDragTime = now; velocityX = dx / elapsed; velocityY = dy / elapsed; targetX += dx; targetY += dy; startX = event.clientX; startY = event.clientY; });
  function endDrag(event) { if (!isDragging) return; isDragging = false; container.style.cursor = canDrag ? "grab" : "auto"; if (canDrag && (Math.abs(velocityX) > .1 || Math.abs(velocityY) > .1)) { targetX += velocityX * settings.momentumFactor; targetY += velocityY * settings.momentumFactor; } if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId); setTimeout(() => { mouseHasMoved = false; }, 0); }
  container.addEventListener("pointerup", endDrag); container.addEventListener("pointercancel", endDrag);
  overlay.addEventListener("click", closeExpandedItem);
  addEventListener("keydown", (event) => { if (event.key === "Escape") closeExpandedItem(); });
  addEventListener("resize", () => { if (!isExpanded) rebuildGrid(); }, { passive: true });
  setLayout(); updateVisibleItems(); animate();
})();
