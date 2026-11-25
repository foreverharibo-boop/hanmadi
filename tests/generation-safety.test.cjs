const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

function fixture() {
    const context = vm.createContext({
        assert, AbortController, Event: class {},
        console: { log() {}, warn() {}, groupCollapsed() {}, groupEnd() {} },
        window: { addEventListener() {} },
        document: { getElementById() { return null; }, querySelector() { return null; } },
        jQuery() {},
    });
    const run = code => vm.runInContext(code, context);
    run(source);
    run(`
        stSettings = {};
        var currentChat = { chatId: 'A', characterId: 1, name1: 'User', name2: 'Char', chat: [] };
        stGetCtx = () => currentChat;
        var input = { value: 'Original', dispatchEvent() {}, focus() {} };
        var ui = { loading: false, toast: false, entries: [], multi: [], errors: [], loadingCount: 0 };
        document.getElementById = id => id === 'send_textarea' ? input : null;
        showLoading = () => { ui.loading = true; ui.loadingCount++; };
        hideLoading = () => { ui.loading = false; };
        showQuickToast = () => { ui.toast = true; };
        hideQuickToast = () => { ui.toast = false; };
        showResult = entry => ui.entries.push(entry);
        showMultiResult = (results, entry) => ui.multi.push({ results, entry });
        showError = message => ui.errors.push(message);
        stGenerateRaw = async () => 'AI answer';
        var args = ['', 'both', 'none', 100, { formality: 50, playfulness: 50 }, 'ko', '1st', '', 'normal', 'past', 'Original'];
        function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
    `);
    return run;
}

function scenario(name, code) {
    test(name, async () => {
        await fixture()(`(async () => { ${code} })()`);
    });
}

