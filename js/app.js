// app.js — semua logika JavaScript untuk Life Dashboard

// =============================================================================
// Storage — abstraksi tipis di atas localStorage dengan penanganan error terpusat
// =============================================================================

// NOTE: Storage.KEYS diperluas di bawah untuk THEME dan USER_NAME.

const Storage = {
  KEYS: {
    TASKS:     'dashboard_tasks',
    LINKS:     'dashboard_links',
    THEME:     'dashboard_theme',
    USER_NAME: 'dashboard_user_name',
  },

  /**
   * Cek apakah localStorage tersedia di browser saat ini.
   * Melakukan test-write dan test-delete untuk mendeteksi mode private
   * atau browser yang tidak mendukung localStorage.
   * @returns {boolean} true jika localStorage dapat digunakan, false jika tidak
   */
  isAvailable() {
    const testKey = '__storage_test__';
    try {
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Simpan data ke localStorage dengan serialisasi JSON.
   * Menangkap SecurityError (mode private) dan QuotaExceededError (storage penuh).
   * @param {string} key   - Kunci localStorage (gunakan Storage.KEYS)
   * @param {*}      data  - Data yang akan disimpan (akan di-stringify ke JSON)
   */
  save(key, data) {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);
    } catch (e) {
      if (e instanceof DOMException) {
        // SecurityError: akses localStorage diblokir (contoh: mode private/iframe)
        // QuotaExceededError: storage penuh
        console.warn(`[Storage] Gagal menyimpan data dengan key "${key}":`, e.name, e.message);
      } else {
        console.warn(`[Storage] Error tidak terduga saat menyimpan key "${key}":`, e);
      }
    }
  },

  /**
   * Muat data dari localStorage dengan deserialisasi JSON.
   * Mengembalikan null jika key tidak ditemukan atau JSON tidak valid.
   * @param {string} key - Kunci localStorage (gunakan Storage.KEYS)
   * @returns {*|null}   - Data yang tersimpan, atau null jika tidak ada / gagal parse
   */
  load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[Storage] Gagal memuat data dengan key "${key}":`, e.message);
      return null;
    }
  },
};

// =============================================================================
// GreetingWidget — jam digital, tanggal dalam Bahasa Indonesia, dan salam waktu
// =============================================================================

const GreetingWidget = {
  /** Nama hari dalam Bahasa Indonesia, diindeks dari 0 (Minggu) s.d. 6 (Sabtu). */
  DAYS: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],

  /** Nama bulan dalam Bahasa Indonesia, diindeks dari 0 (Januari) s.d. 11 (Desember). */
  MONTHS: [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ],

  /**
   * Format objek Date menjadi string jam "HH:MM" (tanpa detik) dengan zero-padding.
   * @param {Date} date - Objek Date yang valid
   * @returns {string} Contoh: "09:05"
   */
  formatTime(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  },

  /**
   * Format objek Date menjadi string tanggal dalam Bahasa Indonesia.
   * @param {Date} date - Objek Date yang valid
   * @returns {string} Contoh: "Kamis, 16 Oktober 2026"
   */
  formatDate(date) {
    const dayName   = this.DAYS[date.getDay()];
    const dayNum    = date.getDate();
    const monthName = this.MONTHS[date.getMonth()];
    const year      = date.getFullYear();
    return `${dayName}, ${dayNum} ${monthName} ${year}`;
  },

  /**
   * Tentukan salam berdasarkan jam (0–23).
   * - 05–11 → "Selamat Pagi"
   * - 12–17 → "Selamat Siang"
   * - 18–20 → "Selamat Sore"
   * - 21–23 atau 00–04 → "Selamat Malam"
   * @param {number} hour - Jam dalam format 24 jam (0–23)
   * @returns {string} Teks salam
   */
  getGreeting(hour) {
    if (hour >= 5 && hour <= 11) return 'Selamat Pagi';
    if (hour >= 12 && hour <= 17) return 'Selamat Siang';
    if (hour >= 18 && hour <= 20) return 'Selamat Sore';
    return 'Selamat Malam';
  },

  /**
   * Perbarui elemen DOM #clock, #date, dan #greeting dengan waktu saat ini.
   * Jika tanggal tidak valid atau terjadi error, tampilkan nilai fallback.
   */
  update() {
    try {
      const date = new Date();

      if (isNaN(date.getTime())) {
        document.getElementById('clock').textContent    = '--:--';
        document.getElementById('greeting').textContent = 'Halo,';
        return;
      }

      document.getElementById('clock').textContent    = this.formatTime(date);
      document.getElementById('date').textContent     = this.formatDate(date);
      document.getElementById('greeting').textContent = this.getGreeting(date.getHours()) + ',';
    } catch (e) {
      console.warn('[GreetingWidget] Error saat memperbarui tampilan:', e);
      document.getElementById('clock').textContent    = '--:--';
      document.getElementById('greeting').textContent = 'Halo,';
    }
  },

  /**
   * Inisialisasi widget: panggil update() sekali langsung, lalu setiap 1 detik.
   */
  init() {
    this.update();
    setInterval(() => this.update(), 1000);
  },
};

// GreetingWidget.init() dipanggil oleh App.init() via DOMContentLoaded

// =============================================================================
// FocusTimer — hitung-mundur 25 menit (Pomodoro) dengan tombol Start/Stop/Reset
// =============================================================================

const FocusTimer = {
  /** Durasi awal dalam detik: 25 menit × 60 = 1500 detik. */
  DURATION_SECONDS: 1500,

  /** State internal timer. Tidak dipersist ke LocalStorage. */
  state: {
    remaining: 1500,   // detik tersisa
    isRunning: false,  // apakah timer sedang berjalan
    intervalId: null,  // ID dari setInterval, atau null jika idle
  },

  /**
   * Format detik menjadi string "MM:SS" dengan zero-padding.
   * @param {number} seconds - Jumlah detik (0–1500)
   * @returns {string} Contoh: 90 → "01:30", 1500 → "25:00", 0 → "00:00"
   */
  formatTime(seconds) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  },

  /**
   * Perbarui tampilan DOM sesuai state timer saat ini.
   * - Sinkronisasi ke kedua view (home dan focused).
   */
  render() {
    const display  = document.getElementById('timer-display');
    const btnStart = document.getElementById('timer-start');
    const btnStop  = document.getElementById('timer-stop');
    const btnReset = document.getElementById('timer-reset');
    const ringProgress = document.querySelector('.timer-ring-progress:not(.timer-ring-progress--large)');

    if (display) display.textContent = this.formatTime(this.state.remaining);
    if (btnStart) btnStart.disabled = this.state.isRunning;
    if (btnStop)  btnStop.disabled  = !this.state.isRunning;
    if (btnReset) btnReset.disabled = false;

    // Animasi cincin home view (circumference 326.7 untuk r=52)
    if (ringProgress) {
      const fraction = this.state.remaining / this.DURATION_SECONDS;
      ringProgress.style.strokeDashoffset = 326.7 * (1 - fraction);
    }

    // Sync focused view
    this.syncFocused();
  },

  /**
   * Sinkronisasi state timer ke focused view (#view-timer).
   */
  syncFocused() {
    const displayF  = document.getElementById('timer-display-f');
    const statusF   = document.getElementById('timer-status-f');
    const btnStartF = document.getElementById('timer-start-f');
    const btnStopF  = document.getElementById('timer-stop-f');
    const btnResetF = document.getElementById('timer-reset-f');
    const ringLarge = document.querySelector('.timer-ring-progress--large');

    if (displayF) displayF.textContent = this.formatTime(this.state.remaining);
    if (statusF)  {
      statusF.textContent = document.getElementById('timer-status')?.textContent || 'Ready';
      statusF.className   = document.getElementById('timer-status')?.className || '';
    }
    if (btnStartF) btnStartF.disabled = this.state.isRunning;
    if (btnStopF)  btnStopF.disabled  = !this.state.isRunning;
    if (btnResetF) btnResetF.disabled = false;

    // Animasi cincin focused view (circumference 439.6 untuk r=70)
    if (ringLarge) {
      const fraction = this.state.remaining / this.DURATION_SECONDS;
      ringLarge.style.strokeDashoffset = 439.6 * (1 - fraction);
    }
  },

  /**
   * Satu langkah hitung-mundur: kurangi remaining sebesar 1.
   * Jika remaining sudah 0, panggil onComplete(). Selain itu, render ulang.
   */
  tick() {
    this.state.remaining -= 1;
    if (this.state.remaining <= 0) {
      this.state.remaining = 0;
      this.onComplete();
    } else {
      this.render();
    }
  },

  /**
   * Mulai hitung-mundur jika timer belum berjalan.
   * Set isRunning = true, simpan intervalId, render ulang.
   */
  start() {
    if (this.state.isRunning) return;
    this.state.isRunning  = true;
    this.state.intervalId = setInterval(() => this.tick(), 1000);
    this.render();
  },

  /**
   * Hentikan hitung-mundur pada posisi saat ini.
   * Bersihkan interval, set isRunning = false, render ulang.
   */
  stop() {
    if (this.state.intervalId !== null) {
      clearInterval(this.state.intervalId);
      this.state.intervalId = null;
    }
    this.state.isRunning = false;
    this.render();
  },

  /**
   * Atur ulang timer ke durasi awal (1500 detik).
   */
  reset() {
    this.stop();
    this.state.remaining = this.DURATION_SECONDS;
    const status = document.getElementById('timer-status');
    if (status) {
      status.textContent = 'Ready';
      status.classList.remove('timer-done');
    }
    this.render();
  },

  /**
   * Dipanggil saat hitung-mundur mencapai 00:00.
   * Hentikan timer, tampilkan teks "Sesi Selesai!", mainkan suara notifikasi.
   */
  onComplete() {
    this.stop();
    const status = document.getElementById('timer-status');
    if (status) {
      status.textContent = 'Sesi Selesai!';
      status.classList.add('timer-done');
    }
    this._playBeep();
  },

  /**
   * Mainkan nada beep 440 Hz selama ~0.5 detik menggunakan AudioContext.
   * Diam tanpa error jika AudioContext tidak didukung browser.
   * @private
   */
  _playBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx        = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode   = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type            = 'sine';
      oscillator.frequency.value = 440; // Hz

      // Fade-out halus untuk menghindari klik audio yang tajam
      gainNode.gain.setValueAtTime(1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);

      // Tutup AudioContext setelah selesai untuk membebaskan sumber daya
      oscillator.onended = () => ctx.close();
    } catch (e) {
      // Browser tidak mendukung AudioContext atau autoplay diblokir — abaikan
      console.warn('[FocusTimer] Tidak dapat memainkan notifikasi audio:', e.message);
    }
  },

  init() {
    this.render();
    document.getElementById('timer-start').addEventListener('click', () => this.start());
    document.getElementById('timer-stop').addEventListener('click',  () => this.stop());
    document.getElementById('timer-reset').addEventListener('click', () => this.reset());

    // Focused view buttons (delegate to same methods)
    const startF = document.getElementById('timer-start-f');
    const stopF  = document.getElementById('timer-stop-f');
    const resetF = document.getElementById('timer-reset-f');
    if (startF) startF.addEventListener('click', () => this.start());
    if (stopF)  stopF.addEventListener('click',  () => this.stop());
    if (resetF) resetF.addEventListener('click', () => this.reset());
  },
};

// FocusTimer.init() dipanggil oleh App.init() via DOMContentLoaded

// =============================================================================
// TodoList — pengelola daftar tugas dengan CRUD dan persistensi Local Storage
// =============================================================================

const TodoList = {
  /** Array Task in-memory. Diisi oleh load() saat init. */
  tasks: [],

  /** ID task yang sedang dalam mode edit, atau null jika tidak ada. */
  editingId: null,

  /** Filter aktif: 'all' | 'active' | 'done' */
  currentFilter: 'all',

  /**
   * Buat ID unik untuk setiap task baru.
   * Menggunakan crypto.randomUUID() jika tersedia; fallback ke kombinasi
   * Date.now() dan Math.random() untuk lingkungan yang tidak mendukung.
   * @returns {string} String ID unik
   */
  _generateId() {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }
    // Fallback: timestamp + random number → string hex
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  },

  /**
   * Simpan seluruh array tasks ke Local Storage.
   * Memanggil Storage.save() dengan kunci TASKS.
   * Requirements: 3.9
   */
  save() {
    Storage.save(Storage.KEYS.TASKS, this.tasks);
  },

  /**
   * Muat array tasks dari Local Storage ke this.tasks.
   * Jika tidak ada data atau terjadi error, gunakan array kosong [].
   * Requirements: 3.10, 3.11
   */
  load() {
    const data = Storage.load(Storage.KEYS.TASKS);
    this.tasks = Array.isArray(data) ? data : [];
  },

  /**
   * Bangun ulang DOM daftar tugas berdasarkan this.tasks (home view).
   * Requirements: 3.3–3.8
   */
  render() {
    const list = document.getElementById('todo-list');
    if (!list) return;

    const newList = list.cloneNode(false);
    const filter  = this.currentFilter || 'all';

    const filtered = this.tasks.filter((t) => {
      if (filter === 'active') return !t.done;
      if (filter === 'done')   return t.done;
      return true;
    });

    if (filtered.length === 0) {
      const placeholder = document.createElement('li');
      placeholder.className = 'todo-placeholder';
      placeholder.textContent = filter === 'all'
        ? 'Belum ada tugas. Tambahkan tugas baru!'
        : (filter === 'active' ? 'Tidak ada tugas aktif.' : 'Belum ada tugas yang selesai.');
      newList.appendChild(placeholder);
    } else {
      filtered.forEach((task) => {
        const li = this._buildTaskLi(task);
        newList.appendChild(li);
      });
    }

    newList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'toggle')      this.toggleTask(id);
      else if (action === 'edit')   this.editTask(id);
      else if (action === 'delete') this.deleteTask(id);
      else if (action === 'save-edit') {
        const editInput = btn.closest('li').querySelector('.todo-edit-input');
        this.saveEdit(id, editInput ? editInput.value : '');
      } else if (action === 'cancel-edit') this.cancelEdit(id);
    });

    list.parentNode.replaceChild(newList, list);

    // Sync focused view jika sedang aktif
    if (typeof SidebarNav !== 'undefined' && SidebarNav.currentView === 'todo') {
      this.renderFocused();
    }
  },

  /**
   * Bangun elemen <li> untuk satu task (dipakai oleh render & renderFocused).
   * @param {Object} task
   * @returns {HTMLLIElement}
   */
  _buildTaskLi(task) {
    const li = document.createElement('li');
    li.dataset.id = task.id;

    if (this.editingId === task.id) {
      // ── Mode edit ──────────────────────────────────────────────────────
      li.className = 'todo-item todo-item--editing';

      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'todo-edit-input';
      editInput.value = task.text;
      editInput.setAttribute('aria-label', 'Edit teks tugas');
      editInput.maxLength = 500;

      const btnSave = document.createElement('button');
      btnSave.type = 'button';
      btnSave.className = 'todo-btn todo-btn--save';
      btnSave.dataset.action = 'save-edit';
      btnSave.dataset.id = task.id;
      btnSave.setAttribute('aria-label', 'Simpan perubahan');
      btnSave.textContent = 'Simpan';

      const btnCancel = document.createElement('button');
      btnCancel.type = 'button';
      btnCancel.className = 'todo-btn todo-btn--cancel';
      btnCancel.dataset.action = 'cancel-edit';
      btnCancel.dataset.id = task.id;
      btnCancel.setAttribute('aria-label', 'Batal edit');
      btnCancel.textContent = 'Batal';

      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); this.saveEdit(task.id, editInput.value); }
        if (e.key === 'Escape') { e.preventDefault(); this.cancelEdit(task.id); }
      });

      li.appendChild(editInput);
      li.appendChild(btnSave);
      li.appendChild(btnCancel);

      setTimeout(() => {
        editInput.focus();
        editInput.setSelectionRange(editInput.value.length, editInput.value.length);
      }, 0);

    } else {
      // ── Mode tampil normal ─────────────────────────────────────────────
      li.className = 'todo-item' + (task.done ? ' todo-item--done' : '');

      const btnToggle = document.createElement('button');
      btnToggle.type = 'button';
      btnToggle.className = 'todo-btn todo-btn--toggle';
      btnToggle.dataset.action = 'toggle';
      btnToggle.dataset.id = task.id;
      btnToggle.setAttribute('aria-label', task.done ? 'Tandai belum selesai' : 'Tandai selesai');
      if (task.done) {
        btnToggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:12px;height:12px"><polyline points="20 6 9 17 4 12"/></svg>';
      }

      const textBlock = document.createElement('div');
      textBlock.className = 'todo-text-block';

      const span = document.createElement('span');
      span.className = 'todo-text' + (task.done ? ' done' : '');
      span.textContent = task.text;

      const metaEl = document.createElement('div');
      metaEl.className = 'todo-meta';
      if (task.createdAt) {
        const d = new Date(task.createdAt);
        const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
        const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        metaEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;vertical-align:middle;margin-right:2px" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${dateStr} · ${hh}:${mm}`;
      }

      textBlock.appendChild(span);
      textBlock.appendChild(metaEl);

      const badge = document.createElement('span');
      badge.className = 'todo-badge ' + (task.done ? 'todo-badge--done' : 'todo-badge--active');
      badge.textContent = task.done ? 'Selesai' : 'Aktif';

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'todo-btn todo-btn--edit';
      btnEdit.dataset.action = 'edit';
      btnEdit.dataset.id = task.id;
      btnEdit.setAttribute('aria-label', 'Edit tugas');
      btnEdit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:13px;height:13px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

      const btnDelete = document.createElement('button');
      btnDelete.type = 'button';
      btnDelete.className = 'todo-btn todo-btn--delete';
      btnDelete.dataset.action = 'delete';
      btnDelete.dataset.id = task.id;
      btnDelete.setAttribute('aria-label', 'Hapus tugas');
      btnDelete.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

      li.appendChild(btnToggle);
      li.appendChild(textBlock);
      li.appendChild(badge);
      li.appendChild(btnEdit);
      li.appendChild(btnDelete);
    }

    return li;
  },

  // ===========================================================================
  // CRUD Methods
  // ===========================================================================

  /**
   * Tambahkan task baru ke daftar.
   * Validasi teks: harus 1–500 karakter setelah trim().
   * - Tidak valid → tampilkan indikator error inline, jangan tambah task.
   * - Valid → buat Task baru, push ke array, simpan, render, kosongkan input.
   * Requirements: 3.1, 3.2
   * @param {string} text - Teks tugas dari input pengguna
   */
  addTask(text, fromFocused = false) {
    const trimmed = (text || '').trim();

    // Pick the right error/input elements depending on which view called this
    const errorEl = document.getElementById(fromFocused ? 'todo-error-f' : 'todo-error');
    const inputEl = document.getElementById(fromFocused ? 'todo-input-f' : 'todo-input');

    // Validasi panjang
    if (trimmed.length === 0 || trimmed.length > 500) {
      if (inputEl) inputEl.classList.add('input-error');
      if (errorEl) {
        errorEl.textContent = trimmed.length === 0
          ? 'Tugas tidak boleh kosong.'
          : 'Tugas tidak boleh lebih dari 500 karakter.';
      }
      return;
    }

    // Cek duplikat — case-insensitive
    const isDuplicate = this.tasks.some(
      (t) => t.text.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      if (inputEl) inputEl.classList.add('input-error');
      if (errorEl) errorEl.textContent = 'Tugas ini sudah ada dalam daftar.';
      return;
    }

    // Hapus indikator error
    if (inputEl) inputEl.classList.remove('input-error');
    if (errorEl) errorEl.textContent = '';

    const newTask = {
      id: this._generateId(),
      text: trimmed,
      done: false,
      createdAt: Date.now(),
    };

    this.tasks.push(newTask);
    this.save();
    this.render();
    this.renderFocused();

    if (inputEl) inputEl.value = '';
  },

  /**
   * Aktifkan mode edit pada task dengan id yang diberikan.
   * Menyetel editingId lalu render ulang.
   * Requirements: 3.3
   * @param {string} id - ID task yang akan diedit
   */
  editTask(id) {
    this.editingId = id;
    this.render();
  },

  saveEdit(id, text) {
    const trimmed = (text || '').trim();
    if (trimmed.length === 0 || trimmed.length > 500) return;
    const task = this.tasks.find((t) => t.id === id);
    if (task) task.text = trimmed;
    this.editingId = null;
    this.save();
    this.render();
    this.renderFocused();
  },

  cancelEdit(id) {
    this.editingId = null;
    this.render();
    this.renderFocused();
  },

  toggleTask(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (task) task.done = !task.done;
    this.save();
    this.render();
    this.renderFocused();
  },

  deleteTask(id) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.save();
    this.render();
    this.renderFocused();
  },

  /**
   * Inisialisasi widget TodoList:
   * Requirements: 3.10
   */
  init() {
    this.load();
    this.render();

    const inputEl  = document.getElementById('todo-input');
    const addBtn   = document.getElementById('todo-add');

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addTask(inputEl ? inputEl.value : '');
      });
    }

    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addTask(inputEl.value);
        }
      });
    }

    // Wire up focused view input (delegates to same addTask logic)
    const inputF = document.getElementById('todo-input-f');
    const addBtnF = document.getElementById('todo-add-f');

    if (addBtnF) {
      addBtnF.addEventListener('click', () => {
        this.addTask(inputF ? inputF.value : '', true);
      });
    }

    if (inputF) {
      inputF.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addTask(inputF.value, true);
        }
      });
    }

    // Filter tabs in focused view
    const focusedFilters = document.querySelectorAll('#view-todo .filter-tab');
    focusedFilters.forEach((btn) => {
      btn.addEventListener('click', () => {
        focusedFilters.forEach((b) => b.classList.remove('filter-tab--active'));
        btn.classList.add('filter-tab--active');
        this.currentFilter = btn.dataset.filter || 'all';
        this.renderFocused();
      });
    });

    // Filter tabs in home view
    const homeFilters = document.querySelectorAll('#view-home .filter-tab');
    homeFilters.forEach((btn) => {
      btn.addEventListener('click', () => {
        homeFilters.forEach((b) => b.classList.remove('filter-tab--active'));
        btn.classList.add('filter-tab--active');
        this.currentFilter = btn.dataset.filter || 'all';
        this.render();
      });
    });
  },

  /**
   * Render daftar tugas ke #todo-list-f (focused view).
   * Menggunakan logika render yang sama dengan render() tapi target DOM berbeda.
   */
  renderFocused() {
    const list = document.getElementById('todo-list-f');
    if (!list) return;

    const errorF = document.getElementById('todo-error-f');

    const newList = list.cloneNode(false);
    const filter  = this.currentFilter || 'all';

    const filtered = this.tasks.filter((t) => {
      if (filter === 'active')  return !t.done;
      if (filter === 'done')    return t.done;
      return true;
    });

    if (filtered.length === 0) {
      const placeholder = document.createElement('li');
      placeholder.className = 'todo-placeholder';
      placeholder.textContent = filter === 'all'
        ? 'Belum ada tugas. Tambahkan tugas baru!'
        : (filter === 'active' ? 'Tidak ada tugas aktif.' : 'Belum ada tugas yang selesai.');
      newList.appendChild(placeholder);
    } else {
      filtered.forEach((task) => {
        const li = this._buildTaskLi(task);
        newList.appendChild(li);
      });
    }

    newList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'toggle') {
        this.toggleTask(id);
      } else if (action === 'edit') {
        this.editTask(id);
      } else if (action === 'delete') {
        this.deleteTask(id);
      } else if (action === 'save-edit') {
        const editInput = btn.closest('li').querySelector('.todo-edit-input');
        this.saveEdit(id, editInput ? editInput.value : '');
      } else if (action === 'cancel-edit') {
        this.cancelEdit(id);
      }
    });

    list.parentNode.replaceChild(newList, list);
  },
};

