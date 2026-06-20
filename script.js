const $ = (selector) => document.querySelector(selector);

const state = {
  user: null,
  repos: [],
  events: [],
  languages: {},
  portfolio: '',
};

const storageKey = 'gitroot:last-scan';
const scanForm = $('#scanForm');
const usernameInput = $('#username');
const tokenInput = $('#token');
const statusEl = $('#status');
const scanBtn = $('.scan-btn');

function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

function fmt(num) {
  return new Intl.NumberFormat().format(num || 0);
}

function safe(text) {
  return String(text || '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

async function githubFetch(url) {
  const headers = { Accept: 'application/vnd.github+json' };
  const token = tokenInput.value.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 404) throw new Error('GitHub user not found. Check the username.');
    if (res.status === 403) throw new Error('GitHub rate limit reached. Add a fine-grained token or try later.');
    throw new Error(`GitHub API error: ${res.status}`);
  }
  return res.json();
}

async function scanUser(username) {
  const base = 'https://api.github.com';
  const [user, repos, events] = await Promise.all([
    githubFetch(`${base}/users/${encodeURIComponent(username)}`),
    githubFetch(`${base}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`),
    githubFetch(`${base}/users/${encodeURIComponent(username)}/events/public?per_page=30`),
  ]);

  state.user = user;
  state.repos = repos.filter(repo => !repo.fork);
  state.events = events;
  state.languages = buildLanguageMap(state.repos);
  state.portfolio = buildPortfolioText();
  localStorage.setItem(storageKey, JSON.stringify({ username, scannedAt: new Date().toISOString() }));
  renderAll();
}

function buildLanguageMap(repos) {
  return repos.reduce((acc, repo) => {
    const lang = repo.language || 'Other';
    acc[lang] = (acc[lang] || 0) + 1;
    return acc;
  }, {});
}

function rootScore() {
  const user = state.user || {};
  const repos = state.repos;
  const stars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const forks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
  const langs = Object.keys(state.languages).length;
  const recentEvents = state.events.length;
  const profileCompleteness = [user.bio, user.location, user.blog, user.name].filter(Boolean).length * 5;
  const raw = Math.min(100, Math.round(
    Math.min(repos.length, 30) * 1.5 + Math.min(stars, 120) * .18 + Math.min(forks, 80) * .15 + langs * 5 + Math.min(recentEvents, 30) + profileCompleteness
  ));
  return raw;
}

function topRepos() {
  return [...state.repos]
    .sort((a, b) => (b.stargazers_count + b.forks_count + (b.size / 1000)) - (a.stargazers_count + a.forks_count + (a.size / 1000)))
    .slice(0, 6);
}

function renderAll() {
  renderProfile();
  renderLanguages();
  renderRepos();
  renderEvents();
  renderRecommendations();
  renderPortfolio();
}

function renderProfile() {
  const user = state.user;
  if (!user) return;
  $('#profileEmpty').hidden = true;
  $('#profileView').hidden = false;
  $('#avatar').src = user.avatar_url;
  $('#displayName').textContent = user.name || user.login;
  $('#profileLink').textContent = `@${user.login}`;
  $('#profileLink').href = user.html_url;
  $('#bio').textContent = user.bio || 'No bio found. Add a clear GitHub bio to improve recruiter trust.';
  $('#score').textContent = rootScore();
  $('#repoCount').textContent = fmt(user.public_repos);
  $('#followerCount').textContent = fmt(user.followers);
  $('#publicGists').textContent = fmt(user.public_gists);
  $('#heroScore').textContent = rootScore();
  $('#heroRepos').textContent = fmt(state.repos.length);
  $('#heroStars').textContent = fmt(state.repos.reduce((s, r) => s + r.stargazers_count, 0));
  $('#heroLangs').textContent = Object.keys(state.languages).length;
}

function renderLanguages() {
  const entries = Object.entries(state.languages).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
  $('#langMeta').textContent = `${entries.length} languages`;
  $('#languageBars').innerHTML = entries.length ? entries.map(([lang, count]) => {
    const pct = Math.round((count / total) * 100);
    return `<div class="bar-item"><div class="bar-meta"><span>${safe(lang)}</span><span>${pct}%</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
  }).join('') : '<p class="empty-state">No repository languages detected.</p>';
}

function renderRepos() {
  const repos = topRepos();
  $('#repoGrid').innerHTML = repos.length ? repos.map(repo => `
    <article class="repo-card">
      <a href="${repo.html_url}" target="_blank" rel="noopener">${safe(repo.name)}</a>
      <p>${safe(repo.description || 'No description yet. Add a strong README description to improve portfolio value.')}</p>
      <div class="repo-meta"><span>★ ${fmt(repo.stargazers_count)}</span><span>⑂ ${fmt(repo.forks_count)}</span><span>${safe(repo.language || 'Other')}</span></div>
    </article>`).join('') : '<p class="empty-state">No public non-fork repositories found.</p>';
}

function renderEvents() {
  $('#eventMeta').textContent = `${state.events.length} recent events`;
  $('#eventList').innerHTML = state.events.slice(0, 7).map(event => {
    const repo = event.repo?.name || 'unknown/repo';
    const date = new Date(event.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<div class="event-item"><b>${safe(event.type.replace('Event', ''))}</b> in ${safe(repo)} <span>• ${date}</span></div>`;
  }).join('') || '<p class="empty-state">No recent public activity found.</p>';
}