scenario('zero remains zero and raw generation does not override its connection limit', String.raw`
    getSettings().maxTokens = 0;
    assert.equal(getSettings().maxTokens, 0);
    let budget;
    stGenerateRaw = async params => { budget = params.responseLength; return 'answer'; };
    await runGenerate(...args);
    assert.equal(budget, null);
    assert.equal(getSettings().maxTokens, 0);
    assert.equal(ui.entries.length, 1);
`);
scenario('missing token setting defaults to 500; positive budgets remain intact', String.raw`
    assert.equal(getSettings().maxTokens, 500);
    getSettings().maxTokens = 3000;
    stGenerateRaw = async params => { assert.equal(params.responseLength, 3000); return 'answer'; };
    await runGenerate(...args);
    assert.equal(ui.errors.length, 0);
`);
for (const message of ['network timeout', '401 Unauthorized', '429 Too Many Requests']) {
    scenario('raw error is propagated without retry: ' + message, String.raw`
        let calls = 0;
        stGenerateRaw = async () => { calls++; throw Error(${JSON.stringify(message)}); };
        await assert.rejects(requestStandalone('prompt', 100), /${message}/);
        assert.equal(calls, 1);
    `);
}
scenario('invalid raw response is rejected without retry', String.raw`
    let calls = 0;
    stGenerateRaw = async () => { calls++; return {}; };
    await assert.rejects(requestStandalone('prompt', 100), /텍스트 응답/);
    assert.equal(calls, 1);
`);
scenario('unchanged quick input receives exactly one continuation', String.raw`
    await quickGenerate();
    assert.equal(input.value, 'Original\nAI answer');
    assert.equal(ui.entries.length, 0);
    assert.equal(ui.toast, false);
`);
scenario('edited quick input is preserved; manual insertion appends only AI text', String.raw`
    const job = deferred(); stGenerateRaw = () => job.promise;
    const pending = quickGenerate();
    input.value = 'Original plus new typing';
    job.resolve('AI answer'); await pending;
    assert.equal(input.value, 'Original plus new typing');
    assert.equal(ui.entries.length, 1);
    assert.equal(ui.entries[0].inputChanged, true);
    assert(insertDraftToInput(ui.entries[0].result, ui.entries[0]));
    assert.equal(input.value, 'Original plus new typing\nAI answer');
`);
scenario('cleared quick input is not repopulated automatically', String.raw`
    const job = deferred(); stGenerateRaw = () => job.promise;
    const pending = quickGenerate(); input.value = '';
    job.resolve('answer'); await pending;
    assert.equal(input.value, ''); assert.equal(ui.entries.length, 1);
`);
scenario('new typing in an initially empty quick input is preserved', String.raw`
    input.value = ''; const job = deferred(); stGenerateRaw = () => job.promise;
    const pending = quickGenerate(); input.value = 'New typing';
    job.resolve('answer'); await pending;
    assert.equal(input.value, 'New typing'); assert.equal(ui.entries.length, 1);
`);
scenario('chat mismatch blocks quick results even without chat-change event', String.raw`
    const job = deferred(); stGenerateRaw = () => job.promise;
    const pending = quickGenerate(); currentChat.chatId = 'B'; input.value = 'B draft';
    job.resolve('A answer'); await pending;
    assert.equal(input.value, 'B draft'); assert.equal(ui.entries.length, 0);
    assert.equal(ui.errors.length, 0); assert.equal(ui.toast, false);
`);
scenario('switching away and back still invalidates the old quick request', String.raw`
    const job = deferred(); stGenerateRaw = () => job.promise;
    const pending = quickGenerate();
    currentChat.chatId = 'B'; handleDraftChatChanged();
    currentChat.chatId = 'A'; handleDraftChatChanged();
    job.resolve('stale'); await pending;
    assert.equal(input.value, 'Original'); assert.equal(ui.entries.length, 0);
`);
scenario('late single result is not shown or added to another chat history', String.raw`
    const job = deferred(); stGenerateRaw = () => job.promise;
    const pending = runGenerate(...args); currentChat.chatId = 'B';
    job.resolve('stale'); await pending;
    assert.equal(ui.entries.length, 0); assert.equal(sessionHistory.length, 0);
    assert.equal(ui.loading, false);
`);
scenario('saved entry cannot be inserted into a different chat', String.raw`
    const entry = {userMessage:'Original', inputSnapshot:'Original', chatKey:getDraftChatKey()};
    currentChat.chatId = 'B'; input.value = 'B draft';
    assert.equal(insertDraftToInput('A answer', entry), false);
    assert.equal(input.value, 'B draft');
`);
scenario('normal result insertion also preserves edits made after generation', String.raw`
    await runGenerate(...args); input.value = 'Changed after result';
    assert(insertDraftToInput('answer', ui.entries[0]));
    assert.equal(input.value, 'Changed after result\nanswer');
`);
scenario('cancel during instruction translation prevents generation and loading revival', String.raw`
    getSettings().autoTranslateInst = true; args[0] = '지시';
    const job = deferred(); let calls = 0;
    stGenerateRaw = () => { calls++; return job.promise; };
    const pending = runGenerate(...args); cancelGeneration();
    job.resolve('Translated instruction'); await pending;
    assert.equal(calls, 1); assert.equal(ui.loading, false); assert.equal(ui.loadingCount, 1);
    assert.equal(ui.entries.length, 0); assert.equal(ui.errors.length, 0);
`);
scenario('cancelled translation failure does not fall through to a generation request', String.raw`
    getSettings().autoTranslateInst = true; args[0] = '지시';
    const job = deferred(); let calls = 0;
    stGenerateRaw = () => { calls++; return job.promise; };
    const pending = runGenerate(...args); cancelGeneration();
    job.reject(Error('network error')); await pending;
    assert.equal(calls, 1); assert.equal(ui.errors.length, 0); assert.equal(ui.loading, false);
`);
scenario('chat change during translation prevents the next request', String.raw`
    getSettings().autoTranslateInst = true; args[0] = '지시';
    const job = deferred(); let calls = 0;
    stGenerateRaw = () => { calls++; return job.promise; };
    const pending = runGenerate(...args); currentChat.chatId = 'B';
    job.resolve('Translated'); await pending;
    assert.equal(calls, 1); assert.equal(ui.entries.length, 0); assert.equal(ui.loading, false);
`);
scenario('cancel while generating ignores the result without retry', String.raw`
    const job = deferred(); let calls = 0;
    stGenerateRaw = () => { calls++; return job.promise; };
    const pending = quickGenerate(); cancelGeneration(); job.resolve('stale'); await pending;
    assert.equal(calls, 1); assert.equal(input.value, 'Original'); assert.equal(ui.toast, false);
`);
scenario('a stale request cannot hide a newer request loading state', String.raw`
    const first = deferred(), second = deferred(); let calls = 0;
    stGenerateRaw = () => ++calls === 1 ? first.promise : second.promise;
    const old = runGenerate(...args), current = runGenerate(...args);
    first.resolve('old'); await old;
    assert.equal(ui.loading, true); assert.equal(ui.entries.length, 0);
    second.resolve('new'); await current;
    assert.equal(ui.loading, false); assert.equal(ui.entries[0].result, 'new');
`);
scenario('profile receives its own abort signal and zero does not force 500 tokens', String.raw`
    const s = getSettings(); s.profileId = 'profile'; s.maxTokens = 0;
    let signal, calls = 0;
    stConnectionRequest = {sendRequest: (id,prompt,budget,options) => {
        calls++; assert.equal(budget, undefined); signal = options.signal;
        return new Promise((resolve,reject) => signal.addEventListener('abort', () => {
            const e=Error('cancelled'); e.name='AbortError'; reject(e);
        }));
    }};
    const pending = quickGenerate(); assert.equal(signal.aborted, false);
    cancelGeneration(); await pending;
    assert.equal(signal.aborted, true); assert.equal(calls, 1);
    assert.equal(ui.errors.length, 0); assert.equal(input.value, 'Original');
`);
scenario('three-result translation cancellation prevents all three generation requests', String.raw`
    getSettings().autoTranslateInst = true; args[0] = '지시';
    const jobs = [deferred(),deferred(),deferred()]; let calls = 0;
    stGenerateRaw = () => jobs[calls++].promise;
    const pending = runGenerateMulti(3,...args); cancelGeneration();
    jobs.forEach(j => j.resolve('Translated')); await pending;
    assert.equal(calls, 3); assert.equal(ui.multi.length, 0); assert.equal(ui.loading, false);
`);
scenario('three-result success and partial failure still work', String.raw`
    let calls = 0; stGenerateRaw = async () => { if (++calls === 2) throw Error('failed'); return 'result '+calls; };
    await runGenerateMulti(3,...args);
    assert.equal(calls, 3); assert.equal(ui.multi[0].results.length, 2);
    assert.equal(ui.multi[0].entry.inputSnapshot, 'Original'); assert.equal(ui.loading, false);
`);
scenario('none genre, saved instructions and normal translation remain intact', String.raw`
    const s=getSettings(); s.selectedGenre=s.genres.indexOf('none');s.autoSaveInstruction=true;s.lastInstruction='지시';s.autoTranslateInst=true;
    const prompts=[]; stGenerateRaw=async p=>{prompts.push(p.prompt);return prompts.length===1?'Saved instruction':'answer';};
    await quickGenerate();
    assert.equal(prompts.length,2); assert(prompts[1].includes('Saved instruction'));
    assert(!/Genre:|Keep the genre/.test(prompts[1])); assert.equal(input.value,'Original\nanswer');
`);
