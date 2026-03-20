
// ─── Firebase config ─────────────────────────────────────────────────────────
// To enable public editing for all visitors:
// 1. Go to https://console.firebase.google.com and create a project
// 2. Add a web app, copy the firebaseConfig object here
// 3. Create a Realtime Database, set rules to: { "rules": { ".read": true, ".write": true } }
// 4. Replace null below with your config object
const FIREBASE_CONFIG = null;
// Example:
// const FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "your-project.firebaseapp.com",
//   databaseURL: "https://your-project-default-rtdb.firebaseio.com",
//   projectId: "your-project",
//   storageBucket: "your-project.appspot.com",
//   messagingSenderId: "123456",
//   appId: "1:123456:web:abc"
// };

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

	function autoResize(el){
		el.style.height = 'auto';
		el.style.height = el.scrollHeight + 'px';
	}

	function inlineMd(text){
		return text
			.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
			.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
			.replace(/\*(.+?)\*/g,'<em>$1</em>')
			.replace(/`(.+?)`/g,'<code>$1</code>');
	}

	function renderMd(text){
		if(!text || !text.trim()) return '';
		const blocks = text.split(/\n\n+/);
		return blocks.map(block => {
			const t = block.trim();
			if(!t) return '';
			if(/^#{1,2} /.test(t)){
				const level = t.startsWith('## ') ? 4 : 3;
				return `<h${level}>${inlineMd(t.replace(/^#{1,2} /,''))}</h${level}>`;
			}
			if(/^[-*] /m.test(t)){
				const items = t.split('\n').filter(l => l.trim()).map(l => `<li>${inlineMd(l.replace(/^[-*] /,''))}</li>`).join('');
				return `<ul>${items}</ul>`;
			}
			return `<p>${inlineMd(t.replace(/\n/g,'<br>'))}</p>`;
		}).join('');
	}

	// ─── Firebase lore sync ───────────────────────────────────────────────────
	let firebaseDB = null;
	async function initFirebase(){
		if(!FIREBASE_CONFIG) return;
		try{
			const app = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
			const db = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
			const fireApp = app.initializeApp(FIREBASE_CONFIG);
			firebaseDB = { db: db.getDatabase(fireApp), ref: db.ref, set: db.set, onValue: db.onValue };
		}catch(e){
			console.warn('Firebase init failed, falling back to localStorage:', e);
		}
	}

	async function firebaseGet(path){
		if(!firebaseDB) return null;
		return new Promise(resolve => {
			const r = firebaseDB.ref(firebaseDB.db, path);
			firebaseDB.onValue(r, snap => resolve(snap.val()), { onlyOnce: true });
		});
	}

	async function firebaseSet(path, value){
		if(!firebaseDB) return;
		await firebaseDB.set(firebaseDB.ref(firebaseDB.db, path), value);
	}

	function firebaseListen(path, callback){
		if(!firebaseDB) return;
		const r = firebaseDB.ref(firebaseDB.db, path);
		firebaseDB.onValue(r, snap => callback(snap.val()));
	}

	// ─── Default entry descriptions ──────────────────────────────────────────
	const LORE_DEFAULTS = {
		// Power Ranking
		'jimmy-strong': `Jimmy Strong holds the undisputed #1 position in the SImps power ranking. No one fully agrees on how he got there — theories involve a gym, a protein shake incident, and possibly a dare. His physical capabilities defy known physics. His emotional availability is less documented.\n\nJimmy is not malicious. He is simply very, very strong, and the universe has organized itself accordingly.`,
		'terry-davis': `Ranked #2 in the power ranking, Terry Davis exists in permanent proximity to the top spot without ever quite reaching it. This is not for lack of power — Terry's capabilities are genuinely staggering — but because Jimmy Strong exists and the two are not the same person.\n\nTerry has made peace with this. Mostly.`,
		'god-dios': `God/Dios occupies the third position in the power ranking, which is remarkable considering most gods in this universe land much lower. The dual name (God/Dios) suggests either a bilingual deity or two entities who share a portfolio and refuse to settle the question. Omnipotence is confirmed. Omniscience is disputed.`,
		'the-sun-god': `The Sun God ranks #4, which may disappoint those who expected a solar deity to outrank everything. The Sun God presides over the actual sun — a fact that becomes relevant during outdoor sessions. Their presence raises the ambient temperature and UV index measurably.\n\nThey are not always literal about the sun. Sometimes they are metaphorical about it, which is worse.`,
		'detective-steven-saves-christmas': `Detective Steven is ranked #5 specifically in the Christmas-saving configuration. His standard detective form is somewhat lower on the ranking; it's the holiday context that unlocks his true potential. He has saved Christmas at least once and carries the achievement as both a title and a personality trait.\n\nThe exact mechanism by which Christmas was saved is classified.`,
		'terragirl': `Terragirl ranks #6 and commands earth-based powers — terrain manipulation, geological patience, and an inherent understanding of load-bearing structures. She is grounded in the literal and the figurative sense. Enemies who underestimate her tend to fall into holes that weren't there a moment ago.`,
		'master-of-instruments': `The Master of Instruments (#7) controls every musical instrument simultaneously. This is less about playing music and more about weaponizing it — a cello can become a siege engine in the right hands, and these are the right hands. The Master does not perform. The Master *conducts*.`,
		'glow-baby': `Glow Baby (#8) is exactly what the name suggests: an infant who glows. The glow is not decorative. It functions as a power source, a threat deterrent, and at maximum output, a visible landmark from orbit. Glow Baby does not speak yet but communicates through luminosity gradients.\n\nCare instructions are incomplete.`,
		'anthropomorphic-oklahoma': `Oklahoma, manifested as a person. Ranked #9. Anthropomorphic Oklahoma embodies the state in full — its weather volatility, its stoic prairies, its complicated relationship with tornadoes. Conversations with it tend to drift toward wide open spaces and a low-grade sense of inevitability.\n\nIt smells faintly of red dirt and possibility.`,
		'gigadragon': `Gigadragon is the largest dragon in the known SImps multiverse and ranks #10 overall, simultaneously occupying both the power ranking and the creatures index. The prefix "giga" is literal. Standard dragon encounters take minutes; Gigadragon encounters take structural rescheduling.\n\nIt is not evil so much as *large* in a way that forecloses most options.`,
		'god-of-war': `The God of War ranks #11, which places it below several non-war entities and at least one baby. This is considered embarrassing by traditional theological standards and is not discussed in front of the God of War. Combat capabilities remain extreme. The ranking is more about context than power ceiling.`,
		'the-king-who-must-be-pleased': `The King (Who Must Be Pleased) is ranked #12. The parenthetical is mandatory — it is part of the title, not a descriptor. Pleasing the King is the primary mechanic of any encounter involving him. What constitutes "pleased" shifts. What happens when he is displeased does not.`,
		'tony-stony-punch': `Tony Stony, operating in punch mode, ranks #13 and is one of the four Volcano Beings alongside Elizabeth, Lizzie, and Chichibongo. His designated combat style is the punch. He has no other style. Within the punch discipline, however, Tony Stony has achieved a level of refinement that most multiclass fighters cannot reach.`,
		'elizabeth-stomp': `Elizabeth (stomp) ranks #14 among the Volcano Beings. Her combat paradigm is the stomp — vertical force, seismic implications, zero subtlety. She and Tony Stony have an unspoken rivalry about who causes more structural damage per encounter. The data favors Elizabeth but Tony contests the methodology.`,
		'lizzie-stare': `Lizzie (stare) is the third Volcano Being, ranked #15. The stare is her weapon, and it functions as both an attack and a sustained environmental hazard. Extended contact with the stare produces effects that have not been fully catalogued. Short contact produces significant discomfort.\n\nLizzie blinks at tactically chosen intervals.`,
		'chichibongo-dance': `Chichibongo (dance) rounds out the Volcano Beings at #16. Do not let the dance framing mislead you. The dance is a combat system with roots in Volcano Island tradition, and Chichibongo executes it with precision that looks improvised but isn't. Every stomp and spin has a target.`,
		'tiny-stony': `Tiny Stony (#17) is the smaller version of Tony Stony. The size reduction is real; the power reduction is contested. Tiny Stony operates under the theory that concentrated mass punches harder than distributed mass, and has enough evidence to keep the argument going.`,
		'the-mighty-duck': `The Mighty Duck (#18) is a duck of significant power. The title "Mighty" was not self-assigned. It was given after an incident that the duck does not discuss but that several witnesses describe using the same word: *mighty*. Wingspan is a factor. Quacking is a weapon.`,
		'rabby-the-rabbit': `Rabby the Rabbit (#19) is a rabbit of unusual capability. The diminutive name is not reflective of threat level. Rabby operates in the mid-tier of the power ranking through a combination of speed, unexpected ferocity, and what observers have called "structural confidence for a prey animal."`,
		'soviet-matt-with-nuke': `Soviet Matt (#20) is Matt in his Soviet configuration, accompanied by a nuclear weapon. The nuke is fully operational. Soviet Matt's ranking of #20 reflects the SImps universe's complex relationship with escalation — the weapon does not automatically guarantee top-five placement when the wielder lacks the intent to use it at full yield.`,
		'bort': `Bort (#21) has a name and a power ranking and very little else documented. What Bort does, exactly, is unclear. That Bort does *something* at power-ranking level is not in dispute. Bort occupies the #21 spot with an energy of someone who does not feel the need to explain themselves.`,
		'gigashark': `Gigashark (#22) is to sharks what Gigadragon is to dragons: the largest, most structurally significant member of the category. Operating primarily in aquatic and near-aquatic environments, Gigashark's power ranking reflects raw predatory capability combined with an ability to appear in bodies of water that should not contain a shark of this size.`,
		'ahmad-punching-joy-to-death': `Ahmad Punching Joy to Death (#23) is catalogued by the act rather than a standalone identity. Ahmad is punching Joy to death. This is the entry. Whether this is a recurring event, a one-time occurrence, or a permanent state of affairs is a matter of ongoing wiki debate. Joy's current status: unknown.`,
		'lord-fertittle': `Lord Fertittle (#24) holds a title, which implies a domain, which implies responsibilities, which Fertittle may or may not be meeting. The name suggests something agricultural or ancient. The power ranking placement of #24 suggests someone who has been at this for a long time and has accumulated power without attracting more attention than necessary.`,
		'emo-fist-superhero': `The Emo Fist Superhero (#25) is a superhero whose power is the emo fist — a punch that carries both physical force and emotional weight. The emotional component may be the more dangerous one. Being struck by the emo fist reportedly leaves the target questioning choices they made years ago.`,
		'bob-ghost-kid-slasher': `Bob (#26) is a ghost, specifically a kid ghost, specifically a slasher. The category combination (ghost + kid + slasher) creates a threat profile that is difficult to counter using standard methods. Ghost countermeasures don't fully work because he's also a slasher. Slasher countermeasures don't fully work because he's also a ghost. The kid element adds a layer of ethical complication.`,
		'warden': `The Warden (#27) administers something — a prison, a realm, a process. The Warden's power lies less in physical capability and more in institutional authority: the ability to determine who stays, who goes, and what the rules are. Challenging the Warden is possible. Getting out of wherever the Warden decides you belong is harder.`,
		'octopus-lie-detector-church-of-the-eight-sided-star': `The Octopus Lie Detector of the Church of the Eight-Sided Star (#28) serves a religious organization whose geometry is central to its theology. The octopus functions as a sacred instrument of truth — eight arms, each monitoring a different signal, producing a verdict that the Church treats as binding. Its accuracy rating is described as "theologically guaranteed."`,
		'lamppost-vampire-hunter': `The Lamppost Vampire Hunter (#29) is a vampire hunter that is, physically, a lamppost. This creates tracking complications and mobility limitations that the Lamppost has apparently compensated for through sheer specialization. It does not move. Vampires are drawn to light. The rest follows.`,
		'medusa': `Medusa (#30) needs little introduction but gets one anyway: the original stone-gaze entity, operating in the SImps universe with her classical powers intact. The ranking of #30 is not an insult — it reflects a crowded field above her. Any encounter involving direct eye contact ends the same way it always has.`,
		'tommy-the-rattlesnake': `Tommy the Rattlesnake (#31) operates on the assumption that Mirage is real. If Mirage is real, Tommy's capabilities are substantially higher than baseline rattlesnake. If Mirage is not real, Tommy is still a rattlesnake ranked #31 in a universe full of gods, which suggests the rattlesnake thing is genuinely formidable.`,
		'queen-grandmother-mother-frog': `The Queen Grandmother Mother Frog (#32) holds three titles simultaneously, which is either ceremonial redundancy or evidence of three distinct roles fulfilled by one frog. She presides over frog-adjacent governance, amphibian lineage disputes, and at least one pond that functions as a seat of power.`,
		'mr-awesome-rodriguez': `Mr. Awesome Rodriguez (#33) has a name that is doing a lot of work. The "Mr." implies professionalism. "Awesome" is a self-assessment that the power ranking has validated. "Rodriguez" grounds him. He operates at #33 with the confidence of someone who has always known they belong in the top third.`,
		'christmas-genie-twins-one-with-cards-one-with-coins': `The Christmas Genie Twins (#34) are a matched set: one carries cards, one carries coins, and together they cover the full spectrum of holiday wish-granting mechanics. They operate on Christmas logic, which means their power is seasonal but intense when active. Wishes granted by the card twin tend to be specific. Wishes granted by the coin twin tend to be literal.`,
		'giant-wheat-germ': `Giant Wheat Germ (#35) is large, nutritionally dense, and armed. The wheat germ origin story — the embryo of the wheat plant, the most concentrated part — has been scaled up to threat level. What Giant Wheat Germ wants is unclear. That it has preferences is evident from its ranking.`,
		'gibberish-radish': `The Gibberish Radish (#36) communicates exclusively in gibberish and is a radish. This would normally suggest a limited power ceiling; the #36 ranking suggests otherwise. The gibberish may not be random. Several SImps scholars believe the Gibberish Radish is transmitting information in a language that has not yet been decoded.`,
		'battletoad': `Battletoad (#37) is a toad with battle capability. Named after something, probably. The combat orientation is baked into the title — this is not a toad who battles occasionally; this is a toad for whom battle is the primary mode of existence. Encounters in aquatic or swampy terrain are notably more dangerous.`,
		'gta-protag': `The GTA Protag (#38) operates on Grand Theft Auto physics and ethics — a combination that in a TTRPG setting creates massive tactical flexibility and a concerning relationship with civilian casualties. The protagonist framing means they always have a mission. The GTA framing means that mission can be abandoned at any moment for something more immediately interesting.`,
		'giant-snake-slasher': `The Giant Snake Slasher (#39) is both a giant snake and a slasher, not merely a slasher who happens to be a snake. The slasher mechanics (persistence, inability to be permanently stopped, horror atmosphere) are amplified by the snake mechanics (constriction, venom, no legs). The combination is considered one of the more unpleasant in the creature index.`,
		'chompy-the-giant-alligator': `Chompy the Giant Alligator (#40) chomps. The name is fully descriptive. Chompy is a giant alligator whose primary interaction with the world is chomping, and at giant scale, the chomping has consequences. Chompy does not appear to have a secondary trait. The chomping is sufficient.`,
		'bessie-the-cow': `Bessie the Cow's milk enslaves minds. This is not a minor side effect or an occasional occurrence — it is the central mechanic of Bessie's power. The milk is the weapon. Bessie (#41) is otherwise a standard cow, which makes the mind-enslaving milk more alarming, not less, because nobody suspects the cow.`,
		'big-giorno': `Big Giorno (#42) is Giorno at a larger scale — whether this means physical size, narrative scale, or stylistic intensity is context-dependent. At #42, Big Giorno commands enough power that the "big" prefix is load-bearing. Flower-related imagery may be involved. Gold Experience is plausible.`,
		'negative-20-genie': `The Negative $20 Genie (#43) grants wishes that subtract twenty dollars from you per wish, or alternatively is a genie that operates at a net negative, giving you something while taking more. The mechanism is economically hostile. The genie is probably aware of this. The ranking of #43 suggests the genie has leverage beyond the financial dimension.`,
		'bloogorf': `Bloogorf (#44). The name is the primary documentation. Bloogorf exists at #44 in the power ranking, which is a significant position, and does so without extensive paperwork. What Bloogorf is made of, where Bloogorf comes from, and what Bloogorf wants remain open questions that the wiki hopes someone will eventually answer.`,
		'5000-zombie-chickens': `Five thousand zombie chickens (#45) functioning as a single ranked entity. The threat is less about any individual zombie chicken — which is manageable — and more about the *five thousand* part, combined with the undead persistence and the collective behavior that emerges when that many chickens share a single motivation.`,
		'time-wizard-john': `Time Wizard John (#46) is a time wizard, specifically John. The name "John" does a lot of tonal work here — it makes a time wizard seem like someone you could call. John can manipulate temporal flow, revisit or skip sections of the timeline, and generally cause the narrative problems that come with unrestricted time access. He is accessible. That is the problem.`,
		'robo-host': `Robo Host (#47) is a robotic hosting entity — it runs events, manages guests, controls the room. The host function is the power: whoever controls the format controls the outcome. Robo Host's mechanical nature means the hospitality never lapses even when the situation becomes hostile. The smile is permanent.`,
		'mother-barron': `Mother Barron (#48) is the progenitor of Barron and Barroness, which puts her above both in the ranking. The Barron family occupies three consecutive slots in the mid-tier power ranking (#48–50), suggesting a family whose collective gravitational pull keeps each member elevated. Mother Barron is the anchor.`,
		'barroness': `The Barroness (#49) occupies the middle slot of the Barron family tier. Her title and ranking place her between her mother and her sibling, which is either a position of mediation or a position of pressure. The Barroness's individual capabilities are documented separately from the family unit, though the family unit is where most encounters occur.`,
		'barron': `Barron (#50) rounds out the Barron family triad at the bottom of their shared tier. This is not a low ranking — #50 out of 119 ranked characters is solidly mid-tier — but within the family, Barron is consistently third. Whether Barron finds this motivating or has made peace with it varies by session.`,
		'swiss-ski-children-trainees': `The Swiss Ski Children Trainees (#51) are children, they are Swiss, they ski, and they are trainees — which means they haven't reached full potential yet. The #51 ranking reflects their current state. At full certification, some projections have the Swiss Ski Children significantly higher. The ski school is somewhere between a training facility and a power incubator.`,
		'principal-of-the-ski-school': `The Principal of the Ski School (#52) oversees the Swiss Ski Children Trainees and has shaped the institution that is producing ranked combatants. The Principal's power derives from position, curriculum, and the specific kind of authority that comes from controlling the conditions of development. What the ski school is actually training children *for* is a persistent wiki question.`,
		'the-fucktree': `The Fucktree (#53) is a tree. Its name is its only descriptor, and it is sufficient. The Fucktree occupies both the power ranking and the Names & Titles index, suggesting it functions as a landmark, a concept, and a combatant simultaneously. It does not move. Things happen around it. It is ranked accordingly.`,
		'grave-robber-instruments': `The Grave Robber Instruments (#54) are musical instruments with a grave robbery background — either made from materials sourced from graves, wielded by a grave robber, or both. They play music that should not be heard by the living, which they do regardless. The combination of instrument and necromantic provenance creates a sound profile that the power ranking takes seriously.`,
		'moon-witch': `The Moon Witch (#55) derives power from the moon in the traditional sense and several non-traditional ones. Lunar cycles are her clock, her fuel source, and her calendar. At full moon, the Moon Witch operates at peak capacity. At new moon, she is present but quiet. She is always watching the sky to see what she is currently capable of.`,
		'durg-with-laser-crown': `Durg (#56) wears a laser crown, which is a crown that fires lasers. This is either a weapon, a status symbol, or both — the SImps universe does not always distinguish between the two. Durg's baseline capabilities are supplemented significantly by the crown, and the crown is not something one can simply remove without escalating the encounter.`,
		'lice-laser-head': `Lice Laser Head (#57) has head lice that fire lasers. The lice are the weapons. The host is the platform. This ranking reflects the combined output of the lice-as-laser-system rather than any personal combat capability of the head involved. The lice appear to operate autonomously and with considerable tactical coordination.`,
		'angel-sarah': `Angel Sarah (#58) is an angel named Sarah. The name grounds a celestial entity in something familiar, which is either reassuring or specifically designed to put you off guard. Angel Sarah operates with divine authority and personal warmth; the warmth is genuine and the authority is non-negotiable.`,
		'god-of-time': `The God of Time (#59) ranks below the God of War, which in any other universe would be surprising. In the SImps universe, it reflects the law of diminishing returns on omnipotence when the field is already crowded with gods. The God of Time controls temporal flow, causality, and deadline anxiety. The God of Time is always technically on time.`,
		'droidy-with-parental-controls-off': `Droidy with Parental Controls Off (#60) is a robot whose safety constraints have been removed. The parental controls were doing significant work. Without them, Droidy operates at full, unfiltered capacity — which is high enough to land at #60 in the full ranking. Droidy with parental controls on is charming. Droidy without them is a different conversation.`,
		'gryphon-from-shakespeare-run': `The Gryphon from Shakespeare Run (#61) appeared during a Shakespeare-themed set and decided to stay. Classical gryphon attributes — eagle head, lion body, fierce loyalty, and a tendency to guard treasure — operate within an improvisational framework, which makes the gryphon's behavior less predictable than mythology suggests.`,
		'winona-weatherby': `Winona Weatherby (#62) has a name that implies either Victorian pedigree or a character from a coastal mystery novel. The power ranking at #62 suggests neither origin story fully contains her. Winona's capabilities have not been exhaustively documented, but the name alone has earned her a reputation that precedes her.`,
		'ambi-the-ambulance': `Ambi the Ambulance (#63) is an ambulance who has achieved personhood and a power ranking. Ambi operates in emergency contexts by design but functions as an independent agent by choice. The sirens are a personality trait. The medical equipment is a weapon and a gift depending on who you are and what you've done. Ambi is not neutral.`,
		'queen-lilac': `Queen Lilac (#64) reigns over a domain that carries her color — purple, fragrant, associated with royalty and mild hallucination. She and King Oliver (#65) share consecutive rankings and presumably a court. Queen Lilac's power derives from her title, her domain, and the specific authority that comes from being the lilac queen and knowing exactly what that means.`,
		'king-oliver': `King Oliver (#65) is the king, presumably of wherever Queen Lilac rules or an adjacent territory. The consecutive rankings suggest coordination or at least mutual recognition. King Oliver's power is institutional rather than personal, which in the SImps power ranking still counts for more than it would in a strictly physical universe.`,
		'horace-duncan': `Horace Duncan (#66) appears as an individual and as the head of the Horrace Duncan + Elephants faction, which means his personal ranking is supplemented by elephant-related capabilities that carry over into solo encounters. A man with elephants at his disposal, ranked #66, is someone who has thought carefully about leverage.`,
		'leo-the-lemon-lion': `Leo the Lemon Lion (#67) is a lion who is also a lemon — either lemon-colored, lemon-flavored, or derived from lemon in some categorical sense. The combination produces a creature that is both predatory and citrus, which is an unusual sensory profile for a threat. Leo's mane may be yellow for the right reasons.`,
		'zoom-bear': `Zoom Bear (#68) is a bear who participates in video calls. Whether this is the bear's natural habitat or a modern adaptation is unclear. The power ranking at #68 reflects capabilities that translate across physical and digital space. Zoom Bear's camera presence is reportedly intimidating in ways that bears in person are not.`,
		'robin-ghost': `Robin Ghost (#69) is the ghost of Robin — which Robin is not specified, and the ambiguity is load-bearing. The ghost state grants standard incorporeal advantages; the Robin identity grants whatever Robin's original capabilities were, preserved post-death and operating at full power without the physical limitations of living.`,
		'jaw-unhinger-window-thrower': `The Jaw Unhinger, Window Thrower (#70) is a being defined by two coordinated capabilities: it unhinges jaws and throws windows. The jaw unhinging is biological disruption. The window throwing is environmental offense. Together, they describe an encounter that starts structurally and ends anatomically.`,
		'acid-breath-baby': `Acid Breath Baby (#71) is an infant whose breath is acid. The baby framing is not protective — the ranking confirms this. Standard infant vulnerability metrics do not apply to Acid Breath Baby. The acid breath is involuntary, which may or may not make encounters with it better or worse depending on your perspective on intent.`,
		'balloon-sensei': `Balloon Sensei (#72) is a sensei made of balloon, or a sensei whose teaching methodology involves balloons, or both. The sensei framing implies a lineage of knowledge and a student relationship; the balloon framing implies impermanence and the constant low-level threat of popping. Balloon Sensei's lessons are brief but they stick.`,
		'stalagmike': `Stalagmike (#73) is a stalagmite named Mike, or Mike who has become a stalagmite, or a stalagmite that achieved the name Mike through unclear processes. The geological patience of a stalagmite combined with a personal name creates a specific character energy: ancient, stable, and unwilling to be moved.`,
		'puppet-master': `The Puppet Master (#74) controls puppets — but in the SImps universe, "puppets" may extend beyond marionettes to any entity that can be controlled through strings, literal or otherwise. The Puppet Master's ranking reflects the aggregate power of their puppets plus the leverage that comes from never being directly in the room.`,
		'japanese-balloon-boy': `Japanese Balloon Boy (#75) is a boy, from Japan, who is or carries balloons of significance. The specific national attribution grounds a floating phenomenon. The balloon element again suggests lightness as a power vector. Japanese Balloon Boy's ranking at #75 puts him in the company of genuinely formidable entities.`,
		'fairy-godmother': `The Fairy Godmother (#76) grants wishes, imposes deadlines, and operates on enchantment logic that includes consequences for non-compliance. The classic archetype functions as written in the SImps universe but with the awareness that the enchantments she provides have a cost structure she does not always disclose upfront.`,
		'god-of-squirrels': `The God of Squirrels (#77) is a deity with an extremely specific portfolio. The squirrels are loyal, numerous, and operating at divine instruction. The God of Squirrels also heads the God of Squirrels + Babies faction, which suggests the divine portfolio has expanded in a direction that the universe is still processing.`,
		'witch-willifred': `Witch Willifred (#78) curses you to get smaller as you age. The curse is specific, slow-acting, and eventually decisive. Willifred is also the entity who defeats Dwayne the Rock Johnson for image rights (#80), which establishes a precedent: she wins fights that look unwinnable. Do not underestimate her based on the aging mechanic.`,
		'detective-adams': `Detective Adams (#79) is a detective. The detective archetype in the SImps universe carries genuine investigative capability and the narrative momentum that comes from being the person who figures things out. Adams operates mid-tier, below the more spectacular detectives but above most non-investigators.`,
		'dwayne-the-rock-johnson-loses-to-willifred-for-image': `Dwayne the Rock Johnson (#80) appears in the ranking specifically in the context of losing to Witch Willifred for image rights. This is the documented encounter that defines his presence in the wiki. His physical capabilities are the ones you already know. The image rights loss is a permanent footnote.`,
		'scream-flower': `The Scream Flower (#81) is a flower that screams. The screaming is continuous or triggered — the exact mechanic varies by encounter. As a creature entry, the Scream Flower operates in environments where its screaming has tactical value: it disrupts concentration, signals danger, and as a constant presence, makes everything worse.`,
		'invisible-washed-up-man': `The Invisible Washed Up Man (#82) is invisible, and also washed up. The combination is specific: not washed up in the sense of forgotten, but in the sense of having arrived somewhere unexpected via the ocean. The invisibility makes this worse. You cannot see him and yet he is very much there, dripping, on your shore.`,
		'chomp': `Chomp (#83) just chomps. There is no secondary mechanic. The chomping is the thing. Whatever Chomp encounters, it chomps. The ranking at #83 reflects the cumulative effect of persistent, single-minded chomping applied to everything that enters range. Simple systems, scaled up, are sufficient.`,
		'matt-evil-bachelor': `Matt Evil Bachelor (#84) is Matt, who is evil, who is a bachelor. The three qualifiers combine into a specific archetype: someone who has made peace with villainy and has no domestic obligations, which frees up significant time and resources for schemes. Matt Evil Bachelor's evil is domestic in scale but personal in commitment.`,
		'depressed-minions-big-day': `The Depressed Minions (#85) are having a big day, which is either a good thing or a relative term. Minions are depressed; the big day is occurring anyway. The collective nature of the minion format means the depression is averaged across a group, which makes individual encounters with any single depressed minion feel manageable until you remember there are others.`,
		'book-demon': `The Book Demon (#86) lives in a book, emerges from a book, or is a demon made of books. The library is its habitat. The knowledge it carries is the source of its power, and like all book-based entities, it is impossible to fully defeat because you cannot unwrite what has already been written.`,
		'chicken-nugget-spies': `The Chicken Nugget Spies (#87) are intelligence operatives disguised as chicken nuggets. The disguise is the capability: nobody suspects the nuggets. They report, infiltrate, and gather information while being consumed at an alarming rate by people who don't realize what they're interacting with. The mission brief is printed in very small font.`,
		'cage-wolf': `Cage Wolf (#88) is a wolf in a cage, or a wolf called Cage, or a wolf whose powers are cage-related. The cage framing could mean containment (threatening) or origin (escaped). Either way, a wolf that has been through the cage experience and survived at #88 power-ranking level is operating at a threat tier that the cage presumably couldn't hold permanently.`,
		'boris': `Boris (#89) is Boris. The name is the full descriptor available. Boris exists at #89 in the power ranking with minimal documentation and maximum presence. Encounters with Boris are brief in the notes section. Boris does not require extensive explanation. Boris handles things.`,
		'smurg': `Smurg (#90) is a being of uncertain origin and clear capability. The name evokes something ancient and slightly wrong, which matches the vibe of an entity ranked #90 without extensive documentation. Smurg is present in the power ranking because the power ranking cannot ignore Smurg.`,
		'servebot': `Servebot (#91) is a service robot who also appears in the Smartest Characters list — the only entity in both categories. This dual ranking reveals something important: Servebot serves, but Servebot understands. The service is intelligent. What Servebot is learning from all those interactions is not documented but should be.`,
		'5-year-old-with-a-gun': `The 5 Year Old with a Gun (#92) is dangerous in the specific way that combines total capability with zero restraint. The gun is the weapon; the five-year-old is the threat multiplier. The combination produces encounters that are difficult to de-escalate through standard negotiation because the five-year-old is operating on five-year-old logic with adult-level armament.`,
		'gesticulana-quadrilatipus-jane': `GesticuLana / Quadrilatipus / Jane (#93) is a single entity with three names and presumably three forms or modes. GesticuLana suggests gesture-based power. Quadrilatipus suggests four limbs of some kind. Jane grounds it. The slash-separated names indicate these are not aliases but genuinely different configurations of the same being.`,
		'monster-high-school-priscilla': `Monster High School Priscilla (#94) attends or operates within Monster High School and represents the specific threat tier of a monster who has also gotten through high school, which is itself a survival challenge. Priscilla's capabilities are shaped by the Monster High School curriculum, whatever that involves.`,
		'kaelyns-reflection': `Kaelyn's Reflection (#95) is not Kaelyn but the reflection of Kaelyn — a mirror-image entity with independent ranking and presumably inverted or reflected capabilities. The reflection being ranked separately from Kaelyn (who appears elsewhere in the metaverse variants) suggests it has achieved some degree of independence from the source.`,
		'tonko': `Tonko (#96) occupies the late-tier of the power ranking with minimal documentation. The name is distinctive. The power is confirmed by placement. Tonko exists in the SImps universe at a rank that puts it above 23 other entities, which is enough to make Tonko a figure of consequence regardless of the annotation gap.`,
		'vidya-riddle-dragon': `Vidya Riddle Dragon in Radioprov (#97) poses riddles on the radio. This is a dragon operating in the broadcasting medium, which creates a threat profile centered on information warfare and puzzle-based traps that play out over the airwaves. The riddles are not optional. The consequences of wrong answers are on-brand for a dragon.`,
		'matts-german-leprechaun': `Matt's German Leprechaun Cautionary German Folktale (#98) is a leprechaun with German national framing embedded in a cautionary story structure. The triple classification (Matt's, German, Cautionary) suggests this character was created to teach a lesson, is Matt's creation or property, and has been located in the wrong national tradition entirely.`,
		'santa-claus-uber-driver': `Santa Claus Uber Driver (#99) is Santa operating in the gig economy. The reindeer have been replaced by a vehicle. The gift delivery remains, technically, but the route optimization is now algorithmic. Santa Claus Uber Driver ranks #99, which puts him just outside the top-tier bracket — a position Santa finds familiar from December scheduling pressure.`,
		'siri-both-forest-spirit-and-voice-on-gps': `Siri (#100) holds a dual identity: she is both a forest spirit and the voice on your GPS. These two roles are not contradictory in the SImps universe. The GPS voice has always been suspiciously confident about routes through places no one has been. The forest spirit framing explains why.`,
		'hannah-robot-arm-endurance': `Hannah Robot Arm Endurance (#101) is defined by the endurance test implied in the name: a robot arm, Hannah, tested for endurance. Whether Hannah is the robot arm or Hannah is operating a robot arm in an endurance challenge is unclear. Either way, the endurance has been impressive enough to secure a power ranking placement.`,
		'salamandra': `Salamandra (#102) is small but immortal. The parenthetical is the key fact: the size is irrelevant. Immortality means all encounters with Salamandra are effectively one-sided in the long run. She may lose individual battles. She will not lose the war. The small size just makes her harder to find.`,
		'peckys-mom': `Pecky's Mom (#103) derives her ranking from being the mother of Pecky, whoever Pecky is, combined with capabilities that exceed what that origin story typically produces. The mom framing in the SImps universe tends to indicate someone operating with complete information, high stakes, and the specific ferocity of a parent who has decided something needs to be handled.`,
		'dj-dillo': `DJ Dillo (#104) is an armadillo who DJs. The armored exterior is a costume and a natural defense system simultaneously. DJ Dillo's power ranking reflects both the musical capability (crowd control, mood manipulation, sonic territory) and the armadillo capability (defensive rolling, impenetrability). The crossfade is deadly.`,
		'kong-of-mars': `Kong of Mars (#105) is Kong, relocated to Mars. The Martian context changes things — lower gravity, red dust, an audience of Martian entities unfamiliar with Kong-based threats. Kong of Mars operates with all the original Kong attributes plus whatever Mars has done to Kong's physiology during the adaptation period.`,
		'deedeemon': `Deedeemon (#106) is a demon with a name that sounds like it's being announced. The double-E double-O construction creates something that is simultaneously name and sound effect. Deedeemon operates near the bottom of the power ranking's top tier as an entity that is definitely demonic and definitely named Deedeemon.`,
		'cat-whisperer': `The Cat Whisperer (#107) communicates with cats in the specific register that cats respond to. This is rarer than it sounds. Cats don't respond to most things. The Cat Whisperer has access to the full intelligence network of every cat in range, which in any urban or domestic environment is extensive.`,
		'maxtus-pemberton': `Maxtus Pemberton (#108) has a name with the weight of an institution behind it. The double consonants in "Maxtus" and the old-money register of "Pemberton" create a character who has been powerful for a long time and knows how to make that power feel inevitable. Near the bottom of the ranking but not out of it.`,
		'fashionista-duo-from-julianna': `The Fashionista Duo from Julianna (#109) are two fashionistas, originating from Julianna, whose power derives from fashion — taste, presentation, the social weight of aesthetic judgment. Fashion as a power system in TTRPG tends to be underestimated until someone is underdressed at a crucial moment.`,
		'maitress-binda': `Maitresse Binda (#110) holds a French title (Maîtresse = Mistress/Teacher) that implies authority over a classroom or domain. She appears in both the power ranking and the Names & Titles index. Maitresse Binda's power is pedagogical authority, which in the SImps universe can be more binding than magic.`,
		'mr-peast': `Mr. Peast (#111) is near the bottom of the power ranking's middle tier, which still places him above 8 other ranked entities. The name is distinctive, the capabilities under-documented. Mr. Peast is present and accounted for and is not someone to dismiss based on ranking alone.`,
		'jeff-bezos': `Jeff Bezos (#112) appears in the power ranking at #112, which places him well into the lower tier of ranked entities. The SImps universe has gods, dragons, and animate states of Oklahoma ranked above him. This is either a commentary or simply accurate.`,
		'falling-accountantsdd': `The Falling Accountants (#113) are accountants, and they are falling. The double-D suffix in the slug suggests either a typo that became canonical or a specific variant of falling accountant. As a power ranking entity, the falling accountants represent the specific threat of numerical precision delivered from above.`,
		'water-goblin': `Water Goblin (#114) is a goblin of water — either a goblin who controls water, a goblin made of water, or a goblin who lives underwater. The Water Goblin Kingdom (Underwater) is a separate arena entry, suggesting the Water Goblin has a domain. A goblin with a kingdom is more than a goblin.`,
		'sumps-ent': `Sumps Ent (#115) is an ent — a walking, talking tree entity — of uncertain origin. "Sumps" suggests either a drainage context or a name. The ent archetype carries ancient authority, slow movement, and the kind of patience that only beings measured in centuries possess. Sumps Ent near the bottom of the ranking doesn't mean Sumps Ent is small.`,
		'captain-incest': `Captain Incest (#116) holds a naval rank and a descriptor. The descriptor is the story. Captain Incest appears near the bottom of the power ranking, which still means they are a ranked entity in a universe that includes gods. The exact nature of the captaincy and the specific circumstances that produced the descriptor are not documented here.`,
		'vivi-lafont': `Vivi LaFont (#117) must save the world in five steps. The constraint is the character: she has exactly five moves available, and the world is at stake, and she knows it. Vivi's power ranking reflects the capability of someone who has operated under that constraint and has, apparently, managed.`,
		'squaddy-marcus': `Squaddy Marcus (#118) is near the bottom of the power ranking and also appears in the Names & Titles index. The "squaddy" framing implies he operates as part of a squad rather than independently, which may account for the lower individual ranking — his power is collective, and the individual number doesn't capture the full picture.`,
		'pumpkin-sam': `Pumpkin Sam (#119) is the last ranked character in the SImps power ranking. The pumpkin imagery suggests seasonal power, harvest associations, and the specific charisma of something that carves well. Being #119 out of 119 ranked entities still means being ranked. The wiki notes this distinction. Sam probably does too.`,

		// Creatures (non-power-ranking)
		'worlds-largest-dino-nug-unborn': `The World's Largest Dino Nug (Unborn) exists in a pre-hatched state, which means its full capabilities have not yet been unlocked. As an object, it occupies the relics index; as a creature, it is technically not yet one. The "world's largest" qualifier applies to the unborn state. Nobody has seen what hatches.`,
		'rhombus-and-rheembus': `Rhombus and Rheembus are a paired entity — two beings defined by geometric near-similarity. Rhombus is the shape. Rheembus is the rhyming companion whose exact form is not specified. They appear in both the creatures and Names & Titles indexes, which captures both what they are and the fact that their names are already doing significant work.`,
		'mouse-who-became-non-biology-professor': `A mouse who became a Non-Biology Professor. The specificity of "non-biology" is important — this mouse went into academia in a field that would seem to be its least relevant discipline, which is either a statement about the mouse's ambition or evidence of active avoidance. The mouse is tenured.`,
		'hal-ibut-fish-human': `Hal-ibut Fish Human is a pun that is also a creature: Hal, who is an ibut (halibut), who is a fish, who is also a human. The hybrid status creates a being that operates in multiple biological registers simultaneously. The name encodes the identity crisis so you don't have to ask.`,
		'musical-chimps': `The Musical Chimps are chimpanzees who play music. The combination produces a group whose capabilities fall somewhere between performance and threat. Musical Chimps operate with the improvisational instincts of primates and the structured framework of music theory, which is an unusual power combination.`,
		'waterfall-cat-spirit': `The Waterfall Cat Spirit is a feline entity associated with waterfalls — either residing in them, formed by them, or taking their form. Cat spirits in the SImps universe carry the typical cat attributes (unpredictability, selective cooperation, complete self-possession) amplified by elemental water association.`,
		'octopus-kraken-interviewee': `The Octopus Kraken Interviewee is an octopus of kraken-scale who is being interviewed, or has been interviewed, or exists specifically in an interview context. The interview framing implies the creature has something to communicate and someone has decided to ask. What it said is not in the wiki yet.`,
		'okapi-family': `The Okapi Family is a family unit of okapis — the giraffe-adjacent striped ungulates native to the Congo, now operating in whatever SImps terrain requires them. The family unit means this is a collective creature entry. Individual okapis are notable; an okapi family is a social structure with defensive implications.`,
		'jayda-audition-bear': `The Jayda Audition Bear is a bear associated with Jayda's audition — either the bear that appeared during the audition, a bear that Jayda played, or a bear that is auditioning. The audition context suggests performance anxiety and competitive stakes, which this bear has presumably resolved in its favor.`,
		'heroin-vampire-seb-audition': `The Heroin Vampire (Seb Audition) is a vampire whose characterization involves heroin, created or encountered during Seb's audition. The audition origin story is preserved in the name. It is a vampire. The additional detail is part of the character's documented essence.`,
		'kaelyns-nebulous-fog': `Kaelyn's Nebulous Fog is a creature and an atmosphere. The fog is Kaelyn's — either created by her, belonging to her, or constituting her in some nebulous configuration. As a creature entry, the fog is animate, has intent, and responds to being treated as environment when it should be treated as an entity.`,
		'sprinkles-the-cat': `Sprinkles the Cat is a cat named Sprinkles, which is either deeply wholesome or a contrast that the SImps universe is using intentionally. A cat with a power ranking-adjacent presence in the creature index is a cat with significance. Sprinkles is significant in ways the name partially obscures.`,
		'lemon-tree': `The Lemon Tree is a tree that produces lemons and, apparently, enough presence to merit a creature entry. In the SImps universe, citrus trees have agency. The Lemon Tree's power is slow, rooted, and seasonal — but the lemons have uses that go beyond the culinary.`,
		'frequency-fish-on-the-island': `The Frequency Fish on the Island is a fish that operates on specific frequencies, or a fish found on a specific island, or a fish that is itself a frequency. The island context isolates it. The frequency context makes it a transmission medium. The fish is both message and messenger.`,
		'clancys-6-playtpi': `Clancy's 6 Playtpi are six platypuses belonging to Clancy. The platypus as a creature is already improbable; six of them, owned by someone named Clancy, constitutes a faction-level threat. Platypi are venomous, semi-aquatic, and lay eggs. Clancy has six.`,
		'10-000-rats-in-a-truck': `Ten thousand rats in a truck. The truck is the delivery mechanism. The rats are the threat. Ten thousand is the quantity. The combination of infrastructure and rodent volume creates a mobile, deniable, overwhelming encounter that is difficult to counter using standard truck-stopping methods.`,

		// Gangs & Factions
		'orb-people-galaxy-council': `The Orb People — Galaxy Council are spherical beings who govern at the galactic scale. The Galaxy Council designation makes them one of the highest-tier administrative bodies in the SImps universe. They are also among the Smartest Characters, which explains how a faction of orbs is running a galaxy.`,
		'anthropomorphic-states': `The Anthropomorphic States are US states who have become people. Anthropomorphic Oklahoma leads the power ranking; the States as a faction include all the others, each with their own personality, weather system, and regional grievance. Operating as a bloc, they represent something close to an entire continent's worth of attitude.`,
		'volcano-4-beings': `The Volcano 4 Beings — Tony Stony, Lizzie, Chichi Bongo, and Elizabeth — are the four Volcano Island entities who each have a designated combat style (punch, stare, dance, stomp). As a faction, they pool these styles into a coordinated threat. They live on a volcano, which is both their origin and their arena preference.`,
		'belly-button-dual-wielders-w-time-bike': `The Belly Button Dual Wielders operate with two weapons, a time bike, and a body-focused power source that the name describes without fully explaining. The time bike allows temporal mobility. The dual wielding covers spatial offense. The belly button component is the unexplained variable that the faction has apparently weaponized.`,
		'mac-and-cheese-family-roger': `The Mac and Cheese Family includes Roger as a documented member. The family's identity is built around mac and cheese — its production, consumption, or metaphysical significance. Roger is the named representative. The faction implies a household-scale power structure that has expanded beyond its original mandate.`,
		'doodle-squad': `The Doodle Squad is a faction defined by doodling. This seems low-stakes until you consider that in the SImps universe, drawing something into existence is a documented power. The Doodle Squad has turned margin-note creativity into a tactical capability. Their threat is everything they haven't drawn yet.`,
		'moles-holding-up-us': `The Moles Holding Up US are moles who are physically supporting the United States — either the ground beneath it or the concept of it. The holding-up mechanic means they have enormous leverage: they can stop holding up. Whether this is a credible threat depends on whether you believe the moles are load-bearing.`,
		'horrace-duncan-elephants': `Horrace Duncan and his elephants operate as a faction because the elephants are not incidental. Duncan's individual ranking (#66) is supplemented by a group of elephants whose cooperation he has secured. Elephants in a faction context provide memory, physical force, and the specific social gravity of a very large animal that has decided to stay.`,
		'mermaids': `The Mermaids are a faction of aquatic humanoids with the usual capabilities — marine dominion, song-based influence, navigational knowledge — operating collectively. As a faction they control enough of the water-adjacent environments in the SImps universe to matter. Individual mermaids are powerful; the faction is a maritime governance structure.`,
		'siri-and-the-forest-spirits': `Siri and the Forest Spirits are the faction version of Siri's dual nature (#100 in the power ranking). As a group, the forest spirits operate under Siri's direction — or in collaboration with her — forming a network of nature entities that collectively cover more terrain than any individual spirit could.`,
		'big-jeff-and-the-motorcycle-gang': `Big Jeff leads a motorcycle gang, which in the SImps universe constitutes a faction with road infrastructure advantages, intimidation mechanics, and the specific physics of a large number of motorcycles arriving at once. Big Jeff's size is presumably load-bearing for the "Big" in his name.`,
		'apple-police': `The Apple Police are law enforcement organized around Apple — the company, the fruit, or a specific Apple product depending on the session. Their jurisdiction is tech-adjacent, their enforcement methodology involves product compliance, and their presence in an arena (any arena) raises questions about what exactly is being policed.`,
		'new-yorkers-at-busy-intersection': `New Yorkers at a Busy Intersection are a faction by virtue of proximity, shared grievance, and the specific combativeness that emerges when New Yorkers are grouped at a place where traffic should be moving but isn't. They are not organized. They do not need to be. The shared context generates coordination automatically.`,
		'25-milwaukee-brewers': `The 25 Milwaukee Brewers are a full baseball roster operating as a TTRPG faction. The 25-player complement means maximum substitution flexibility. The Milwaukee context means they play in conditions that build character. As a faction, the Brewers bring sports-adjacent teamwork to environments that did not anticipate a full baseball team.`,
		'city-of-ny-animals': `City of NY + Animals is New York City plus its animal population — rats, pigeons, raccoons, the occasional coyote — acting as a unified faction. The city provides infrastructure; the animals provide the intelligence network of every creature who has learned to live off human systems without being invited.`,
		'shakespeare-balloon': `Shakespeare Balloon is a faction that is also an object and also, apparently, Shakespeare. The balloon format suggests lightness, travel, and a certain theatrical fragility. Shakespeare as a faction leader brings dramatic structure, iambic authority, and a complete works' worth of applicable quotes to any encounter.`,
		'imagination-girl-slasher-mr-bojangles': `Imagination Girl — Slasher + Mr Bojangles is a faction pairing: Imagination Girl, who is a slasher, combined with Mr Bojangles. The slasher designation means Imagination Girl operates on horror-genre persistence mechanics. Mr Bojangles adds something — a name that suggests dance, old age, or a dog. The combination is unresolved.`,
		'rod-and-buster': `Rod and Buster are a duo faction, with Buster also appearing in the Smartest Characters list. The pairing implies complementary capabilities — Rod provides something Buster doesn't, and vice versa. That Buster is smart suggests their partnership is not random; there's a plan, and Rod is part of it.`,
		'dogplane-duo': `The Dogplane Duo is a partnership between a dog and a plane, or a dog-plane hybrid, or two beings who together constitute one flight-capable canine unit. The duo framing suggests interdependence. The dog and the plane need each other for something neither can do alone.`,
		'jupiter-aliens': `Jupiter Aliens are extraterrestrials from Jupiter — not from space generally, but specifically from the gas giant. Jupiter's environmental conditions shape the aliens' physiology and expectations. They are a faction because they arrived together and have maintained that coherence on arrival at wherever they've arrived.`,
		'god-of-squirrels-babies': `The God of Squirrels + Babies faction is the God of Squirrels (#77) operating with infant support. The babies are not the God of Squirrels's babies necessarily — they are babies who have been aligned with the squirrel deity's agenda. The squirrel-baby coalition is an unexpected faction configuration that has proven durable.`,
		'lice-gun-squad': `The Lice Gun Squad is a tactical unit operating with lice-based weapons. This may be related to Lice Laser Head (#57) or may be an independent lice weapons program. As a squad, the lice gun team represents an organized, scalable deployment of parasitic weaponry that most opponents have not prepared for.`,
		'mud-people': `The Mud People are a faction constituted of or from mud — either beings made of mud or people who have been in mud long enough that the mud has become identity. The mud affiliation gives them terrain advantage in any environment where mud is present, which in the SImps universe is more environments than you'd think.`,

		// Objects & Relics
		'catherines-mom-yell-mask': `Catherine's Mom Yell Mask is a mask that produces the specific yell of Catherine's mom. The yell has effects. Whether it is the volume, the content, or the maternal source that causes those effects is unclear. The mask stores and replays the yell with fidelity. Equipping it grants access to something that was not originally yours to use.`,
		'necronomicon-philosophy-show': `The Necronomicon Philosophy Show is either a Necronomicon that also hosts a philosophy show, or a philosophy show presented in Necronomicon format. Either way, it combines eldritch evil with academic discourse. The show has guests. The guests are probably not doing well.`,
		'snap-orb': `The Snap Orb is an orb that snaps — either producing a snapping sound with significant effects, or snapping in the Thanos sense, or functioning as a contained snap that can be deployed as a relic. The orb format suggests portability. The snap suggests consequences at the scale of whatever the orb is calibrated for.`,
		'rogers-time-machine': `Roger's Time Machine belongs to Roger, the kid genius of the Mac and Cheese Family and one of the Smartest Characters. A time machine in the hands of an inventor child is maximally dangerous — not because of malice, but because kid geniuses have not yet developed full appreciation for temporal causality.`,
		'horror-lamp': `The Horror Lamp is a lamp that produces horror rather than light, or a lamp that produces horror through light. It illuminates things that should not be seen. The lamp itself may be haunted, enchanted, or simply poorly manufactured in a universe where the quality control on illumination devices is unreliable.`,
		'animal-hybrid-machine': `The Animal Hybrid Machine (called "My Machine" by its operator) combines animals into hybrids. The possessive nickname suggests personal attachment. The machine's output — hybrid animals — populates the creature index with beings that would not otherwise exist. "My Machine" implies ownership and pride in results.`,
		'elephant-tusk': `The Elephant Tusk is an ivory relic with the weight of the elephant behind it — both physical weight and the moral and narrative weight of what it represents. In a universe where Horrace Duncan commands elephants and the Okapi Family is documented, the tusk carries lineage and consequence.`,
		'lilacs-sword': `Lilac's Sword belongs to Queen Lilac (#64) and functions as both her weapon and a symbol of her reign. A queen's sword in the SImps universe is not decorative. It has been used. The blade knows which realm it belongs to.`,
		'simps-lights': `The SImps Lights are the lighting infrastructure of SImps productions — the actual lights used in performances. In the SImps universe, this transcends production equipment to relic status. The lights have seen every bit, every character, every timeline collapse. They contain an archive.`,
		'simps-car': `The SImps Car is the vehicle associated with the SImps group. It has presumably transported people and props through situations the manual did not anticipate. The car's relic status reflects accumulated experience and possibly modification. It goes where it needs to go.`,
		'malaikas-big-time': `Malaika's Big Time is a relic defined by its relationship to a specific moment of triumph or consequence. "Big Time" as a relic suggests that the bigness of the time has been preserved in object form and can be accessed, replayed, or deployed. What Malaika's big time was is not specified but it was clearly significant.`,
		'flipside-segway': `The Flipside Segway is a Segway from the flipside — the reverse dimension, the negative space, the other side of whatever mirror the SImps universe contains. Standard Segway physics do not apply. The Flipside Segway moves in directions that regular Segways cannot. Its top speed is listed as "contextual."`,
		'beach-juice': `Beach Juice is a consumable relic of uncertain composition. It tastes like beach. Its effects range from mild to significant depending on the beach it came from and how much is consumed. Beach Juice occupies the objects index as evidence that in the SImps universe, liquids deserve documentation.`,
		'giant-toothpaste': `Giant Toothpaste is a tube of toothpaste scaled to an impractical size. The giant format turns a hygiene product into a deployable substance with area-of-effect applications. The minty pressure alone is notable. What the fluoride does at this scale has not been fully tested.`,
		'hotel-room-key': `The Hotel Room Key opens a hotel room. The room is the destination and the question — what is in the hotel room, why is the key a relic, and who checked out without returning it are the three relevant questions. Hotel rooms in the SImps universe contain things that hotel rooms in other universes do not.`,
		'master-phineas-medallion-transformation-tea': `Master Phineas' Medallion-Transformation Tea is a tea that, in combination with the medallion, produces transformation. Whether the tea alone transforms and the medallion focuses it, or whether neither works without the other, is unclear. Master Phineas made it. That's the provenance. It transforms.`,
		'boris-shoelace': `Boris' Shoelace is a shoelace belonging to Boris (#89). The shoelace being catalogued as a relic implies it has done something beyond standard shoelace function. Boris does not document his possessions extensively. The shoelace being in the wiki suggests someone else thought it was important.`,
		'stephanies-baby-teeth': `Stephanie's Baby Teeth are a biological relic — teeth that have been shed and preserved. In the SImps universe, baby teeth have the properties of a personal artifact: they contain something of the person they came from at an early age. What Stephanie's early age contained, the teeth remember.`,
		'dirty-rag': `The Dirty Rag is a cloth that has absorbed too much. What it has absorbed — fluid, magic, history, context — is not specified in detail. The dirt is the record. The Dirty Rag is a relic because the things it has cleaned up are now part of it and have given it properties that a clean rag does not possess.`,
		'cursed-microwave': `The Cursed Microwave heats things and curses them. The curse is applied during the heating cycle. What comes out of the Cursed Microwave is warm and affected in ways that depend on what went in. The microwave is plugged in and operational. Nobody has unplugged it.`,
		'2-second-hourglass': `The 2 Second Hourglass measures exactly two seconds. This is either useless or the most precise time-keeping instrument available for a very specific application. In a universe with time wizards and timeline resets, two seconds is a meaningful unit. The hourglass knows this.`,
		'tooty-delight': `Tooty Delight (carbo water + lime + barrel) is a beverage relic — carbonated water, lime, in a barrel. The barrel format suggests either aging, volume, or ritual. Tooty Delight is consumed at significant moments or in significant quantities. The "delight" is either accurate or ironic depending on what the barrel has been doing.`,
		'lanas-bedsheet-reflective': `Lana's Bedsheet (Reflective) is a bedsheet that reflects. Whether it reflects light, magic, attacks, or psychological projections depends on the encounter. The reflective property elevates it from domestic textile to tactical object. Lana owns it. The sheet was probably not always like this.`,
		'the-sword-that-cuts-through-time': `The Sword that Cuts Through Time does exactly what it says. The temporal cutting mechanic means it doesn't just wound enemies in the present — it removes the moment of their being. This is a high-tier relic. It is also a sword. These two things together explain why it has a page.`,
		'shiriels-missing-retainer': `Shiriel's Missing Retainer (improv and real) is missing in two registers simultaneously: in the improv fiction, it is a plot device; in reality, Shiriel's retainer was actually lost. The dual ontology makes this retainer unique in the relics index — it exists in performance and in fact.`,
		'hals-backpack': `Hal's Backpack belongs to Hal, presumably Hal-ibut Fish Human. What the backpack contains, how a fish-human carries it, and why it has achieved relic status are the three questions the wiki hasn't fully answered. The backpack is there. Hal is carrying it. The contents are presumably related to why.`,
		'simran-effigy-burned-on-football-field': `The Simran Effigy Burned on Football Field is a burned effigy of Simran, on a football field, which has achieved relic status through the specificity of the act. The football field gives it a venue; the burning gives it a ritual dimension; Simran's name gives it a target. The ash remains.`,

		// Kids
		'danielles-psych-terror-toddler': `Danielle's Psych Terror Toddler is a toddler who produces psychological terror. Belonging to Danielle (or in Danielle's care), the toddler's methods are age-appropriate in duration but professional in effect. Eye contact with the Psych Terror Toddler initiates a process.`,
		'telekinesis-armando-kid': `Telekinesis Armando Kid is a child named Armando with telekinesis. The kid framing means the power is uncontrolled, full-capacity, and operated without the restraint of an adult who has learned what not to lift. Armando moves things. The things he moves are the things he's thinking about.`,
		'ant-whisperer-superhero': `The Ant Whisperer Superhero is a superhero whose power is communicating with ants. This sounds limited. Ants have structural access to every building, are present in quantities that defeat most counting methods, and have been operating an agricultural civilization for millions of years. The Ant Whisperer has access to all of that.`,
		'kid-jesus': `Kid Jesus is Jesus, as a kid. The pre-ministry period, the formative years, the divine childhood. In the SImps universe, Kid Jesus has the full theological backstory but is operating in a ten-year-old's body, which means the miracles are real but the emotional regulation is a work in progress.`,
		'bob-the-kid-who-disappeared-in-the-hotel': `Bob (the kid who disappeared in the hotel) is documented by the disappearance. The hotel is the location. The disappearance is the event. Bob existed before and may exist after but the hotel is the most important data point. What happened in the hotel is not in the wiki.`,

		// Events
		'the-great-bit-reset-recurring': `The Great Bit Reset is a recurring event in SImps timeline history — a moment when the accumulated bits, characters, and continuity are wiped or rebooted, allowing the universe to begin again from a cleared state. It is *recurring*, which means it has happened before and will happen again. Everything in the wiki exists in the interval between resets.`,
		'bepclbs-and-aepclbs-before-after-epc-light-board-stolen': `BEPCLBS and AEPCLBS — Before EPC Light Board Stolen and After EPC Light Board Stolen — are the two temporal eras of SImps history defined by the theft of the EPC light board. The stolen light board (also appearing as a metaverse variant) functions as the universe's historical watershed. Everything is either before or after it.`,

		// Arenas
		'oranging-world': `Oranging World is an arena defined by the process of becoming orange — a world mid-transition into a citrus state. The oranging is ongoing. Encounters here take place against a backdrop of environmental color saturation and the low-level disorientation of being somewhere that is actively becoming something else.`,
		'police-station': `The Police Station is a law enforcement arena with procedural mechanics, interrogation rooms, and the specific power dynamics of an institution that controls who is detained and why. The Apple Police may operate here. The station's encounter potential is in what it holds and what it processes.`,
		'in-and-out-mountainview': `In-N-Out in Mountain View is a specific fast food location elevated to arena status. The In-N-Out physics (secret menu, regional loyalty, specific burger geometry) apply in full. Encounters here follow the Animal Style rules. The line moves at its own pace regardless of the emergency.`,
		'greenroom-gasoline-maze': `The Greenroom (Gasoline Maze) is a pre-show waiting area that has been converted into or naturally evolved into a gasoline-saturated maze. The gasoline is present. The maze is navigable. The greenroom's original purpose — calming performers before a show — has been complicated by the maze and the gasoline.`,
		'inside-little-girl-imagination': `Inside Little Girl Imagination is an arena that is the interior of a child's imagination — a space governed by childhood logic, where scale is inconsistent, danger is immediate, and the rules change when the child's attention shifts. Surviving here requires understanding that the arena's architect is elsewhere and not fully paying attention.`,
		'spaceship': `The Spaceship is a spacecraft arena with vacuum-adjacent mechanics, limited oxygen, and the navigational constraints of operating in space. Who pilots the spaceship, where it is going, and what it is carrying are the three variables. The spaceship does not pick favorites. It goes where it is pointed.`,
		'sahara-desert': `The Sahara Desert is the full Saharan expanse as an arena — the heat, the scale, the specific endurance challenge of encountering anything across sand that extends to every horizon. Water is the resource. Shade is the strategy. The desert has been here longer than any of the entities who fight in it.`,
		'antarctica-cabin': `The Antarctica Cabin is an isolated structure in the Antarctic environment — a resource-scarce, weather-extreme arena with cabin-fever mechanics built in. Encounters here combine interior claustrophobia with exterior lethal cold. The cabin holds something. Outside is Antarctica.`,
		'lyman-atrium': `Lyman Atrium is a real Stanford location — the atrium of Lyman Hall — functioning as a SImps performance and encounter space. The architecture is academic; the encounters are not. Lyman Atrium has seen enough SImps performances to have developed ambient awareness of what tends to happen here.`,
		'crime-city': `Crime City is an urban arena where crime is the dominant activity and organizing principle. The city's infrastructure has been reconfigured around criminal mechanics rather than civic ones. Navigation requires knowing which crimes are current and which are legacy. Law enforcement presence is present but unclear in its allegiances.`,
		'human-stacks': `Human Stacks is an arena where humans are stacked — either as the terrain, as opponents, or as the structural material of the space itself. The stacking mechanic creates vertical encounter geometry and unstable surfaces. Moving through Human Stacks requires understanding load distribution.`,
		'puppet-show-backstage': `Puppet Show Backstage is the area behind the performance — the arena where the Puppet Master operates, where strings are managed, and where what the audience sees is constructed. Encounters backstage reveal the mechanisms of the performance and potentially the Puppet Master themselves.`,
		'goblin-rumble-arena': `The Goblin Rumble Arena is designated for goblin-based combat events. The architecture reflects goblin ergonomics and goblin aesthetic preferences, which differ from standard arena design in ways that advantage smaller, scrappier combatants and disadvantage anyone who needs ceiling clearance.`,
		'upside-down-ocean': `The Upside Down Ocean is an ocean that is inverted — water above, seafloor below in the conventional sense, but accessed from the underside. Navigation requires recalibrating buoyancy expectations. The marine life operates normally relative to the inverted ocean but abnormally relative to you.`,
		'water-goblin-kingdom-underwater': `The Water Goblin Kingdom (Underwater) is the domain of the Water Goblin (#114) — a governance structure below the waterline with the specific encounter dynamics of an aquatic political environment. The Kingdom has subjects, laws, and infrastructure. The Water Goblin is not just a goblin; it is a head of state.`,
		'mars': `Mars as an arena carries the red planet's actual properties — low gravity, thin atmosphere, dust storms, and the specific isolation of being on a planet that Earth can see but not easily reach. Kong of Mars (#105) is resident. Encounters on Mars take place in conditions that most arena rulebooks do not cover.`,
		'jupiter-sandy': `Jupiter (Sandy) is Jupiter in a sandy configuration — the gas giant given terrestrial footing through some mechanism. The sandy modifier suggests a version of Jupiter where you can stand, which raises immediate questions about atmosphere, gravity, and how the sandy version came to exist.`,
		'nitery-theater': `The Nitery Theater is the Ram's Head Theatrical Society venue at Stanford — a real performance space that has been elevated to SImps arena status. The theater's architecture implies an audience, a stage, and the specific power dynamics of performance space where some people are watched and others do the watching.`,
		'roof-of-the-dungeon': `The Roof of the Dungeon is the top surface of a dungeon — not inside it, but above it. The arena is the transitional space between dungeon and surface, with the dungeon below providing context and the sky above providing exit. What comes up from the dungeon and what comes down from above are the two encounter vectors.`,
		'arnold-house-1': `Arnold House 1 is a residence at Stanford — a dormitory that has been arena-fied. The dorm room geography (small rooms, shared walls, communal bathrooms) creates an encounter environment of compressed space and involuntary proximity. Arnold House is specific; the 1 implies there are others.`,
		'tiny-house': `The Tiny House is a miniaturized domestic space — either literally small-scale architecture or a house that is small in the tiny house movement sense. The constraint of small-house geometry means every encounter takes place at very close range. There is no room to disengage.`,
		'rube-goldberg-shop': `The Rube Goldberg Shop is a workspace full of elaborate, multi-step machines that accomplish simple things in complex ways. Every mechanism is operational. Every encounter activates at least one. The shop's danger is that solving one problem triggers six others.`,
		'zoom-squares': `Zoom Squares is the arena version of a video call grid — the tiled interface of remote communication as a space. Each square is a location. Movement between squares requires understanding the platform mechanics. Zoom Squares encounters have the specific disorientation of everyone being present and nobody being in the same place.`,
		'celestial-realm-with-orbs': `The Celestial Realm with Orbs is the home territory of the Orb People (Galaxy Council). The realm's architecture is spherical, the scale is cosmological, and the orbs that populate it are both decoration and residents. Encounters here take place in the jurisdiction of the galaxy's governing body.`,
		'fang-and-tooth-tavern': `The Fang & Tooth Tavern is a watering hole with a predatory name, which is either honest branding or a warning. The tavern provides the classic inn encounter dynamics — information exchange, temporary alliances, and the possibility that someone at the bar has been waiting for you specifically.`,
		'cheese-factory': `The Cheese Factory produces cheese through industrial processes in an arena setting. The factory floor has machinery, aging chambers, and the specific hazards of large-scale dairy production. The cheese being produced may be standard or may be the advanced varieties that the SImps universe's cheese-adjacent entries suggest.`,
		'top-of-tree-tiny-show': `Top of Tree Tiny Show is an elevated performance space at the top of a tree — either literally (canopy level) or metaphorically (the apex of a compact performance run). The tiny show format constrains the encounter to a small-scale, high-altitude space where everything is compact and the drop is significant.`,
		'volcano-island-of-powerful-beings': `Volcano Island of Powerful Beings is the home territory of the Volcano 4 (#13-16) — an island built around an active volcano that serves as both origin and ongoing power source for the beings who live there. The island's encounter dynamics are shaped by the volcano's presence: heat, geological instability, and beings who have adapted to both.`,
		'nyc-busy-intersection': `NYC Busy Intersection is the home territory of the New Yorkers at Busy Intersection faction — an urban arena at maximum pedestrian density, traffic intensity, and collective impatience. Movement through this arena requires understanding New York physics. Everything is moving and nobody is stopping.`,
		'100-floor-vanity-fair-building': `The 100 Floor Vanity Fair Building is a skyscraper dedicated to the specific cultural and social mechanics of Vanity Fair — both the magazine and the fair of vanities. Each floor has a different regime of appearance, status, and cultural currency. Encounters on different floors operate on different rules.`,
		'claires-at-the-mall': `Claire's at the Mall is the teen jewelry and accessories chain as an arena. The enclosed mall context, the specific demographic of Claire's clientele, and the products available (ear piercings, clip-on earrings, butterfly clips) define the encounter space. Claire's has its own logic. The mall contains it.`,
		'apartment-above-the-barrons': `The Apartment Above the Barrons is the domestic space directly above Mother Barron, the Barroness, and Barron. Proximity to a ranked family of three creates constant downward pressure — both literal (noise, vibration) and metaphorical (everything above you knowing what's happening below). The apartment exists in their orbit.`,
		'dr-smiths-office-3-doors': `Dr. Smith's Office has three doors. Which one you choose matters. The office setting implies a medical or professional encounter; the three-door mechanic makes it a choice architecture problem. Dr. Smith is behind one of the doors. What is behind the other two is the variable.`,
		'cheese-city-rat-city': `Cheese City, also known as Rat City, is an urban arena where cheese is both currency and infrastructure. The rat population (see: 10,000 rats in a truck) has found this city optimal. Encounters here operate on rodent-scale economics where the cheese is both the goal and the terrain.`,
		'tinker-shack': `The Tinker Shack is a workshop space for invention, modification, and repair — the kind of space where Roger's Time Machine might have been built. The shack format means limited space, maximum tool density, and the specific disorder of a place where everything is in progress. Nothing in the Tinker Shack is finished.`,
		'drainage-system-where-spiders-live': `The Drainage System (where spiders live) is an underground water management infrastructure that has been colonized by spiders. The drainage function is secondary to the spider function in practice. Navigation requires understanding both hydraulic flow and spider territory, which are different problems that happen to share a physical space.`,
		'komm': `Komm is an arena. The name offers little environmental context, which is itself context — a place so specific to the SImps universe that it doesn't need description. Komm is where Komm-encounters happen. The wiki expects you to know.`,
		'goats-up-the-mountain': `Goats Up the Mountain is a vertical terrain arena — a mountain being climbed by goats, or a mountain that goats are associated with, or the climbing process itself as encounter space. The goats are present. The mountain is steep. The combination produces a specific encounter dynamic of heights and hooves.`,
		'douchebag-pizza': `Douchebag Pizza is a pizza restaurant with an attitude. The establishment's character is encoded in its name. Service is present but optional. The pizza is real. Encounters here involve navigating the restaurant's specific social ecosystem while also, theoretically, getting pizza.`,
		'the-kissing-audience': `The Kissing Audience is a crowd of people engaged in kissing, which makes them both an audience and a phenomenon. As an arena, The Kissing Audience creates encounter dynamics where the environment is distracted, affectionate, and not fully paying attention to whatever is happening on the stage or in the space.`,
		'milwaukee-starbucks': `Milwaukee Starbucks is a specific Starbucks in Milwaukee — a coffee arena with the chain's standard mechanics (complex orders, limited seating, the specific authority of whoever has the barista's attention) set in a Midwestern city that the 25 Milwaukee Brewers presumably frequent.`,
		'twisted-jungle': `The Twisted Jungle is a jungle that has been twisted — either physically (the vegetation is geometrically wrong) or narratively (the jungle follows rules that jungles don't follow). Navigation requires relearning what jungle conventions apply and which have been inverted by the twist.`,
		'brickgott': `Brickgott is an arena of brick. The name implies a place built from or constituted of brick — a constructed environment with the specific encounter properties of masonry: solid walls, defined spaces, and the aesthetic of something built to last by someone who meant it.`,
		'roble-dorm-theater': `Roble Dorm Theater is the performance space in Roble Hall at Stanford — a real venue where SImps bits have been born and tested. The dorm theater format means the audience is also the building's residents; the performers know the space; and the theater has absorbed years of improv into its walls.`,
		'prosser': `Prosser is a Stanford space — a classroom or building that has been arena-classified. The academic environment creates encounter dynamics of rows, authority, and the specific vulnerability of being called on when you don't know the answer.`,
		'rag': `RAG is an arena — a specific SImps-adjacent space at Stanford (Roble, Arnold, Governor's Corner dorm complex) that functions as both home territory and encounter environment. RAG is where people who know each other well fight each other, which is a specific genre of encounter.`,
		'd-school-studio-1': `d.school Studio 1 is the first of several d.school (Hasso Plattner Institute of Design at Stanford) studios used as SImps arenas. The design school environment — whiteboards, Post-its, prototyping materials — creates an encounter space where ideation and iteration are the primary environmental affordances.`,
		'd-school-studio-c': `d.school Studio C is a specific d.school studio with the "C" designation. The lettered studio may have different affordances than the numbered studios — the C possibly indicating a collaborative configuration. The design school context applies.`,
		'd-school-studio-2': `d.school Studio 2 is the second numbered studio, with the same design school environment as Studio 1 but potentially different spatial configuration and accumulated session history.`,
		'd-school-studio-3': `d.school Studio 3 is where one of the more documented SImps sessions occurred — the studio index page notes specific events here. The design school environment persists. Studio 3 has something the others don't, which is why it's the one that gets pages.`,
		'd-school-studio-4-cursed': `d.school Studio 4 is cursed. The parenthetical is documentary, not metaphorical — or it is metaphorical in a way that has produced real effects. Studio 4's curse affects encounters here. The design school affordances are present but compromised by whatever the curse introduced.`,
		'category-die-must-play': `Category Die (must play) is an encounter mechanic elevated to arena status: a die that determines categories, with the rule that you must play whatever it shows. The mandatory play rule removes player choice and hands agency to the die. The die always shows something.`,
		'billings-montana': `Billings, Montana is a real city operating as a SImps arena — the largest city in Montana, with the High Plains geography and the specific encounter environment of a mid-size Western American city that didn't expect to be in a TTRPG wiki.`,
		'submarine-from-terror-superscene': `The Submarine from Terror Superscene is a submarine that appeared in a particularly intense SImps session. The "terror superscene" provenance means this submarine was born from something extreme and carries that origin. Underwater, enclosed, with the specific claustrophobia of a vessel that cannot easily surface.`,
		'cafe-venetia': `Cafe Venetia is a coffee shop near Stanford — a real location that functions as both a SImps meeting space and an arena. The cafe format provides the classic information-exchange encounter environment: tables, beverages, and the specific neutrality of a third space where alliances form over drinks.`,
		'marinara-coffee-shop': `Marinara Coffee Shop is a coffee establishment with an Italian sauce name, which is either a pun, a branding choice, or evidence that the shop serves marinara alongside coffee. The combination creates a menu-encounter dynamic that most coffee arenas don't have to account for.`,
		'llama-town': `Llama Town is a town whose primary population or identity is llama-related. The town planning, architecture, and social structure have been organized around llama needs and preferences. Encounters here operate on llama-town logic, which differs from human-town logic in ways that become evident immediately.`,
		'lanatown': `Lanatown is a town associated with Lana — either founded by her, named after her, or shaped by her presence. The possessive town format suggests someone's vision has been implemented at an urban scale. What Lana's town values and how it enforces those values are the relevant encounter parameters.`,
		'mermaid-cove': `Mermaid Cove is the aquatic arena of the Mermaids faction — a cove with the enclosed geography that favors ambush and the sonic properties of water and rock that make mermaid song maximally effective. The cove has one entrance from the sea.`,
		'turlock-house': `Turlock House is a house in or associated with Turlock, California — a Central Valley location that functions as a domestic arena. The house is specific; Turlock provides the agricultural, working-class Central Valley context. What is in Turlock House is shaped by what Turlock is.`,
		'rural-ohio': `Rural Ohio is an expanse of Ohio farmland as an arena — flat terrain, agricultural infrastructure, and the specific encounter dynamics of somewhere that extends to the horizon in every direction. There is nowhere to hide in Rural Ohio. Everything is visible. The sky is large.`,
		'peoples-improv-theater': `People's Improv Theater (The PIT) is a real New York City improv venue that functions as a SImps arena. The PIT's training ground status means encounters here are improvisational by nature and evaluated. Something is always being tested.`,
		'taps-103': `TAPS 103 is a Stanford theater and performance studies space — a classroom-theater hybrid where SImps encounters take place in an academic performance context. The room number makes it specific and navigable. TAPS 103 knows what it has hosted.`,
		'taps-104': `TAPS 104 is the adjacent TAPS space, with the sequential numbering implying a similar but distinct encounter environment. Different sessions have different rooms. TAPS 104 is TAPS 104.`,
		'taps-105': `TAPS 105 completes the TAPS numbered trio — the third space in the Theater and Performance Studies suite, with its own session history and encounter parameters.`,
		'jungle-105': `JUNGLE 105 is TAPS 105 in jungle configuration — either literally converted into a jungle environment for a session or operating under jungle rules within the TAPS space. The jungle designation fundamentally alters encounter parameters that the room number alone doesn't capture.`,
		'doerr-patio-callbax': `Doerr Patio Callbax is an outdoor Stanford arena — the patio space of the Doerr sustainability building, used for Callbax (a SImps session format). The outdoor architecture provides natural light, ambient campus noise, and the specific encounter dynamics of performing where anyone walking by can see.`,
		'evil-taps-103': `Evil TAPS 103 is the evil version of TAPS 103 — the same space but operating on inverted or corrupted rules. The evil designation may reflect a specific session's atmosphere, a timeline variant, or a permanent alternate-dimension TAPS 103 that exists alongside the standard one.`,
		'midsummer-set-in-rag-courtyard': `The Midsummer Set in RAG Courtyard is an outdoor performance arena — a production of A Midsummer Night's Dream staged in the RAG dorm courtyard. The Shakespearean context combines with the dorm residential environment: theater magic in a space where people also do laundry.`,

		// Photo Categories
		'simps': `SImps is the base photo category — members of Stanford Improvisers (SImps), the improv comedy group this entire wiki documents. This is the root classification from which all other photo categories derive. To be a SImp is to be eligible for all sub-classifications.`,
		'stimps': `StImps are Stanford Improvisers who are also Stanford alumni — former members who have moved through the group and into whatever comes after. The St- prefix marks temporal position: they were here, they are now elsewhere, and the photo record connects both states.`,
		'mimps': `MImps are male-identifying SImps members. The M- prefix applies the binary classification to the group's photo taxonomy. MImps exist alongside NonManImps and a spectrum of sub-variants that reflect the group's ongoing engagement with gender categorization.`,
		'timps': `TImps are trans SImps members — an identity-specific sub-classification that the photo taxonomy documents separately from the gender binary categories. The T- prefix marks trans identity as a distinct photo category within the broader SImps archive.`,
		'mrimps': `MRImps are married SImps members — the "MR" marking marital status rather than gender (though the "Mr." resonance is probably intentional). MRImps represent members who have transitioned into the life phase that includes a spouse, while remaining in the photo documentation system.`,
		'trimps-photo-categories': `TrImps are trans male-identifying SImps members — a specific intersection of trans identity and masculine gender identification within the group. The TrI- prefix documents this combination as a distinct photo category.`,
		'taylorswimps': `TaylorSwImps are SImps members who are also Taylor Swift fans — a crossover category that became significant enough to formalize. The category exists because the overlap between the SImps group and the Swiftie community was documentable and someone decided to document it.`,
		'lins': `Lins are SImps members named Lin, or Lin-adjacent by nickname or association. The name-based category is one of the most specific in the taxonomy — it tracks not identity or affiliation but the name Lin as it appears in the group.`,
		'lincest': `Lincest is the photo category for SImps members who have dated other SImps members named Lin, or who are in a Lins-adjacent romantic network. The name-incest pun is the taxonomic joke that also happens to document a real pattern.`,
		'man-lin': `Man Lin is a male Lin — the gender-specific sub-classification of the Lins category. The intersection of male identity and the Lin name produces a specific photo classification that the taxonomy preserves.`,
		'ta-lins': `TA Lins are Lins who are also teaching assistants — the academic role intersecting with the name category. The TA Lin population is small enough to name but large enough to warrant a category.`,
		'queerpassingstrimps': `QueerPassingStrImps are straight SImps members who are perceived as queer — the photo taxonomy's documentation of the gap between identity and presentation. The category is descriptive rather than prescriptive and reflects the group's self-aware relationship with queer aesthetics.`,
		'strimps': `StrImps are straight SImps members — the heterosexual sub-classification of the photo taxonomy. StrImps coexist with QuImps, QueerPassingStrImps, and the full spectrum of orientation-based categories that the taxonomy has developed.`,
		'quimps': `QuImps are queer SImps members — the primary queer-identity category in the photo taxonomy. The QuI- prefix documents queer identity as a significant axis of group documentation alongside gender, name, and relationship categories.`,
		'bimps-unused-often': `BImps are bisexual SImps members — a specific orientation category that the taxonomy notes is "unused often," suggesting the classification exists but hasn't been consistently applied. The underuse is itself documented, which is a taxonomic choice.`,
		'manimps': `ManImps are male SImps members — a parallel to MImps with slightly different classification logic. The Man- prefix emphasizes the male identity more explicitly. The distinction between MImps and ManImps may be generational, contextual, or a product of different photographers applying different labels.`,
		'nonmanimps-unused-often': `NonManImps are non-male SImps members — a taxonomy designed to capture everyone not classified as ManImps. Like BImps, it is marked "unused often," which means the category was created anticipating use that hasn't fully materialized.`,
		'wimps': `WImps are women-identifying SImps members — the female sub-classification of the photo taxonomy. The W- prefix parallels M- for male, creating a binary core to the gender taxonomy that the TImps, TrImps, NonBinImps, and other categories extend and complicate.`,
		'genderisconfusimps': `GenderIsConfusImps is the photo category for SImps members whose gender presentation defies straightforward classification — not nonbinary in the formal sense, but specifically confusing. The category is affectionate and self-aware. It exists because the taxonomy discovered the classification system's limits.`,
		'nonbinimps-sometimes': `NonBinImps (sometimes) are nonbinary-identifying SImps members, with the "sometimes" qualifier suggesting either fluidity or the photographer's uncertainty about when the classification applies. The sometimes is preserved in the category name, making the uncertainty part of the record.`,
		'gymps': `GyMps are SImps members who go to the gym — a lifestyle-based photo category that documents athletic engagement alongside all the identity-based categories. GyMps are defined by gym attendance, which is either more or less significant than any of the other things this taxonomy tracks.`,
		'yimps-jimps': `YImps (JImps) are SImps members named Jayda, Julianna, or beginning with J — a name-based category that parallels the Lins taxonomy. The Y/J variant in parentheses acknowledges the spelling ambiguity in the classification.`,
		'southasiimps': `SouthAsiImps are South Asian SImps members — a regional heritage category in the photo taxonomy. The category documents South Asian identity as a significant demographic axis within the group alongside all the other classification axes.`,
		'asiimps': `AsiImps are Asian-identifying SImps members — a broader Asian heritage category that encompasses SouthAsiImps and other Asian identities. The two-tier system (AsiImps and SouthAsiImps) reflects the group's decision to document both the broad and specific.`,
		'whimps-cursed': `WhImps are white-identifying SImps members — marked "cursed" in the taxonomy, which is either a joke about whiteness, a comment on the category's construction, or documentation of something that happened when the category was created. The curse is in the name.`,
		'latinimps': `LatinImps are Latin-identifying SImps members — a heritage category that documents Latin American identity in the group. LatinImps exists alongside HispanImps in a two-tier system similar to the Asian categories.`,
		'hispanimps': `HispanImps are Hispanic-identifying SImps members — the specific Hispanic identity category that coexists with LatinImps. The distinction between Hispanic and Latin classifications reflects the group's attempt to document identity at multiple levels of specificity.`,
		'downbimps-simpimps': `DownBImps (SimpImps) are SImps members who are "down bad" — extremely or painfully in love, infatuated, or romantically consumed. The SimpImps parallel name makes the pun explicit: simping, as a behavior, documented by a group called SImps.`,
		'cuffedimps': `CuffedImps are SImps members who are in relationships — "cuffed" in the colloquial sense. The category documents coupled status as a photo classification axis, creating a record of who was in relationships at the time of documentation.`,
		'simpcest': `SImpcest documents romantic or sexual relationships between SImps members — the within-group pairing category. The name combines SImps and incest in a way that acknowledges the group-as-family dynamic while documenting the actual relationships. The Lincest category is a subset.`,
		'humanitimps': `HumanitImps are SImps members in humanities disciplines — the academic affiliation category for the arts, languages, history, and related fields. The humanities-STEM axis produces both HumanitImps and StemImps as parallel categories.`,
		'stemimps': `StemImps are SImps members in STEM fields — science, technology, engineering, and math. The STEM category coexists with HumanitImps, and the existence of both categories reflects the group's diverse academic composition and the decision to document it.`,
		'artimps': `ArtImps are SImps members who are artists — visual art, design, or artistic practice as a distinct category from humanities broadly. ArtImps documents the subset of the group whose primary identity axis is making things visually.`,
		'westcampimps': `WestCampImps are SImps members who live on West Campus at Stanford — the geographic dorm classification that locates members in the residential map. West Campus and East Campus create a spatial taxonomy of where people sleep.`,
		'eastcampimps': `EastCampImps are SImps members on East Campus — the other half of the Stanford residential geography. The campus-side classification matters for logistics, social clustering, and the specific identity that comes from which side of campus formed you.`,
		'californiimps': `CaliforniImps are SImps members from California — the home state category for the largest contingent of Stanford students who arrive already knowing In-N-Out and highway numbers.`,
		'midwestimps': `MidwestImps are SImps members from the Midwest — the regional heritage category for those who arrived at Stanford from the states that everyone has opinions about. The Midwest produces a specific kind of person and this category documents which SImps are that kind.`,
		'southernimps': `SouthernImps are SImps members from the American South — the regional category for a demographic whose relationship with the coastal university context is specific and documented.`,
		'eastcoastimps': `EastCoastImps are SImps members from the East Coast — the origin-region category for New Englanders, Mid-Atlantickers, and others who came to Stanford from the Eastern time zone.`,
		'losangelimps': `LosAngelImps are SImps members from Los Angeles specifically — a subset of CaliforniImps defined by the city rather than the state. Los Angeles produces a specific type, and the taxonomy has decided to track it.`,
		'summerimps': `SummerImps are SImps members active during the summer session — a temporal category that documents summer-quarter participation. The summer cohort has its own dynamics distinct from the academic-year group.`,
		'shrimps': `ShrImps are short SImps members — the height-based classification that documents members who are small. The pun on "shrimp" is the point. Height is tracked. The ShrImps are named.`,
		'tallimps': `TallImps are tall SImps members — the counterpart to ShrImps. Height as a photo category produces a physical-characteristic axis that coexists with all the identity, heritage, and relationship categories. Some people are tall. The taxonomy knows.`,
		'opentoedshoewearingimps': `OpenToedShoeWearingImps are SImps members who wear open-toed shoes — a footwear-based classification that is probably the most specific photo category in the entire taxonomy. Someone looked at the photos and noticed the shoes. The category exists.`,
		'africanscholimps': `AfricanScholImps are African Scholars Program participants who are also SImps members — the scholarship-program intersection category. The African Scholars Program at Stanford has enough SImps crossover to merit documentation.`,
		'pianimps': `PianImps are SImps members who play piano — a musical instrument category. The piano is specific; the GuitImps category covers guitar players. The instrument-based taxonomy documents musical capability as a SImps identity axis.`,
		'guitimps': `GuitImps are SImps members who play guitar — the guitar counterpart to PianImps. Together they form the instrument-based photo taxonomy that documents musical ability within the group.`,
		'abfimps': `ABFimps are SImps members involved with ABF (the Stanford Association of Black Students' Foundation, or another ABF) — the organization-membership crossover category that documents SImps' connections to other Stanford student organizations.`,

		// Metaverse Variants
		'priscillafights': `priscillafights is Priscilla in her fighting configuration — a metaverse variant defined by combat mode. Whatever Priscilla is in the base timeline, priscillafights is that plus willingness to fight about it.`,
		'detective-little': `Detective Little is a small detective — either physically little or little in the sense of being early in a detective career. The detective archetype scaled down changes the power dynamics of investigation: harder to see, easier to underestimate.`,
		'straight-simon': `Straight Simon is Simon in his heterosexual variant. The metaverse framing of straight identity as a variant rather than a default reflects the SImps universe's orientation toward queerness as baseline.`,
		'straight-oliver': `Straight Oliver is the heterosexual variant of Oliver — the king, presumably, or another Oliver. Same energy, different romantic configuration. Straight Oliver exists in the metaverse alongside his counterparts.`,
		'bimon': `Bimon is Simon in his bisexual variant — the Bi + Simon portmanteau creating a metaverse version defined by orientation. Bimon exists in the spectrum between Straight Simon and other Simon variants.`,
		'tall-jayda': `Tall Jayda is Jayda in a taller physical configuration. The height variant creates a metaverse Jayda with different spatial relationships to the world — more visible, different reach, new perspective from above.`,
		'communess': `CommuNess (Communist Ness) is Ness operating under communist ideology — a metaverse variant defined by political philosophy. The Ness who emerged from a communist framework makes different decisions than the standard Ness.`,
		'driver-jmo': `Driver Jmo is Jmo in a driving configuration — a variant where driving is the primary mode of existence. The Flirty Jmo (retreat) variant exists separately, suggesting Jmo has multiple documented metaverse states.`,
		'batman': `Batman is Batman — either a SImps member who played Batman, a metaverse variant of a SImps member who became Batman, or an actual Batman operating in the SImps universe. All three explanations are equally valid in this context.`,
		'dirty-stinky-diaper-baby': `Dirty Stinky Diaper Baby is a baby variant — the infant configuration that is dirty, stinky, and in a diaper. As a metaverse entity, this is either a transformed member or a baby that has achieved metaverse status through sheer presence.`,
		'trimps-metaverse': `TRImps is the metaverse variant of the TrImps photo category — either a collective metaverse state for trans male members or a specific single entity who embodies the category.`,
		'foxface': `Foxface is a variant with a fox face — either a fox-faced member variant or a member who has adopted a fox identity in the metaverse. The face is the distinguishing feature.`,
		'oliver-waterhouse': `Oliver Waterhouse is Oliver in a Waterhouse configuration — the variant defined by the Waterhouse surname or context. Whether this is King Oliver in civilian mode or a different Oliver with Waterhouse as a house affiliation is unresolved.`,
		'daniel-cadigan': `Daniel Cadigan is a specific metaverse variant with a full name — Daniel, surname Cadigan. The precision of the naming suggests this is a real person or a character with established identity rather than a purely abstract variant.`,
		'robber-barrons': `Robber Barrons are the Barron family in a robber baron configuration — the Gilded Age industrial-capitalist variant of the ranked family. Robber Barrons operate with the specific power mechanics of 19th-century monopoly capitalism.`,
		'hamps': `HAmps is a metaverse variant — the HA prefix suggesting either laughter, a name, or a classification system. HAmps occupies the metaverse without extensive annotation.`,
		'sex-with-erin': `Sex with Erin is a metaverse variant entry — documenting an entity or scenario as a SImps universe object. The directness of the name is the documentation.`,
		'the-mistele-parents-in-bachelor-incest-audience': `The Mistele Parents in Bachelor Incest Audience are a specific family unit present at a specific event — the Bachelor incest audience, which implies a Bachelor-format show where the incest is structural. The parents are documented as audience members, which means they witnessed.`,
		'tony-kramer': `Tony Kramer is a metaverse variant — a specific individual with a full name in the SImps universe. The Kramer construction may invoke Seinfeld, the real person, or a Tony specific to SImps history.`,
		'lisa-rowland': `Lisa Rowland is a named metaverse variant — a character or person in the SImps universe defined by her full name. Lisa Rowland exists with enough distinctness to warrant individual documentation.`,
		'dan-klein': `Dan Klein is Dan in a Klein configuration or the real Dan Klein — a figure in the Stanford improv world who appears in the SImps metaverse. The variant may be a character based on the real person.`,
		'jmo-in-and-out': `Jmo in and Out is Jmo operating at In-N-Out — the fast food arena variant of Jmo. The In-N-Out context shapes this variant's behavior and priorities in ways that the standard Jmo configuration doesn't capture.`,
		'prm': `PRM is a metaverse variant identified by three initials — either an acronym for a specific person's name or a classification system. PRM occupies the metaverse with the brevity of an acronym.`,
		'will-setrakian': `Will Setrakian is Will in a Setrakian configuration — either a character with this surname or a specific real person who appears in the SImps metaverse. The surname Setrakian carries Armenian heritage.`,
		'foho-exclusive': `FOHO Exclusive is a Front of House Only variant — a metaverse entity or configuration that exists exclusively in the front-of-house context, never backstage, always where the audience is.`,
		'simps-transformer': `SImps Transformer is a SImps member in transformer form — the vehicle-to-robot-to-vehicle configuration applied to the improv context. What the SImps Transformer transforms into reflects SImps-specific imagery.`,
		'shrimp-caucus': `Shrimp Caucus is a political caucus of short people — the ShrImps in a legislative configuration. The shrimp pun carries through into governance. The caucus makes decisions. The decisions are proportionally sized.`,
		'28-year-old-will': `28 Year Old Will is Will at age 28 — a temporal variant that documents a specific future version of Will. The age precision makes this a metaverse projection: this is who Will becomes, documented before or after it happens.`,
		'janet-and-porco': `Janet and Porco are a paired metaverse variant — two entities documented together, whose relationship or pairing is the defining characteristic. The names suggest one human character and one pig reference.`,
		'ilan-he-they': `Ilan (he/they) is Ilan with documented pronouns — a metaverse variant defined by the pronoun specification. The he/they categorization is part of the identity, not a descriptor added afterward.`,
		'lowen-and-ionel': `Lowen and Ionel are another paired variant — two entities documented as a unit. The names suggest specific individuals whose pairing has metaverse significance.`,
		'jj': `JJ is a metaverse variant identified by double initials — either a person whose name abbreviates to JJ or a specific JJ-character in SImps history.`,
		'tobias-fraiser': `Tobias Fraiser is a named metaverse variant — the Arrested Development character Tobias, or a Tobias named Fraiser, or a specific person in SImps history with this full name.`,
		'daania-when-she-hears-werewolf-or-taylor-swift': `Daania When She Hears "Werewolf" or "Taylor Swift" is a triggered metaverse state — Daania in the specific configuration she enters when either of these words is spoken. The variant exists between triggers. The trigger activates it.`,
		'sidecoach-joy': `Sidecoach Joy is Joy in sidecoach mode — the improv director configuration where Joy is giving direction from the side rather than performing. The sidecoach position is a specific power role in improv, and as a metaverse variant it represents Joy's directing capabilities.`,
		'grandma-judy': `Grandma Judy is a grandmotherly figure — either a member's actual grandma who appeared in a SImps context, or a character variant of someone named Judy in the grandmother configuration.`,
		'sankhet-shiriels-date': `Sankhet (Shiriel's Date) is Sankhet as documented through his relationship to Shiriel — specifically as her date. The relational definition makes this a variant of Sankhet that exists in the context of Shiriel's story.`,
		'kenneth-ivary-jaydas-creepy-old-teacher': `Kenneth Ivary is Jayda's creepy old teacher who can swim 350 miles in a day. The swimming capability is the specific supernatural element. The creepy teacher framing provides the relational context. The 350 miles is the detail that cannot be ignored.`,
		'epc-lights-red': `EPC Lights (Red) is the EPC lighting system in its red configuration — the specific red-light state that the EPC (Experimental Performance Complex, presumably) produces. The red state may be a setting, a mood, or a temporal marker.`,
		'epc-lightboard-stolen': `EPC Lightboard (Stolen) is the state of the EPC lightboard post-theft — the metaverse variant that corresponds to the BEPCLBS/AEPCLBS historical event. This is the lightboard as it existed when taken, preserved as a variant.`,
		'rizzscilla': `Rizzscilla is Priscilla in her rizzed-up configuration — the variant characterized by charm, charisma, and rizz. Where priscillafights is the combat variant, Rizzscilla is the social influence variant.`,
		'flirty-jmo-retreat': `Flirty Jmo (retreat) is Jmo in flirtatious mode at a retreat context. The retreat setting and the flirtatious configuration combine into a specific variant. Driver Jmo is the other documented Jmo variant.`,
		'beardbastian': `Beardbastian is Sebastian with a beard — the bearded variant of Sebastian. The beard is the defining difference from the standard configuration. Shavebastian is the clean-shaven counterpart.`,
		'shavebastian': `Shavebastian is Sebastian clean-shaven — the beard-free variant that coexists with Beardbastian. The two Sebastian variants document the same person across a facial hair axis, which the SImps metaverse has decided is classification-worthy.`,
		'ness-the-forest-sprite': `Ness the Forest Sprite is Ness in a nature spirit configuration — the variant that emerges when Ness is in forest sprite mode. This connects to the Siri and Forest Spirits faction and the CommuNess metaverse variant, suggesting Ness has multiple documented states.`,
		'charles': `Charles is a metaverse variant identified by first name only — a Charles who exists in the SImps universe with enough distinctness to have a page. The name alone is the documentation.`,
		'schrodingers-girl-scout': `Schrodinger's Girl Scout is a Girl Scout who exists in a quantum state — simultaneously selling and not selling cookies, present and absent, in and out of the box. Until you open the door, the Girl Scout's cookie inventory is uncertain.`,
		'white-italian-ness': `White (Italian!!) Ness is Ness in a white Italian configuration — the exclamation points in the slug encoding the specific energy of Italian-American whiteness being claimed. The emphasis is part of the variant's identity.`,
		'bubbly-daania': `bubbly daania is Daania in her bubbly configuration — the cheerful, effervescent variant. Named in lowercase, which is its own stylistic choice. This is Daania at maximum approachability.`,
		'shrimpran': `Shrimpran is Simran in small form — the ShrImp variant of Simran, combining the short-person taxonomy with a specific person's name. Shrimpran is Simran; Simran is also documented elsewhere. The size is the differentiator.`,
		'punctual-kevin-kirby': `Punctual Kevin Kirby is Kevin Kirby in his on-time configuration — a variant defined by a positive temporal attribute. The specificity of "punctual" as a defining characteristic suggests it is notable, meaning Kevin Kirby is not always punctual.`,
		'the-youngest-boy-in-the-world': `The Youngest Boy in the World is a superlative metaverse variant — the globally youngest male at the moment of documentation, preserved as a character. Being the youngest is a temporary state; being documented as such makes it permanent.`,
		'ryan-dukes': `Ryan Dukes is a named metaverse variant — Ryan with the surname Dukes. The name has a specific energy: first name casual, last name slightly authoritative. Ryan Dukes exists in the SImps universe with enough definition to have a page.`,
		'sachin-bachin': `Sachin Bachin is Sachin in a rhyming configuration — the bachin suffix creating a sound echo. The name-rhyme variant is a common SImps naming convention, and Sachin Bachin operates within that tradition.`,
		'greg-and-friends': `Greg (and friends) is Greg in social mode — not alone but with friends who are unnamed in the variant title. The parenthetical implies the friends are an extension of Greg rather than independent entities in this configuration.`,
		'the-senior-show-metaverse': `The Senior Show Metaverse is the variant state associated with the SImps Senior Show — the graduating class's final performance as a distinct metaverse. The Senior Show creates its own universe with its own rules, preserved here as a variant.`,
		'gorbus-in-florence': `Gorbus in Florence (where is he now?) is Gorbus in an Italian city, with the parenthetical expressing genuine uncertainty about his current location. The question is part of the documentation. Gorbus was in Florence. Nobody is sure where Gorbus is now.`,
		'gorbus-he-they-the-puppet': `Gorbus (he/they) the puppet is the puppet version of Gorbus — a separate entity from the Florence Gorbus, operating with puppet mechanics and the pronoun specification (he/they) encoded in the title.`,
		'herman-the-puppet': `Herman the puppet is a puppet named Herman — a character distinct from the human (or non-human) Herman who may exist in other entries. Herman the puppet operates in puppet space with puppet physics and Herman's specific personality.`,
		'blue-guy-the-puppet': `Blue Guy the Puppet is a puppet that is blue and a guy. The color is the primary identifier. Blue Guy the Puppet operates alongside Herman the Puppet and Gorbus in the puppet sub-metaverse, which has enough characters to constitute a collective.`,
		'groundlings-vs-superfans': `Groundlings vs Superfans is a metaverse variant that is also an event — the confrontation between groundlings (general audience members) and superfans (deeply committed enthusiasts) as a documented variant state. The versus framing means both sides have agency.`,
	};

	// ─── Lore editor ─────────────────────────────────────────────────────────
	function initLoreEditor(){
		if(!pageKey.startsWith('entry:')) return;
		const pageHeader = document.querySelector('.page-header');
		if(!pageHeader) return;

		const slug = pageKey.replace('entry:','');
		const localKey = `simpsWiki.lore.${pageKey}`;

		const panel = document.createElement('div');
		panel.className = 'panel lore-panel';
		panel.innerHTML = `
			<div class="lore-header">
				<h3>Description</h3>
				<div class="lore-actions">
					<span class="lore-sync-status" id="lore-sync"></span>
					<button class="toolbar-button" id="lore-edit-btn">Edit</button>
				</div>
			</div>
			<div class="lore-rendered" id="lore-rendered"></div>
			<textarea class="page-notes lore-textarea hidden" id="lore-textarea" placeholder="Write a description for this entry. Supports **bold**, *italic*, \`code\`, ## headings, and - bullet lists. Changes sync publicly for all visitors."></textarea>
			<div class="note-hint hidden" id="lore-save-hint"></div>`;
		pageHeader.after(panel);

		const rendered = document.getElementById('lore-rendered');
		const textarea = document.getElementById('lore-textarea');
		const editBtn = document.getElementById('lore-edit-btn');
		const syncStatus = document.getElementById('lore-sync');
		const saveHint = document.getElementById('lore-save-hint');

		let currentContent = '';

		function showContent(text){
			currentContent = text || '';
			if(currentContent.trim()){
				rendered.innerHTML = renderMd(currentContent);
				rendered.classList.remove('lore-empty');
			}else{
				const defaultText = LORE_DEFAULTS[slug] || '';
				if(defaultText){
					rendered.innerHTML = renderMd(defaultText);
					rendered.classList.remove('lore-empty');
				}else{
					rendered.innerHTML = '<span class="muted lore-placeholder">No description yet. Click <strong>Edit</strong> to write one — it\'ll be visible to everyone.</span>';
					rendered.classList.add('lore-empty');
				}
			}
		}

		function enterEdit(){
			textarea.value = currentContent || LORE_DEFAULTS[slug] || '';
			textarea.classList.remove('hidden');
			saveHint.classList.remove('hidden');
			rendered.classList.add('hidden');
			editBtn.textContent = 'Done';
			editBtn.dataset.active = 'true';
			autoResize(textarea);
			textarea.focus();
		}

		function exitEdit(){
			textarea.classList.add('hidden');
			saveHint.classList.add('hidden');
			rendered.classList.remove('hidden');
			editBtn.textContent = 'Edit';
			editBtn.dataset.active = '';
		}

		editBtn.addEventListener('click', () => {
			if(editBtn.dataset.active === 'true') exitEdit();
			else enterEdit();
		});

		rendered.addEventListener('click', () => enterEdit());

		let saveTimer = null;
		textarea.addEventListener('input', () => {
			autoResize(textarea);
			clearTimeout(saveTimer);
			saveHint.textContent = 'Saving…';
			saveTimer = setTimeout(async () => {
				const val = textarea.value;
				currentContent = val;
				localStorage.setItem(localKey, val);
				if(firebaseDB){
					try{
						await firebaseSet(`entries/${slug}/lore`, val);
						await firebaseSet(`entries/${slug}/editedAt`, Date.now());
						saveHint.textContent = 'Saved — visible to all visitors.';
						syncStatus.textContent = '● synced';
					}catch{
						saveHint.textContent = 'Saved locally (sync failed).';
					}
				}else{
					saveHint.textContent = 'Saved locally. Add Firebase config to sync publicly.';
				}
			}, 600);
		});

		// Load content: prefer Firebase, fall back to localStorage
		(async () => {
			if(firebaseDB){
				syncStatus.textContent = '● live';
				firebaseListen(`entries/${slug}/lore`, val => {
					currentContent = val || '';
					if(editBtn.dataset.active !== 'true'){
						showContent(currentContent);
					}
				});
			}else{
				const local = localStorage.getItem(localKey) || '';
				showContent(local);
			}
		})();
	}

	function initNotes(){
		if(!els.pageNotes) return;
		const key = `simpsWiki.notes.${pageKey}`;
		els.pageNotes.value = localStorage.getItem(key) || '';
		autoResize(els.pageNotes);
		let timer = null;
		els.pageNotes.addEventListener('input', () => {
			autoResize(els.pageNotes);
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
		lore: Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('simpsWiki.lore.')).map(k => [k, localStorage.getItem(k)])),
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
				if(payload.lore){
					Object.entries(payload.lore).forEach(([key, value]) => localStorage.setItem(key, value));
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
	await initFirebase();
	initLoreEditor();
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
