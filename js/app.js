// app.js — semua logika JavaScript untuk Life Dashboard

// =============================================================================
// Storage — abstraksi tipis di atas localStorage dengan penanganan error terpusat
// =============================================================================

const Storage = {
  KEYS: {
    TASKS: 'dashboard_tasks',
    LINKS: 'dashboard_links',
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
        document.getElementById('clock').textContent    = '--:--:--';
        document.getElementById('greeting').textContent = 'Halo';
        return;
      }

      document.getElementById('clock').textContent    = this.formatTime(date);
      document.getElementById('date').textContent     = this.formatDate(date);
      document.getElementById('greeting').textContent = this.getGreeting(date.getHours());
    } catch (e) {
      console.warn('[GreetingWidget] Error saat memperbarui tampilan:', e);
      document.getElementById('clock').textContent    = '--:--:--';
      document.getElementById('greeting').textContent = 'Halo';
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
   * - #timer-display: tampilkan waktu tersisa dalam format MM:SS
   * - #timer-start: disabled saat isRunning, enabled saat idle
   * - #timer-stop: enabled saat isRunning, disabled saat idle
   * - #timer-reset: selalu enabled
   * - .timer-ring-progress: animasi lingkaran berdasarkan sisa waktu
   */
  render() {
    const display  = document.getElementById('timer-display');
    const btnStart = document.getElementById('timer-start');
    const btnStop  = document.getElementById('timer-stop');
    const btnReset = document.getElementById('timer-reset');
    const ringProgress = document.querySelector('.timer-ring-progress');

    if (display) display.textContent = this.formatTime(this.state.remaining);

    if (btnStart) btnStart.disabled = this.state.isRunning;
    if (btnStop)  btnStop.disabled  = !this.state.isRunning;
    if (btnReset) btnReset.disabled = false;

    // Animasi cincin: circumference ≈ 326.7
    if (ringProgress) {
      const circumference = 326.7;
      const fraction = this.state.remaining / this.DURATION_SECONDS;
      const offset   = circumference * (1 - fraction);
      ringProgress.style.strokeDashoffset = offset;
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

  /**
   * Inisialisasi widget: render tampilan awal dan pasang event listener
   * pada tombol Start, Stop, dan Reset.
   */
  init() {
    this.render();
    document.getElementById('timer-start').addEventListener('click', () => this.start());
    document.getElementById('timer-stop').addEventListener('click',  () => this.stop());
    document.getElementById('timer-reset').addEventListener('click', () => this.reset());
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
   * Bangun ulang DOM daftar tugas berdasarkan this.tasks.
   *
   * Tampilan menggunakan desain baru: checkbox bulat, badge status (Selesai/Aktif),
   * ikon edit & hapus, dan info meta tanggal.
   *
   * Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
   */
  render() {
    const list = document.getElementById('todo-list');
    if (!list) return;

    // Klon <ul> untuk melepas semua event listener lama
    const newList = list.cloneNode(false);

    if (this.tasks.length === 0) {
      const placeholder = document.createElement('li');
      placeholder.className = 'todo-placeholder';
      placeholder.textContent = 'Belum ada tugas. Tambahkan tugas baru!';
      newList.appendChild(placeholder);
    } else {
      this.tasks.forEach((task) => {
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
            if (e.key === 'Enter') {
              e.preventDefault();
              this.saveEdit(task.id, editInput.value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              this.cancelEdit(task.id);
            }
          });

          li.appendChild(editInput);
          li.appendChild(btnSave);
          li.appendChild(btnCancel);

          setTimeout(() => {
            editInput.focus();
            editInput.setSelectionRange(editInput.value.length, editInput.value.length);
          }, 0);

        } else {
          // ── Mode tampil normal (desain baru) ───────────────────────────────
          li.className = 'todo-item' + (task.done ? ' todo-item--done' : '');

          // ── Checkbox / toggle ──
          const btnToggle = document.createElement('button');
          btnToggle.type = 'button';
          btnToggle.className = 'todo-btn todo-btn--toggle';
          btnToggle.dataset.action = 'toggle';
          btnToggle.dataset.id = task.id;
          btnToggle.setAttribute('aria-label', task.done ? 'Tandai belum selesai' : 'Tandai selesai');
          if (task.done) {
            btnToggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:12px;height:12px"><polyline points="20 6 9 17 4 12"/></svg>';
          } else {
            btnToggle.textContent = '';
          }

          // ── Teks & meta block ──
          const textBlock = document.createElement('div');
          textBlock.style.flex = '1';
          textBlock.style.minWidth = '0';

          const span = document.createElement('span');
          span.className = 'todo-text' + (task.done ? ' done' : '');
          span.textContent = task.text;

          // Tanggal meta (format sederhana dari createdAt)
          const metaEl = document.createElement('div');
          metaEl.className = 'todo-meta';
          if (task.createdAt) {
            const d = new Date(task.createdAt);
            const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
            const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            const hh = String(d.getHours()).padStart(2,'0');
            const mm = String(d.getMinutes()).padStart(2,'0');
            metaEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;vertical-align:middle;margin-right:2px" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${dateStr} · ${hh}:${mm}`;
          }

          textBlock.appendChild(span);
          textBlock.appendChild(metaEl);

          // ── Badge status ──
          const badge = document.createElement('span');
          badge.className = 'todo-badge ' + (task.done ? 'todo-badge--done' : 'todo-badge--active');
          badge.textContent = task.done ? 'Selesai' : 'Aktif';

          // ── Tombol edit (ikon pensil) ──
          const btnEdit = document.createElement('button');
          btnEdit.type = 'button';
          btnEdit.className = 'todo-btn todo-btn--edit';
          btnEdit.dataset.action = 'edit';
          btnEdit.dataset.id = task.id;
          btnEdit.setAttribute('aria-label', 'Edit tugas');
          btnEdit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

          // ── Tombol hapus (ikon tempat sampah) ──
          const btnDelete = document.createElement('button');
          btnDelete.type = 'button';
          btnDelete.className = 'todo-btn todo-btn--delete';
          btnDelete.dataset.action = 'delete';
          btnDelete.dataset.id = task.id;
          btnDelete.setAttribute('aria-label', 'Hapus tugas');
          btnDelete.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

          li.appendChild(btnToggle);
          li.appendChild(textBlock);
          li.appendChild(badge);
          li.appendChild(btnEdit);
          li.appendChild(btnDelete);
        }

        newList.appendChild(li);
      });
    }

    // Satu event listener pada <ul> (event delegation)
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
  addTask(text) {
    const trimmed = (text || '').trim();
    const errorEl = document.getElementById('todo-error');
    const inputEl = document.getElementById('todo-input');

    // Validasi
    if (trimmed.length === 0 || trimmed.length > 500) {
      // Tampilkan indikator error inline
      if (inputEl) inputEl.classList.add('input-error');
      if (errorEl) {
        errorEl.textContent = trimmed.length === 0
          ? 'Tugas tidak boleh kosong.'
          : 'Tugas tidak boleh lebih dari 500 karakter.';
      }
      return;
    }

    // Hapus indikator error jika sebelumnya ada
    if (inputEl) inputEl.classList.remove('input-error');
    if (errorEl) errorEl.textContent = '';

    // Buat task baru dan tambahkan ke array
    const newTask = {
      id: this._generateId(),
      text: trimmed,
      done: false,
      createdAt: Date.now(),
    };

    this.tasks.push(newTask);
    this.save();
    this.render();

    // Kosongkan input field
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

  /**
   * Simpan hasil edit pada task dengan id yang diberikan.
   * Validasi teks baru (1–500 karakter setelah trim()); jika tidak valid, tidak menyimpan.
   * Memperbarui task.text, set editingId = null, simpan, render.
   * Requirements: 3.4
   * @param {string} id   - ID task yang sedang diedit
   * @param {string} text - Teks baru dari input edit
   */
  saveEdit(id, text) {
    const trimmed = (text || '').trim();

    // Validasi — jika tidak valid, jangan simpan (tetap dalam mode edit)
    if (trimmed.length === 0 || trimmed.length > 500) return;

    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      task.text = trimmed;
    }

    this.editingId = null;
    this.save();
    this.render();
  },

  /**
   * Batalkan mode edit dan kembalikan tampilan normal.
   * Requirements: 3.5
   * @param {string} id - ID task yang dibatalkan editnya (tidak digunakan langsung)
   */
  cancelEdit(id) {
    this.editingId = null;
    this.render();
  },

  /**
   * Toggle status selesai/belum selesai pada task dengan id yang diberikan.
   * Requirements: 3.6, 3.7
   * @param {string} id - ID task yang di-toggle
   */
  toggleTask(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      task.done = !task.done;
    }
    this.save();
    this.render();
  },

  /**
   * Hapus task dengan id yang diberikan dari daftar.
   * Requirements: 3.8
   * @param {string} id - ID task yang akan dihapus
   */
  deleteTask(id) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.save();
    this.render();
  },

  /**
   * Inisialisasi widget TodoList:
   * 1. Muat data tasks dari Local Storage via load().
   * 2. Render tampilan awal via render().
   * 3. Pasang event listener pada tombol #todo-add (click) untuk menambah task.
   * 4. Pasang event listener pada input #todo-input (keydown Enter) untuk menambah task.
   * Requirements: 3.10
   */
  init() {
    this.load();
    this.render();

    const inputEl  = document.getElementById('todo-input');
    const addBtn   = document.getElementById('todo-add');

    // Klik tombol "Tambah" → tambahkan task lalu kosongkan input
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addTask(inputEl ? inputEl.value : '');
      });
    }

    // Tekan Enter di input field → tambahkan task
    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addTask(inputEl.value);
        }
      });
    }
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

  /**
   * Bangun ulang DOM daftar tautan berdasarkan this.links.
   * Setiap link dirender sebagai baris (link-card) dengan:
   *   • Favicon/huruf pertama (link-favicon)
   *   • Nama tautan (link-name)
   *   • Tombol buka di tab baru (link-btn--open) — <a>
   *   • Tombol hapus (link-btn--delete)
   * Requirements: 4.4, 4.5
   */
  render() {
    const container = document.getElementById('links-container');
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

        // ── Favicon / inisial ──
        const faviconDiv = document.createElement('div');
        faviconDiv.className = 'link-favicon';
        // Coba muat favicon via Google S2; fallback ke inisial
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

        // ── Nama ──
        const nameSpan = document.createElement('span');
        nameSpan.className = 'link-name';
        nameSpan.textContent = link.name;

        // ── Tombol buka (ikon external link) — Requirements: 4.4 ──
        const btnOpen = document.createElement('a');
        btnOpen.href = link.url;
        btnOpen.target = '_blank';
        btnOpen.rel = 'noopener noreferrer';
        btnOpen.className = 'link-btn link-btn--open';
        btnOpen.dataset.action = 'open';
        btnOpen.dataset.id = link.id;
        btnOpen.setAttribute('aria-label', `Buka ${link.name} di tab baru`);
        btnOpen.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

        // ── Tombol hapus (ikon X) — Requirements: 4.5 ──
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

    // Satu event listener (event delegation)
    newContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'delete') this.deleteLink(id);
      // action === 'open' ditangani native browser via <a href>
    });

    container.parentNode.replaceChild(newContainer, container);
  },

  /**
   * Hapus link dengan id yang diberikan dari daftar, lalu simpan dan render ulang.
   * Requirements: 4.5
   * @param {string} id - ID link yang akan dihapus
   */
  deleteLink(id) {
    this.links = this.links.filter((l) => l.id !== id);
    this.save();
    this.render();
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
  addLink(name, url) {
    const trimmedName = (name || '').trim();
    const trimmedUrl  = (url || '').trim();

    const nameInputEl  = document.getElementById('links-name-input');
    const nameErrorEl  = document.getElementById('links-name-error');
    const urlInputEl   = document.getElementById('links-url-input');
    const urlErrorEl   = document.getElementById('links-url-error');

    let isValid = true;

    // ── Validasi nama ────────────────────────────────────────────────────────
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

    // ── Validasi URL (kosong) ─────────────────────────────────────────────────
    if (trimmedUrl.length === 0) {
      if (urlInputEl) urlInputEl.classList.add('input-error');
      if (urlErrorEl) urlErrorEl.textContent = 'URL tidak boleh kosong.';
      isValid = false;
    } else {
      // ── Normalisasi dan validasi URL ────────────────────────────────────────
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

    // ── Buat link baru dan tambahkan ke array ────────────────────────────────
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

    // Kosongkan kedua input field setelah berhasil
    if (nameInputEl) nameInputEl.value = '';
    if (urlInputEl)  urlInputEl.value  = '';
  },

  /**
   * Inisialisasi widget QuickLinks:
   * 1. Muat data links dari Local Storage via load().
   * 2. Render tampilan awal via render().
   * 3. Pasang event listener pada tombol #links-add-btn (click) untuk menambah link.
   * 4. Pasang event listener pada tombol #links-show-form-btn untuk toggle form.
   * Requirements: 4.1, 4.2, 4.3, 4.5
   */
  init() {
    this.load();
    this.render();

    const addBtn      = document.getElementById('links-add-btn');
    const nameInputEl = document.getElementById('links-name-input');
    const urlInputEl  = document.getElementById('links-url-input');
    const formArea    = document.getElementById('links-form-area');
    const showFormBtn = document.getElementById('links-show-form-btn');

    // Toggle form saat tombol + diklik
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
        );
        // Tutup form setelah berhasil menambah
        if (formArea && !document.getElementById('links-name-error')?.textContent &&
            !document.getElementById('links-url-error')?.textContent) {
          formArea.classList.remove('links-form-open');
        }
      });
    }
  },
};

// QuickLinks.init() dipanggil oleh App.init() via DOMContentLoaded

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
      // Tampilkan banner peringatan yang sudah ada di HTML (hidden by default)
      // Menggunakan elemen yang sudah ada di DOM agar tampil sekali saja,
      // tanpa alert() yang memblokir (Requirement: 5.6)
      const warningBanner = document.getElementById('storage-warning');
      if (warningBanner) {
        warningBanner.hidden = false;
      }
    }

    // ── Inisialisasi semua widget secara berurutan ────────────────────────────
    GreetingWidget.init();
    FocusTimer.init();
    TodoList.init();
    QuickLinks.init();
  },
};

// Pasang event listener DOMContentLoaded untuk menjalankan App.init()
// saat seluruh DOM sudah siap (Requirement: 5.2, 5.3)
document.addEventListener('DOMContentLoaded', () => App.init());