// TodoList.init() dipanggil oleh App.init() via DOMContentLoaded

// =============================================================================
// QuickLinks — pengelola daftar tautan cepat dengan CRUD dan persistensi Local Storage
// =============================================================================

const QuickLinks = {
  /** Array Link in-memory. Diisi oleh load() saat init. */
  links: [],

  /**
   * Normalisasi URL dengan menambahkan protokol "https://" jika URL tidak
   * diawali dengan "http://" atau "https://".
   * Requirements: 4.6
   * @param {string} url - URL mentah dari input pengguna
   * @returns {string} URL yang sudah dinormalisasi
   */
  normalizeUrl(url) {
    const trimmed = (url || '').trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  },

  /**
   * Validasi apakah URL (setelah normalisasi) diawali dengan "http://" atau "https://".
   * Requirements: 4.7
   * @param {string} url - URL yang akan divalidasi (sebelum atau sesudah normalisasi)
   * @returns {boolean} true jika URL valid, false jika tidak
   */
  validateUrl(url) {
    const normalized = this.normalizeUrl(url);
    return normalized.startsWith('http://') || normalized.startsWith('https://');
  },

  /**
   * Simpan seluruh array links ke Local Storage.
   * Memanggil Storage.save() dengan kunci LINKS.
   * Requirements: 4.8
   */
  save() {
    Storage.save(Storage.KEYS.LINKS, this.links);
  },

  /**
   * Muat array links dari Local Storage ke this.links.
   * Jika tidak ada data atau terjadi error, gunakan array kosong [].
   * Requirements: 4.3, 4.8
   */
  load() {
    const data = Storage.load(Storage.KEYS.LINKS);
    this.links = Array.isArray(data) ? data : [];
  },

  render() {
    this._renderTo('links-container');
  },

  renderFocused() {
    this._renderTo('links-container-f');
  },

  /**
   * Render daftar link ke container dengan id tertentu.
   * @param {string} containerId
   */
  _renderTo(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const newContainer = container.cloneNode(false);

    if (this.links.length === 0) {
      const placeholder = document.createElement('p');
      placeholder.className = 'links-placeholder';
      placeholder.textContent = 'Belum ada tautan. Tambahkan tautan favorit Anda!';
      newContainer.appendChild(placeholder);
    } else {
      this.links.forEach((link) => {
        const card = document.createElement('div');
        card.className = 'link-card';
        card.dataset.id = link.id;

        // Favicon
        const faviconDiv = document.createElement('div');
        faviconDiv.className = 'link-favicon';
        try {
          const hostname = new URL(link.url).hostname;
          const img = document.createElement('img');
          img.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
          img.alt = '';
          img.onerror = () => {
            img.remove();
            faviconDiv.textContent = link.name.charAt(0).toUpperCase();
          };
          faviconDiv.appendChild(img);
        } catch (_) {
          faviconDiv.textContent = link.name.charAt(0).toUpperCase();
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'link-name';
        nameSpan.textContent = link.name;

        const btnOpen = document.createElement('a');
        btnOpen.href = link.url;
        btnOpen.target = '_blank';
        btnOpen.rel = 'noopener noreferrer';
        btnOpen.className = 'link-btn link-btn--open';
        btnOpen.dataset.action = 'open';
        btnOpen.dataset.id = link.id;
        btnOpen.setAttribute('aria-label', `Buka ${link.name} di tab baru`);
        btnOpen.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'link-btn link-btn--delete';
        btnDelete.dataset.action = 'delete';
        btnDelete.dataset.id = link.id;
        btnDelete.setAttribute('aria-label', `Hapus tautan ${link.name}`);
        btnDelete.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

        card.appendChild(faviconDiv);
        card.appendChild(nameSpan);
        card.appendChild(btnOpen);
        card.appendChild(btnDelete);
        newContainer.appendChild(card);
      });
    }

    newContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'delete') this.deleteLink(id);
    });

    container.parentNode.replaceChild(newContainer, container);
  },

  deleteLink(id) {
    this.links = this.links.filter((l) => l.id !== id);
    this.save();
    this.render();
    this.renderFocused();
  },

  /**
   * Buat ID unik untuk setiap link baru.
   * Menggunakan crypto.randomUUID() jika tersedia; fallback ke kombinasi
   * Date.now() dan Math.random() untuk lingkungan yang tidak mendukung.
   * @returns {string} String ID unik
   */
  _generateId() {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }
    // Fallback: timestamp + random number → string hex
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  },

  /**
   * Tambahkan link baru ke daftar.
   *
   * Validasi:
   * - Nama: 1–50 karakter setelah trim()
   * - URL: tidak kosong setelah trim(), lalu dinormalisasi, lalu divalidasi
   *
   * Jika validasi gagal, tampilkan pesan error inline pada field yang bermasalah
   * dan jangan tambahkan link.
   *
   * Jika validasi berhasil, buat Link baru, push ke array, simpan, render,
   * dan kosongkan kedua input field.
   *
   * Requirements: 4.1, 4.2, 4.3
   * @param {string} name - Nama tampilan link dari input pengguna
   * @param {string} url  - URL link dari input pengguna
   */
  addLink(name, url, fromFocused = false) {
    const trimmedName = (name || '').trim();
    const trimmedUrl  = (url || '').trim();

    const suffix = fromFocused ? '-f' : '';
    const nameInputEl  = document.getElementById(`links-name-input${suffix}`);
    const nameErrorEl  = document.getElementById(`links-name-error${suffix}`);
    const urlInputEl   = document.getElementById(`links-url-input${suffix}`);
    const urlErrorEl   = document.getElementById(`links-url-error${suffix}`);
    const formArea     = document.getElementById(`links-form-area${suffix}`);

    let isValid = true;

    if (trimmedName.length === 0 || trimmedName.length > 50) {
      if (nameInputEl) nameInputEl.classList.add('input-error');
      if (nameErrorEl) {
        nameErrorEl.textContent = trimmedName.length === 0
          ? 'Nama tautan tidak boleh kosong.'
          : 'Nama tautan tidak boleh lebih dari 50 karakter.';
      }
      isValid = false;
    } else {
      if (nameInputEl) nameInputEl.classList.remove('input-error');
      if (nameErrorEl) nameErrorEl.textContent = '';
    }

    if (trimmedUrl.length === 0) {
      if (urlInputEl) urlInputEl.classList.add('input-error');
      if (urlErrorEl) urlErrorEl.textContent = 'URL tidak boleh kosong.';
      isValid = false;
    } else {
      const normalizedUrl = this.normalizeUrl(trimmedUrl);
      if (!this.validateUrl(normalizedUrl)) {
        if (urlInputEl) urlInputEl.classList.add('input-error');
        if (urlErrorEl) urlErrorEl.textContent = 'URL tidak valid. Gunakan format http:// atau https://.';
        isValid = false;
      } else {
        if (urlInputEl) urlInputEl.classList.remove('input-error');
        if (urlErrorEl) urlErrorEl.textContent = '';
      }
    }

    if (!isValid) return;

    const normalizedUrl = this.normalizeUrl(trimmedUrl);

    const newLink = {
      id:        this._generateId(),
      name:      trimmedName,
      url:       normalizedUrl,
      createdAt: Date.now(),
    };

    this.links.push(newLink);
    this.save();
    this.render();
    this.renderFocused();

    if (nameInputEl) nameInputEl.value = '';
    if (urlInputEl)  urlInputEl.value  = '';
    if (formArea)    formArea.classList.remove('links-form-open');
  },

  init() {
    this.load();
    this.render();
    this.renderFocused();

    const addBtn      = document.getElementById('links-add-btn');
    const nameInputEl = document.getElementById('links-name-input');
    const urlInputEl  = document.getElementById('links-url-input');
    const formArea    = document.getElementById('links-form-area');
    const showFormBtn = document.getElementById('links-show-form-btn');

    // Toggle form (home view)
    if (showFormBtn && formArea) {
      showFormBtn.addEventListener('click', () => {
        formArea.classList.toggle('links-form-open');
        if (formArea.classList.contains('links-form-open') && nameInputEl) {
          nameInputEl.focus();
        }
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addLink(
          nameInputEl ? nameInputEl.value : '',
          urlInputEl  ? urlInputEl.value  : '',
          false,
        );
      });
    }

    // Focused view form
    const addBtnF      = document.getElementById('links-add-btn-f');
    const nameInputF   = document.getElementById('links-name-input-f');
    const urlInputF    = document.getElementById('links-url-input-f');
    const formAreaF    = document.getElementById('links-form-area-f');
    const showFormBtnF = document.getElementById('links-show-form-btn-f');

    if (showFormBtnF && formAreaF) {
      showFormBtnF.addEventListener('click', () => {
        formAreaF.classList.toggle('links-form-open');
        if (formAreaF.classList.contains('links-form-open') && nameInputF) {
          nameInputF.focus();
        }
      });
    }

    if (addBtnF) {
      addBtnF.addEventListener('click', () => {
        this.addLink(
          nameInputF ? nameInputF.value : '',
          urlInputF  ? urlInputF.value  : '',
          true,
        );
      });
    }
  },
};