function renderRecommendations() {
  const recs = [];
  const repos = state.repos;
  const noReadmeRisk = repos.filter(r => !r.description).length;
  const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const langs = Object.keys(state.languages).length;
  if (!state.user.bio) recs.push('Add a sharp GitHub bio with your role, stack, and goal.');
  if (noReadmeRisk > 0) recs.push(`Add descriptions to ${noReadmeRisk} repositories so recruiters understand your work faster.`);
  if (langs < 3) recs.push('Build 2–3 small projects in different stacks to show versatility.');
  if (stars === 0) recs.push('Pin your best repositories and add screenshots/GIFs to increase star potential.');
  if (state.events.length < 5) recs.push('Push small weekly commits to create visible consistency.');
  recs.push('Create one flagship project with live demo, README, problem statement, features, and deployment link.');
  $('#recommendations').innerHTML = recs.map(r => `<li>${safe(r)}</li>`).join('');
}

function buildPortfolioText() {
  const user = state.user;
  const repos = topRepos();
  const langs = Object.keys(state.languages).slice(0, 6).join(', ') || 'GitHub projects';
  const stars = state.repos.reduce((s, r) => s + r.stargazers_count, 0);
  return `${user.name || user.login} — Developer Portfolio Summary\n\nGitHub: ${user.html_url}\nRoot Score: ${rootScore()}/100\nPrimary Stack: ${langs}\nPublic Repositories: ${user.public_repos}\nFollowers: ${user.followers}\nTotal Stars Across Scanned Repos: ${stars}\n\nResume Line:\nDeveloped and maintained public GitHub projects across ${langs}, using version control, documentation, deployment-ready code, and iterative open-source development practices.\n\nTop Projects:\n${repos.map((r, i) => `${i + 1}. ${r.name} — ${r.description || 'Project repository'} (${r.language || 'Other'}, ★ ${r.stargazers_count})`).join('\n')}\n\nNext Improvement:\nAdd screenshots, live demo links, clear READMEs, and issue-based development logs to your best repositories.`;
}

function renderPortfolio() {
  $('#portfolioText').textContent = state.portfolio;
}

scanForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim().replace('@', '');
  if (!username) return;
  try {
    scanBtn.classList.add('loading');
    scanBtn.disabled = true;
    setStatus('Scanning GitHub profile, repositories, languages, and activity...');
    await scanUser(username);
    setStatus(`Scan complete for @${username}.`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    scanBtn.classList.remove('loading');
    scanBtn.disabled = false;
  }
});

$('#demoBtn').addEventListener('click', () => {
  usernameInput.value = 'sxndy66';
  scanForm.requestSubmit();
});

$('#copyPortfolioBtn').addEventListener('click', async () => {
  if (!state.portfolio) return setStatus('Analyze a profile first.');
  await navigator.clipboard.writeText(state.portfolio);
  setStatus('Portfolio text copied.', 'success');
});

$('#downloadBtn').addEventListener('click', () => {
  if (!state.user) return setStatus('Analyze a profile first.');
  const data = JSON.stringify({ user: state.user, repos: state.repos, languages: state.languages, portfolio: state.portfolio }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gitroot-${state.user.login}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('#clearBtn').addEventListener('click', () => {
  localStorage.removeItem(storageKey);
  setStatus('Saved scan data cleared.', 'success');
});

$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('gitroot:theme', next);
});

function initTilt() {
  document.querySelectorAll('.tilt-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rx = ((y / rect.height) - .5) * -10;
      const ry = ((x / rect.width) - .5) * 10;
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    card.addEventListener('mouseleave', () => card.style.transform = 'rotateX(0) rotateY(0)');
  });
}

(function init() {
  document.documentElement.dataset.theme = localStorage.getItem('gitroot:theme') || 'dark';
  initTilt();
  const last = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (last?.username) {
    usernameInput.value = last.username;
    setStatus(`Last scanned: @${last.username}. Press Analyze to refresh.`);
  }
})();
