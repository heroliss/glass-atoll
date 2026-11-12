// QA only: bounded observation of actual application frames. No canvas, device,
// query, resource, animation loop or render is created. Never use as a benchmark.
const active = new WeakSet();
const message = error => String(error?.message || error);
const assert = (condition, text) => { if (!condition) throw Error(text); };

export async function runRenderTimerGLTrace({gl, renderer, requestFrame, maxFrames = 3,
  timeoutMs = 3000, contextBefore = 24, contextAfter = 24, maxCalls = 300000,
  maxErrors = 128, maxQueryEvents = 512, signal} = {}) {
  gl ??= renderer?.getContext?.();
  assert(gl && typeof gl.getError === 'function', 'An actual WebGL context is required');
  assert(typeof requestFrame === 'function', 'requestFrame(callback|null) must own the exclusive one-shot main frame probe slot');
  assert(Number.isInteger(maxFrames) && maxFrames >= 1 && maxFrames <= 3, 'maxFrames must be 1..3');
  assert(Number.isFinite(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 3000, 'timeoutMs must be 100..3000');
  assert([contextBefore, contextAfter].every(n => Number.isInteger(n) && n >= 1 && n <= 64), 'context limits must be 1..64');
  assert(Number.isInteger(maxCalls) && maxCalls >= 1 && maxCalls <= 1000000, 'maxCalls must be 1..1000000');
  assert(Number.isInteger(maxErrors) && maxErrors >= 1 && maxErrors <= 256, 'maxErrors must be 1..256');
  assert(Number.isInteger(maxQueryEvents) && maxQueryEvents >= 1 && maxQueryEvents <= 2048, 'maxQueryEvents must be 1..2048');
  assert(!active.has(gl), 'A render-timer trace already owns this context');
  const started = performance.now();
  const report = {schema: 'glass-atoll.render-timer-GL-trace.v1', dateUTC: new Date().toISOString(),
    status: 'starting', diagnosticOnly: true, notPerformanceMeasurement: true,
    notAnErrorFreeAcceptance: true, maxFrames, timeoutMs,
    errorPolicy: 'Each reached application GL operation executes once. Native getError is drained after operations; unique pending flags are replayed to application getError. Undelivered virtual flags are reported at cleanup and cannot be restored to native GL without manufacturing errors.',
    limits: ['Probing changes synchronization, error observation timing and CPU cost; this is diagnosis, not performance or error-free acceptance.',
      'Only calls reached through wrapped context properties are observed. Previously captured native references and extension-object methods can bypass wrapping.',
      'First observed post-operation errors are attribution candidates; preexisting flags and helper metadata operations are labelled separately.',
      'Caller must exclusively own the one-shot frame probe slot. requestFrame registers a callback; it must not render. A pending owned callback is cleared on cleanup.',
      'Timeout is checked synchronously but JavaScript cannot interrupt a native call or an executing frame; cleanup occurs when control returns.'],
    entryErrors: [], nativeErrorEvents: [], callerGetErrorSamples: [], incidents: {},
    queryEvents: [], frames: [], headContext: [], tailContext: [], extensions: {},
    counts: {calls: 0, applicationCalls: 0, helperCalls: 0, byMethod: {}, nativeGetErrorCalls: 0,
      nativeZeroReads: 0, nativeErrorsByCode: {}, callerGetErrorCalls: 0,
      callerReturnsByCode: {}, virtualReplayReturns: 0, callerSamplesOmitted: 0, queryEventsOmitted: 0},
    cleanup: {methodDescriptorsRestored: false, frameProbeCleared: false}};
  if (signal?.aborted) { report.status = 'aborted-before-start'; return report; }
  active.add(gl);
  return await new Promise(resolve => {
    const originals = new Map(), patches = [], ids = new WeakMap(), enums = new Map();
    const ring = [], pending = [], pendingSet = new Set();
    const nativeGetError = gl.getError;
    let serial = 0, objectSerial = 0, finished = false, stopping = false, timer = null;
    let phase = 'entry', frameNumber = 0, callbackPending = false, lastFrameFirstSeq = 1;
    const errorNames = {0: 'NO_ERROR', 1280: 'INVALID_ENUM', 1281: 'INVALID_VALUE',
      1282: 'INVALID_OPERATION', 1285: 'OUT_OF_MEMORY', 1286: 'INVALID_FRAMEBUFFER_OPERATION', 37442: 'CONTEXT_LOST_WEBGL'};
    for (let proto = gl; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, name);
        if (name !== 'constructor' && typeof descriptor?.value === 'function' && !originals.has(name)) originals.set(name, gl[name]);
        if (/^[A-Z][A-Z0-9_]+$/.test(name) && typeof descriptor?.value === 'number') addEnum(name, descriptor.value);
      }
    }
    originals.set('getError', nativeGetError);
    function addEnum(name, value) { const names = enums.get(value) || []; if (names.length < 5 && !names.includes(name)) names.push(name); enums.set(value, names); }
    function concise(value) {
      if (value === null || value === undefined || typeof value === 'boolean') return value ?? null;
      if (typeof value === 'number') return Number.isFinite(value) ? (enums.has(value) ? {value, names: enums.get(value)} : value) : String(value);
      if (typeof value === 'string') return value.length > 140 ? value.slice(0, 137) + '...' : value;
      if (ArrayBuffer.isView(value)) return {type: value.constructor?.name, length: value.length ?? value.byteLength, bytes: value.byteLength,
        first: typeof value.length === 'number' ? Array.from(value.subarray?.(0, 8) || []) : undefined};
      if (value instanceof ArrayBuffer) return {type: 'ArrayBuffer', bytes: value.byteLength};
      if (Array.isArray(value)) return {type: 'Array', length: value.length, first: value.slice(0, 12).map(concise)};
      if (typeof value === 'object' || typeof value === 'function') {
        if (!ids.has(value)) ids.set(value, ++objectSerial);
        return {object: ids.get(value), type: Object.prototype.toString.call(value).slice(8, -1)};
      }
      return String(value).slice(0, 80);
    }
    function stack() { return new Error('GL trace call site').stack?.split('\n').slice(2, 12).join('\n'); }
    function remember(row) {
      for (const incident of Object.values(report.incidents)) if (row.seq > incident.trigger.seq && incident.after.length < contextAfter) incident.after.push(row);
      ring.push(row); if (ring.length > contextBefore + 1) ring.shift();
      if (report.headContext.length < contextBefore) report.headContext.push(row);
    }
    function incident(name, row) {
      if (!report.incidents[name]) report.incidents[name] = {trigger: row, before: ring.filter(r => r.seq < row.seq).slice(-contextBefore), after: []};
    }
    function newRow(method, args = [], helper = false) {
      const row = {seq: ++serial, frame: frameNumber, phase, method, args: Array.from(args).slice(0, 10).map(concise)};
      if (helper) row.helperDiagnostic = true;
      report.counts.calls++; report.counts[helper ? 'helperCalls' : 'applicationCalls']++;
      report.counts.byMethod[method] = (report.counts.byMethod[method] || 0) + 1;
      remember(row); return row;
    }
    function flag(code, source, row) {
      report.counts.nativeGetErrorCalls++;
      if (code === 0) { report.counts.nativeZeroReads++; return; }
      report.counts.nativeErrorsByCode[code] = (report.counts.nativeErrorsByCode[code] || 0) + 1;
      const event = {ordinal: report.nativeErrorEvents.length + 1, code, name: errorNames[code] || 'UNKNOWN_GL_ERROR', source,
        callSeq: row.seq, frame: row.frame, method: row.method, phase: row.phase, helperDiagnostic: !!row.helperDiagnostic};
      report.nativeErrorEvents.push(event); (row.nativeErrors ??= []).push(code);
      if (source === 'entry') report.entryErrors.push(code);
      if (!pendingSet.has(code)) { pending.push(code); pendingSet.add(code); }
      incident('firstNativeError', row);
      if (code === 1280 || code === 1282) { incident('first' + code, row); if (source !== 'entry') incident('firstPostEntry' + code, row); }
      row.stack ??= stack();
      if (report.nativeErrorEvents.length >= maxErrors) scheduleFinish('error-limit-reached');
    }
    function probe(source, row, terminal = false) {
      for (let n = 0; n < 16; n++) {
        const code = Reflect.apply(nativeGetError, gl, []); flag(code, source, row);
        if (code === 0) return; if (stopping && !terminal) return;
      }
      report.probeDrainLimitReached = true; scheduleFinish('error-drain-limit-reached');
    }
    function isQueryOperation(name, args) {
      return /Query/.test(name) || (name === 'getParameter' && args[0] === report.timerConstants?.GPU_DISJOINT_EXT) ||
        (name === 'getExtension' && /timer_query/i.test(String(args[0])));
    }
    function queryRow(row) {
      if (report.queryEvents.length < maxQueryEvents) { row.stack ??= stack(); report.queryEvents.push(row); }
      else report.counts.queryEventsOmitted++;
    }
    function wrapper(name, original) { return function (...args) {
      if (finished || stopping) return Reflect.apply(original, this, args);
      const row = newRow(name, args), query = isQueryOperation(name, args);
      if (query) queryRow(row);
      let result, completed = false;
      try { result = Reflect.apply(original, this, args); completed = true; row.result = concise(result); }
      catch (error) { row.threw = message(error); throw error; }
      finally {
        if (this === gl) {
          if (name === 'getError' && completed) { report.counts.callerGetErrorCalls++; flag(result, 'caller-getError', row); }
          else if (name !== 'getError') probe('post-call', row);
        } else row.foreignReceiver = true;
        if (serial >= maxCalls) scheduleFinish('call-limit-reached');
        else if ((serial & 127) === 0 && performance.now() - started >= timeoutMs) scheduleFinish('timed-out');
      }
      if (name === 'getError' && this === gl) {
        const returned = pending.length ? pending.shift() : result; pendingSet.delete(returned);
        report.counts.callerReturnsByCode[returned] = (report.counts.callerReturnsByCode[returned] || 0) + 1;
        if (returned !== result) report.counts.virtualReplayReturns++;
        row.nativeReturn = result; row.returned = returned;
        if (report.callerGetErrorSamples.length < 256) report.callerGetErrorSamples.push({seq: row.seq, native: result, returned});
        else report.counts.callerSamplesOmitted++;
        return returned;
      }
      return result;
    }; }
    function diagnostic(method, args = []) {
      const fn = originals.get(method); if (!fn) return null;
      const row = newRow(method, args, true); if (isQueryOperation(method, args)) queryRow(row);
      try { const result = Reflect.apply(fn, gl, args); row.result = concise(result); probe('helper-metadata', row, true); return result; }
      catch (error) { row.threw = message(error); return null; }
    }
    function contextSnapshot() {
      const out = {drawingBufferWidth: gl.drawingBufferWidth, drawingBufferHeight: gl.drawingBufferHeight};
      for (const name of ['CURRENT_PROGRAM', 'DRAW_FRAMEBUFFER_BINDING', 'READ_FRAMEBUFFER_BINDING', 'VERTEX_ARRAY_BINDING']) {
        if (typeof gl[name] === 'number') out[name] = concise(diagnostic('getParameter', [gl[name]]));
      }
      if (report.timerExtensionAvailable) {
        out.disjoint = diagnostic('getParameter', [report.timerConstants.GPU_DISJOINT_EXT]);
        if (typeof gl.CURRENT_QUERY === 'number') out.activeTimerQuery = concise(diagnostic('getQuery', [report.timerConstants.TIME_ELAPSED_EXT, gl.CURRENT_QUERY]));
      }
      return out;
    }
    function scheduleFinish(status) { if (finished || stopping) return; stopping = true; queueMicrotask(() => finish(status)); }
    function descriptorsEqual(a, b) { return a === undefined || b === undefined ? a === b : ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(k => a[k] === b[k]); }
    function finish(status, error) {
      if (finished) return; finished = true; phase = 'helper-exit';
      if (timer !== null) clearTimeout(timer); signal?.removeEventListener('abort', aborted);
      report.status = status; if (error) report.error = message(error);
      try { report.exitContext = contextSnapshot(); probe('tail', {seq: ++serial, frame: frameNumber, phase, method: 'native-tail-flags', args: [], helperDiagnostic: true}, true); }
      catch (caught) { report.tailProbeError = message(caught); }
      report.remainingVirtualFlags = pending.map(code => ({code, name: errorNames[code] || 'UNKNOWN_GL_ERROR'}));
      const restoreErrors = [];
      for (const patch of patches.slice().reverse()) {
        try {
          if (patch.previous) Object.defineProperty(gl, patch.name, patch.previous); else delete gl[patch.name];
          if (!descriptorsEqual(Object.getOwnPropertyDescriptor(gl, patch.name), patch.previous)) restoreErrors.push(patch.name + ': descriptor mismatch');
        } catch (caught) { restoreErrors.push(patch.name + ': ' + message(caught)); }
      }
      report.cleanup.methodDescriptorsRestored = restoreErrors.length === 0; report.cleanup.methodRestoreErrors = restoreErrors;
      try { if (callbackPending) requestFrame(null); report.cleanup.frameProbeCleared = true; }
      catch (caught) { report.cleanup.frameProbeError = message(caught); }
      callbackPending = false; report.tailContext = ring.slice(-contextBefore);
      report.elapsedMs = performance.now() - started; report.framesObserved = report.frames.length;
      report.patchedMethods = patches.map(p => p.name).sort(); report.cleanup.activeTraceReleased = true;
      active.delete(gl); resolve(report);
    }
    function aborted() { scheduleFinish('aborted'); }
    function frameProbe(frameStart) {
      callbackPending = false; if (finished || stopping) return;
      const number = ++frameNumber; phase = 'frame-' + number + '-before-endQuery';
      const marker = {seq: ++serial, frame: number, phase, method: 'main-frame-probe-before-endQuery', args: [concise(frameStart)]};
      remember(marker); probe('frame-probe', marker);
      const record = {number, frameStart, firstCallSeq: lastFrameFirstSeq, probeSeq: marker.seq}; report.frames.push(record);
      phase = 'frame-' + number + '-after-probe';
      if (number < maxFrames) { callbackPending = true; requestFrame(frameProbe); }
      queueMicrotask(() => {
        if (finished) return;
        record.afterEndQuerySeq = serial; record.observedErrors = report.nativeErrorEvents.filter(e => e.callSeq >= record.firstCallSeq && e.callSeq <= serial).map(e => ({code: e.code, callSeq: e.callSeq, method: e.method}));
        lastFrameFirstSeq = serial + 1;
        if (number >= maxFrames) finish('captured'); else phase = 'between-frames';
      });
    }
    try {
      probe('entry', {seq: 0, frame: 0, phase, method: 'preexisting-native-flags', args: []});
      phase = 'helper-entry';
      const extension = diagnostic('getExtension', ['EXT_disjoint_timer_query_webgl2']);
      report.timerExtensionAvailable = !!extension;
      if (extension) {
        const constants = {};
        for (let proto = extension; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
          for (const name of Object.getOwnPropertyNames(proto)) {
            const d = Object.getOwnPropertyDescriptor(proto, name);
            if (/^[A-Z][A-Z0-9_]+$/.test(name) && typeof d?.value === 'number') { constants[name] = d.value; addEnum(name, d.value); }
          }
        }
        report.extensions.EXT_disjoint_timer_query_webgl2 = constants;
        report.timerConstants = {...constants, QUERY_RESULT: gl.QUERY_RESULT, QUERY_RESULT_AVAILABLE: gl.QUERY_RESULT_AVAILABLE, CURRENT_QUERY: gl.CURRENT_QUERY};
      }
      report.entryContext = contextSnapshot();
      if (stopping) return;
      for (const [name, original] of originals) {
        const previous = Object.getOwnPropertyDescriptor(gl, name);
        Object.defineProperty(gl, name, {value: wrapper(name, original), writable: true, configurable: true, enumerable: previous?.enumerable ?? false});
        patches.push({name, previous});
      }
      phase = 'waiting-for-main-frame'; lastFrameFirstSeq = serial + 1;
      timer = setTimeout(() => scheduleFinish('timed-out'), timeoutMs);
      signal?.addEventListener('abort', aborted, {once: true});
      callbackPending = true; requestFrame(frameProbe);
    } catch (error) { finish('installation-or-request-failed', error); }
  });
}

export const traceRenderTimerGL = runRenderTimerGLTrace;
