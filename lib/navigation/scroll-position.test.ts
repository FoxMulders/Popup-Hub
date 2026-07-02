/**
 * Unit checks for scroll position preservation — run:
 *   npx tsx lib/navigation/scroll-position.test.ts
 */
import assert from 'node:assert/strict'
import {
  SCROLL_RESTORE_STORAGE_KEY,
  captureScrollPositions,
  clearStoredScrollSnapshot,
  readStoredScrollSnapshot,
  reloadPreservingScroll,
  restoreScrollPositions,
} from './scroll-position'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

type MockStorage = {
  store: Map<string, string>
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function createMockStorage(): MockStorage {
  const store = new Map<string, string>()
  return {
    store,
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
  }
}

function installDomMocks(options: {
  windowY?: number
  siteMainScroll?: number
  wizardScrolls?: number[]
}) {
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const previousSessionStorage = globalThis.sessionStorage

  let windowY = options.windowY ?? 0
  let siteMainScroll = options.siteMainScroll ?? 0
  const wizardScrolls = [...(options.wizardScrolls ?? [])]

  const siteMain = {
    get scrollTop() {
      return siteMainScroll
    },
    set scrollTop(value: number) {
      siteMainScroll = value
    },
  }

  const wizardNodes = wizardScrolls.map((initial) => {
    let scrollTop = initial
    return {
      get scrollTop() {
        return scrollTop
      },
      set scrollTop(value: number) {
        scrollTop = value
      },
    }
  })

  const docElement = {
    scrollTop: 0,
  }
  const body = {
    scrollTop: 0,
  }

  globalThis.window = {
    scrollY: windowY,
    scrollTo({ top }: { top: number }) {
      windowY = top
      ;(globalThis.window as { scrollY: number }).scrollY = top
    },
    requestAnimationFrame(callback: FrameRequestCallback) {
      callback(0)
      return 0
    },
    location: {
      reload() {
        reloadCalled = true
      },
    },
    sessionStorage: createMockStorage(),
  } as unknown as Window & typeof globalThis

  globalThis.sessionStorage = (globalThis.window as Window).sessionStorage

  globalThis.document = {
    documentElement: docElement,
    body,
    getElementById(id: string) {
      if (id === 'site-main') return siteMain
      return null
    },
    querySelectorAll(selector: string) {
      if (selector === '.setup-wizard-body') return wizardNodes
      return []
    },
  } as unknown as Document

  let reloadCalled = false

  return {
    get windowY() {
      return windowY
    },
    get siteMainScroll() {
      return siteMainScroll
    },
    get wizardScrolls() {
      return wizardNodes.map((node) => node.scrollTop)
    },
    get reloadCalled() {
      return reloadCalled
    },
    restore() {
      globalThis.window = previousWindow
      globalThis.document = previousDocument
      globalThis.sessionStorage = previousSessionStorage
    },
  }
}

console.log('scroll-position')

test('captureScrollPositions reads every scroll host', () => {
  const mocks = installDomMocks({ windowY: 240, siteMainScroll: 120, wizardScrolls: [48] })
  try {
    const snapshot = captureScrollPositions()
    assert.equal(snapshot.windowY, 240)
    assert.equal(snapshot.siteMain, 120)
    assert.deepEqual(snapshot.wizardBodies, [48])
  } finally {
    mocks.restore()
  }
})

test('restoreScrollPositions writes back to every scroll host', () => {
  const mocks = installDomMocks({ windowY: 0, siteMainScroll: 0, wizardScrolls: [0] })
  try {
    restoreScrollPositions({ windowY: 512, siteMain: 96, wizardBodies: [24] })
    assert.equal(mocks.windowY, 512)
    assert.equal(mocks.siteMainScroll, 96)
    assert.deepEqual(mocks.wizardScrolls, [24])
  } finally {
    mocks.restore()
  }
})

test('reloadPreservingScroll stores snapshot before reload', () => {
  const mocks = installDomMocks({ windowY: 333, siteMainScroll: 44, wizardScrolls: [11] })
  try {
    reloadPreservingScroll()
    assert.equal(mocks.reloadCalled, true)
    const raw = globalThis.sessionStorage.getItem(SCROLL_RESTORE_STORAGE_KEY)
    assert.ok(raw)
    const parsed = JSON.parse(raw!) as { windowY: number; siteMain?: number; wizardBodies: number[] }
    assert.equal(parsed.windowY, 333)
    assert.equal(parsed.siteMain, 44)
    assert.deepEqual(parsed.wizardBodies, [11])
  } finally {
    mocks.restore()
  }
})

test('readStoredScrollSnapshot returns null for invalid payloads', () => {
  const mocks = installDomMocks({})
  try {
    globalThis.sessionStorage.setItem(SCROLL_RESTORE_STORAGE_KEY, '{not json')
    assert.equal(readStoredScrollSnapshot(), null)
    globalThis.sessionStorage.setItem(
      SCROLL_RESTORE_STORAGE_KEY,
      JSON.stringify({ windowY: 'bad', wizardBodies: [] }),
    )
    assert.equal(readStoredScrollSnapshot(), null)
  } finally {
    mocks.restore()
  }
})

test('clearStoredScrollSnapshot removes saved payload', () => {
  const mocks = installDomMocks({})
  try {
    globalThis.sessionStorage.setItem(
      SCROLL_RESTORE_STORAGE_KEY,
      JSON.stringify({ windowY: 10, wizardBodies: [] }),
    )
    clearStoredScrollSnapshot()
    assert.equal(readStoredScrollSnapshot(), null)
  } finally {
    mocks.restore()
  }
})

console.log('All scroll-position tests passed.')
