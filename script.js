/* CUSTOMIZE THIS CONFIGURATION: replace names, messages, memories and music path here. */
const CONFIG = {
  riaName: 'Ria',
  yourName: '[Your Name]',
  musicPath: 'assets/romantic-song.mp3',
  finalMessage: "If I could choose one person to keep beside me through all the ordinary days, the crazy days, the beautiful days, and everything in between... I'd choose you. Always."
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (selector) => document.querySelector(selector);

// Apply easy-to-edit configuration values to the page.
document.title = `For ${CONFIG.riaName} — A Little Love Letter`;
$('#intro-title').innerHTML = `Hey <em>${CONFIG.riaName}</em>...`;
$('.proposal h2').textContent = `${CONFIG.riaName}...`;
$('#final-title').innerHTML = `${CONFIG.riaName} <span aria-hidden="true">♥</span>`;
$('.letter-paper strong:last-child').firstChild.textContent = `${CONFIG.yourName} `;
$('#music').src = CONFIG.musicPath;

// Scroll buttons use one delegated listener so every journey button stays accessible.
document.addEventListener('click', (event) => {
  const button = event.target.closest('.scroll-button');
  if (button) document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
});

// Reveal content as it enters the viewport.
const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !prefersReducedMotion) {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('in-view'); obs.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else revealItems.forEach((item) => item.classList.add('in-view'));

// Typewriter message (with a reduced-motion-friendly fallback).
const typewriter = $('.typewriter');
const text = typewriter.dataset.text;
if (prefersReducedMotion) typewriter.textContent = text;
else {
  let index = 0;
  const type = () => { typewriter.textContent = text.slice(0, index++); if (index <= text.length) setTimeout(type, 28); };
  const typeObserver = new IntersectionObserver((entries, obs) => { if (entries[0].isIntersecting) { type(); obs.disconnect(); } });
  typeObserver.observe(typewriter);
}

// Flip memory cards with mouse, touch, Enter and Space.
document.querySelectorAll('.memory-card').forEach((card) => card.addEventListener('click', () => card.classList.toggle('flipped')));

// Reading progress and back-to-top control.
const progressBar = $('#progressBar');
const topButton = $('#topButton');
window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = `${max ? (window.scrollY / max) * 100 : 0}%`;
  topButton.classList.toggle('show', window.scrollY > window.innerHeight * .7);
}, { passive: true });
topButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' }));

// Optional music: never autoplay and fail silently if the placeholder file is absent.
const music = $('#music');
const musicToggle = $('#musicToggle');
musicToggle.addEventListener('click', async () => {
  if (music.paused) { try { await music.play(); musicToggle.innerHTML = '❚❚ <span>Pause</span>'; } catch (_) { musicToggle.innerHTML = '♫ <span>Add music file</span>'; } }
  else { music.pause(); musicToggle.innerHTML = '♫ <span>Music</span>'; }
});

// Proposal interaction: both choices remain fully accessible.
const yesButton = $('#yesButton');
const thinkButton = $('#thinkButton');
const proposalActions = $('#proposalActions');
const yesMessage = $('#yesMessage');
const celebration = $('#celebration');
yesButton.addEventListener('click', () => {
  proposalActions.hidden = true;
  $('#proposal-question').hidden = true;
  yesMessage.hidden = false;
  launchCelebration();
});
thinkButton.addEventListener('click', () => {
  thinkButton.innerHTML = 'Take all the time you need <span>♡</span>';
  thinkButton.setAttribute('aria-label', 'Take all the time you need');
});
function launchCelebration() {
  for (let i = 0; i < 34; i += 1) {
    const heart = document.createElement('span');
    heart.className = 'confetti'; heart.textContent = i % 3 ? '♥' : '✦';
    heart.style.left = `${45 + Math.random() * 10}%`; heart.style.setProperty('--x', `${(Math.random() - .5) * 100}vw`); heart.style.setProperty('--y', `${(Math.random() - .5) * 100}vh`); heart.style.color = i % 2 ? '#f58aa9' : '#fff1f5';
    celebration.appendChild(heart); setTimeout(() => heart.remove(), 2800);
  }
}

// Reveal the final surprise only after the YES celebration.
$('#surpriseButton').addEventListener('click', () => {
  const finalSection = $('#final');
  finalSection.classList.add('visible');
  finalSection.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
});
