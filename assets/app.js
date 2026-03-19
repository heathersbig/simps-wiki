
(async function(){
	const body = document.body;
	const base = body.dataset.base || '.';
	const currentPath = body.dataset.pagePath || 'index.html';
	const pageTitle = body.dataset.pageTitle || 'Untitled';
	const pageKey = body.dataset.pageKey || currentPath;
	const dataUrl = `${base}/assets/site-data.json`;

	const els = {
		sidebarTree: document.getElementById('sidebar-tree'),
		bookmarkList: document.getElementById('bookmark-list'),
		recentTabs: document.getElementById('recent-tabs'),
		searchOverlay: document.getElementById('search-overlay'),
		searchInput: document.getElementById('search-input'),
		searchResults: document.getElementById('search-results'),
		helpOverlay: document.getElementById('help-overlay'),
		pageNotes: document.getElementById('page-notes'),
		noteStatus: document.getElementById('note-status'),
		bookmarkToggle: document.querySelector('[data-bookmark-current]'),
		rollOutput: document.getElementById('roll-output'),
	};

	let siteData = null;
	let pageIndex = [];

	const store = {
		get(key, fallback){
			try{
				const raw = localStorage.getItem(key);
				return raw ? JSON.parse(raw) : fallback;
			}catch{
				return fallback;
			}
		},
		set(key, value){
			localStorage.setItem(key, JSON.stringify(value));
		}
	};

	function pathify(path){
		if(path.startsWith('http')) return path;
		return `${base}/${path}`.replace(/\/\.\//g,'/');
	}

	function initTheme(){
		const saved = localStorage.getItem('simpsWiki.theme') || 'dark';
		body.dataset.theme = saved;
	}
	function setTheme(next){
		body.dataset.theme = next;
		localStorage.setItem('simpsWiki.theme', next);
	}
	function initFontScale(){
		const scale = parseFloat(localStorage.getItem('simpsWiki.fontScale') || '1');
		document.documentElement.style.setProperty('--font-scale', String(scale));
	}
	function adjustFont(delta){
		const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) || 1;
		const next = Math.max(0.9, Math.min(1.35, Math.round((current + delta) * 100) / 100));
		document.documentElement.style.setProperty('--font-scale', String(next));
		localStorage.setItem('simpsWiki.fontScale', String(next));
	}

	async function loadData(){
		if(siteData) return siteData;
		siteData = await fetch(dataUrl).then(r => r.json());
		pageIndex = siteData.pages || [];
		return siteData;
	}

	function renderSidebar(data){
		if(!els.sidebarTree) return;
		const wrapper = document.createElement('div');
		const home = document.createElement('a');
		home.href = pathify('index.html');
		home.className = 'tree-home' + (currentPath === 'index.html' ? ' current' : '');
		home.textContent = 'Welcome';
		wrapper.appendChild(home);

		data.categories.forEach(cat => {
			const details = document.createElement('details');
			details.className = 'tree-group';
			const currentInside = currentPath === cat.path || cat.items.some(item => item.path === currentPath);
			if(currentInside) details.open = true;

			const summary = document.createElement('summary');
			const link = document.createElement('a');
			link.href = pathify(cat.path);
			link.textContent = cat.label;
			if(currentPath === cat.path) link.classList.add('current');

			const count = document.createElement('span');
			count.className = 'count';
			count.textContent = cat.count;

			summary.appendChild(link);
			summary.appendChild(count);
			details.appendChild(summary);

			const ul = document.createElement('ul');
			cat.items.forEach(item => {
				const li = document.createElement('li');
				const a = document.createElement('a');
				a.href = pathify(item.path);
				a.textContent = item.rank ? `#${item.rank} ${item.title}` : item.title;
				if(item.path === currentPath) a.classList.add('current');
				li.appendChild(a);
				ul.appendChild(li);
			});
			details.appendChild(ul);
			wrapper.appendChild(details);
		});
		els.sidebarTree.innerHTML = '';
		els.sidebarTree.appendChild(wrapper);
	}

	function getBookmarks(){
		return store.get('simpsWiki.bookmarks', []);
	}
	function setBookmarks(list){
		store.set('simpsWiki.bookmarks', list);
	}
	function toggleBookmark(){
		const current = getBookmarks();
		const index = current.findIndex(item => item.path === currentPath);
		if(index >= 0){
			current.splice(index, 1);
		}else{
			current.unshift({ title: pageTitle, path: currentPath });
		}
		setBookmarks(current.slice(0, 40));
		renderBookmarks();
		updateBookmarkToggle();
	}
	function updateBookmarkToggle(){
		if(!els.bookmarkToggle) return;
		const active = getBookmarks().some(item => item.path === currentPath);
		els.bookmarkToggle.textContent = active ? '★ Bookmarked' : '☆ Bookmark';
		els.bookmarkToggle.dataset.active = active ? 'true' : 'false';
	}
	function renderBookmarks(){
		if(!els.bookmarkList) return;
		const items = getBookmarks();
		if(!items.length){
			els.bookmarkList.innerHTML = '<div class="empty-state">No bookmarks yet.</div>';
			return;
		}
		els.bookmarkList.innerHTML = '';
		items.forEach(item => {
			const a = document.createElement('a');
			a.className = 'pill-link';
			a.href = pathify(item.path);
			a.textContent = item.title;
			els.bookmarkList.appendChild(a);
		});
	}

	function recordRecent(){
		const recents = store.get('simpsWiki.recents', []);
		const next = [{ title: pageTitle, path: currentPath }, ...recents.filter(item => item.path !== currentPath)].slice(0, 9);
		store.set('simpsWiki.recents', next);
	}
	function renderRecents(){
		if(!els.recentTabs) return;
		const recents = store.get('simpsWiki.recents', []);
		els.recentTabs.innerHTML = '';
		recents.forEach(item => {
			const a = document.createElement('a');
			a.className = 'tab-chip';
			if(item.path === currentPath) a.classList.add('current');
			a.href = pathify(item.path);
			a.textContent = item.title;
			els.recentTabs.appendChild(a);
		});
		if(!recents.length){
			els.recentTabs.innerHTML = '<span class="empty-state">Visited pages will show up here.</span>';
		}
	}

	function openOverlay(el){
		if(el) el.classList.add('open');
	}
	function closeOverlay(el){
		if(el) el.classList.remove('open');
	}
	async function performSearch(query){
		await loadData();
		const q = query.trim().toLowerCase();
		els.searchResults.innerHTML = '';
		if(!q){
			els.searchResults.innerHTML = '<div class="empty-state">Search titles, categories, or summaries.</div>';
			return;
		}
		const results = pageIndex.filter(page => {
			const hay = `${page.title} ${page.summary || ''} ${(page.categories || []).join(' ')}`.toLowerCase();
			return hay.includes(q);
		}).slice(0, 35);
		if(!results.length){
			els.searchResults.innerHTML = '<div class="empty-state">Nothing matched. Which honestly feels impossible, but here we are.</div>';
			return;
		}
		results.forEach(result => {
			const wrap = document.createElement('a');
			wrap.className = 'search-result';
			wrap.href = pathify(result.path);
			wrap.innerHTML = `<h3>${escapeHtml(result.title)}</h3><div class="mini-meta">${(result.categories || []).map(c => `<span class="badge">${escapeHtml(c)}</span>`).join('')}</div><p>${escapeHtml(result.summary || '')}</p>`;
			els.searchResults.appendChild(wrap);
		});
	}
	function escapeHtml(str){
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function initNotes(){
		if(!els.pageNotes) return;
		const key = `simpsWiki.notes.${pageKey}`;
		els.pageNotes.value = localStorage.getItem(key) || '';
		let timer = null;
		els.pageNotes.addEventListener('input', () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				localStorage.setItem(key, els.pageNotes.value);
				if(els.noteStatus) els.noteStatus.textContent = 'Saved locally.';
			}, 140);
			if(els.noteStatus) els.noteStatus.textContent = 'Saving…';
		});
	}

	async function goRandom(kind){
		await loadData();
		let pool = pageIndex.filter(p => p.type === 'entry');
		if(kind && siteData.entries){
			pool = Object.values(siteData.entries)
				.filter(entry => {
					if(kind === 'arena') return entry.categories.includes('Arena');
					if(kind === 'object') return entry.categories.includes('Objects');
					if(kind === 'character') return entry.categories.includes('SImps Character Power Ranking');
					if(kind === 'metaverse') return entry.categories.includes('Metaverse');
					return true;
				})
				.map(entry => ({ title: entry.title, path: entry.path, summary: entry.summary, categories: entry.categoryLabels }));
		}
		const pick = pool[Math.floor(Math.random() * pool.length)];
		if(!pick) return;
		if(els.rollOutput && kind){
			els.rollOutput.innerHTML = `<strong>${escapeHtml(kind[0].toUpperCase() + kind.slice(1))} roll:</strong> <a href="${pathify(pick.path)}">${escapeHtml(pick.title)}</a><div class="muted" style="margin-top:.35rem">${escapeHtml(pick.summary || '')}</div>`;
		}else{
			location.href = pathify(pick.path);
		}
	}

	function exportData(){
		const payload = {
			bookmarks: getBookmarks(),
			recents: store.get('simpsWiki.recents', []),
			theme: localStorage.getItem('simpsWiki.theme') || 'dark',
			fontScale: localStorage.getItem('simpsWiki.fontScale') || '1',
			notes: Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('simpsWiki.notes.')).map(k => [k, localStorage.getItem(k)])),
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'simps-wiki-local-data.json';
		a.click();
		URL.revokeObjectURL(a.href);
	}
	function importData(file){
		const reader = new FileReader();
		reader.onload = () => {
			try{
				const payload = JSON.parse(reader.result);
				if(payload.bookmarks) setBookmarks(payload.bookmarks);
				if(payload.recents) store.set('simpsWiki.recents', payload.recents);
				if(payload.theme) setTheme(payload.theme);
				if(payload.fontScale){
					localStorage.setItem('simpsWiki.fontScale', String(payload.fontScale));
					initFontScale();
				}
				if(payload.notes){
					Object.entries(payload.notes).forEach(([key, value]) => localStorage.setItem(key, value));
				}
				renderBookmarks();
				renderRecents();
				updateBookmarkToggle();
				initNotes();
				alert('Imported local wiki data.');
			}catch(err){
				alert('Could not import that file.');
			}
		};
		reader.readAsText(file);
	}

	function bindCategoryFilter(){
		const input = document.querySelector('[data-category-filter]');
		if(!input) return;
		const items = [...document.querySelectorAll('[data-filter-item]')];
		input.addEventListener('input', () => {
			const q = input.value.trim().toLowerCase();
			items.forEach(item => {
				const hay = item.dataset.filterItem.toLowerCase();
				item.classList.toggle('hidden', q && !hay.includes(q));
			});
		});
	}

	function bindButtons(){
		document.querySelectorAll('[data-open-search]').forEach(btn => btn.addEventListener('click', () => {
			openOverlay(els.searchOverlay);
			performSearch(els.searchInput.value || '');
			setTimeout(() => els.searchInput && els.searchInput.focus(), 30);
		}));
		document.querySelectorAll('[data-close-overlay]').forEach(btn => btn.addEventListener('click', () => {
			closeOverlay(btn.closest('.overlay'));
		}));
		document.querySelectorAll('[data-open-help]').forEach(btn => btn.addEventListener('click', () => openOverlay(els.helpOverlay)));
		document.querySelectorAll('[data-theme-toggle]').forEach(btn => btn.addEventListener('click', () => {
			setTheme(body.dataset.theme === 'light' ? 'dark' : 'light');
		}));
		document.querySelectorAll('[data-font-up]').forEach(btn => btn.addEventListener('click', () => adjustFont(0.05)));
		document.querySelectorAll('[data-font-down]').forEach(btn => btn.addEventListener('click', () => adjustFont(-0.05)));
		document.querySelectorAll('[data-random-page]').forEach(btn => btn.addEventListener('click', () => goRandom()));
		document.querySelectorAll('[data-roll]').forEach(btn => btn.addEventListener('click', () => goRandom(btn.dataset.roll)));
		document.querySelectorAll('[data-export-local]').forEach(btn => btn.addEventListener('click', exportData));
		document.querySelectorAll('[data-import-local]').forEach(btn => btn.addEventListener('click', () => {
			const input = document.getElementById('import-file');
			if(input) input.click();
		}));
		const importFile = document.getElementById('import-file');
		if(importFile){
			importFile.addEventListener('change', e => {
				const file = e.target.files && e.target.files[0];
				if(file) importData(file);
				e.target.value = '';
			});
		}
		if(els.bookmarkToggle){
			els.bookmarkToggle.addEventListener('click', toggleBookmark);
		}
		document.querySelectorAll('[data-mobile-nav]').forEach(btn => btn.addEventListener('click', () => document.body.classList.add('sidebar-open')));
		document.querySelectorAll('[data-close-sidebar]').forEach(btn => btn.addEventListener('click', () => document.body.classList.remove('sidebar-open')));
		if(els.searchInput){
			els.searchInput.addEventListener('input', e => performSearch(e.target.value));
		}
		document.querySelectorAll('[data-print-page]').forEach(btn => btn.addEventListener('click', () => window.print()));
	}

	function bindKeyboard(){
		document.addEventListener('keydown', e => {
			if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
				e.preventDefault();
				openOverlay(els.searchOverlay);
				els.searchInput && els.searchInput.focus();
			}
			if(e.key === '?'){
				e.preventDefault();
				openOverlay(els.helpOverlay);
			}
			if(e.key === 'Escape'){
				closeOverlay(els.searchOverlay);
				closeOverlay(els.helpOverlay);
				document.body.classList.remove('sidebar-open');
			}
			if(e.key.toLowerCase() === 'b' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){
				e.preventDefault();
				toggleBookmark();
			}
			if(e.key.toLowerCase() === 'r' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){
				e.preventDefault();
				goRandom();
			}
			if(e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){
				e.preventDefault();
				openOverlay(els.searchOverlay);
				els.searchInput && els.searchInput.focus();
			}
		});
	}

	initTheme();
	initFontScale();
	recordRecent();
	renderRecents();
	renderBookmarks();
	updateBookmarkToggle();
	initNotes();
	bindButtons();
	bindCategoryFilter();
	bindKeyboard();
	try{
		const data = await loadData();
		renderSidebar(data);
	}catch(err){
		if(els.sidebarTree){
			els.sidebarTree.innerHTML = '<div class="empty-state">Sidebar failed to load. Very on-brand, honestly.</div>';
		}
	}
})();