// QuickLinks.init() dipanggil oleh App.init() via DOMContentLoaded

// =============================================================================
// SidebarNav — switches between Home (all widgets) and focused single-widget views
// =============================================================================

const SidebarNav = {
  /**
   * Map dari data-view ke label yang ditampilkan di topbar.
   */
  LABELS: {
    home:  '',
    todo:  'To-Do List',
    timer: 'Focus Timer',
    links: 'Quick Links',
  },

  /** View yang sedang aktif. */
  currentView: 'home',

  /**
   * Aktifkan view tertentu:
   * 1. Sembunyikan semua panel view.
   * 2. Tampilkan panel yang sesuai.
   * 3. Update active state sidebar.
   * 4. Update topbar title.
   * @param {string} view - 'home' | 'todo' | 'timer' | 'links'
   */
  switchTo(view) {
    if (!this.LABELS.hasOwnProperty(view)) return;
    this.currentView = view;

    // ── Toggle view panels ───────────────────────────────────────────────────
    const panels = document.querySelectorAll('.view-panel');
    panels.forEach((panel) => {
      if (panel.id === `view-${view}`) {
        panel.classList.remove('view-panel--hidden');
      } else {
        panel.classList.add('view-panel--hidden');
      }
    });

    // ── Update sidebar active state ──────────────────────────────────────────
    const navItems = document.querySelectorAll('.sidebar-nav-item[data-view]');
    navItems.forEach((item) => {
      const isActive = item.dataset.view === view;
      item.classList.toggle('sidebar-nav-item--active', isActive);
      item.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    // ── Update topbar title ──────────────────────────────────────────────────
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) {
      const label = this.LABELS[view];
      titleEl.textContent = label;
      titleEl.classList.toggle('visible', label !== '');
    }

    // ── Sync focused widgets when switching to their view ───────────────────
    if (view === 'todo')  { TodoList.renderFocused(); }
    if (view === 'timer') { FocusTimer.syncFocused(); }
    if (view === 'links') { QuickLinks.renderFocused(); }
  },

  /**
   * Inisialisasi: pasang event listener ke semua tombol sidebar.
   */
  init() {
    const navItems = document.querySelectorAll('.sidebar-nav-item[data-view]');
    navItems.forEach((item) => {
      item.addEventListener('click', () => {
        this.switchTo(item.dataset.view);
      });
    });

    // Mulai di Home
    this.switchTo('home');
  },
};

// =============================================================================
// ThemeToggle — light/dark mode dengan persistensi localStorage
// =============================================================================

const ThemeToggle = {
  /**
   * Terapkan tema ke <html data-theme="..."> dan simpan ke localStorage.
   * @param {'light'|'dark'} theme
   */
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    Storage.save(Storage.KEYS.THEME, theme);
  },

  /** Toggle antara light dan dark. */
  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    this.apply(current === 'light' ? 'dark' : 'light');
  },

  /**
   * Inisialisasi: muat preferensi tersimpan (atau deteksi system preference),
   * lalu pasang event listener pada tombol toggle.
   */
  init() {
    // Coba muat dari localStorage, fallback ke system preference
    const saved = Storage.load(Storage.KEYS.THEME);
    if (saved === 'dark' || saved === 'light') {
      this.apply(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.apply('dark');
    } else {
      this.apply('light');
    }

    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
    }
  },
};

