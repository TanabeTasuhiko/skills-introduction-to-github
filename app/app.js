/**
 * 連続スクショ PDF Maker
 * - Screen Capture API で画面共有 → 連続スクショ
 * - クリップボード貼り付け / ファイルドロップ / ファイル選択 にも対応
 * - ドラッグ&ドロップで並び替え
 * - jsPDF で1つのPDFにまとめて出力
 */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────
  const state = {
    screenshots: [],   // { id, dataUrl, width, height, timestamp }
    stream: null,       // MediaStream
    autoTimer: null,
    nextId: 1,
    // Page-turn detection
    detectActive: false,
    detectRAF: null,
    detectPrevFrame: null,   // ImageData (downscaled)
    detectCooldownUntil: 0,
    detectCount: 0,
    detectPhase: 'idle',     // idle | change_detected | settling
    detectSettleStart: 0,
    monitorVisible: false,
  };

  // ─── DOM refs ───────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const btnStartCapture   = $('#btn-start-capture');
  const btnTakeScreenshot  = $('#btn-take-screenshot');
  const btnStopCapture     = $('#btn-stop-capture');
  const btnPasteImage      = $('#btn-paste-image');
  const btnLoadFiles       = $('#btn-load-files');
  const btnClearAll        = $('#btn-clear-all');
  const btnExportPdf       = $('#btn-export-pdf');
  const fileInput          = $('#file-input');
  const gallery            = $('#gallery');
  const emptyState         = $('#empty-state');
  const pageCount          = $('#page-count');
  const statusText         = $('#status-text');
  const captureStatus      = $('#capture-status');
  const videoPreview       = $('#video-preview');
  const captureCanvas      = $('#capture-canvas');
  const dropOverlay        = $('#drop-overlay');
  const pageSizeSelect     = $('#page-size');
  const imageFitSelect     = $('#image-fit');
  const imageQualitySelect = $('#image-quality');
  const autoCaptureCheck   = $('#auto-capture');
  const autoIntervalInput  = $('#auto-interval');
  // Page-turn detection
  const pageDetectCheck    = $('#page-detect');
  const detectSensitivity  = $('#detect-sensitivity');
  const detectSensVal      = $('#detect-sensitivity-val');
  const detectSettle       = $('#detect-settle');
  const detectCooldown     = $('#detect-cooldown');
  const detectRegion       = $('#detect-region');
  const btnDetectPreview   = $('#btn-detect-preview');
  const detectStatusBadge  = $('#detect-status-badge');
  const detectMonitor      = $('#detect-monitor');
  const btnCloseMonitor    = $('#btn-close-monitor');
  const detectCanvas       = $('#detect-canvas');
  const monitorPrevCanvas  = $('#monitor-prev');
  const monitorDiffCanvas  = $('#monitor-diff');
  const monitorDiffPct     = $('#monitor-diff-pct');
  const monitorThreshold   = $('#monitor-threshold');
  const monitorState       = $('#monitor-state');
  const monitorCountEl     = $('#monitor-count');
  const monitorDiffBar     = $('#monitor-diff-bar');
  const monitorThreshLine  = $('#monitor-threshold-line');

  // ─── Screen Capture ─────────────────────────────────────
  async function startCapture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
      state.stream = stream;
      videoPreview.srcObject = stream;

      // If user stops sharing via browser UI
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopCapture();
      });

      btnStartCapture.disabled = true;
      btnTakeScreenshot.disabled = false;
      btnStopCapture.disabled = false;
      captureStatus.classList.remove('hidden');
      setStatus('画面キャプチャ中 — Spaceキーでスクショ撮影');

      // Start auto-capture if checked
      if (autoCaptureCheck.checked) {
        startAutoCapture();
      }
      // Start page-turn detection if checked
      if (pageDetectCheck.checked) {
        startDetection();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setStatus('キャプチャ開始に失敗: ' + err.message);
      }
    }
  }

  function stopCapture() {
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }
    videoPreview.srcObject = null;
    btnStartCapture.disabled = false;
    btnTakeScreenshot.disabled = true;
    btnStopCapture.disabled = true;
    captureStatus.classList.add('hidden');
    stopAutoCapture();
    stopDetection();
    setStatus('キャプチャ停止');
  }

  function takeScreenshot() {
    if (!state.stream) return;
    const track = state.stream.getVideoTracks()[0];
    const settings = track.getSettings();
    const w = settings.width;
    const h = settings.height;
    captureCanvas.width = w;
    captureCanvas.height = h;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(videoPreview, 0, 0, w, h);
    const quality = parseFloat(imageQualitySelect.value);
    const dataUrl = captureCanvas.toDataURL('image/jpeg', quality);
    addScreenshot(dataUrl, w, h);
    setStatus(`スクショ #${state.screenshots.length} を撮影しました`);
  }

  // ─── Auto Capture ───────────────────────────────────────
  function startAutoCapture() {
    stopAutoCapture();
    const sec = Math.max(1, parseInt(autoIntervalInput.value, 10) || 3);
    state.autoTimer = setInterval(() => {
      if (state.stream) {
        takeScreenshot();
      }
    }, sec * 1000);
    setStatus(`自動キャプチャ: ${sec}秒間隔`);
  }

  function stopAutoCapture() {
    if (state.autoTimer) {
      clearInterval(state.autoTimer);
      state.autoTimer = null;
    }
  }

  autoCaptureCheck.addEventListener('change', () => {
    if (autoCaptureCheck.checked && state.stream) {
      startAutoCapture();
    } else {
      stopAutoCapture();
    }
  });

  autoIntervalInput.addEventListener('change', () => {
    if (autoCaptureCheck.checked && state.stream) {
      startAutoCapture();
    }
  });

  // ─── Page-Turn Detection ───────────────────────────────
  const DETECT_SCALE = 160; // Downscale width for comparison (perf)

  function startDetection() {
    if (!state.stream) return;
    state.detectActive = true;
    state.detectPrevFrame = null;
    state.detectCount = 0;
    state.detectPhase = 'idle';
    state.detectCooldownUntil = 0;
    detectStatusBadge.classList.remove('hidden');
    detectStatusBadge.classList.add('active');
    detectStatusBadge.textContent = '検知ON';
    btnDetectPreview.disabled = false;
    setStatus('ページめくり検知: ON — 電子書籍のページをめくると自動撮影します');
    detectLoop();
  }

  function stopDetection() {
    state.detectActive = false;
    if (state.detectRAF) {
      cancelAnimationFrame(state.detectRAF);
      state.detectRAF = null;
    }
    state.detectPrevFrame = null;
    detectStatusBadge.classList.add('hidden');
    detectStatusBadge.classList.remove('active');
    btnDetectPreview.disabled = true;
  }

  function detectLoop() {
    if (!state.detectActive || !state.stream) return;

    state.detectRAF = requestAnimationFrame(() => {
      processDetectionFrame();
      // Run at ~10fps for efficiency
      setTimeout(() => detectLoop(), 100);
    });
  }

  function processDetectionFrame() {
    if (!state.stream) return;
    const track = state.stream.getVideoTracks()[0];
    if (!track) return;
    const settings = track.getSettings();
    const srcW = settings.width;
    const srcH = settings.height;
    if (!srcW || !srcH) return;

    // Downscale for comparison
    const scale = DETECT_SCALE / srcW;
    const dw = DETECT_SCALE;
    const dh = Math.round(srcH * scale);

    detectCanvas.width = dw;
    detectCanvas.height = dh;
    const ctx = detectCanvas.getContext('2d', { willReadFrequently: true });

    // Determine detection region
    const region = detectRegion.value;
    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (region === 'center') {
      // Center 60%
      const marginX = srcW * 0.2;
      const marginY = srcH * 0.2;
      sx = marginX;
      sy = marginY;
      sw = srcW * 0.6;
      sh = srcH * 0.6;
    }

    ctx.drawImage(videoPreview, sx, sy, sw, sh, 0, 0, dw, dh);
    const currentFrame = ctx.getImageData(0, 0, dw, dh);

    const now = performance.now();
    const threshold = parseInt(detectSensitivity.value, 10) / 100;
    const settleMs = parseInt(detectSettle.value, 10) || 500;
    const cooldownMs = parseInt(detectCooldown.value, 10) || 1000;

    if (state.detectPrevFrame) {
      const diff = computeFrameDiff(state.detectPrevFrame, currentFrame);

      // Update monitor if visible
      if (state.monitorVisible) {
        updateMonitor(state.detectPrevFrame, currentFrame, diff, dw, dh);
      }

      // State machine for detection
      switch (state.detectPhase) {
        case 'idle':
          if (diff > threshold && now > state.detectCooldownUntil) {
            // Big change detected — page might be turning
            state.detectPhase = 'change_detected';
            state.detectSettleStart = now;
            updateDetectMonitorState('変化検出...');
          }
          break;

        case 'change_detected':
          if (diff > threshold * 0.3) {
            // Still changing (animation in progress), reset settle timer
            state.detectSettleStart = now;
          }
          if (now - state.detectSettleStart > settleMs) {
            // Page has settled — capture!
            state.detectPhase = 'idle';
            state.detectCooldownUntil = now + cooldownMs;
            state.detectCount++;
            takeScreenshot();
            updateDetectMonitorState('撮影完了!');
            if (monitorCountEl) monitorCountEl.textContent = state.detectCount;
            setStatus(`ページめくり検知: #${state.detectCount} 自動撮影 (${state.screenshots.length}ページ目)`);
            // After capture, mark current frame as new baseline
            state.detectPrevFrame = currentFrame;
            return;
          }
          break;
      }
    }

    state.detectPrevFrame = currentFrame;
  }

  function computeFrameDiff(prev, curr) {
    const len = prev.data.length;
    let totalDiff = 0;
    let pixelCount = 0;
    // Sample every 4th pixel for performance
    for (let i = 0; i < len; i += 16) {
      const dr = Math.abs(prev.data[i] - curr.data[i]);
      const dg = Math.abs(prev.data[i + 1] - curr.data[i + 1]);
      const db = Math.abs(prev.data[i + 2] - curr.data[i + 2]);
      // A pixel is "changed" if average channel diff > 30
      if ((dr + dg + db) / 3 > 30) {
        totalDiff++;
      }
      pixelCount++;
    }
    return totalDiff / pixelCount; // ratio 0..1
  }

  function updateMonitor(prevFrame, currFrame, diff, dw, dh) {
    // Draw previous frame
    const prevCtx = monitorPrevCanvas.getContext('2d');
    monitorPrevCanvas.width = dw;
    monitorPrevCanvas.height = dh;
    prevCtx.putImageData(prevFrame, 0, 0);

    // Draw diff heatmap
    const diffCtx = monitorDiffCanvas.getContext('2d');
    monitorDiffCanvas.width = dw;
    monitorDiffCanvas.height = dh;
    const diffImg = diffCtx.createImageData(dw, dh);
    for (let i = 0; i < prevFrame.data.length; i += 4) {
      const dr = Math.abs(prevFrame.data[i] - currFrame.data[i]);
      const dg = Math.abs(prevFrame.data[i + 1] - currFrame.data[i + 1]);
      const db = Math.abs(prevFrame.data[i + 2] - currFrame.data[i + 2]);
      const avg = (dr + dg + db) / 3;
      // Heatmap: green(low) → yellow(mid) → red(high)
      const intensity = Math.min(avg * 4, 255);
      diffImg.data[i] = intensity;                          // R
      diffImg.data[i + 1] = Math.max(0, 255 - intensity);  // G
      diffImg.data[i + 2] = 0;                              // B
      diffImg.data[i + 3] = Math.max(intensity, 40);        // A
    }
    diffCtx.putImageData(diffImg, 0, 0);

    // Update text
    const pct = (diff * 100).toFixed(1);
    const thresholdVal = parseInt(detectSensitivity.value, 10);
    monitorDiffPct.textContent = pct + '%';
    monitorThreshold.textContent = thresholdVal + '%';
    monitorDiffBar.style.width = Math.min(parseFloat(pct), 100) + '%';
    monitorThreshLine.style.left = thresholdVal + '%';
    monitorCountEl.textContent = state.detectCount;

    // Color the percentage based on threshold
    if (diff * 100 > thresholdVal) {
      monitorDiffPct.style.color = '#e94560';
    } else {
      monitorDiffPct.style.color = '#7ec8e3';
    }
  }

  function updateDetectMonitorState(text) {
    if (monitorState) monitorState.textContent = text;
  }

  // Detection UI events
  pageDetectCheck.addEventListener('change', () => {
    if (pageDetectCheck.checked && state.stream) {
      startDetection();
    } else {
      stopDetection();
    }
  });

  detectSensitivity.addEventListener('input', () => {
    detectSensVal.textContent = detectSensitivity.value;
  });

  btnDetectPreview.addEventListener('click', () => {
    state.monitorVisible = !state.monitorVisible;
    detectMonitor.classList.toggle('hidden', !state.monitorVisible);
  });

  btnCloseMonitor.addEventListener('click', () => {
    state.monitorVisible = false;
    detectMonitor.classList.add('hidden');
  });

  // ─── Screenshot Management ─────────────────────────────
  function addScreenshot(dataUrl, width, height) {
    const item = {
      id: state.nextId++,
      dataUrl,
      width,
      height,
      timestamp: new Date(),
    };
    state.screenshots.push(item);
    renderCard(item);
    updateUI();
  }

  function removeScreenshot(id) {
    state.screenshots = state.screenshots.filter((s) => s.id !== id);
    const card = document.querySelector(`[data-id="${id}"]`);
    if (card) card.remove();
    updateUI();
  }

  function moveScreenshot(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const [item] = state.screenshots.splice(fromIndex, 1);
    state.screenshots.splice(toIndex, 0, item);
    rerenderGallery();
  }

  function clearAll() {
    if (state.screenshots.length === 0) return;
    if (!confirm(`${state.screenshots.length}ページすべて削除しますか？`)) return;
    state.screenshots = [];
    rerenderGallery();
    updateUI();
    setStatus('全ページを削除しました');
  }

  // ─── Rendering ──────────────────────────────────────────
  function renderCard(item) {
    emptyState.style.display = 'none';
    const index = state.screenshots.indexOf(item);
    const card = document.createElement('div');
    card.className = 'screenshot-card';
    card.dataset.id = item.id;
    card.draggable = true;

    const timeStr = item.timestamp.toLocaleTimeString('ja-JP');

    card.innerHTML = `
      <img class="card-image" src="${item.dataUrl}" alt="Page ${index + 1}" loading="lazy" />
      <div class="card-footer">
        <span class="page-number">#${index + 1}</span>
        <span class="card-timestamp">${timeStr}</span>
        <div class="card-actions">
          <button class="preview-btn" title="拡大プレビュー">🔍</button>
          <button class="move-up-btn" title="前へ移動">⬆</button>
          <button class="move-down-btn" title="後ろへ移動">⬇</button>
          <button class="delete-btn" title="削除">✕</button>
        </div>
      </div>
    `;

    // Card events
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeScreenshot(item.id);
    });

    card.querySelector('.preview-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showLightbox(item.dataUrl);
    });

    card.querySelector('.move-up-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = state.screenshots.findIndex((s) => s.id === item.id);
      if (idx > 0) moveScreenshot(idx, idx - 1);
    });

    card.querySelector('.move-down-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = state.screenshots.findIndex((s) => s.id === item.id);
      if (idx < state.screenshots.length - 1) moveScreenshot(idx, idx + 1);
    });

    // Drag & Drop for reordering
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', item.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.drag-over').forEach((el) =>
        el.classList.remove('drag-over')
      );
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (isNaN(draggedId)) return;
      const fromIdx = state.screenshots.findIndex((s) => s.id === draggedId);
      const toIdx = state.screenshots.findIndex((s) => s.id === item.id);
      if (fromIdx !== -1 && toIdx !== -1) {
        moveScreenshot(fromIdx, toIdx);
      }
    });

    gallery.appendChild(card);
  }

  function rerenderGallery() {
    // Remove all cards
    gallery.querySelectorAll('.screenshot-card').forEach((el) => el.remove());
    if (state.screenshots.length === 0) {
      emptyState.style.display = '';
    } else {
      emptyState.style.display = 'none';
      state.screenshots.forEach((item) => renderCard(item));
    }
    updateUI();
  }

  function updateUI() {
    const count = state.screenshots.length;
    pageCount.textContent = `${count} ページ`;
    btnClearAll.disabled = count === 0;
    btnExportPdf.disabled = count === 0;
  }

  // ─── Lightbox ───────────────────────────────────────────
  function showLightbox(dataUrl) {
    let lightbox = document.querySelector('.lightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.className = 'lightbox hidden';
      lightbox.innerHTML = '<img />';
      lightbox.addEventListener('click', () => lightbox.classList.add('hidden'));
      document.body.appendChild(lightbox);
    }
    lightbox.querySelector('img').src = dataUrl;
    lightbox.classList.remove('hidden');
  }

  // ─── Clipboard Paste ───────────────────────────────────
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        loadImageBlob(blob);
      }
    }
  }

  // ─── File Loading ───────────────────────────────────────
  function loadImageBlob(blob) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        addScreenshot(reader.result, img.naturalWidth, img.naturalHeight);
        setStatus('画像を追加しました');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(blob);
  }

  function loadFiles(files) {
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        loadImageBlob(file);
      }
    }
  }

  // ─── Drag & Drop (file import) ─────────────────────────
  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (e.dataTransfer?.types?.includes('Files')) {
      dropOverlay.classList.remove('hidden');
    }
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropOverlay.classList.add('hidden');
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.classList.add('hidden');
    if (e.dataTransfer?.files?.length) {
      loadFiles(e.dataTransfer.files);
    }
  });

  // ─── PDF Export ─────────────────────────────────────────
  async function exportPDF() {
    if (state.screenshots.length === 0) return;

    const { jsPDF } = window.jspdf;
    const pageSizeVal = pageSizeSelect.value;
    const fitMode = imageFitSelect.value;

    // Show progress
    let overlay = document.querySelector('.progress-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'progress-overlay hidden';
      overlay.innerHTML = `
        <div class="progress-text">PDF生成中...</div>
        <div class="progress-bar-container">
          <div class="progress-bar"></div>
        </div>
        <div class="progress-text" id="progress-detail"></div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden');
    const progressBar = overlay.querySelector('.progress-bar');
    const progressDetail = overlay.querySelector('#progress-detail');

    // Small delay so the overlay renders
    await sleep(50);

    try {
      // Determine first page dimensions for "fit" mode
      const firstImg = state.screenshots[0];

      let pdf;
      if (pageSizeVal === 'fit') {
        // Each page matches image dimensions in pt (1px ≈ 0.75pt)
        const pxToPt = 72 / 96;
        const w = firstImg.width * pxToPt;
        const h = firstImg.height * pxToPt;
        pdf = new jsPDF({
          orientation: w > h ? 'landscape' : 'portrait',
          unit: 'pt',
          format: [w, h],
        });
      } else {
        pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: pageSizeVal,
        });
      }

      for (let i = 0; i < state.screenshots.length; i++) {
        const ss = state.screenshots[i];
        const pct = Math.round(((i + 1) / state.screenshots.length) * 100);
        progressBar.style.width = pct + '%';
        progressDetail.textContent = `${i + 1} / ${state.screenshots.length} ページ`;

        if (i > 0) {
          if (pageSizeVal === 'fit') {
            const pxToPt = 72 / 96;
            const w = ss.width * pxToPt;
            const h = ss.height * pxToPt;
            pdf.addPage([w, h], w > h ? 'landscape' : 'portrait');
          } else {
            pdf.addPage();
          }
        }

        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const imgAspect = ss.width / ss.height;
        const pageAspect = pageW / pageH;

        let drawX = 0, drawY = 0, drawW = pageW, drawH = pageH;

        if (fitMode === 'contain') {
          if (imgAspect > pageAspect) {
            drawW = pageW;
            drawH = pageW / imgAspect;
            drawY = (pageH - drawH) / 2;
          } else {
            drawH = pageH;
            drawW = pageH * imgAspect;
            drawX = (pageW - drawW) / 2;
          }
        } else if (fitMode === 'cover') {
          if (imgAspect > pageAspect) {
            drawH = pageH;
            drawW = pageH * imgAspect;
            drawX = (pageW - drawW) / 2;
          } else {
            drawW = pageW;
            drawH = pageW / imgAspect;
            drawY = (pageH - drawH) / 2;
          }
        }
        // 'stretch' uses full page by default (drawX=0, drawY=0, drawW=pageW, drawH=pageH)

        pdf.addImage(ss.dataUrl, 'JPEG', drawX, drawY, drawW, drawH);

        // Yield to keep UI responsive
        if (i % 10 === 0) await sleep(0);
      }

      const timestamp = formatTimestamp(new Date());
      pdf.save(`screenshots_${timestamp}.pdf`);
      setStatus(`PDF (${state.screenshots.length}ページ) を保存しました`);
    } catch (err) {
      setStatus('PDF生成エラー: ' + err.message);
      console.error(err);
    } finally {
      overlay.classList.add('hidden');
    }
  }

  // ─── Utilities ──────────────────────────────────────────
  function setStatus(text) {
    statusText.textContent = text;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function formatTimestamp(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  // ─── Event Bindings ────────────────────────────────────
  btnStartCapture.addEventListener('click', startCapture);
  btnTakeScreenshot.addEventListener('click', takeScreenshot);
  btnStopCapture.addEventListener('click', stopCapture);
  btnPasteImage.addEventListener('click', () => {
    // Attempt to read clipboard
    if (navigator.clipboard && navigator.clipboard.read) {
      navigator.clipboard.read().then((items) => {
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              item.getType(type).then((blob) => loadImageBlob(blob));
            }
          }
        }
      }).catch(() => {
        setStatus('クリップボードの読み取りに失敗しました。Ctrl+V で貼り付けてください。');
      });
    } else {
      setStatus('Ctrl+V で画像を貼り付けてください');
    }
  });
  btnLoadFiles.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      loadFiles(fileInput.files);
      fileInput.value = '';
    }
  });
  btnClearAll.addEventListener('click', clearAll);
  btnExportPdf.addEventListener('click', exportPDF);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Space = take screenshot (when capturing)
    if (e.code === 'Space' && state.stream && !e.target.matches('input, select, textarea')) {
      e.preventDefault();
      takeScreenshot();
    }
    // Escape = close lightbox
    if (e.code === 'Escape') {
      const lb = document.querySelector('.lightbox');
      if (lb) lb.classList.add('hidden');
    }
  });

  // Paste
  document.addEventListener('paste', handlePaste);

  // ─── Init ──────────────────────────────────────────────
  setStatus('待機中 — 「画面キャプチャ開始」で始めてください');
})();