// =============================================================================
// GreetingName — custom name dengan edit inline dan persistensi localStorage
// =============================================================================

const GreetingName = {
  DEFAULT_NAME: 'Maya',

  /** Kembalikan nama tersimpan atau default. */
  getName() {
    const saved = Storage.load(Storage.KEYS.USER_NAME);
    return (typeof saved === 'string' && saved.trim().length > 0)
      ? saved.trim()
      : this.DEFAULT_NAME;
  },

  /** Tampilkan nama di #greeting-name-text. */
  render() {
    const el = document.getElementById('greeting-name-text');
    if (el) el.textContent = this.getName();
  },

  /** Buka form edit inline. */
  openEdit() {
    const displayRow = document.getElementById('greeting-name-display');
    const form       = document.getElementById('greeting-name-form');
    const input      = document.getElementById('greeting-name-input');

    if (!form || !input) return;

    input.value = this.getName();
    form.hidden = false;
    if (displayRow) displayRow.style.display = 'none';

    input.focus();
    input.select();
  },

  /** Tutup form edit tanpa menyimpan. */
  closeEdit() {
    const displayRow = document.getElementById('greeting-name-display');
    const form       = document.getElementById('greeting-name-form');

    if (form) form.hidden = true;
    if (displayRow) displayRow.style.display = '';
  },

  /** Simpan nama baru dari input. */
  saveEdit() {
    const input = document.getElementById('greeting-name-input');
    if (!input) return;

    const newName = input.value.trim();
    if (newName.length === 0 || newName.length > 30) {
      input.classList.add('input-error');
      return;
    }

    input.classList.remove('input-error');
    Storage.save(Storage.KEYS.USER_NAME, newName);
    this.render();
    this.closeEdit();
  },

  /**
   * Inisialisasi: render nama awal dan pasang event listener.
   */
  init() {
    this.render();

    const editBtn    = document.getElementById('greeting-name-edit-btn');
    const saveBtn    = document.getElementById('greeting-name-save');
    const cancelBtn  = document.getElementById('greeting-name-cancel');
    const input      = document.getElementById('greeting-name-input');

    if (editBtn)   editBtn.addEventListener('click',  () => this.openEdit());
    if (saveBtn)   saveBtn.addEventListener('click',  () => this.saveEdit());
    if (cancelBtn) cancelBtn.addEventListener('click',() => this.closeEdit());

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); this.saveEdit(); }
        if (e.key === 'Escape') { e.preventDefault(); this.closeEdit(); }
      });
    }
  },
};

// =============================================================================
// App — titik masuk utama yang mewiring semua widget bersama-sama
// =============================================================================

const App = {
  /**
   * Inisialisasi seluruh dashboard:
   * 1. Cek ketersediaan localStorage; jika tidak tersedia, tampilkan
   *    banner peringatan non-blocking satu kali di DOM (Requirement: 5.6).
   * 2. Inisialisasi semua widget secara berurutan (Requirement: 5.2, 5.3).
   */
  init() {
    // ── Periksa ketersediaan localStorage ─────────────────────────────────────
    if (!Storage.isAvailable()) {
      const warningBanner = document.getElementById('storage-warning');
      if (warningBanner) {
        warningBanner.hidden = false;
      }
    }

    // ── Inisialisasi semua widget secara berurutan ────────────────────────────
    ThemeToggle.init();
    GreetingName.init();
    GreetingWidget.init();
    FocusTimer.init();
    TodoList.init();
    QuickLinks.init();
    SidebarNav.init();
  },
};

// Pasang event listener DOMContentLoaded untuk menjalankan App.init()
// saat seluruh DOM sudah siap (Requirement: 5.2, 5.3)
document.addEventListener('DOMContentLoaded', () => App.init());
